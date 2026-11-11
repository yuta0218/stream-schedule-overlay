(function () {
  "use strict";
  var demo = /(?:^|[?&])demo=1(?:&|$)/.test(window.location.search);
  var form = document.getElementById("connection");
  var input = document.getElementById("endpoint");
  var status = document.getElementById("status");
  var details = document.getElementById("details");
  var payload = document.getElementById("payload");
  var attempts = 0;
  var successes = 0;
  var lastSuccess = "未取得";
  function updateDetails() {
    details.textContent = "試行 " + attempts + "回・成功 " + successes +
      "回・最終成功 " + lastSuccess + "・自動更新 " + (ScheduleConfig.refreshMs / 60000) + "分ごと";
  }
  var feed = ScheduleFeed.create({
    demo: demo,
    onAttempt: function (count) {
      attempts = count;
      status.textContent = (demo ? "ダミー" : "実データ（JSONP）") + "：取得中";
      updateDetails();
    },
    onSuccess: function (data) {
      successes += 1;
      lastSuccess = ScheduleData.day(Date.now()) + " " + ScheduleData.time(Date.now());
      payload.textContent = JSON.stringify(data, null, 2);
      payload.hidden = false;
      status.textContent = demo ? "ダミーデータ取得成功（Apps Scriptとの接続は未検証）" : "実データ取得成功（JSONP）";
      updateDetails();
    },
    onFailure: function (message) {
      status.textContent = message + (successes ? "。直前のJSONを保持しています。" : "。JSONは未表示です。");
      updateDetails();
    }
  });
  input.value = ScheduleConfig.webAppUrl;
  form.hidden = demo;
  form.onsubmit = function (event) {
    event.preventDefault();
    var value = input.value.replace(/^\s+|\s+$/g, "");
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec$/.test(value)) {
      status.textContent = "末尾が /exec のApps Script公開URLを入力してください。";
      return;
    }
    feed.start(value);
  };
  feed.start(demo ? "demo.json" : ScheduleConfig.webAppUrl);
}());
