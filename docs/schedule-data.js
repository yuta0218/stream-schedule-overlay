/* 日時・検証・日付ごとの整形。端末のタイムゾーンに依存させません。 */
var ScheduleData = (function () {
  "use strict";
  function day(value) {
    return new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
  }
  function time(value) {
    return new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(11, 16);
  }
  function addDays(date, count) {
    return day(new Date(date + "T00:00:00+09:00").getTime() + count * 86400000);
  }
  function validDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }
  function valid(data) {
    if (!data || typeof data.generatedAt !== "string" || isNaN(Date.parse(data.generatedAt)) ||
        !Array.isArray(data.streams) || !Array.isArray(data.holidays)) return false;
    return data.streams.every(function (stream) {
      return stream && typeof stream.title === "string" &&
        typeof stream.start === "string" && typeof stream.end === "string" &&
        !isNaN(Date.parse(stream.start)) && Date.parse(stream.end) > Date.parse(stream.start);
    }) && data.holidays.every(function (holiday) {
      return holiday && validDate(holiday.date) && typeof holiday.name === "string";
    });
  }
  function label(stream, now) {
    if (day(stream.start) !== day(now)) return "";
    if (new Date(now).getTime() < Date.parse(stream.start)) return "今夜";
    return new Date(now).getTime() < Date.parse(stream.end) ? "配信中" : "";
  }
  function rows(data, first, count) {
    var result = [];
    for (var i = 0; i < count; i += 1) {
      var date = addDays(first, i);
      var weekday = new Date(date + "T00:00:00Z").getUTCDay();
      result.push({
        date: date, weekday: weekday,
        dateText: i === 0 || date.slice(8) === "01" ?
          Number(date.slice(5, 7)) + "/" + Number(date.slice(8)) : String(Number(date.slice(8))),
        streams: data.streams.filter(function (stream) { return day(stream.start) === date; })
          .sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); }),
        holidays: data.holidays.filter(function (holiday) { return holiday.date === date; })
          .map(function (holiday) { return holiday.name; })
      });
    }
    return result;
  }
  return { day: day, time: time, addDays: addDays, valid: valid, label: label, rows: rows };
}());
