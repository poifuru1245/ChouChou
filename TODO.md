# ChouChou Project Alpha — TODO

更新日: 2026-07-19

## 完成率サマリー

M4.5完了時点で29領域に分けた棚卸し結果:

- 完成: 21領域
- 開発中: 6領域
- 未実装: 2領域
- 参考完成率: **約83%**

算定式は「完成=1、開発中=0.5、未実装=0」とした機能実装率であり、本番運用品質やセキュリティ承認率ではない。Firestore/Storage RulesはM1で実装・Emulator検証済みだが、本番反映後の運用確認は別途必要。

## 機能別ステータス

| # | 機能領域 | 状態 | 根拠・残作業 |
|---:|---|---|---|
| 1 | 公開サイト基本ページ | 完成 | ホーム、アクセス、下層ページ、404あり |
| 2 | キャスト一覧・詳細 | 完成 | Firestore連携、写真、プロフィール、予約導線あり |
| 3 | お気に入り | 完成 | LocalStorage同期、一覧・詳細・専用ページあり |
| 4 | NEWS・ギャラリー・料金・求人表示 | 完成 | Firestoreコンテンツを公開画面へ反映 |
| 5 | 問い合わせ・求人応募 | 完成 | Firestore保存と通知UIあり |
| 6 | 管理ログイン・RBAC | 完成 | 4ロール、Route Guard、403、ログアウトあり |
| 7 | ユーザー管理 | 完成 | Callable Functions経由で作成・更新・無効化 |
| 8 | オーナーダッシュボード | 完成 | 集計、グラフ、ランキング、出勤、予約、NEWS |
| 9 | キャスト管理 | 完成 | CRUD、並び替え、公開、各種フラグ、画像 |
| 10 | シフト管理 | 完成 | 出勤予定の登録・編集・表示 |
| 11 | 予約管理 | 完成 | CRUD、状態、検索、カレンダー、CSV |
| 12 | CRM | 完成 | 一覧、詳細、予約・来店・売上履歴、顧客紐付け |
| 13 | 売上管理 | 完成 | CRUD、検索、集計、customerId/reservationId連携 |
| 14 | コンテンツ・設定管理 | 完成 | NEWS、イベント、ギャラリー、料金、求人、設定 |
| 15 | 公開WEB予約とCRM自動統合 | 開発中 | 予約作成は可能。顧客照合・新規確認を全経路で統一する |
| 16 | 給与管理 | 完成 | M4で自動計算、個別調整、月締めロック、監査を実装。PDFは将来拡張 |
| 17 | キャストポータル | 開発中 | 本人情報表示・編集あり。承認・配信・履歴生成側が不足 |
| 18 | データ統合サービス層 | 完成 | M2移行済み。UI直接Firestore / Storageアクセス0件 |
| 19 | PWA | 開発中 | manifest/Service Workerあり。オフライン範囲と更新戦略が限定的 |
| 20 | Instagram表示 | 開発中 | 現状はギャラリーデータ利用。Instagram API自動取得ではない |
| 21 | Firestore/Storage Rulesのコード管理 | 完成 | M4.5で21ケースのEmulatorテスト成功 |
| 22 | LINE・メール・Push自動通知 | 未実装 | LINE共有URLはあるがMessaging API/Webhook連携なし |
| 23 | Google Calendar連携 | 未実装 | 予約画面の将来拡張のみ |
| 24 | CRM分析・リピート率分析 | 完成 | M5でKPI目標、LTV、顧客・売上・キャスト分析、重要監査通知を実装 |
| 25 | 給与PDF・自動ランキング確定 | 開発中 | 給与計算・表示は完成。PDF・確定配信は将来拡張 |
| 26 | 自動テスト・CI | 開発中 | unit、Rules、RBAC、静的監査あり。CI未導入 |
| 27 | 席・来店管理 | 完成 | M3で席状態、来店タイムライン、移動を実装 |
| 28 | 日締め・月締め | 完成 | M4で編集ロックとowner解除を実装 |
| 29 | 本番品質保証 | 完成 | M4.5で統合、Rules、RBAC、Service、ブラウザ、静的監査を実施 |

## P0 — 本番安全性

- [x] `firestore.rules`を追加し、`owner / manager / staff / cast`の読み書きを明示する。
- [x] `cast`が自分の`casts`、`sales`、`payrollHistory`、`shiftRequests`だけを扱えるRulesを実装する。
- [x] `storage.rules`を追加し、管理画像とキャスト本人画像のアップロード権限を分離する。
- [x] `firebase.json`へFirestore/Storage Rulesのデプロイ設定を追加する。
- [x] Emulator Suiteで許可・拒否・業務統合テストを作成する（21/21成功）。
- [ ] Cloud FunctionsのApp Check強制を段階的に有効化する。
- [ ] role/status変更時のトークン失効・再認証方針を決める。
- [x] 本番データのバックアップ対象、復元、保持期間、災害復旧手順を`BACKUP_PLAN.md`へ定義する。
- [x] 本番業務と障害初動を`OPERATIONS_MANUAL.md`へ定義する。
- [ ] 専用バックアップbucket、Scheduled Backup / PITR、自動実行、暗号化Auth Exportを本番で設定する。
- [ ] 隔離環境でFirestore / Storage / Authの復元訓練を行いRPO/RTOを確定する。

## P1 — データ整合性と内部構造

- [x] Task #004の`assets/services/`移行を完了する。
- [x] 画面からのFirebase SDK直接呼出しを洗い出し、コレクション単位のサービスへ移す。
- [ ] `customers`、`reservations`、`sales`のID・正規化・validationを単一実装に統一する。
- [ ] 旧予約・旧売上の`customerId`欠損を検出する移行レポートを作る。
- [ ] 来店確定処理を冪等化し、`visitCount`の二重加算を防ぐテストを追加する。
- [ ] 顧客の電話番号・LINE ID正規化と重複候補確認を実装する。
- [ ] サービス層のページングAPIを管理一覧UIへ接続する。
- [ ] `payrollHistory`を確定保存する管理フローを実装する。
- [ ] `castRankings`を月次等で生成・確定する処理を実装する。
- [ ] `shiftRequests`の承認・差戻し画面を管理側へ追加する。
- [ ] `castAnnouncements`の作成・公開管理画面を追加する。

## P1 — 品質保証

- [x] Firestore/Storage Emulatorによる疑似認証・RBAC・Rulesテストを追加する。
- [x] 予約→来店→売上→給与→締めの統合テストを追加する。
- [ ] ユーザー作成→更新→無効化→キャスト再紐付けのFunctionsテストを追加する。
- [ ] 主要公開ページと管理画面のPC・タブレット・スマホE2Eを追加する。
- [ ] `node --check`、`git diff --check`、テストを実行するCIを追加する。
- [ ] Firebase deploy前のプレビュー/ステージング環境を用意する。

## P2 — 重複・未使用ファイル整理

- [ ] 0 byteの`assets/js/ranking.js`、`assets/js/reservation.js`、`assets/js/today.js`を参照再確認後に削除する。
- [ ] `assets/today.js`の将来予約を廃止するか、実装予定を明記する。
- [ ] 未参照の`assets/css/today-pc-scroll.css`を画面確認後に削除する。
- [ ] 互換re-exportの`assets/customerService.js`、`assets/reservationService.js`等は移行完了まで維持し、削除条件を決める。
- [ ] 未参照の`assets/utils/id.js`、`assets/utils/uiFeedback.js`をTask #004完了時に採用または削除する。
- [ ] 同名サービスファイルの正規import先を`assets/services/`へ統一する。
- [ ] `style.css`と`admin.css`の重複ルールをComputed Styleとスクリーンショット比較付きで段階整理する。
- [ ] `assets/app.js`、`assets/cast.js`、`assets/cast-manager.js`、`assets/schedule.js`を責務別に分割する。

## P2 — 未実装の業務機能

- [ ] 公開WEB予約でも既存顧客検索と確認付き新規顧客作成を行う。
- [ ] LINE Messaging APIのWebhook、予約通知、変更・キャンセル通知を実装する。
- [ ] メール通知と来店10分前通知をサーバー側で実装する。
- [ ] Google Calendarの同期方式、競合解消、再試行を設計する。
- [ ] Instagram Graph APIを利用する場合の認証・キャッシュ・失敗時表示を設計する。
- [ ] 給与明細PDF、CSV出力、確定・再計算履歴を実装する。
- [ ] CRMのリピート率、LTV、休眠、担当キャスト別分析を実装する。

## P3 — 運用・性能・アクセシビリティ

- [ ] Firestoreクエリと複合indexを実利用データ量で確認する。
- [ ] ダッシュボードと一覧の購読数・read数を計測し、キャッシュ方針を決める。
- [ ] 画像をWebP/AVIF優先にし、アップロード時のリサイズ方針を追加する。
- [ ] ホームの複数CSS/JSロードを計測し、遅延ロード対象を決める。
- [ ] キーボード操作、フォーカス、コントラスト、スクリーンリーダーを監査する。
- [ ] PWAキャッシュ更新、オフライン表示、個人情報ページの非キャッシュ方針を明示する。

## 削除・統合時の安全条件

- ファイル名が重複していても、互換importは直ちに削除しない。
- `rg`による参照確認だけでなく、ブラウザのNetwork/Console/Computed Styleを確認する。
- 公開、管理、キャストポータルの全経路でPC・スマホ表示を比較する。
- データ構造変更にはバックフィル、ロールバック、Rules更新をセットで用意する。
