# ChouChou data services

画面は `firestoreService.js` を直接呼ばず、対象コレクションのサービスを利用します。

- `dataService.js`: CRUD、検索、ソート、ページング、リアルタイム購読、例外変換
- `customerService.js`: CRM項目の正規化・検証、予約／来店／売上との照合、来店集計
- `reservationService.js`: 予約CRUD、M3ステータス、顧客・担当・席・来店紐付け
- `visitService.js`: 予約・来店・席・顧客を同期するTransaction、タイムライン、席移動
- `tableService.js`: 席CRUD、席種別・状態の正規化、リアルタイム購読
- `salesService.js`: 来店・顧客・予約・キャスト連携、料金／決済自動計算、締めロック付き売上Transaction
- `payrollService.js`: 給与・コミッション設定、月次給与、個別手当・控除、月締めロック
- `closingService.js`: 営業日締め・月締め、owner解除、決済別スナップショット
- `financeCalculator.js`: Firebase非依存の売上・給与・締め集計純粋関数
- `castService.js`: キャストCRUD、公開順、画像・タグ互換処理
- `scheduleService.js`: シフトCRUD、リアルタイム購読、キャストとの一括更新
- `newsService.js`: NEWS CRUD、並び替え、画像管理
- `galleryService.js`: ギャラリーCRUD、並び替え、画像管理
- `eventService.js`: イベントCRUD、掲載画像管理
- `siteService.js`: サイト設定・求人コンテンツ・関連画像
- `systemService.js`: SYSTEM料金CRUD、並び替え
- `contactService.js` / `recruitService.js`: 公開フォームの検証済み登録
- `castViewService.js`: 公開ランキング向けの軽量なキャスト閲覧数更新・購読
- `analyticsService.js`: キャスト閲覧数API互換、M5全データソースの管理画面向けリアルタイム統合購読
- `analyticsCalculator.js`: KPI、売上時系列、ヒートマップ、キャスト／顧客分析のFirebase非依存純粋関数
- `notificationService.js`: VIP来店、誕生日、キャンセル、ボトル期限、締め、売上目標の派生通知
- `storageService.js`: Storageアップロード・削除・共通エラー処理
- `userService.js`: Authentication管理用Callable Functionsと読み取り専用usersサービス
- `authService.js`: 認証Promise、共通例外、稼働状態の正規入口
- `dashboardService.js`: ダッシュボード購読・集計の正規入口
- `auditService.js`: Admin SDK監査ログの読取と、M4追記専用業務監査ログ
- `errors.js`: `PermissionDeniedError`、`ValidationError`、`NotFoundError`、`ConflictError`、`NetworkError`
- `serviceRuntime.js`: Promise実行、共通例外変換、ローディング状態
- `serviceLogger.js`: payloadを保存しないServiceイベントログ

## 基本契約

各コレクションサービスは、用途に応じて `list` / `page` / `get` / `create` / `update` / `remove` / `listen` / `listenOne` 相当の関数を公開します。保存前に正規化・検証し、画面へは`ServiceError`派生型として統一されたエラーを返します。

非購読APIは必ず`Promise`を返します。共通Data CRUDは取得でドメイン値、作成・更新でID、削除で`undefined`を解決値とし、認証・集計・Functions等は処理に対応するドメイン値を返します。リアルタイムAPIは同期的にunsubscribe関数を返します。例外は`ServiceError`派生型へ変換され、UIは`error.code`と`error.message`だけで表示判断できます。`DataServiceError`は旧コード互換のため残す非推奨名です。

旧パス `assets/js/services/castService.js` と `assets/js/services/salesService.js` は互換エントリーポイントとして残しています。画面コードから低レベルの `firestoreService.js`、Firebase SDK、コレクション名を直接利用してはいけません。新規画面は `assets/services/` のドメインServiceを利用してください。
