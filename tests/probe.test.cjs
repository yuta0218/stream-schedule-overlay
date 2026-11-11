const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function server(pages, id = 'yutasworks@gmail.com') {
  const calls = [];
  const context = vm.createContext({
    Date,
    Utilities: { formatDate(date, zone, format) {
      assert.equal(zone, 'Asia/Tokyo');
      const text = new Date(date.getTime() + 9 * 3600000).toISOString();
      return format === 'yyyy-MM-dd' ? text.slice(0, 10) : text.slice(0, 19) + '+09:00';
    } },
    Calendar: {
      Calendars: { get(value) { assert.equal(value, 'primary'); return { id }; } },
      Events: { list(value, options) {
        if (value === 'ja.japanese.official#holiday@group.v.calendar.google.com') return { items: [] };
        assert.equal(value, 'primary');
        calls.push(options);
        return pages[calls.length - 1];
      } }
    },
    ContentService: {
      MimeType: { JSON: 'application/json', JAVASCRIPT: 'application/javascript' },
      createTextOutput(text) { return { text, setMimeType(type) { this.type = type; return this; } }; }
    }
  });
  vm.runInContext(read('docs/config.js') + '\n' + read('apps-script/Code.gs'), context);
  return { context, calls };
}

function event(title, start, location = 'https://www.twitch.tv/yuta0218', extras = {}) {
  return Object.assign({
    summary: title, location, start: { dateTime: start },
    end: { dateTime: new Date(Date.parse(start) + 3600000).toISOString() },
    description: '非公開の説明', attendees: [{ email: '非公開の連絡先' }], id: '非公開ID'
  }, extras);
}

test('場所欄だけで選び、複数ページを取得し、許可した項目だけを返す', () => {
  const { context, calls } = server([
    { items: [event('配信B', '2026-11-12T21:00:00+09:00'),
      event('秘密の予定', '2026-11-11T21:00:00+09:00', ''),
      event('twitch.tv/yuta0218', '2026-11-11T22:00:00+09:00', '別の場所'),
      event('削除済み', '2026-11-11T23:00:00+09:00', undefined, { status: 'cancelled' })], nextPageToken: '次ページ' },
    { items: [event('配信A', '2026-11-11T21:00:00+09:00')] }
  ]);
  const result = JSON.parse(JSON.stringify(context.buildPayload_(new Date('2026-11-11T00:00:00+09:00'))));
  assert.deepEqual(result.streams.map(s => s.title), ['配信A', '配信B']);
  assert.deepEqual(Object.keys(result), ['generatedAt', 'streams', 'holidays']);
  result.streams.forEach(s => assert.deepEqual(Object.keys(s), ['start', 'end', 'title']));
  assert.equal(calls[1].pageToken, '次ページ');
  assert.equal(JSON.stringify(result).includes('非公開'), false);
});

test('月またぎの15日間を開始時刻で絞り、前日・翌範囲・終日を除く', () => {
  const { context, calls } = server([{ items: [
    event('前日から継続', '2026-11-29T23:30:00+09:00'),
    event('初日', '2026-11-30T00:00:00+09:00'),
    event('最終日', '2026-12-14T23:59:00+09:00'),
    event('対象外', '2026-12-15T00:00:00+09:00'),
    event('終日', '2026-12-01T00:00:00+09:00', undefined, { start: { date: '2026-12-01' } })
  ] }]);
  const result = context.buildPayload_(new Date('2026-11-29T15:00:00Z'));
  assert.deepEqual(Array.from(result.streams, s => s.title), ['初日', '最終日']);
  assert.equal(calls[0].timeMin, '2026-11-29T15:00:00.000Z');
  assert.equal(calls[0].timeMax, '2026-12-14T15:00:00.000Z');
});

test('別アカウントなら予定を取得しない。Calendar失敗を空配列にしない', () => {
  const wrong = server([], 'company@example.com');
  assert.throws(() => wrong.context.doGet(), /個人用/);
  assert.equal(wrong.calls.length, 0);
  const failed = server([]);
  failed.context.Calendar.Events.list = () => { throw new Error('取得失敗'); };
  assert.throws(() => failed.context.doGet(), /取得失敗/);
  const manifest = JSON.parse(read('apps-script/appsscript.json'));
  assert.deepEqual(manifest.oauthScopes, ['https://www.googleapis.com/auth/calendar.readonly']);
});

function client(demo = true, configured = false) {
  const elements = Object.fromEntries(['connection', 'endpoint', 'status', 'details', 'payload']
    .map(id => [id, { textContent: '', hidden: id === 'payload', value: '' }]));
  const requests = [];
  const scripts = [];
  const timeouts = new Map();
  let nextTimeout = 0;
  const head = {
    appendChild(script) { scripts.push(script); script.parentNode = this; },
    removeChild(script) { script.parentNode = null; }
  };
  const timers = [];
  let clock = Date.parse('2026-11-11T23:59:59+09:00');
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  function XHR() { requests.push(this); }
  XHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
  XHR.prototype.send = function () {};
  XHR.prototype.abort = function () { this.aborted = true; };
  const context = vm.createContext({
    Date: FakeDate, window: { location: { search: demo ? '?demo=1' : '' } },
    document: { getElementById: id => elements[id], head, createElement(tag) {
      assert.equal(tag, 'script'); return {};
    } }, XMLHttpRequest: XHR,
    setInterval(fn, ms) { timers.push({ fn, ms }); return timers.length; }, clearInterval() {},
    setTimeout(fn, ms) { const id = ++nextTimeout; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timeouts.delete(id); }
  });
  vm.runInContext(read('docs/config.js'), context);
  if (!configured) context.ScheduleConfig.webAppUrl = '';
  vm.runInContext(read('docs/schedule-data.js') + '\n' + read('docs/schedule-feed.js') + '\n' + read('docs/probe.js'), context);
  return { elements, requests, scripts, timers, timeouts, context, setClock(value) { clock = Date.parse(value); } };
}

test('初回失敗は本文を隠す。成功後の失敗・不正JSONは前回の本文を保つ', () => {
  const { elements, requests, timers } = client();
  requests[0].onerror();
  assert.equal(elements.payload.hidden, true);
  const refresh = timers.find(t => t.ms === 300000);
  refresh.fn();
  requests[1].status = 200;
  requests[1].responseText = read('docs/demo.json');
  requests[1].onload();
  assert.equal(elements.payload.hidden, false);
  assert.match(elements.status.textContent, /接続は未検証/);
  const previous = elements.payload.textContent;
  refresh.fn();
  requests[2].status = 200;
  requests[2].responseText = '<html>ログイン</html>';
  requests[2].onload();
  assert.equal(elements.payload.textContent, previous);
  assert.match(elements.status.textContent, /保持/);
  refresh.fn();
  requests[3].status = 200;
  requests[3].responseText = '{}';
  requests[3].onload();
  assert.equal(elements.payload.textContent, previous);
  assert.match(elements.status.textContent, /形式/);
});

test('日付変更で処理中のJSONPを片付け、別の受け取り関数で即時に再取得する', () => {
  const c = client(false);
  assert.equal(c.requests.length, 0);
  c.elements.endpoint.value = 'https://script.google.com/macros/s/test/exec';
  c.elements.connection.onsubmit({ preventDefault() {} });
  assert.equal(c.requests.length, 0);
  const first = c.scripts[0];
  const oldName = new URL(first.src).searchParams.get('callback');
  const oldReceive = c.context.window[oldName];
  c.setClock('2026-11-12T00:00:00+09:00');
  c.timers.find(t => t.ms === 1000).fn();
  assert.equal(first.parentNode, null);
  assert.equal(c.context.window[oldName], undefined);
  assert.equal(c.scripts.length, 2);
  const newName = new URL(c.scripts[1].src).searchParams.get('callback');
  assert.notEqual(oldName, newName);
  oldReceive(JSON.parse(read('docs/demo.json')));
  assert.equal(c.elements.payload.hidden, true);
  assert.equal(c.timeouts.size, 1);
});

test('公開URLの設定があれば操作なしで実データを取得し、ダミーでは公開URLを使わない', () => {
  const live = client(false, true);
  assert.equal(live.requests.length, 0);
  assert.equal(live.scripts.length, 1);
  assert.match(live.scripts[0].src, /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec\?callback=streamScheduleCallback_1&_=/);
  assert.equal(live.scripts[0].crossOrigin, undefined);
  assert.equal(live.timers.find(t => t.ms === 300000).ms, 300000);
  const demo = client(true, true);
  assert.match(demo.requests[0].url, /^demo\.json\?_=/);
  assert.equal(demo.requests[0].withCredentials, false);
  assert.equal(demo.scripts.length, 0);
});

test('JSONとJSONPが同じ公開項目を返し、JSONPも対象外予定を含めない', () => {
  const start = new Date(Date.now() + 3600000).toISOString();
  const pages = () => [{ items: [event('公開する配信\u2028次の行\u2029続き', start),
    event('非公開予定', start, '')] }];
  const normal = server(pages()).context.doGet();
  assert.equal(normal.type, 'application/json');
  const jsonp = server(pages()).context.doGet({ parameter: { callback: 'streamScheduleCallback_1' } });
  assert.equal(jsonp.type, 'application/javascript');
  assert.equal(jsonp.text.includes('\u2028'), false);
  assert.equal(jsonp.text.includes('\u2029'), false);
  let delivered;
  vm.runInNewContext(jsonp.text, { streamScheduleCallback_1(data) { delivered = data; } });
  assert.deepEqual(JSON.parse(JSON.stringify(delivered.streams)), JSON.parse(normal.text).streams);
  assert.equal(jsonp.text.includes('非公開'), false);
  assert.deepEqual(Object.keys(delivered), ['generatedAt', 'streams', 'holidays']);
});

test('不正なJSONP関数名はカレンダーを読む前に拒否する', () => {
  for (const callback of ['', 'alert', 'streamScheduleCallback_', 'streamScheduleCallback_1.foo',
    'streamScheduleCallback_1);alert(1)//']) {
    const c = server([]);
    let reads = 0;
    c.context.Calendar.Calendars.get = () => { reads += 1; return { id: 'yutasworks@gmail.com' }; };
    assert.throws(() => c.context.doGet({ parameter: { callback } }), /受け取り関数名/);
    assert.equal(reads, 0);
  }
});

function deliver(c, index, data) {
  const script = c.scripts[index];
  const onload = script.onload;
  const callback = new URL(script.src).searchParams.get('callback');
  c.context.window[callback](data);
  onload();
}

test('JSONPの成功・再取得・通信失敗・タイムアウトで表示と後始末が正しい', () => {
  const c = client(false, true);
  const refresh = c.timers.find(t => t.ms === 300000);
  c.scripts[0].onerror();
  assert.equal(c.elements.payload.hidden, true);
  assert.equal(c.scripts[0].parentNode, null);
  assert.equal(c.timeouts.size, 0);
  refresh.fn();
  const data = JSON.parse(read('docs/demo.json'));
  deliver(c, 1, data);
  assert.match(c.elements.status.textContent, /実データ取得成功（JSONP）/);
  assert.match(c.elements.details.textContent, /成功 1回/);
  assert.equal(c.timeouts.size, 0);
  assert.equal(c.scripts[1].parentNode, null);
  const previous = c.elements.payload.textContent;
  refresh.fn();
  Array.from(c.timeouts.values())[0].fn();
  assert.match(c.elements.status.textContent, /タイムアウト/);
  assert.equal(c.elements.payload.textContent, previous);
  assert.equal(c.scripts[2].parentNode, null);
  refresh.fn();
  deliver(c, 3, {});
  assert.match(c.elements.status.textContent, /形式/);
  assert.equal(c.elements.payload.textContent, previous);
  refresh.fn();
  data.generatedAt = '2026-11-12T00:01:00+09:00';
  deliver(c, 4, data);
  assert.match(c.elements.details.textContent, /成功 2回/);
  assert.match(c.elements.payload.textContent, /2026-11-12T00:01/);
  assert.deepEqual(Object.keys(c.context.window), ['location']);
});

test('古い公開版など、読み込みだけ成功してデータが届かない場合も失敗として扱う', () => {
  const c = client(false, true);
  c.scripts[0].onload();
  assert.match(c.elements.status.textContent, /公開バージョン/);
  assert.equal(c.elements.payload.hidden, true);
  assert.equal(c.timeouts.size, 0);
});

test('祝日専用カレンダーを全ページ読み、範囲内の日付と名前だけを返す', () => {
  const c = server([]);
  const holidayCalls = [];
  const holiday = (date, end, name, extra = {}) => Object.assign({
    start: { date }, end: { date: end }, summary: name,
    id: '非公開ID', description: '非公開説明', location: '非公開場所'
  }, extra);
  c.context.Calendar.Events.list = (id, options) => {
    if (id === 'primary') return { items: [] };
    assert.equal(id, 'ja.japanese.official#holiday@group.v.calendar.google.com');
    holidayCalls.push(options);
    if (!options.pageToken) return { items: [
      holiday('2026-04-29', '2026-04-30', '昭和の日'),
      holiday('2026-05-03', '2026-05-04', '憲法記念日'),
      holiday('2026-04-27', '2026-04-28', '範囲外'),
      holiday('2026-05-13', '2026-05-14', '範囲外'),
      holiday('2026-05-04', '2026-05-05', '削除済み', { status: 'cancelled' })
    ], nextPageToken: '次の祝日' };
    return { items: [holiday('2026-05-06', '2026-05-07', '憲法記念日 振替休日')] };
  };
  const result = JSON.parse(JSON.stringify(c.context.buildPayload_(new Date('2026-04-28T20:00:00+09:00'))));
  assert.deepEqual(result.holidays, [
    { date: '2026-04-29', name: '昭和の日' },
    { date: '2026-05-03', name: '憲法記念日' },
    { date: '2026-05-06', name: '憲法記念日 振替休日' }
  ]);
  assert.equal(holidayCalls[1].pageToken, '次の祝日');
  assert.equal(holidayCalls[0].timeMax, '2026-05-12T15:00:00.000Z');
  assert.equal(JSON.stringify(result).includes('非公開'), false);
});

test('配信取得が成功しても祝日取得が失敗したら、不完全な成功応答を返さない', () => {
  const c = server([]);
  c.context.Calendar.Events.list = id => {
    if (id === 'primary') return { items: [] };
    throw new Error('祝日取得失敗');
  };
  assert.throws(() => c.context.doGet(), /祝日取得失敗/);
});
