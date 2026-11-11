(function () {
  "use strict";
  var panel = document.getElementById("schedule");
  var container = document.getElementById("days");
  var demo = /(?:^|[?&])demo=1(?:&|$)/.test(window.location.search);
  var busy = /(?:^|[?&])busy=1(?:&|$)/.test(window.location.search);
  var state = /(?:^|[?&])state=(live|ended)(?:&|$)/.exec(window.location.search);
  var labels = [];

  function element(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function updateLabels(now) {
    labels.forEach(function (entry) {
      var text = ScheduleData.label(entry.stream, now);
      if (entry.node.textContent !== text) entry.node.textContent = text;
      entry.node.hidden = !text;
    });
  }
  function render(data, now) {
    var rows = ScheduleData.rows(data, ScheduleData.day(now), ScheduleConfig.days);
    var fragment = document.createDocumentFragment();
    labels = [];
    rows.forEach(function (row) {
      var className = "schedule-row";
      if (row.streams.length) className += " has-stream";
      if (row.holidays.length) className += " is-holiday";
      if (row.weekday === 0) className += " is-sunday";
      if (row.weekday === 6) className += " is-saturday";
      var line = element("div", className);
      line.setAttribute("data-date", row.date);
      line.appendChild(element("div", "date", row.dateText));
      line.appendChild(element("div", "weekday", "日月火水木金土".charAt(row.weekday)));
      var content = element("div", "content");
      row.streams.forEach(function (stream) {
        var block = element("div", "stream");
        var meta = element("div", "stream-meta");
        meta.appendChild(element("span", "stream-time", ScheduleData.time(stream.start)));
        var label = element("span", "stream-label");
        labels.push({ node: label, stream: stream });
        meta.appendChild(label);
        block.appendChild(meta);
        stream.title.split(" / ").forEach(function (title) {
          block.appendChild(element("div", "stream-title", title));
        });
        content.appendChild(block);
      });
      row.holidays.forEach(function (name) { content.appendChild(element("div", "holiday-name", name)); });
      line.appendChild(content);
      fragment.appendChild(line);
    });
    // 応答全体を検証した後で描画します。失敗時に前回のDOMを消しません。
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(fragment);
    updateLabels(now);
    panel.hidden = false;
  }
  if (demo) {
    var now = Date.parse(ScheduleDemo.now);
    if (state) now = Date.parse("2026-04-28T" + (state[1] === "live" ? "21:30:00" : "22:00:00") + "+09:00");
    render(ScheduleDemo.data(busy), now);
    return;
  }
  var feed = ScheduleFeed.create({
    onSuccess: function (data) { render(data, Date.now()); },
    onFailure: function (message) {
      // 配信画面には診断メッセージを重ねず、初回は透明、以降は前回表示を保ちます。
      if (window.console) window.console.warn(message);
    },
    onTick: updateLabels
  });
  feed.start(ScheduleConfig.webAppUrl);
}());
