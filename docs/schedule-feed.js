/* OBSで確認済みのJSONP。取得と日付監視を診断・本番ページで共用します。 */
var ScheduleFeed = (function () {
  "use strict";
  function create(options) {
    var active = null;
    var attempts = 0;
    var timer;
    var lastDay = ScheduleData.day(Date.now());
    function cancel() {
      if (active) active.cancel();
    }
    function request() {
      if (active || !options.endpoint) return;
      var task = { cleanup: function () {} };
      task.cancel = function () {
        task.cleanup();
        if (active === task) active = null;
      };
      active = task;
      attempts += 1;
      if (options.onAttempt) options.onAttempt(attempts);
      function fail(message) {
        if (active !== task) return;
        task.cancel();
        options.onFailure(message);
      }
      function receive(data) {
        if (active !== task) return;
        if (!ScheduleData.valid(data)) return fail("JSONの形式が仕様と一致しません。Apps Scriptの公開バージョンを確認してください");
        task.cancel();
        options.onSuccess(data);
      }
      var separator = options.endpoint.indexOf("?") === -1 ? "?" : "&";
      if (options.demo) {
        var xhr = new XMLHttpRequest();
        task.cleanup = function () {
          xhr.onload = xhr.onerror = xhr.ontimeout = null;
          xhr.abort();
        };
        xhr.open("GET", options.endpoint + separator + "_=" + Date.now(), true);
        xhr.withCredentials = false;
        xhr.timeout = ScheduleConfig.requestTimeoutMs;
        xhr.onload = function () {
          if (xhr.status < 200 || xhr.status >= 300) return fail("ダミーデータの取得失敗（HTTP " + xhr.status + "）");
          var data;
          try { data = JSON.parse(xhr.responseText); }
          catch (error) { return fail("ダミーデータをJSONとして読み取れませんでした"); }
          receive(data);
        };
        xhr.onerror = function () { fail("ダミーデータの通信失敗"); };
        xhr.ontimeout = function () { fail("ダミーデータの取得がタイムアウトしました"); };
        xhr.send();
        return;
      }
      var callback = ScheduleConfig.jsonpCallbackPrefix + attempts;
      var script = document.createElement("script");
      var timeout;
      task.cleanup = function () {
        clearTimeout(timeout);
        script.onload = script.onerror = null;
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[callback];
      };
      window[callback] = receive;
      script.async = true;
      // crossOriginは指定しません。OBSで失敗したCORSによる取得を再導入しないためです。
      script.src = options.endpoint + separator + "callback=" + encodeURIComponent(callback) + "&_=" + Date.now();
      script.onload = function () { fail("JSONPのデータを受け取れませんでした。Apps Scriptの公開バージョンを確認してください"); };
      script.onerror = function () { fail("JSONPの通信失敗。Apps Scriptの公開URLと応答形式を確認してください"); };
      timeout = setTimeout(function () { fail("JSONPの取得がタイムアウトしました"); }, ScheduleConfig.requestTimeoutMs);
      document.head.appendChild(script);
    }
    function start(endpoint) {
      cancel();
      if (timer) clearInterval(timer);
      options.endpoint = endpoint;
      request();
      timer = setInterval(request, ScheduleConfig.refreshMs);
    }
    setInterval(function () {
      var day = ScheduleData.day(Date.now());
      if (day !== lastDay) {
        lastDay = day;
        cancel();
        request();
      }
      if (options.onTick) options.onTick(Date.now());
    }, 1000);
    return { start: start, request: request };
  }
  return { create: create };
}());
