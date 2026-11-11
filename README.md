# 配信予定オーバーレイ

個人のアニメ同時視聴配信で、今後15日分の配信予定をOBSに重ねて表示します。Apps Scriptは個人用Googleカレンダーを読み取り、GitHub Pagesの静的ページへJSON・JSONPで返します。予定の登録・変更は行いません。

- リポジトリ: [yuta0218/stream-schedule-overlay](https://github.com/yuta0218/stream-schedule-overlay)
- 本番表示: [配信予定の帯](https://yuta0218.github.io/stream-schedule-overlay/)
- 通信診断: [取得検証ページ](https://yuta0218.github.io/stream-schedule-overlay/probe.html)
- Pages公開元: `feature/connection-probe` ブランチの `/docs`。ビルド工程・依存ライブラリなし。

## 表示と更新

- 今日を含む15日間を、Asia/Tokyo固定で1日1行に表示します。端末側のタイムゾーンには依存しません。
- 場所欄に `twitch.tv/yuta0218` を含む時刻付き予定だけが対象です。判定はApps Scriptで行い、タイトルや説明での検索はしません。
- 同じ日の配信は開始時刻順。開始時刻とタイトルを表示し、終了時刻は表示しません。タイトルは ` / ` ごとに作品の行を分けます。長い作品名は省略せず折り返します。
- 当日の配信には開始前「今夜」、開始時刻から終了時刻直前まで「配信中」を表示します。終了後も当日の行は残ります。ラベルは通信とは別に毎秒確認します。
- 祝日名を表示し、祝日の日付は赤。曜日は土曜が青、日曜が赤。先頭行と毎月1日には月を表示します。
- 5分ごとに取得し直します。日付変更は毎秒監視し、変わったら直ちに取得します。
- 取得・形式検証に失敗したら直前の帯を保持します。初回成功までは見出しや日付も出さず、ページ全体が透明です。日付変更時の取得失敗でも、成功するまでは前回の帯を保持します。
- JSONPを利用し、OBSで失敗したGoogleへのXHRによるCORS事前確認を使いません。タイトル・祝日名はHTMLではなくテキストとして描画します。

板は幅432px、背景 `rgba(16,18,28,.86)`、枠2px、角丸16px、余白18px・21px。見出し20px、日付・曜日18px、作品名22px・600、時刻・ラベル16pxです。配色とフォントは合意した表示基準に合わせています。

## OBSの設定

1. ブラウザソースのURLを本番表示のURLにする。Googleへのログインは不要です。
2. 幅440px・高さ900pxを指定する。板は左右4pxの余白を取り、ブラウザソースの下端に配置されます。
3. 15日分が収まらなければ、文字や日数を変えず、ブラウザソースの高さを増やす。板の高さは配信件数・作品数・折り返しで変わります。
4. 配信画面内の位置はOBSでソースを移動して決める。
5. 通信の確認は `probe.html` を別のブラウザソースか一時的なURL変更で開き、5分後に成功回数と最終成功時刻が進むことを確認する。確認後は本番URLに戻す。

背景は透明です。ブラウザでは透明部分が白く見える場合があります。OBSで追加の背景色指定は不要です。

## ダミーデータで見た目を確認する

`?demo=1` を付けるとGoogleへ接続せず、架空の予定で表示できます。プロジェクトのルートでローカルHTTPサーバーを起動します。

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

| URLの末尾 | 確認する内容 |
| --- | --- |
| `/?demo=1` | 4月28日から15日間。3配信・祝日のみの日・配信と祝日の同日表示・月またぎ・土日・今夜 |
| `/?demo=1&state=live` | 当日の配信中 |
| `/?demo=1&state=ended` | 終了後も当日の配信を残し、ラベルを外す |
| `/?demo=1&busy=1` | 同日複数配信の時刻順・長い作品名・900pxを超える高さ |
| `/probe.html?demo=1` | 通信診断用の固定JSON。HTTPサーバーが必要 |

例: `http://127.0.0.1:8765/?demo=1`。本番の帯に操作ボタンは表示しません。ダミーの時計は各見本の時刻に固定し、再現できるようにしています。MacのChromeでは通常の見本は約805px、件数を増やした見本は約1,075pxでした。Windowsのフォントや実際の作品名では高さが変わります。

## Apps Scriptを祝日対応版に更新する

**Pagesを本番の帯へ更新する前に、Apps Scriptを更新してください。** 旧公開版は `holidays` を返さないため、本番ページは不完全な応答として表示しません。

1. `yutasworks@gmail.com` の既存Apps Scriptプロジェクトを開く。
2. `コード.gs` を [apps-script/Code.gs](apps-script/Code.gs) の全文で置き換える。
3. `Config.gs` を [docs/config.js](docs/config.js) の全文で置き換える。設定の正本は `docs/config.js` です。`holidayCalendarId` が追加されています。
4. 保存し、エディターから `doGet` を実行する。失敗したら実行履歴を確認する。祝日の取得失敗を空の祝日一覧には置き換えません。
5. デプロイ → デプロイを管理 → 既存Webアプリの鉛筆 → 新バージョン → デプロイ。実行ユーザー「自分」、アクセス「全員」を維持し、既存の `/exec` URLを使う。
6. 公開URLを開き、`generatedAt`・`streams`・`holidays` があることを確認する。11月11日からの範囲では、祝日は11月23日の「勤労感謝の日」だけになる。
7. 本人承認を経てPagesを更新し、通信診断ページと本番表示を確認する。

初回作成時のマニフェストは [apps-script/appsscript.json](apps-script/appsscript.json)。Calendar v3の高度なサービス、タイムゾーン `Asia/Tokyo`、`calendar.readonly` のみの設定です。今回スコープを増やしていないため、既存マニフェストの変更は不要です。

設定を変更したときは `docs/config.js` とApps Scriptの `Config.gs` を同じ内容にし、Apps Scriptを再公開してください。設定は手動同期です。OBS・表示ページはGoogleへのログインを行いません。

## 祝日の取得元と公開項目

祝日専用の公開カレンダー `ja.japanese.official#holiday@group.v.calendar.google.com` を使います。通常版 `ja.japanese#holiday@group.v.calendar.google.com` には、七五三などの行事が入るため使いません。祝日専用版は振替休日・国民の休日も含みます。

2026年11月11日に両方の公開ICSを読み比べました。祝日専用版の2026年の18日分は、内閣府の国民の祝日・休日の一覧と日付が一致しました。七五三・クリスマス・銀行休業日・大晦日は含まれていません。Google側の祝日情報は更新されるため、表示年の情報は取得元に従います。

- [Googleの祝日専用カレンダー実データ（ICS）](https://calendar.google.com/calendar/ical/ja.japanese.official%23holiday%40group.v.calendar.google.com/public/basic.ics)
- [国民の祝日について・内閣府](https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html)
- [祝日とその他の行事の表示設定・Google公式ヘルプ](https://support.google.com/calendar/answer/13748345?hl=ja)

公開する項目は次だけです。説明・参加者・場所・予定IDは含めません。

```json
{
  "generatedAt": "2026-11-11T20:55:00+09:00",
  "streams": [
    { "start": "2026-11-11T21:00:00+09:00", "end": "2026-11-11T22:00:00+09:00", "title": "架空の作品 #1" }
  ],
  "holidays": [
    { "date": "2026-11-23", "name": "勤労感謝の日" }
  ]
}
```

パラメータなしではJSON、`?callback=streamScheduleCallback_1` ではJSONPを返します。受け取り関数名は設定した接頭辞と数字に限定し、カレンダーを読む前に検証します。

終日予定は配信時刻を表示できないため除外し、配信は開始日の行に表示します。前日開始の配信は15日分の範囲には含めません。場所欄が空の既存予定を補完する処理は行いません。

## ファイルとテスト

| ファイル | 役割 |
| --- | --- |
| `apps-script/Code.gs` | 読み取り・配信の選別・祝日の取得・JSON・JSONP応答 |
| `docs/config.js` | アカウント・場所の判定文字列・祝日カレンダー・日数・更新間隔・公開URL |
| `docs/index.html`・`overlay.css`・`overlay.js` | 本番の帯・配色・安全なテキスト描画 |
| `docs/schedule-data.js` | 日付・ラベル・応答検証・日別の並べ替え |
| `docs/schedule-feed.js` | 本番と診断で共用するJSONP取得・更新・後始末 |
| `docs/demo.js` | Googleに接続しない帯の見本 |
| `docs/probe.html`・`probe.css`・`probe.js` | 診断ページ・試行と成功の回数表示 |
| `docs/demo.json` | 診断用の固定ダミーJSON |
| `tests/*.test.cjs` | 読み取り・非公開項目の除外・日時境界・描画・通信失敗の検証 |

```sh
node --test tests/*.test.cjs
```

ローカルGitフックは `git config core.hooksPath .githooks` で有効にします。秘密情報を検査し、mainへの直接コミット・pushを止めます。GitHubへのpushは、リポジトリ・remote・ref・コミット・変更内容・forceと削除の有無を示し、本人の一回限りの承認を得てから行います。

## 確認状況（2026年11月11日）

- [x] JSONPによる実データ取得をGitHub Pages・MacのChromeで確認した。
- [x] WindowsのOBS 33.0.1でJSONP取得と5分更新を本人が確認した。試行2回・成功2回。
- [x] 公開中の配信3件を個人カレンダーと照合し、開始・終了・タイトルが一致し、公開項目も限定されていた。
- [x] 祝日専用カレンダーの2026年実データを確認した。
- [x] Node.jsのテスト17件で、対象外予定の除外・項目制限・祝日のページ分割・期間境界・ラベル・失敗時の保持・日付変更時の取得を確認した。
- [x] MacのChromeで幅440pxの帯を開き、通常・配信中・終了後・複数配信・長いタイトル・高さ増加の見本を確認した。
- [ ] 祝日対応版をApps Scriptに再公開し、Calendar API経由で11月23日の祝日が返ることを確認する。
- [ ] 本番の帯をPagesへ反映し、WindowsのOBSで透明背景・文字・5分更新を本人が確認する。

現在の15日間には対象外の予定がないため、実カレンダーの対象外予定を除外できたことの突合は未確認です。対象外予定の除外は模擬データで検証済みです。検証用に実カレンダーへ予定を作成したり、非公開予定の内容を公開記録に残したりしません。

## APIの公式資料

- [Advanced Calendar Service](https://developers.google.com/apps-script/advanced/calendar)
- [Events: list（期間境界・繰り返し・ページ分割）](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- [Content Service（JSON応答・リダイレクト）](https://developers.google.com/apps-script/guides/content)
