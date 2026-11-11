# 配信予定オーバーレイ・取得検証用の試作

GitHub PagesからApps ScriptのJSONを匿名で取得できるか確かめるための最小構成です。Apps Scriptの公開とローカルページからの実データ取得を確認しています。帯の表示は、GitHub PagesとOBSでの取得検証後に実装します。

リポジトリ: [yuta0218/stream-schedule-overlay](https://github.com/yuta0218/stream-schedule-overlay)

## GitHub Pagesの公開設定

- 公開元: `feature/connection-probe` ブランチの `/docs`
- 設定画面: リポジトリの Settings → Pages → Deploy from a branch
- `.nojekyll` を配置し、HTML・CSS・JavaScriptをそのまま配信する。
- `docs/config.js` に設定済みのApps Script公開URLへ、ページを開くと自動で接続する。

GitHub Pagesは任意のブランチの `/docs` から公開できます。[公式手順](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 今回の範囲

- 個人アカウントのprimaryから、今日を含む15日分の時刻付き配信予定を読む。
- 場所欄に `twitch.tv/yuta0218` が含まれる予定だけをサーバー側で選ぶ。
- JSONは `generatedAt` と `streams` のみ。配信ごとの項目は `start`・`end`・`title` のみ。
- 設定は `docs/config.js` が正本。依存ライブラリ・ビルド工程なし。
- 取得ページは5分ごとと日付変更時に再取得する。失敗時は直前のJSONを保持し、初回失敗時はJSONを表示しない。
- 診断用の状態表示は常に表示する。OBS本番用の帯ではない。

祝日の取得・帯の描画・ラベル切り替え・月またぎの見た目・高さ調整は未実装です。今回のJSONは `holidays` を含みません。終日予定と前日開始の配信も今回の検証対象外です。日付・時刻はAsia/Tokyoで扱います。

## ファイル

| ファイル | 用途 |
| --- | --- |
| `apps-script/Code.gs` | 読み取り・場所欄の判定・JSON応答 |
| `apps-script/appsscript.json` | タイムゾーン・Calendar v3・読み取り専用スコープ |
| `docs/config.js` | 配信URLの判定文字列・日数・更新間隔・公開URL |
| `docs/index.html` | 取得確認ページ |
| `docs/probe.js` | 匿名GET・形式確認・更新・失敗時の保持 |
| `docs/probe.css` | 取得確認ページの表示 |
| `docs/demo.json` | 固定の架空予定。現在の日付に追随しない |
| `tests/probe.test.cjs` | Googleを呼ばないロジック検証 |
| `.githooks/`・`scripts/check-secrets.py` | コミット・push前の秘密情報検査 |

## ローカルで開く

プロジェクトのルートで実行します。

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

ブラウザで `http://127.0.0.1:8765/?demo=1` を開くとダミーJSONを取得します。ファイルを直接開く `file://` ではなくHTTPで開いてください。ダミーの成功は、Googleとの接続成功を意味しません。サーバーを止めるには起動したターミナルでCtrl+Cを押します。

```sh
node --test tests/probe.test.cjs
```

## セットアップと取得確認

### 1. 本人がApps Scriptを準備する

1. `yutasworks@gmail.com` でApps Scriptの新規プロジェクトを作る。会社用アカウントでは作らない。
2. `Code.gs` に `apps-script/Code.gs` の内容を貼り付ける。
3. スクリプトファイル `Config.gs` を追加し、`docs/config.js` の内容をそのまま貼り付ける。
4. プロジェクトの設定からマニフェストを表示し、`appsscript.json` に同梱の内容を貼り付ける。Calendar v3の高度なサービスが有効であることも確認する。
5. タイムゾーンが `Asia/Tokyo`、OAuthスコープが `https://www.googleapis.com/auth/calendar.readonly` の1件だけであることを確認する。
6. エディターから `doGet` を実行し、本人が権限を許可する。別アカウントのprimaryならスクリプトは停止する。
7. 本人がWebアプリとして新規デプロイする。実行ユーザーは「自分」、アクセスできるユーザーは「全員」。末尾が `/exec` のURLを控える。

設定の正本を変更した場合は、Apps Scriptの `Config.gs` に同じ内容を貼り直し、公開デプロイを新しいバージョンに更新します。手動同期であり、自動同期ではありません。

### 2. ローカルのページから実データを取得する

`http://127.0.0.1:8765/` を開くと、設定済みの公開URLから自動で取得します。別の公開URLを試す場合は、入力欄を変更して「取得を開始」を押します。ログイン画面のHTMLや不正なJSONは成功として扱いません。独自ヘッダーやCookieを送らない通常のGETを使い、JSONPや `no-cors` による代替は行いません。

### 3. GitHub Pagesから確認する

1. 本人に個人GitHubアカウント名と公開リポジトリ名を確認する。仮称は `stream-schedule-overlay`。会社組織には作らない。
2. OBSで自動取得する際は、`docs/config.js` の `webAppUrl` に `/exec` のURLを設定する。URLは公開ソースに含まれる。認証トークンは設定しない。
3. push前にリポジトリ・remote・ref・コミット・変更概要・forceや削除の有無を示し、本人の一回限りの承認を得る。
4. 承認を経てGitHub Pagesの公開元を `feature/connection-probe` ブランチの `/docs` に設定する。公開対象のフォルダは `docs`。
5. GitHub PagesのURLから「実データ取得成功」とJSON本文が表示されることを確認する。Googleにログインしていないブラウザ環境でも確認する。Apps ScriptのURLを直接開けるだけでは合格にしない。

### 4. 本人がWindowsのOBSで確認する

1. OBSのバージョンを記録する。
2. ブラウザソースにGitHub PagesのURLを指定する。今回の診断ページは幅760px・高さ900px程度で確認する。本番用の幅440pxは帯の実装後に使う。
3. GoogleにログインせずJSONを取得できることを確認する。
4. 5分以上待ち、成功回数と最終成功時刻が進むことを確認する。手動のページ再読込だけでは自動更新の確認にならない。

## 取得検証の合格条件

- [ ] Apps Scriptの読み取り専用スコープと実行アカウントを確認した。
- [ ] 実際のprimaryを見比べ、対象の配信は返り、場所欄が空・別URLの予定は返らないことを確認した。対象外予定はGoogle上で確認し、JSONや公開の検証記録にコピーしない。
- [ ] 公開JSONに説明・参加者・場所・予定IDがないことを確認した。
- [ ] GitHub Pagesから、ログインなしでJSON本文を取得できた。
- [ ] WindowsのOBSから取得でき、5分ごとの更新が動いた。

実データが0件の場合、空配列だけでは絞り込みの正しさは証明できません。対象予定の場所欄を読み取りで確認します。予定の追加・変更・場所欄の補完は今回行いません。

初回失敗ではJSON本文は非表示、成功後の失敗では直前のJSONを保持します。日付変更後の再取得に失敗した場合も、成功するまで古いJSONを保持します。エラー詳細のカレンダー内容を返す独自のエラーJSONは実装していません。Apps Scriptの実行履歴で原因を確認してください。

取得できなければ、環境・エラー・成功した段階を記録し、代替方式を本人へ提案してから進めます。ローカルのモック検証が通っても、GitHub PagesとOBSから取得できることは実環境で別途確認する必要があります。

## ローカルで確認した結果（2026年11月11日）

- Node.jsのテスト6件が成功。場所欄の絞り込み・公開項目の制限・ページ分割・期間境界・別アカウントでの停止・失敗時の保持・日付変更時の再取得をモックで確認した。
- Chromeでローカルページを開き、ダミーJSONと取得成功の表示を目視確認した。
- Apps Scriptの公開後、ログインなしのHTTP GETとローカルページの両方で実データ取得に成功した。返却項目は生成日時と配信の開始・終了・タイトルのみだった。
- 対象外予定が除外されていることのカレンダーとの突合・GitHub Pages・WindowsのOBS・実時間での5分更新は未検証。

## ローカルのGitフック

`git config core.hooksPath .githooks` で、コミット前とpush前の秘密情報検査を有効にします。`main` への直接コミット・直接pushも止めます。フックは本人承認の代わりにはなりません。

## 参照した公式資料

- [Advanced Calendar Service](https://developers.google.com/apps-script/advanced/calendar)
- [Events: list（期間境界・繰り返し・ページ分割）](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- [Content Service（JSON応答・リダイレクト）](https://developers.google.com/apps-script/guides/content)
