# ChouChou M6.1 Untracked File Report

確認日: 2026-07-27
基準: M6.1文書生成前

## 1. Summary

未追跡は99ファイル。

| 分類 | 件数 |
|---|---:|
| HTML | 13 |
| CSS | 3 |
| JavaScript / Test JavaScript | 53 |
| Rules / Rules package metadata | 4 |
| Functions | 0 |
| Images | 8 |
| Docs / VERSION | 18 |
| Firebase config | 0 |
| 合計 | 99 |

今回の7文書を追加した後は未追跡106ファイルになる。

## 2. HTML: 13

```text
admin/analytics-cast.html
admin/analytics-customer.html
admin/analytics-customers.html
admin/analytics-dashboard.html
admin/analytics-sales.html
admin/analytics.html
admin/closing.html
admin/notifications.html
admin/payroll-detail.html
admin/reservation-detail.html
admin/sale-detail.html
admin/table-manager.html
admin/visit-history.html
```

すべてM3〜M5のrelease候補。互換用`analytics.html` / `analytics-customer.html`と正式URLを区別して追跡する。

## 3. CSS: 3

```text
assets/css/analytics.css
assets/css/finance.css
assets/css/operations.css
```

M3〜M5画面から参照されるためrelease必須。

## 4. JavaScript: 53

### Page / component / utility: 15

```text
assets/analytics-cast.js
assets/analytics-customer.js
assets/analytics-sales.js
assets/analytics.js
assets/closing.js
assets/components/chartManager.js
assets/notifications.js
assets/payroll-detail.js
assets/reservation-detail.js
assets/sale-detail.js
assets/table-manager.js
assets/utils/analyticsUi.js
assets/utils/dateTime.js
assets/utils/firestoreData.js
assets/visit-history.js
```

### Service Layer: 31

```text
assets/services/accessPolicy.js
assets/services/analyticsCalculator.js
assets/services/analyticsService.js
assets/services/auditService.js
assets/services/authService.js
assets/services/castPortalService.js
assets/services/castService.js
assets/services/castViewService.js
assets/services/closingService.js
assets/services/contactService.js
assets/services/dashboardService.js
assets/services/dataService.js
assets/services/errors.js
assets/services/eventService.js
assets/services/financeCalculator.js
assets/services/galleryService.js
assets/services/newsService.js
assets/services/notificationService.js
assets/services/payrollService.js
assets/services/recruitService.js
assets/services/roleService.js
assets/services/salesService.js
assets/services/scheduleService.js
assets/services/serviceLogger.js
assets/services/serviceRuntime.js
assets/services/siteService.js
assets/services/storageService.js
assets/services/systemService.js
assets/services/tableService.js
assets/services/userService.js
assets/services/visitService.js
```

### Tests: 7

```text
tests/analytics/analytics-calculator.test.mjs
tests/finance/finance-calculator.test.mjs
tests/qa/rbac-contract.test.mjs
tests/qa/static-audit.mjs
tests/rules/firestore.rules.test.mjs
tests/rules/storage.rules.test.mjs
tests/rules/test-helpers.mjs
```

## 5. Rules: 4

```text
firestore.rules
storage.rules
tests/rules/package.json
tests/rules/package-lock.json
```

Rules本体が未追跡のままでは、M1をrelease commitから再現できない。

## 6. Functions: 0

`functions/index.js`、`package.json`、`package-lock.json`、`.gitignore`はすでにmainで追跡済み。作業ツリー変更はない。ただし`origin/main`との比較では4ファイルとも削除扱いになるため、merge時の保護対象。

## 7. Images: 8

```text
assets/images/concept-ver6.webp
assets/images/contact-ver6.webp
assets/images/hero-princess.webp
assets/images/hero-ver6.webp
assets/images/recruit-interior-premium-v2.webp
assets/img/badges/badge-new.webp
assets/img/badges/badge-osusume.webp
assets/img/hero/top-ver62.webp
```

M6の転送量改善候補。HTML/CSS/JS参照と元画像fallbackを確認してからreleaseへ含める。

## 8. Docs / VERSION: 18

```text
ARCHITECTURE.md
BACKUP_PLAN.md
CHANGELOG.md
CHECKLIST.md
DEPLOY_PLAN.md
KnownIssues.md
MERGE_REPORT.md
MigrationReport.md
OPERATIONS_MANUAL.md
QA_REPORT.md
README.md
RELEASE_CHECKLIST.md
RELEASE_NOTE.md
ROADMAP.md
TODO.md
VERSION
assets/services/README.md
tests/rules/RESULTS.md
```

このうち`DEPLOY_PLAN.md`、`MERGE_REPORT.md`、`RELEASE_CHECKLIST.md`は直前監査で追加された3件。

## 9. Firebase config: 0

`firebase.json`は未追跡ではなくtracked modified。`.firebaserc`はtrackedで変更なし。詳細は`FIREBASE_AUDIT.md`を参照。

## 10. Classification result

99件の大部分はM1〜M6の必須成果物で、単純削除対象ではない。特にRules、Service、M3〜M5画面、tests、Version文書をrelease commitへ含めない限り、正式リリースは再現できない。
