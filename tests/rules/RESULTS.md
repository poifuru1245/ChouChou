# Security Rules test results

実行日: 2026-07-19
Firebase CLI: 15.20.0
Firestore Emulator: 1.21.0
Storage Rules Runtime: 1.1.3
Node.js: 24.16.0
Java: Temurin 21.0.11（テスト時のみ一時利用）

## Command

```sh
firebase emulators:exec --only firestore,storage "npm test --prefix tests/rules"
```

## Result

- tests: 21
- suites: 7
- pass: 21
- fail: 0
- cancelled: 0
- skipped: 0

## Covered cases

- 公開コンテンツのreadと、予約・顧客・売上の公開read拒否。
- 公開WEB予約、問い合わせ、求人応募の入力制約。
- キャスト閲覧数の`+1`以外の改ざん拒否。
- ownerの全業務機能と、users/auditLogsのAdmin SDK限定。
- managerのキャスト・シフト・予約・顧客・売上権限、給与・設定・users拒否。
- staffの予約受付・顧客照合・NEWS権限、売上・給与・設定拒否。
- castの本人売上・給与・プロフィール・シフト申請・お知らせ既読制御。
- inactiveユーザーの業務操作拒否。
- 予約→受付→着席→延長→会計→売上→給与→日締め／月締め→owner解除の統合フロー。
- Storageの公開read、`casts/gallery/news/system`等のロール別パス、画像MIME、10MB上限、本人UID/castId制御。

Firebase Local Emulator Suiteだけを使用しており、本番Firestore/Storageデータは読み書きしていません。
