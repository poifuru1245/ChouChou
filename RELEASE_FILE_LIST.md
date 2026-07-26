# ChouChou Version 1.0.0 Release File List

確認日: 2026-07-27
用途: clean checkoutからVersion 1.0.0を再現するための必須ファイル監査

## 1. Public Site

### HTML: 16

```text
404.html
access.html
cast-detail.html
cast-portal.html
cast.html
contact.html
favorite.html
favorites.html
gallery.html
index.html
news.html
recruit-form.html
recruit.html
reservation.html
schedule.html
system.html
```

### Public runtime

- `assets/app.js`
- `assets/cast.js`
- `assets/cast-detail.js`
- `assets/gallery.js`
- `assets/reservation.js`
- `assets/schedule.js`
- `assets/contact-form.js`
- `assets/recruit-form.js`
- `assets/js/news.js`
- `assets/js/firebase/firebaseClient.js`
- `service-worker.js`
- `cast-portal.webmanifest`

### Public CSS

- `assets/css/style.css`
- `assets/css/home-v11.css`
- `assets/css/mobile-v10.css`
- `assets/css/interior-v14.css`
- `assets/css/cast-detail-premium-v56.css`
- `assets/css/cast-portal.css`
- `assets/css/customer-detail.css`
- `assets/css/customers.css`
- `assets/css/engagement-v72.css`
- `assets/css/homepage-refine.css`
- `assets/css/reservations.css`

Public HTMLから参照される画像・font・badgeもrelease対象。M6最適化WebPは元画像と参照先を一組で監査する。

## 2. Admin

### HTML: 31

```text
admin/403.html
admin/analytics-cast.html
admin/analytics-customer.html
admin/analytics-customers.html
admin/analytics-dashboard.html
admin/analytics-sales.html
admin/analytics.html
admin/cast.html
admin/closing.html
admin/customer-detail.html
admin/customers.html
admin/dashboard.html
admin/event.html
admin/gallery.html
admin/login.html
admin/news.html
admin/notifications.html
admin/payroll-detail.html
admin/payroll.html
admin/ranking.html
admin/recruit.html
admin/reservation-detail.html
admin/reservations.html
admin/sale-detail.html
admin/sales.html
admin/schedule.html
admin/settings.html
admin/system.html
admin/table-manager.html
admin/users.html
admin/visit-history.html
```

### Admin runtime

- `assets/admin-login.js`
- `assets/admin.js`
- `assets/cast-manager.js`
- `assets/customers.js`
- `assets/customer-detail-admin.js`
- `assets/dashboard.js`
- `assets/event-manager.js`
- `assets/gallery-manager.js`
- `assets/news-manager.js`
- `assets/payroll.js`
- `assets/payroll-detail.js`
- `assets/ranking.js`
- `assets/recruit-manager.js`
- `assets/reservations.js`
- `assets/reservation-detail.js`
- `assets/sales.js`
- `assets/sale-detail.js`
- `assets/schedule.js`
- `assets/settings-manager.js`
- `assets/system-manager.js`
- `assets/table-manager.js`
- `assets/users.js`
- `assets/visit-history.js`
- `assets/forbidden.js`

### Admin CSS

- `assets/css/admin.css`
- `assets/css/analytics.css`
- `assets/css/finance.css`
- `assets/css/operations.css`
- `assets/css/users.css`

## 3. Analytics

正式URL:

```text
admin/analytics-dashboard.html
admin/analytics-sales.html
admin/analytics-cast.html
admin/analytics-customers.html
admin/notifications.html
```

互換URL:

```text
admin/analytics.html
admin/analytics-customer.html
```

Runtime:

```text
assets/analytics.js
assets/analytics-sales.js
assets/analytics-cast.js
assets/analytics-customer.js
assets/notifications.js
assets/components/chartManager.js
assets/utils/analyticsUi.js
assets/services/analyticsCalculator.js
assets/services/analyticsService.js
assets/services/notificationService.js
assets/css/analytics.css
```

外部依存はChart.js 4.4.7 CDN。CSP、ネットワーク失敗時表示、version固定を確認する。

## 4. CRM / Reservation / Visit

```text
admin/customers.html
admin/customer-detail.html
admin/reservations.html
admin/reservation-detail.html
admin/table-manager.html
admin/visit-history.html
assets/customers.js
assets/customer-detail-admin.js
assets/reservations.js
assets/reservation-detail.js
assets/table-manager.js
assets/visit-history.js
assets/services/customerService.js
assets/services/reservationService.js
assets/services/tableService.js
assets/services/visitService.js
assets/css/operations.css
```

## 5. Sales / Payroll / Closing

```text
admin/sales.html
admin/sale-detail.html
admin/payroll.html
admin/payroll-detail.html
admin/closing.html
assets/sales.js
assets/sale-detail.js
assets/payroll.js
assets/payroll-detail.js
assets/closing.js
assets/services/salesService.js
assets/services/payrollService.js
assets/services/closingService.js
assets/services/financeCalculator.js
assets/services/auditService.js
assets/css/finance.css
```

## 6. Service Layer

Releaseには`assets/services/*.js`と、移行期間中の`assets/js/services/*.js`を参照関係に従って含める。

必須境界:

- auth / role / access policy
- cast / customer / reservation / table / visit
- sales / payroll / closing / audit
- analytics / notification / dashboard
- news / gallery / schedule / event / recruit / system / contact
- storage
- common data / error / runtime / logger

未使用と判断したServiceを削除する場合も、全HTML/JS import監査後に別変更として行う。

## 7. Firebase / Functions

```text
.firebaserc
firebase.json
firestore.rules
storage.rules
functions/.gitignore
functions/index.js
functions/package.json
functions/package-lock.json
```

Functions exports:

- `adminListUsers`
- `adminCreateUser`
- `adminUpdateUser`
- `adminDeactivateUser`

## 8. Rules / QA tests

```text
tests/rules/firestore.rules.test.mjs
tests/rules/storage.rules.test.mjs
tests/rules/test-helpers.mjs
tests/rules/package.json
tests/rules/package-lock.json
tests/rules/RESULTS.md
tests/qa/rbac-contract.test.mjs
tests/qa/static-audit.mjs
tests/analytics/analytics-calculator.test.mjs
tests/finance/finance-calculator.test.mjs
```

TestsはHosting upload対象外だが、release sourceには必要。

## 9. Docs / Version

```text
VERSION
README.md
CHANGELOG.md
RELEASE_NOTE.md
ARCHITECTURE.md
MigrationReport.md
QA_REPORT.md
CHECKLIST.md
KnownIssues.md
BACKUP_PLAN.md
OPERATIONS_MANUAL.md
ROADMAP.md
TODO.md
RELEASE_CHECKLIST.md
MERGE_REPORT.md
DEPLOY_PLAN.md
GIT_STATUS_REPORT.md
MERGE_ANALYSIS.md
UNTRACKED_REPORT.md
RELEASE_FILE_LIST.md
FIREBASE_AUDIT.md
HOSTING_REPORT.md
FINAL_RELEASE_PLAN.md
```

MarkdownはHosting ignore対象だが、release sourceと運用には必要。

## 10. Exclusion candidates

次はrelease成果物へ含めない候補。削除自体は今回行わない。

- `.DS_Store`
- `*-backup.*`
- `*-before-*.html/css`
- `*.save`
- zip backup
- Firebase debug logs
- `node_modules/`
- Excel / HEIC / 届出書

## 11. Completion rule

正式release commitのclean checkoutで以下を満たすこと。

- Public 16 HTMLとAdmin 31 HTMLが存在
- 静的監査のmissing local referencesが0
- M5正式5 URLがHosting manifestへ入る
- RulesとFunctionsが`firebase.json`から参照される
- Service境界テストがPASS
- Version・QA・運用文書が同じcommitに含まれる
