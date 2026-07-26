# ChouChou Version 1.0.0 Deploy Plan

作成日: 2026-07-27
状態: **PLAN ONLY — 未実行**

本書はGit統合完了後の実施計画である。今回の確認ではCommit、Tag、Deploy、Remote変更、Firestoreデータ変更を行っていない。

## 1. 現在の停止条件

次が解消するまでデプロイしない。

1. `main` が 102 commits ahead / 79 commits behind。
2. コミット間でテキスト18件・画像2件が競合。
3. 作業ツリー165ファイルが未確定で、origin変更と66ファイルが重複。
4. M1〜M6の主要成果物が未追跡。
5. M5正式5ページが本番で404。
6. `origin/main` の `firebase.json` はHostingのみで、Rules / Functionsを含まない。

## 2. 安全なGit統合手順

実施には別途承認が必要。

1. 現在の作業ツリーをファイル一覧・hash・バックアップで保全する。
2. 不要物と成果物を分類し、M1〜M6を再現可能なローカルcommitへ固定する。
3. `main` から専用のrelease integration branchを作成する。
4. 最新 `origin/main` をそのbranchへmergeする。
5. `MERGE_REPORT.md` の20競合を一件ずつレビューする。
6. 公開デザインはorigin側変更を確認し、RBAC / Service / Firestore描画はM1〜M6側を保持する。単純なours/theirs一括採用は禁止する。
7. バッジ画像2件は実表示、解像度、参照path、管理画面表示を比較して採用版を決める。
8. 66重複ファイルについて、未コミット成果物が失われていないことをdiffで確認する。
9. 全品質確認後にのみ、統合branchをrelease候補とする。

## 3. Release candidate validation

予定コマンド例:

```sh
node --check assets/app.js
node --check assets/cast.js
node --check assets/admin.js
node --check assets/analytics.js
node --check assets/analytics-sales.js
node --check assets/analytics-cast.js
node --check assets/analytics-customer.js
node --check assets/notifications.js
node --check functions/index.js
node --test tests/qa/rbac-contract.test.mjs tests/analytics/analytics-calculator.test.mjs tests/finance/finance-calculator.test.mjs
node tests/qa/static-audit.mjs
firebase emulators:exec --only firestore,storage "npm test --prefix tests/rules"
git diff --check
```

追加確認:

- UIからFirebase SDK直接アクセス0件。
- HTMLローカル参照欠落0件。
- Functions 4 exportsのロード確認。
- PC / Tablet / Mobileの主要画面。
- owner / manager / staff / cast / 未ログイン。
- 予約 → 受付 → 着席 → 延長 → 会計 → 売上 → 給与 → 締め。

## 4. Backup gate

デプロイ前に `BACKUP_PLAN.md` に従い、以下を完了・記録する。

- Firestore Export
- Storage Backup
- 現行Rules保存
- 現行Functions revision
- 現行Hosting release ID
- Firebase Authentication復旧方針
- release commit SHA
- 復旧担当者

バックアップ時刻と復元確認者が空欄の場合は進めない。

## 5. Firebase deploy target

ローカルrelease候補の `firebase.json` が意図する対象:

| Target | Source |
|---|---|
| Firestore Rules | `firestore.rules` |
| Storage Rules | `storage.rules` |
| Cloud Functions | `functions/`（Node.js 22） |
| Hosting | site `chouchou-susukino`, public `.` |

予定される最終デプロイコマンド:

```sh
firebase use chouchou-susukino
firebase deploy --only firestore:rules,storage,functions,hosting
```

実行前にFirebase CLIが表示するproject IDと対象を二名確認する。今回このコマンドは実行していない。

## 6. Hosting manifest review

デプロイ直前に、次の5ファイルがrelease commitとHosting upload対象の両方に存在することを確認する。

```text
admin/analytics-dashboard.html
admin/analytics-sales.html
admin/analytics-cast.html
admin/analytics-customers.html
admin/notifications.html
```

`hosting.public` は `.` で、現行ignoreでは上記を除外しない。404再発防止のため、「ローカルに存在」ではなく「release commitからclean checkoutして存在」を完了条件とする。

## 7. Deploy order

互換性確認済みの同一release commitから実施する。

1. Firestore / Storage Rules
2. Cloud Functions
3. Hosting
4. 直後のSmoke Test

Rules先行で現行クライアントが停止する可能性がある場合は、一括deployの前にEmulatorとStagingで旧UI互換を確認する。本番データ構造は変更しない。

## 8. Post-deploy verification

デプロイ直後:

- 5つのM5正式URLが200。
- Public Site主要ページが200。
- owner / manager / staff / castログイン。
- WEB予約 / LINE予約。
- 来店フロー、売上、給与、締め。
- Analytics / Notification表示。
- Functions callable 4件。
- Console、Network、Functions logsに重大エラーなし。
- Rules permission deniedが設計どおり。

24時間以内:

- Lighthouse Performance / Accessibility / Best Practices / SEOを記録。
- Firestore read回数、Functions error、Hosting 404を確認。
- 画像転送量とcache headerを確認。

## 9. Rollback

重大障害時:

1. 新規入力を一時停止し、発生時刻と影響範囲を記録する。
2. Firebase Hostingを直前の正常releaseへrollbackする。
3. Functionsを直前の正常revisionへ戻す。
4. Rulesが原因の場合、保存済みの直前Rulesへ戻す。
5. データ破損が確認された場合のみ、owner承認のもと `BACKUP_PLAN.md` の復元手順を使用する。
6. `businessAuditLogs`、Functions logs、該当reservation / visit / sale IDを保全する。

データ復元はHosting rollbackと分離し、推測で実行しない。

## 10. Release completion

次を満たしてからVersion 1.0.0を完了とする。

- `RELEASE_CHECKLIST.md` の必須項目完了
- 重大バグ0件
- Console Error 0件
- Rulesテスト成功
- 本番Smoke Test成功
- M5正式5 URLが正常
- Backup確認済み
- owner承認済み
- 最後にのみ `v1.0.0` tagを作成・push
