# ChouChou Version 1.0.0 Final Release Plan

作成日: 2026-07-27
状態: **計画のみ・未実行**

## Gate 0: Authorization

次の各段階は、現M6.1の禁止を解除する明示承認後にのみ実施する。

- commit
- merge / rebase
- push
- deploy
- tag

## Step 1: Git source preservation

1. 168ファイルの監査スナップショットとhash一覧を保存。
2. `.DS_Store`、backup、save、zipをrelease候補から分離。
3. 69 tracked changes、99 untrackedをM1〜M6成果物としてレビュー。
4. 現行working treeを再現可能なcommitへ固定。

完了条件:

- clean checkoutで同じ47 HTML、Rules、Functions、Services、tests、docsを再現できる。

## Step 2: Integration branch

1. 最新remote状態を確認。
2. 専用release integration branchを作成。
3. `origin/main`の79 commitsをmerge。
4. 18 text + 2 image conflictsを一件ずつ解決。
5. 66重複ファイルでM1〜M6機能が失われていないことを確認。

禁止:

- 全ファイルours/theirs
- force push
- UIだけを見た機能コードの上書き

## Step 3: Conflict validation

競合ごとに確認:

- Public layout
- Firestore表示
- LINE / WEB予約
- Favorite同期
- Admin CRUD
- RBAC
- Service import
- Responsive

画像競合は実寸・透明領域・CSS・PC/mobileを目視比較。

## Step 4: Release commit

統合と全テスト完了後、Version 1.0.0 release candidateを一つのcommitとして固定する。

含める:

- M1 Rules
- M2 Service Layer
- M3 CRM / Reservation / Visit / Table
- M4 Sales / Payroll / Closing
- M4.5 QA / Backup / Operations
- M5 Analytics / Notifications
- M6 Version / optimized assets / release docs
- M6.1 audit docs

## Step 5: Quality gate

予定確認:

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

追加:

- Service direct access 0
- Functions exports 4
- 47 HTML local reference 0 errors
- PC / tablet / mobile
- owner / manager / staff / cast / unauthenticated

## Step 6: Push release candidate

品質gate通過後のみpush。

確認:

- branch保護
- remote divergence
- CI結果
- release commit SHA
- backup manifest

## Step 7: Pre-deploy backup

`BACKUP_PLAN.md`に従う。

- Firestore Export
- Storage Backup
- current Hosting release ID
- current Rules
- current Functions revision
- Auth復旧方針
- rollback責任者

## Step 8: Firebase deploy

同一release commitから、承認されたprojectへ実行。

対象:

- Firestore Rules
- Storage Rules
- Functions
- Hosting

deploy対象とproject IDを直前に二名確認する。

## Step 9: Production smoke test

直後に確認:

1. Public主要ページ
2. owner / manager / staff / cast login
3. WEB / LINE予約
4. 受付 → 着席 → 席移動 → 延長 → 会計
5. 売上 → 給与 → 締め
6. M5正式5 URL
7. Notification
8. Rules denial
9. Functions
10. Console / Network error

重大障害時はtagを作らずrollback。

## Step 10: Lighthouse / browser

- Chrome
- Safari
- Edge
- iPhone Safari
- Android Chrome
- PC / tablet / mobile

Lighthouse:

- Performance
- Accessibility
- Best Practices
- SEO

結果を`QA_REPORT.md`と`RELEASE_NOTE.md`へ記録。

## Step 11: Version tag

本番Smoke TestとLighthouse確認後にのみannotated `v1.0.0` tagを作成しpushする。

tagはdeploy済みrelease commitと同一SHAを指すこと。

## Stop conditions

次のいずれかで作業停止:

- 未解決競合
- Rules fail
- Service境界違反
- Console重大error
- M5 URL 404
- backup未確認
- project ID不一致
- データ構造変更を要求する差分
- owner承認なし

## Current status

現在はStep 1より前の分析段階。Merge、Commit、Push、Deploy、Tagは一切実行していない。
