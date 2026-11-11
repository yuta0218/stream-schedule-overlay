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
        assert.equal(value, 'primary');
        calls.push(options);
        return pages[calls.length - 1];
      } }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) { return { text, setMimeType() { return this; } }; }
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
  assert.deepEqual(Object.keys(result), ['generatedAt', 'streams']);
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
    document: { getElementById: id => elements[id] }, XMLHttpRequest: XHR,
    setInterval(fn, ms) { timers.push({ fn, ms }); return timers.length; }, clearInterval() {}
  });
  vm.runInContext(read('docs/config.js'), context);
  if (!configured) context.ScheduleConfig.webAppUrl = '';
  vm.runInContext(read('docs/probe.js'), context);
  return { elements, requests, timers, setClock(value) { clock = Date.parse(value); } };
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

test('日付変更で即時にGETし、認証Cookieを送らない', () => {
  const c = client(false);
  assert.equal(c.requests.length, 0);
  c.elements.endpoint.value = 'https://script.google.com/macros/s/test/exec';
  c.elements.connection.onsubmit({ preventDefault() {} });
  assert.equal(c.requests[0].withCredentials, false);
  assert.equal(c.requests[0].method, 'GET');
  c.setClock('2026-11-12T00:00:00+09:00');
  c.timers.find(t => t.ms === 1000).fn();
  assert.equal(c.requests[0].aborted, true);
  assert.equal(c.requests.length, 2);
});

test('公開URLの設定があれば操作なしで実データを取得し、ダミーでは公開URLを使わない', () => {
  const live = client(false, true);
  assert.equal(live.requests.length, 1);
  assert.match(live.requests[0].url, /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec\?_=/);
  assert.equal(live.requests[0].withCredentials, false);
  assert.equal(live.timers.find(t => t.ms === 300000).ms, 300000);
  const demo = client(true, true);
  assert.match(demo.requests[0].url, /^demo\.json\?_=/);
});
