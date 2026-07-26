# ChouChou Milestone M2 Migration Report

実施日: 2026-07-19
対象: ブラウザで実行される全HTML / JavaScript、Firestore、Storage、Realtime Listener、Transaction、Batch

## M6 Version 1.0.0 Release Hardening 追補

実施日: 2026-07-20

- Service LayerとFirestoreデータ構造は変更せず、UI直接SDK呼出0件を再確認。
- 使用中の大容量画像8件をWebP・適正解像度へ切替し、約15MBから約1MBへ削減。
- Hostingへ画像長期cache、JS/CSS再検証cache、HTML no-cache方針を追加。
- Service Worker cacheを`chouchou-v100-static-1`へ更新。
- Lighthouse現行本番値とrelease blockerを`RELEASE_NOTE.md`へ記録。
- Rules 21/21、unit/RBAC 16/16、47 HTML静的監査、Functions export、`git diff --check`を再検証。

## Executive Summary

画面コードのFirebase直接アクセスを廃止し、依存方向を`UI → Domain Service → Firebase Foundation`へ統一した。Cloud FunctionsはFirebase Admin SDKを利用する独立したサーバー側信頼境界として維持している。

| 監査項目 | 修正前 | 修正後 |
|---|---:|---:|
| Firebase Firestore / Storage SDKを直接利用するUIファイル | 10 | 0 |
| 低レベル`firestoreService.js`を直接利用するUIファイル | 10 | 0 |
| UI内のFirestore / Storage API呼び出し | あり | 0 |
| 空または参照されない旧JavaScript / CSS | 7 | 0 |

## Phase 1 — 修正前の直接アクセス

Firebase SDKを直接利用していたUI:

- `assets/cast-manager.js`: collection、doc、getDocs、onSnapshot、addDoc、updateDoc、deleteDoc、writeBatch、Storage API
- `assets/news-manager.js`: collection、doc、getDocs、onSnapshot、CRUD、writeBatch、Storage API
- `assets/gallery-manager.js`: collection、doc、getDocs、onSnapshot、CRUD、writeBatch、Storage API
- `assets/schedule.js`: collection、doc、getDocs、onSnapshot、writeBatch
- `assets/event-manager.js`: collection、doc、onSnapshot、CRUD、Storage API
- `assets/settings-manager.js`: doc、getDoc、setDoc、Storage API
- `assets/system-manager.js`: collection、doc、onSnapshot、CRUD、writeBatch
- `assets/recruit-manager.js`: doc、setDoc、Storage API
- `assets/recruit-form.js`: collection、doc、getDoc、addDoc
- `assets/contact-form.js`: collection、addDoc

低レベルFirestore Serviceを直接利用していたUI:

- `assets/app.js`
- `assets/admin.js`
- `assets/cast.js`
- `assets/cast-detail.js`
- `assets/home-engagement.js`
- `assets/reservation.js`
- `assets/gallery.js`
- `assets/payroll.js`
- `assets/ranking.js`
- `assets/js/news.js`

## Phase 2 — Service構成

正規のドメインServiceは`assets/services/`へ配置した。

| Service | 責務 |
|---|---|
| `authService` | 認証、ログアウト、パスワード再設定、共通例外 |
| `castService` | キャストCRUD、検索、公開、順位、Batch、画像 |
| `customerService` | CRM、顧客照合、来店Transaction |
| `reservationService` | 予約CRUD、状態、顧客紐付け |
| `salesService` | 売上CRUD、検索、重複検証 |
| `scheduleService` | シフトCRUD、購読、キャストとのBatch更新 |
| `newsService` | NEWS CRUD、購読、並び替え、画像 |
| `galleryService` | ギャラリーCRUD、購読、並び替え、画像 |
| `userService` | Callable Functionsによるユーザー管理 |
| `dashboardService` | 複数Serviceの購読と集計 |
| `storageService` | upload、URL取得、delete、Storage例外 |
| `auditService` | owner向け監査ログの取得、検索、ページング、購読 |
| `siteService` | サイト設定、求人コンテンツ、画像 |
| `eventService` / `systemService` | イベント、料金項目 |
| `contactService` / `recruitService` | 公開フォーム登録とRules準拠検証 |
| `analyticsService` | 閲覧カウント、ランキング購読 |

## Phase 3 — CRUD移行

- 管理画面のCRUD、リアルタイム購読、画像操作を各ドメインServiceへ移動。
- 公開サイトのキャスト、シフト、NEWS、ギャラリー、イベント、設定、予約参照を各Serviceへ移動。
- 画面からコレクション名、Document Reference、Storage Reference、Timestamp生成を排除。
- キャスト管理・NEWS・ギャラリー・シフトのBatch処理をServiceへ移動。
- 来店完了の顧客集計Transactionは`customerService`内部に維持。

## Phase 4 — 共通処理

- `dataService.js`: CRUD、検索、ソート、ページング、購読、バリデーション、Promise契約。
- `firestoreService.js`: SDK境界、15秒キャッシュ、共有Realtime Listener、キャッシュ無効化、Batch。
- `storageService.js`: Storage操作、共通稼働状態、例外変換。
- `serviceRuntime.js`: Promiseの開始・終了、ローディング状態、例外変換、ログ呼び出し。
- `serviceLogger.js`: 個人情報payloadを保存しないServiceイベントログ。

## Phase 5 — 共通エラー

`errors.js`に次を実装した。

- `PermissionDeniedError`
- `ValidationError`
- `NotFoundError`
- `ConflictError`
- `NetworkError`
- 共通基底`ServiceError`

FirebaseのFirestore / Storage / Auth / Functionsエラーコードを共通エラーへ変換する。旧`DataServiceError`と`StorageServiceError`は互換性のため非推奨クラスとして残す。

## Phase 6 — API契約

- 非購読APIは常にPromiseを返す。
- 共通Data CRUDは取得でドメイン値、作成・更新でID、削除で`undefined`を返す。認証・集計・Functionsは処理に対応するドメイン値を返す。
- Realtime APIはunsubscribe関数を返す。
- JSDocで共通Data Service、エラー、Runtime、監査Serviceの境界を記述。
- 既存UIの呼び出しシグネチャは維持し、画面デザインは変更していない。

## Phase 7 — 削除・整理

- 重複コピー`assets/js/services/castService 2.js`、`salesService 2.js`を削除。
- 参照のない空ファイル`assets/js/ranking.js`、`assets/js/reservation.js`、`assets/js/today.js`を削除。
- 参照のない旧`assets/today.js`、`assets/css/today-pc-scroll.css`を削除。
- 参照のない`assets/utils/id.js`、`assets/utils/uiFeedback.js`を削除。
- UIのFirebase SDK import、低レベルFirestore import、未使用importを削除。
- 旧cast / sales / customer / reservation Service importパスは実装を持たない互換re-exportだけ残し、Firebase基盤ServiceはFoundationとして維持。

## 意図して残すFirebase SDK境界

次はUIではないため対象外ではなく、正規Service / Foundation境界として残す。

- `assets/js/firebase/firebaseClient.js`: Firebase初期化
- `assets/js/services/firestoreService.js`: Firestore SDK、キャッシュ、共有購読、Batch
- `assets/services/storageService.js`: Storage SDK
- `assets/services/customerService.js`: Transaction
- `assets/js/services/castPortalService.js`: 本人限定Query、Listener、プロフィール更新
- `assets/js/services/authService.js`: Authentication SDK基盤
- `assets/services/userAdminService.js`: Callable Functionsクライアント
- `functions/`: Firebase Admin SDK

## Rules / Cloud Functions整合

- 公開予約は作成時`createdAt/updatedAt`、作成後`reservationId`補完という既存Rules契約を維持。
- 公開問い合わせ・求人応募はRulesの許可フィールドに合わせ`createdAt`だけをServiceで生成し、`updatedAt`を送信しない。
- Storage保存先`casts/`、`gallery/`、`news/`、`events/`、`event-banners/`、`recruit/`を既存Storage Rulesと一致させた。
- `users`と`auditLogs`の書き込みはブラウザへ移さず、Admin SDK Callable Functions専用を維持。

## 未対応

実装上の未対応なし。UIからの直接Firestore / Storage / Firebase SDKアクセスは0件。

本番データを変更する認証済みCRUD Smoke Testは、検証データ混入を避けるため未実施。デプロイ前にowner / manager / staff / cast各権限で実施する。

## 品質確認

- 全`assets/**/*.js`の`node --check`: PASS
- `node --check functions/index.js`: PASS
- UI直接アクセス機械監査: 0件 / PASS
- `git diff --check`: PASS
- ESLint: 設定ファイルなしのため対象外
- Firestore / Storage Rules Emulator: 18件中18件PASS
- ローカルブラウザ: トップ、キャスト一覧、ギャラリーでmodule / console errorなし
- 管理画面: 未ログイン時のRoute Guardとログイン画面遷移を確認

## M3 Reservation + CRM Platform 追補

実施日: 2026-07-20

### Service追加・更新

- `tableService`: 席CRUD、検索、ソート、リアルタイム購読、状態正規化。
- `visitService`: 来店購読、予約状態遷移、来店タイムライン、席移動、予約削除時の関連データ解放。
- `reservationService`: M3ステータスと旧値の互換変換、来店Transactionへの委譲、担当キャスト・席・visitId対応。
- `customerService`: VIP、NG、好きなお酒、ボトル情報、累計・平均利用額フィールド対応。
- `dashboardService`: 本日の来店・キャンセル・空席のリアルタイム集計。

### UI移行

- 新規: `admin/reservation-detail.html`、`admin/table-manager.html`、`admin/visit-history.html`。
- 更新: 予約一覧、CRM一覧・詳細、オーナーダッシュボード、RBACナビゲーション。
- 新規UIは`assets/services/*`だけを利用し、Firebase SDK・低レベルFirestore APIの直接利用は0件。

### データ整合

- 予約状態変更時に`reservations`と`visits`を同一Transactionで更新。
- 着席・席移動・完了・キャンセル時に`tables`を同一Transactionで更新。
- 完了時は`visitCounted`で二重加算を防ぎ、`customers.visitCount / firstVisit / lastVisit`を更新。
- 旧ステータス`確認済 / 来店 / 会計済`は読取時に`予約 / 着席 / 会計`へ正規化。

### M3品質確認

- M3関連14 JavaScriptの`node --check`: PASS。
- `tests/rules/firestore.rules.test.mjs`の`node --check`: PASS。
- `git diff --check`: PASS。
- M3全6 HTMLのローカルHTTP応答: PASS。
- ブラウザのService import読込: PASS、未ログインRoute Guardでログイン画面へ正常遷移、console errorなし。
- UI直接Firestore / Storage API監査: 0件 / PASS。
- Rules Emulator: テストケースへ`visits / tables`のowner・manager・staff許可、cast・inactive拒否を追加。今回の端末ではJava Runtimeが見つからずEmulator起動前に停止したため、追加ケースの実行は未完了。既存M2時点の18件PASS結果は`tests/rules/RESULTS.md`に保持。
- 認証済み主要CRUD: 本番データへの影響を避けるため未実施。デプロイ前にowner / manager / staffで予約登録、着席、席移動、完了、削除をSmoke Testする。

## M4 Sales & Payroll Platform 追補

実施日: 2026-07-19

### 実装

- `financeCalculator`: 売上小計、サービス料、消費税、決済差額、給与、バック、控除、締め集計を純粋関数化。
- `salesService`: `visitId`連携、料金・決済スキーマ、日締め／月締め読取を含むCRUD Transaction、監査ログ。
- `payrollService`: `payrolls / payrollSettings / commissionRules`、個別手当・控除、月締めロック、監査ログ。
- `closingService`: `dailyClosings / monthlyClosings`、決済別スナップショット、owner解除、監査ログ。
- `dashboardService`: 客単価、本指名率、場内率、同伴率、給与ランキング。
- 新規画面: `sale-detail.html`、`payroll-detail.html`、`closing.html`。

### 互換性

- 旧`sales.sales`はM4の`total`として正規化する。
- 旧売上に`month`がない場合も更新時に営業日から補完し、Rulesは旧文書の読取・移行更新を許可する。削除は一度M4形式へ保存した後に許可する。
- `payrollSettings`は既存キャストポータル互換のため全計算ルールをミラー保存し、バック・歩合の正本を`commissionRules/default`へ追加する。
- M1の`auditLogs`はAdmin SDK専用のまま維持し、クライアント業務監査は`businessAuditLogs`へ分離する。

### M4品質確認

- 全`assets/**/*.js`の`node --check`: PASS。
- `git diff --check`: PASS。
- 売上・給与・締め純粋関数テスト: 6件PASS。
- UI直接Firestore / Storage API: 0件。
- Sales / Payrollの保存処理は締め文書をTransaction内で確認。
- Rulesテストへ売上ロック、owner解除、給与・コミッション、追記専用監査ケースを追加。
- Rules Emulatorはこの端末にJava Runtimeがないため追加ケース未実行。既存の最終実行結果は`tests/rules/RESULTS.md`を参照。
- 認証済みCRUDと締め本番Smoke Testはデータ影響を避け未実施。

## M5 Analytics & Intelligence Platform 追補

実施日: 2026-07-19

### Service / 計算層

- 既存`analyticsService`のキャスト閲覧計測APIを維持し、既存データソースの共通リアルタイム購読を追加。
- `analyticsCalculator`へKPI、月目標、時系列、料金・決済内訳、曜日×時間ヒートマップ、キャスト比率・目標、顧客LTV分析を純粋関数として分離。
- `notificationService`は既存データから通知を生成し、通知用Firestoreデータの二重管理を行わない。ownerのみ`businessAuditLogs`の重要イベントを購読する。
- managerは`payrolls`と`businessAuditLogs`を購読せず、M1の給与・監査非公開権限を維持。

### UI / Chart

- 正式画面: `analytics-dashboard.html`、`analytics-sales.html`、`analytics-cast.html`、`analytics-customers.html`、`notifications.html`。
- `analytics.html`と`analytics-customer.html`は既存リンクを壊さない互換ページとして維持。
- Chart.js 4.4.7で折れ線、棒、円／ドーナツ、ランキング、曜日×時間帯ヒートマップを実装。
- Chart.js読込失敗時もカード・表・ランキングを表示するフォールバックを実装。
- owner / manager向けRBACルートと管理ナビゲーションを追加。

### M5品質確認

- M5 JavaScriptの`node --check`: PASS。
- 分析純粋関数テスト: 6件PASS。
- UI直接Firestore / Storage / Firebase SDKアクセス: 0件。
- `git diff --check`: PASS。
- ローカルHTTPで5ページと関連moduleの応答を確認。
- 未ログイン時のRoute Guard: ログイン画面への遷移を確認。
- Chart.js: 実CSS・共通Chartコンポーネントで折れ線・ドーナツを実描画確認。
- レスポンシブ: 1280 / 768 / 390pxで横溢れなし。KPIと目標カードの段階的カラム変更、390px時Chart 324×260pxを確認。
- ブラウザConsoleのwarning / error: 0件。
- owner / managerの認証済み実データ表示は、本番データ保護のため未実施。

## M4.5 Quality Assurance & Production Readiness

実施日: 2026-07-19

- Portable Temurin JRE 21でFirestore / Storage Emulatorを起動し、21件中21件PASS。
- 予約→受付→着席→延長→会計→売上→給与→日締め／月締め→編集拒否→owner解除の統合ケースを追加。
- Firebase非依存のRoute Guardポリシーを抽出し、owner / manager / staff / cast / 未ログインの4テストを追加。
- 全UIの直接Firestore / Storage / Firebase SDKアクセス0件を再確認。
- Functionsは4 Callable export、Admin Auth、users、casts.authUid、auditLogsを静的確認。Functionsコード変更なし。
- 45 HTMLでローカル参照切れ、重複ID、alt欠落、noopener欠落0件。
- Public主要画面、Admin未ログイン、Cast Portal未ログインを1280 / 768 / 390pxで確認し横溢れ・実画像404なし。
- 公開ランキングが管理分析Serviceを連鎖読込する性能回帰を検出し、軽量`castViewService`へ分離。既存キャッシュ向けquery versionを更新。
- HostingからRules、tests、Markdown、Emulatorログを除外。
- 詳細は`QA_REPORT.md`、リリース手順は`CHECKLIST.md`、残課題は`KnownIssues.md`へ分離。
