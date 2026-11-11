/* 設定の正本。Apps Scriptには同じ内容を「Config.gs」として貼り付けます。 */
var ScheduleConfig = {
  expectedCalendarId: "yutasworks@gmail.com",
  timeZone: "Asia/Tokyo",
  locationContains: "twitch.tv/yuta0218",
  holidayCalendarId: "ja.japanese.official#holiday@group.v.calendar.google.com",
  days: 15,
  refreshMs: 5 * 60 * 1000,
  requestTimeoutMs: 20000,
  jsonpCallbackPrefix: "streamScheduleCallback_",
  webAppUrl: "https://script.google.com/macros/s/AKfycbz3Icy5rmNBrTkcZ1vThWgzvOXOnHHMJ5LwXdqQWh_dtCHkxx099TArdZH-qxJyrem2/exec"
};
