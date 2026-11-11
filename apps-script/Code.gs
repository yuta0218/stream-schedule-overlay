/** 取得検証用。公開するJSONは生成日時と対象配信の開始・終了・タイトルだけです。 */
function doGet() {
  // 失敗を空の予定に変換せず、ページ側の取得失敗として扱います。
  return ContentService.createTextOutput(JSON.stringify(buildPayload_(new Date())))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildPayload_(now) {
  // 会社用アカウントで誤って実行した場合は、予定を返す前に停止します。
  var primary = Calendar.Calendars.get("primary");
  if (primary.id !== ScheduleConfig.expectedCalendarId) {
    throw new Error("個人用アカウントのprimaryカレンダーを確認してください。");
  }

  var today = Utilities.formatDate(now, ScheduleConfig.timeZone, "yyyy-MM-dd");
  var from = new Date(today + "T00:00:00+09:00");
  var until = new Date(from.getTime() + ScheduleConfig.days * 86400000);
  var streams = [];
  var pageToken;
  do {
    var options = {
      timeMin: from.toISOString(),
      timeMax: until.toISOString(),
      timeZone: ScheduleConfig.timeZone,
      singleEvents: true,
      showDeleted: false,
      orderBy: "startTime",
      maxResults: 250,
      fields: "nextPageToken,items(status,location,summary,start,end)"
    };
    if (pageToken) options.pageToken = pageToken;
    var page = Calendar.Events.list("primary", options);
    (page.items || []).forEach(function (event) {
      if (event.status === "cancelled") return;
      if (typeof event.location !== "string" ||
          event.location.indexOf(ScheduleConfig.locationContains) === -1) return;
      // 時刻のない終日予定は、この配信時刻の検証には含めません。
      if (!event.start || !event.start.dateTime || !event.end || !event.end.dateTime) return;
      var start = new Date(event.start.dateTime);
      var end = new Date(event.end.dateTime);
      // APIのtimeMinは終了時刻の下限なので、開始日も明示的に絞ります。
      if (!(start >= from && start < until && end > start)) return;
      streams.push({
        start: formatDateTime_(start),
        end: formatDateTime_(end),
        title: event.summary || ""
      });
    });
    pageToken = page.nextPageToken;
  } while (pageToken);
  streams.sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
  return { generatedAt: formatDateTime_(now), streams: streams };
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, ScheduleConfig.timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
