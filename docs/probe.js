(function () {
  "use strict";
  var demo = /(?:^|[?&])demo=1(?:&|$)/.test(window.location.search);
  var form = document.getElementById("connection");
  var input = document.getElementById("endpoint");
  var status = document.getElementById("status");
  var details = document.getElementById("details");
  var payload = document.getElementById("payload");
  var endpoint = demo ? "demo.json" : ScheduleConfig.webAppUrl;
  var active = null;
  var attempts = 0;
  var successes = 0;
  var lastSuccess = "未取得";
  var lastDay = tokyoDay();
  var refreshTimer;

  function tokyoDay() {
    return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  }

  function tokyoTime() {
    return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 19).replace("T", " ");
  }

  function updateDetails() {
    details.textContent = "試行 " + attempts + "回・成功 " + successes +
      "回・最終成功 " + lastSuccess + "・自動更新 " + (ScheduleConfig.refreshMs / 60000) + "分ごと";
  }

  function validPayload(data) {
    if (!data || typeof data.generatedAt !== "string" || isNaN(Date.parse(data.generatedAt)) ||
        !Array.isArray(data.streams)) return false;
    return data.streams.every(function (stream) {
      return stream && typeof stream.title === "string" &&
        typeof stream.start === "string" && typeof stream.end === "string" &&
        !isNaN(Date.parse(stream.start)) && Date.parse(stream.end) > Date.parse(stream.start);
    });
  }

  function request() {
    if (!endpoint || active) return;
    var xhr = new XMLHttpRequest();
    active = xhr;
    attempts += 1;
    status.textContent = (demo ? "ダミー" : "実データ") + "：取得中";
    updateDetails();

    function fail(message) {
      active = null;
      status.textContent = message + (successes ? "。直前のJSONを保持しています。" : "。JSONは未表示です。");
      updateDetails();
    }

    xhr.open("GET", endpoint + (endpoint.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now(), true);
    xhr.withCredentials = false;
    xhr.timeout = ScheduleConfig.requestTimeoutMs;
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) return fail("取得失敗（HTTP " + xhr.status + "）");
      var data;
      try { data = JSON.parse(xhr.responseText); }
      catch (error) { return fail("JSONを取得できませんでした。公開設定と権限許可を確認してください"); }
      if (!validPayload(data)) return fail("JSONの形式が検証用の仕様と一致しません");
      active = null;
      successes += 1;
      lastSuccess = tokyoTime();
      payload.textContent = JSON.stringify(data, null, 2);
      payload.hidden = false;
      status.textContent = demo ? "ダミーデータ取得成功（Apps Scriptとの接続は未検証）" : "実データ取得成功";
      updateDetails();
    };
    xhr.onerror = function () { fail("通信失敗。接続・公開設定・CORSを確認してください"); };
    xhr.ontimeout = function () { fail("取得がタイムアウトしました"); };
    xhr.send();
  }

  function start() {
    if (refreshTimer) clearInterval(refreshTimer);
    request();
    refreshTimer = setInterval(request, ScheduleConfig.refreshMs);
  }

  input.value = ScheduleConfig.webAppUrl;
  form.hidden = demo;
  form.onsubmit = function (event) {
    event.preventDefault();
    var value = input.value.replace(/^\s+|\s+$/g, "");
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec$/.test(value)) {
      status.textContent = "末尾が /exec のApps Script公開URLを入力してください。";
      return;
    }
    if (active) { active.abort(); active = null; }
    endpoint = value;
    start();
  };
  // 通信とは別に日付を監視し、日付が変わったら直ちに再取得します。
  setInterval(function () {
    var day = tokyoDay();
    if (day !== lastDay) {
      lastDay = day;
      if (active) { active.abort(); active = null; }
      request();
    }
  }, 1000);
  if (endpoint) start();
}());
