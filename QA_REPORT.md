# ChouChou QA Report

## M6 Version 1.0.0 Production Readiness

実施日: 2026-07-20
判定: **BLOCKED（コード重大バグ0件、正式リリース条件未達）**

| 領域 | 結果 | 証跡 |
|---|---|---|
| JavaScript / Functions | PASS | 全対象`node --check`、4 Callable export読込 |
| Unit / RBAC | PASS | 16/16 |
| Firestore / Storage Rules | PASS | Emulator 21/21 |
| Static / Service境界 | PASS | 47 HTML、参照・ID・alt・noopener異常0、UI直接SDK 0 |
| Current production Public PC | PASS | トップ表示、横溢れ0、Console Error/Warning 0 |
| Current production Analytics | FAIL | `admin/analytics-dashboard.html`が404。未deploy |
| Authenticated production Smoke | NOT RUN | owner/manager/staff/cast認証情報なし |
| Lighthouse current production | RECORDED | Performance 20 / Accessibility 100 / Best Practices 100 / SEO 91 |
| Version 1.0.0 optimized assets | STATIC PASS | 使用中8画像を約15MBから約1MBへ削減、画像目視確認済み |
| Git release state | FAIL | ahead 102 / behind 15、未コミット多数 |

正式判定、ブロッカー、post-deploy手順は`RELEASE_NOTE.md`を参照する。

## M4.5 QA history

実施日: 2026-07-19
対象: Public Site / Admin / Cast Portal / CRM / Reservation / Sales / Payroll / Dashboard
判定: **条件付きPASS（重大バグ0件、既知の非ブロッキング課題あり）**

## 結果サマリー

| 領域 | 結果 | 証跡 |
|---|---|---|
| 予約〜締め統合フロー | PASS | Emulator上で予約→受付→着席→延長→会計→売上→給与→日締め／月締め→編集拒否→owner解除→再編集を確認 |
| RBAC / Rules | PASS | Firestore / Storage Emulator 21件中21件成功 |
| Route Guard | PASS | 純粋ポリシーテスト4件成功、未ログインAdmin/Cast Portalのログイン遷移をブラウザ確認 |
| Service Layer | PASS | UIからFirestore / Storage / Firebase SDK直接アクセス0件 |
| Functions | PASS（静的） | Node構文、依存解決、4 Callable export、Auth/Admin SDK/Castリンク/Audit実装を確認 |
| UI / Responsive | PASS | 1280px / 768px / 390px、主要公開5画面、Adminログイン、Cast Portalログインで横溢れ・実画像404なし |
| Console / Network | PASS（環境注記あり） | コード由来の予期しないConsole Error 0件。外部Firestore遮断時は期待どおりNetworkErrorへ変換 |
| 404 / 500 | PASS / N/A | 全ローカル参照正常、存在しないパスは404。静的Hostingのためローカル500経路なし |
| Performance | PASS（改善実施） | 公開ランキングから管理分析Service連鎖読込を除去。大容量画像はKnown Issue |
| Documentation | PASS | README / ARCHITECTURE / MigrationReport / TODO / ROADMAP / QA・Backup・運用成果物更新 |
| Backup / Restore | 手順整備済み | Firestore / Storage / Auth / Functions設定の対象、復元、DRを文書化。自動バックアップ構築と復元訓練は本番運用課題 |
| Production Operations | 手順整備済み | キャスト登録から監査・障害初動までの確認手順とチェックリストを文書化 |

## E2E業務フロー

検証専用Firestore Emulatorで次を一連実行した。本番データは未使用。

1. managerが予約を受付。
2. VIP席を予約済み→使用中へ変更。
3. 来店を受付→着席→延長→会計→完了へ更新。
4. 延長回数、来店、予約、席の関連状態を確認。
5. managerが来店・顧客・キャストに紐づく売上を登録。
6. ownerが月次給与を登録。
7. managerが営業日締め、ownerが月締め。
8. 締め後の売上・給与編集が拒否されることを確認。
9. managerの締め解除が拒否されることを確認。
10. owner解除後に売上・給与を再編集できることを確認。

## 権限

| 操作者 | 検証結果 |
|---|---|
| owner | 管理・給与・コミッション・締め解除を許可。users / auditLogsのブラウザ直接書込は拒否 |
| manager | 店舗運営・分析を許可。給与・設定・users・締め解除を拒否 |
| staff | 予約・受付・NEWSを許可。売上・給与・設定・キャスト編集を拒否 |
| cast | 本人データ・プロフィール許可項目・シフト申請・既読のみ許可 |
| 未ログイン | 公開readと検証済み公開フォームcreateのみ許可。管理データread/write拒否 |
| inactive | ロール権限を付与しない |

## Rules

- Portable Temurin JRE 21.0.11を`/private/tmp`へ一時配置し、システムJavaは変更していない。
- Firestore Emulator / Storage Emulator: 21 tests, 7 suites, 21 pass, 0 fail。
- `PERMISSION_DENIED`ログは拒否を期待するテストケースの正常な出力。

## ブラウザ・UI

- Public: index / cast / gallery / system / recruit / contact。
- Protected: admin/dashboardは未ログインでadmin/loginへ遷移。cast-portalはログインUI表示。
- PC 1280px、Tablet 768px、Mobile 390pxで横スクロールなし。
- `src`を持つ画像の読込失敗0件。
- ダークモード専用CSSはなく、OS設定による意図しない配色切替は発生しない。
- ブラウザ環境が外部Firestoreへ到達できない場合、SDKのオフラインログは出るが、Serviceはユーザー向け通信エラーへ変換する。

## Performance

QA中に、公開`ranking.js`が管理用`analyticsService`を経由して給与・CRM・締めServiceまで取得する回帰を検出した。公開閲覧計測を`castViewService`へ分離し、キャッシュキーを更新して解消済み。

- 画像: 13ファイル、約23.5MB。
- 1MB超画像: 10ファイル。
- JavaScript: 98ファイル、約868KB。
- CSS: 17ファイル、約784KB。
- 画像再圧縮は見た目変更リスクがあるためM4.5では未実施。

## Release判定

重大バグは0件。Rules、統合フロー、Service境界、静的整合、レスポンシブはリリース条件を満たす。本番公開後はownerテストアカウントでFunctionsユーザー一覧、管理CRUD、公開キャスト一覧を確認すること。

バックアップ・復元と本番運用は`BACKUP_PLAN.md`、`OPERATIONS_MANUAL.md`へ整理した。専用バックアップbucket、Scheduled Backup / PITR、Auth暗号化保管、復元訓練はコードから実施済みと確認できないため、初回公開前のowner確認項目とする。
