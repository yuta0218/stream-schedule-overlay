const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', 'docs', name), 'utf8');

// DOMの組み立てと表示保持を、通信タイミングと時計を制御して確認します。
function app(search = '', clockValue = '2026-04-28T20:55:00+09:00') {
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.hidden = false; this.attributes = {}; }
    appendChild(node) {
      if (node.tag === 'fragment') {
        for (const child of [...node.children]) this.appendChild(child);
      } else { this.children.push(node); node.parentNode = this; }
      return node;
    }
    removeChild(node) { this.children.splice(this.children.indexOf(node), 1); node.parentNode = null; }
    setAttribute(name, value) { this.attributes[name] = value; }
    get firstChild() { return this.children[0] || null; }
  }
  const nodes = { schedule: new Node('section'), days: new Node('div') };
  nodes.schedule.hidden = true;
  const head = new Node('head');
  const timers = [];
  const timeouts = new Map();
  let clock = Date.parse(clockValue);
  let nextTimeout = 0;
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const context = vm.createContext({
    Date: FakeDate, window: { location: { search }, console: { warn() {} } },
    document: { getElementById: id => nodes[id], head,
      createElement: tag => new Node(tag), createDocumentFragment: () => new Node('fragment') },
    setInterval(fn, ms) { timers.push({ fn, ms }); return timers.length; }, clearInterval() {},
    setTimeout(fn, ms) { const id = ++nextTimeout; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timeouts.delete(id); }
  });
  vm.runInContext(['config.js', 'schedule-data.js', 'schedule-feed.js', 'demo.js', 'overlay.js'].map(read).join('\n'), context);
  function find(node, className) {
    return [ ...(String(node.className || '').split(' ').includes(className) ? [node] : []),
      ...node.children.flatMap(child => find(child, className)) ];
  }
  function receive(data) {
    const script = head.children[0];
    const callback = new URL(script.src).searchParams.get('callback');
    context.window[callback](data);
  }
  return { nodes, head, context, timers, timeouts, find, receive,
    setClock(value) { clock = Date.parse(value); },
    tick() { timers.find(t => t.ms === 1000).fn(); },
    refresh() { timers.find(t => t.ms === 300000).fn(); } };
}
const plain = obj => JSON.parse(JSON.stringify(obj));

test('15日分・月またぎ・祝日・時刻順の複数配信を、端末のタイムゾーンと無関係に整形する', () => {
  const c = app('?demo=1&busy=1');
  const rows = c.context.ScheduleData.rows(c.context.ScheduleDemo.data(true), '2026-04-28', 15);
  assert.equal(rows.length, 15);
  assert.equal(rows[0].dateText, '4/28');
  assert.equal(rows[3].dateText, '5/1');
  assert.equal(rows[14].date, '2026-05-12');
  assert.deepEqual(plain(rows[7].streams.map(s => c.context.ScheduleData.time(s.start))), ['19:00', '21:00']);
  assert.deepEqual(plain(rows[7].holidays), ['こどもの日']);
  assert.equal(rows[4].weekday, 6);
  assert.equal(rows[5].weekday, 0);
  assert.equal(c.context.ScheduleData.day('2026-04-30T15:00:00Z'), '2026-05-01');
  assert.equal(c.context.ScheduleData.time('2026-04-28T12:00:00Z'), '21:00');
  assert.equal(c.head.children.length, 0, 'ダミー表示はGoogleへ接続しない');
});

test('今夜・配信中・終了後のラベルは、開始と終了の境界で切り替わる', () => {
  const c = app('?demo=1');
  const stream = c.context.ScheduleDemo.data(false).streams[0];
  const label = c.context.ScheduleData.label;
  assert.equal(label(stream, '2026-04-28T20:59:59+09:00'), '今夜');
  assert.equal(label(stream, '2026-04-28T21:00:00+09:00'), '配信中');
  assert.equal(label(stream, '2026-04-28T21:59:59+09:00'), '配信中');
  assert.equal(label(stream, '2026-04-28T22:00:00+09:00'), '');
  assert.equal(label(stream, '2026-04-29T00:00:00+09:00'), '');
});

test('タイトルを作品ごとに分け、祝日を同じ行に加え、HTMLとして実行しない', () => {
  const c = app();
  const data = plain(c.context.ScheduleDemo.data(false));
  data.streams[0].title = '<img src=x onerror=alert(1)> / チー付与 #6';
  c.receive(data);
  assert.equal(c.nodes.schedule.hidden, false);
  assert.equal(c.nodes.days.children.length, 15);
  const first = c.nodes.days.children[0];
  assert.deepEqual(c.find(first, 'stream-title').map(n => n.textContent), ['<img src=x onerror=alert(1)>', 'チー付与 #6']);
  assert.equal(c.find(c.nodes.days.children[7], 'holiday-name')[0].textContent, 'こどもの日');
  assert.match(c.nodes.days.children[7].className, /has-stream is-holiday/);
  assert.equal(c.find(c.nodes.days, 'stream-time').some(n => n.textContent === '22:00'), false, '終了時刻は表示しない');
  c.setClock('2026-04-28T21:00:00+09:00');
  c.tick();
  assert.equal(c.find(first, 'stream-label')[0].textContent, '配信中');
  c.setClock('2026-04-28T22:00:00+09:00');
  c.tick();
  assert.equal(c.find(first, 'stream-label')[0].hidden, true);
  assert.equal(c.nodes.days.children[0], first, '終了後も当日の配信を残す');
});

test('初回失敗は透明、更新失敗は前回のDOMを保持し、日付変更で即時再取得する', () => {
  const c = app();
  c.head.children[0].onerror();
  assert.equal(c.nodes.schedule.hidden, true);
  assert.equal(c.nodes.days.children.length, 0);
  c.refresh();
  c.receive(plain(c.context.ScheduleDemo.data(false)));
  const first = c.nodes.days.children[0];
  c.refresh();
  c.head.children[0].onerror();
  assert.equal(c.nodes.days.children[0], first);
  c.setClock('2026-04-29T00:00:00+09:00');
  c.tick();
  assert.equal(c.head.children.length, 1, '日付が変わったら即時に取得する');
  c.head.children[0].onerror();
  assert.equal(c.nodes.days.children[0], first, '日付変更時も取得失敗なら前回を保持する');
  c.refresh();
  c.receive(plain(c.context.ScheduleDemo.data(false)));
  assert.equal(c.nodes.days.children[0].attributes['data-date'], '2026-04-29');
  assert.equal(c.nodes.days.children[14].attributes['data-date'], '2026-05-13');
});

test('祝日のない旧公開版や不正な日付は成功扱いせず、表示を上書きしない', () => {
  const c = app();
  const data = plain(c.context.ScheduleDemo.data(false));
  const old = { generatedAt: data.generatedAt, streams: data.streams };
  c.receive(old);
  assert.equal(c.nodes.schedule.hidden, true);
  c.refresh(); c.receive(data);
  const previous = c.nodes.days.children[0];
  data.holidays[0].date = '2026-02-30';
  c.refresh(); c.receive(data);
  assert.equal(c.nodes.days.children[0], previous);
});
