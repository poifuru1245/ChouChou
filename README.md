# ChouChou

ChouChouの公開サイト、管理画面、キャストポータル、Firebase Functionsを含むプロジェクトです。

Version: `1.0.0` release candidate
Production release status: **BLOCKED** — 詳細は`RELEASE_NOTE.md`を参照してください。

## Security Rules

M1でFirestore/Storage Security Rulesをリポジトリ管理へ移行しました。

- Firestore: `firestore.rules`
- Storage: `storage.rules`
- Rules tests: `tests/rules/`
- Latest test result: `tests/rules/RESULTS.md`
- Firebase設定: `firebase.json`

### ロール

| ロール | 主な権限 |
|---|---|
| `owner` | 全業務データ・全Storageパスの管理、ユーザー・給与・設定を含む |
| `manager` | キャスト、シフト、予約、顧客、売上の管理。給与設定・サイト設定は禁止 |
| `staff` | 予約受付、席・来店運用、予約に必要な顧客照合・新規登録・来店集計、NEWSの管理。顧客ランク変更・売上・給与は禁止 |
| `cast` | キャストポータルから本人プロフィール、本人売上・給与・シフト・お知らせだけ利用 |

ロールの正本はFirestore `users/{uid}`の`role`と`status`です。`status`が有効なユーザーだけに権限が与えられます。ユーザー文書の更新と監査ログの作成はownerのブラウザにも直接許可せず、Firebase Admin SDKを使用するCallable Functions経由に限定しています。未定義コレクションはownerを含めて拒否し、新規機能追加時に権限を明示します。

### Firestoreコレクション分類

コードベースで参照されているトップレベル29コレクションを次のように分類しています。

| コレクション | 分類 | read | write |
|---|---|---|---|
| `casts` | 公開データ＋本人編集 | 公開 | owner / manager、本人castは許可プロフィール項目のみ、公開閲覧数は`+1`のみ |
| `schedules` | 公開データ・店舗運営 | 公開 | owner / manager |
| `news` | 公開データ・スタッフ運営 | 公開 | owner / staff |
| `gallery` | 公開データ・オーナー管理 | 公開 | owner |
| `events` | 公開データ・オーナー管理 | 公開 | owner |
| `content` | 公開データ・オーナー管理 | 公開 | owner |
| `systemItems` | 公開データ・オーナー管理 | 公開 | owner |
| `settings` | 公開サイト設定・オーナー管理 | 公開 | owner |
| `castViews` | 公開ランキング素材 | 公開 | カウント`+1`のみ、削除はowner |
| `reservations` | 管理者データ＋公開受付 | owner / manager / staff | owner / manager / staff、公開は検証済み新規受付のみ |
| `customers` | 管理者データ | owner / manager / staff | owner / manager。staffは予約受付用の新規作成・来店集計のみ |
| `visits` | 来店履歴・店舗運営 | owner / manager / staff | owner / manager / staff。予約ServiceのTransaction経由 |
| `tables` | 席状態・店舗運営 | owner / manager / staff | owner / manager / staff。来店ServiceのTransaction経由 |
| `sales` | 管理者・キャスト専用 | owner / manager、本人cast | owner / manager |
| `payrollSettings` | オーナー専用設定 | owner、給与予定計算のためcast | owner |
| `commissionRules` | オーナー専用バック設定 | owner | owner |
| `payrolls` | 月次給与明細 | owner、本人cast | owner。月締め後は禁止 |
| `dailyClosings` | 営業日締め | owner / manager | owner / manager、解除はowner |
| `monthlyClosings` | 月締め | owner / manager | owner / manager、解除はowner |
| `businessAuditLogs` | M4業務監査 | owner | owner / managerの追記のみ |
| `payrollHistory` | オーナー・キャスト専用 | owner、本人cast | owner |
| `castRankings` | オーナー・キャスト専用 | owner、本人cast | owner |
| `shiftRequests` | 店舗運営・キャスト専用 | owner / manager、本人cast | owner / manager、本人castは新規申請のみ |
| `castAnnouncements` | キャスト専用 | owner、対象cast | owner |
| `castPortalUsers` | キャスト専用 | owner | owner |
| `castPortalUsers/{uid}/announcementReads` | キャスト専用サブコレクション | owner、本人cast | owner、本人cast |
| `users` | オーナー専用・認証基盤 | owner、本人 | Admin SDK Callable Functionsのみ |
| `auditLogs` | オーナー専用・監査 | owner | Admin SDK Callable Functionsのみ |
| `contacts` | オーナー専用＋公開受付 | owner | 公開は検証済み新規送信、管理はowner |
| `recruitApplications` | オーナー専用＋公開受付 | owner | 公開は検証済み新規送信、管理はowner |

`casts`の名前・写真・公開プロフィールは一般サイトで表示する公開データです。このためcastアカウントからも公開プロフィールは閲覧できます。「他キャスト閲覧不可」は、`sales`、`payrollHistory`、`castRankings`、`shiftRequests`等の非公開データに適用し、`castId`と`users.castId`または`casts.authUid`の一致を必須にしています。Firestore Rulesは同一ドキュメントの一部フィールドだけを隠せないため、機密情報を`casts`へ追加せず専用コレクションへ保存してください。

### 公開アクセス

既存サイトとの互換性を維持するため、`casts`、`schedules`、`news`、`gallery`、`events`、`content`、`systemItems`、`settings`は公開読取です。公開フォームは次の検証済みcreateのみ許可します。

- `reservations`: `受付`・`WEB`の予約。作成直後の`reservationId`補完だけ追加で許可。
- `contacts`: `新規`の問い合わせ。
- `recruitApplications`: `新規`の求人応募。
- `castViews`と`casts.viewCount`: 閲覧数の`+1`更新だけ許可。

未公開コンテンツも現在はクライアント側で絞り込んでいるため、文書自体は公開読取になります。将来、公開用コレクションへの分離または`isPublished == true`を含むFirestore Queryへ全画面を移行した後、Rules側も公開済み文書だけに狭めます。

### Storage

| パス | 公開read | write/delete |
|---|---:|---|
| `casts/` | 可 | owner / manager |
| `cast-profiles/{uid}/` | 可 | owner / manager / 本人cast |
| `news/` | 可 | owner / staff |
| `gallery/` | 可 | owner |
| `system/` | 可 | owner |
| `events/`, `event-banners/`, `recruit/` | 可 | owner |

既知の画像パスではJPEG、PNG、WebP、GIFかつ10MB以下だけを許可します。キャスト本人のプロフィール画像は、UID配下かつStorage metadataの`castId`が本人の`users.castId`と一致する必要があります。

## Rules tests

前提:

- Node.js
- Java 21以上（Firestore Emulatorに必要）
- Firebase CLI

初回のみ依存関係をインストールします。

```sh
npm install --prefix tests/rules
```

Firestore/Storage Emulator上で全ケースを実行します。

```sh
firebase emulators:exec --only firestore,storage "npm test --prefix tests/rules"
```

テスト対象:

- 公開コンテンツと公開フォームの許可・拒否。
- ownerの全権限。
- managerの業務データ権限と給与・設定拒否。
- staffの予約・顧客受付・NEWS権限と売上・給与拒否。
- castの本人データ、プロフィール、シフト申請、既読、画像権限。
- inactiveユーザー拒否。
- Storageのパス、MIME type、サイズ、本人UID/castId検証。

## Deploy

テスト成功後にRulesだけをデプロイします。

```sh
firebase deploy --only firestore:rules,storage
```

Rules変更時はHostingやFunctionsのデプロイと分離し、Emulatorテスト結果をレビューしてから反映してください。

## Service Layer

M2でブラウザ画面のデータアクセスを `UI → Domain Service → Firestore / Storage` に統一しました。

- 画面からFirebase SDKや低レベルの`firestoreService.js`を直接importしない。
- CRUD、検索、ページング、リアルタイム購読、Batch、Transaction、Storage画像操作は`assets/services/`へ集約する。
- Firebase初期化と低レベルFirestoreラッパーは`assets/js/firebase/`、`assets/js/services/firestoreService.js`だけが担当する。
- Firebase Admin SDKを使う`functions/`はクライアントService層とは別の信頼境界として維持する。
- 新規コレクションを追加する場合は、画面を作る前にドメインServiceとSecurity Rulesを追加する。

サービス一覧と利用契約は`assets/services/README.md`、移行監査結果は`MigrationReport.md`を参照してください。

## Reservation + CRM Platform

M3では予約を起点に、顧客・来店履歴・席状態を一つの業務フローへ統合しています。

```text
予約 → 受付 → 着席 → 延長 → 会計 → 完了
```

- `admin/reservations.html`: 予約一覧・登録・編集・ステータス管理。
- `admin/reservation-detail.html`: 担当キャスト、席、指名種別、来店タイムラインを一括更新。
- `admin/customers.html` / `customer-detail.html`: VIP・NG・嗜好・ボトル・予約・来店・売上のCRM。
- `admin/table-manager.html`: ボックス・VIP・カウンターの状態表示、CRUD、席移動。
- `admin/visit-history.html`: 来店履歴の検索と予約詳細への遷移。

予約状態の更新は`visitService.transitionReservation()`を使用し、`reservations`、`visits`、`tables`、完了時の`customers`集計をFirestore Transactionで同期します。画面からFirestore APIを直接呼び出してはいけません。

## Sales & Payroll Platform

M4ではM3の来店履歴を起点に売上、給与、締め処理を連携します。

- `admin/sales.html` / `sale-detail.html`: 料金内訳、サービス料、消費税、決済別金額を自動計算。
- `admin/payroll.html` / `payroll-detail.html`: 時給、各種バック、売上歩合、手当、罰金、前借、源泉、控除を月次計算。
- `admin/closing.html`: 営業日締め・月締めとowner限定の解除。
- `assets/services/financeCalculator.js`: Firebaseに依存しない計算ロジック。
- `assets/services/closingService.js`: 締めスナップショットと解除監査。

売上と給与の保存Serviceは`dailyClosings / monthlyClosings`をTransaction内で読み、`closed`の場合は`period-closed`として拒否します。Security Rulesでも同じ制約を強制します。

既存`auditLogs`はM1の方針どおりAdmin SDK専用です。Cloud Functionsを変更しないM4の給与変更、売上修正、コミッション変更、締め解除は、改変禁止・追記専用の`businessAuditLogs`へ記録します。

## Analytics & Intelligence Platform

M5ではM1〜M4のデータを新たな集計コレクションへ複製せず、Service層でリアルタイム購読し、Firebase非依存の純粋関数で分析します。

- `admin/analytics-dashboard.html`: 経営KPI、月目標達成率、概算営業利益、本日の店舗速報、売上・決済・顧客構成。
- `admin/analytics-sales.html`: 日／週／月／年、時間、曜日、キャスト、料金内訳、決済、ランキング、ヒートマップ。
- `admin/analytics-cast.html`: 売上推移、本指名・場内・同伴・延長率、出勤率、単価、目標達成率、ランキング。
- `admin/analytics-customers.html`: 新規・リピーター・VIP・NG、来店間隔、LTV、ランキング、誕生日、ボトル期限。
- `admin/notifications.html`: VIP来店、誕生日、予約キャンセル、ボトル期限、締め完了、売上目標、重要監査イベントの通知センター。

旧URLの`admin/analytics.html`と`admin/analytics-customer.html`も互換ページとして維持しています。

グラフは固定バージョンのChart.js 4.4.7を使用します。Chart.jsを取得できない場合も、数値カード・ランキング・集計テーブルは利用できます。通知はCloud Functionsや重複保存を使わず、既存データから`notificationService`がリアルタイム生成します。

ownerは給与を含む概算営業利益と重要監査イベントを閲覧できます。managerは給与・監査ログを購読せず、営業利益を権限対象外として表示します。staff / castはM5管理画面へアクセスできません。

## Architecture documents

- `ARCHITECTURE.md`
- `TODO.md`
- `ROADMAP.md`
- `MigrationReport.md`
- `QA_REPORT.md`
- `CHECKLIST.md`
- `KnownIssues.md`
- `BACKUP_PLAN.md`
- `OPERATIONS_MANUAL.md`

## Production QA

M4.5ではPortable Temurin JRE 21を利用し、Firestore / Storage Emulator上で21件のRules・RBAC・予約〜締め統合テストを実行しました。Public / Admin / Cast PortalのPC・Tablet・Mobile、Service境界、Functions export、ローカル参照、404、画像容量も監査しています。

```sh
node --test tests/analytics/analytics-calculator.test.mjs tests/finance/finance-calculator.test.mjs tests/qa/rbac-contract.test.mjs
node tests/qa/static-audit.mjs
firebase emulators:exec --only firestore,storage "npm --prefix tests/rules test"
git diff --check
```

Rules、テスト、Markdown、Emulatorログは`firebase.json`でHosting配信対象外にしています。リリース判断と本番後確認は`QA_REPORT.md`と`CHECKLIST.md`、バックアップ・復元は`BACKUP_PLAN.md`、日常運用と障害初動は`OPERATIONS_MANUAL.md`を参照してください。
