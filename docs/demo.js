/* 架空の予定。Googleに接続せず、file://でも確認できます。 */
var ScheduleDemo = (function () {
  "use strict";
  var now = "2026-04-28T20:55:00+09:00";
  function data(busy) {
    var streams = [
      { start: "2026-04-28T21:00:00+09:00", end: "2026-04-28T22:00:00+09:00", title: "凶乱令嬢ニア・リストン #5 / チー付与 #6" },
      { start: "2026-05-02T21:00:00+09:00", end: "2026-05-02T22:00:00+09:00", title: "チー付与 #7 / 凶乱令嬢ニア・リストン #6" },
      { start: "2026-05-05T21:00:00+09:00", end: "2026-05-05T22:00:00+09:00", title: "チー付与 #8" }
    ];
    if (busy) {
      streams.push({ start: "2026-05-05T19:00:00+09:00", end: "2026-05-05T20:30:00+09:00", title: "作品A #1 / 作品B #2" });
      streams.push({ start: "2026-05-01T22:00:00+09:00", end: "2026-05-02T00:30:00+09:00", title: "月またぎ作品 #10" });
      streams.push({ start: "2026-05-09T20:00:00+09:00", end: "2026-05-09T23:00:00+09:00", title: "とても長い作品名でも省略せず折り返して表示するための見本 #12" });
    }
    return {
      generatedAt: now, streams: streams,
      holidays: [
        { date: "2026-04-29", name: "昭和の日" },
        { date: "2026-05-03", name: "憲法記念日" },
        { date: "2026-05-04", name: "みどりの日" },
        { date: "2026-05-05", name: "こどもの日" },
        { date: "2026-05-06", name: "憲法記念日 振替休日" }
      ]
    };
  }
  return { now: now, data: data };
}());
