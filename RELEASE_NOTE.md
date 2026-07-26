# ChouChou Version 1.0.0 Release Note

Release candidate date: 2026-07-20
Target Firebase project/site: `chouchou-susukino`
Status: **PRODUCTION RELEASE BLOCKED — do not tag or deploy yet**

## Release scope

Version 1.0.0 consolidates the Public Site, Admin, Cast Portal, CRM, Reservation, Table/Visit, Sales, Payroll/Closing, Dashboard, Analytics, Notification Center, RBAC, Security Rules, and operating documentation developed through M1–M6.

No Firestore business-data schema or Cloud Functions API was changed during M6.

## Validation completed

- JavaScript syntax: PASS.
- Analytics/finance/RBAC tests: 16/16 PASS.
- Firestore/Storage Emulator Rules tests: 21/21 PASS.
- Static audit: 47 HTML files, missing references 0, duplicate IDs 0, missing alt 0, unsafe blank targets 0.
- Service boundary: UI direct Firestore/Storage API calls 0.
- Functions: four existing Callable exports load successfully with locked dependencies.
- `git diff --check`: PASS.
- Current production Public top: HTTP display confirmed, horizontal overflow 0, Console Error/Warning 0 in the completed PC read-only check.

## Lighthouse baseline

Measured against the currently deployed production top before Version 1.0.0 deployment:

| Category | Score |
|---|---:|
| Performance | 20 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 91 |

Baseline details: FCP 5.2s, LCP 70.0s, TBT 36,890ms, CLS 0.145, total transfer 13,340 KiB. The environment experienced unusually long Chrome collection time, but the payload finding is valid. M6 replaces the dominant local image requests with WebP variants; the eight active optimized files total about 1.0 MB instead of about 15 MB. A post-deploy Lighthouse run is required for the final production score.

## Release blockers

1. Git `main` is 102 commits ahead and 15 commits behind `origin/main`, with M1–M6 changes still uncommitted. A release tag on this state would not identify a reproducible source tree.
2. Current production returns 404 for `admin/analytics-dashboard.html`; Hosting does not yet match the Version 1.0.0 candidate.
3. owner/manager/staff/cast production test accounts or authenticated sessions were not available, so the requested role-based production Smoke Test could not be executed.
4. Latest Firestore/Storage/Auth backup time, backup manifest, Secret Manager inventory, and production environment inventory have not been confirmed by an owner.
5. App Check remains disabled for Callable Functions (`enforceAppCheck:false`). Acceptance is required before release.
6. Safari, Edge, iPhone Safari, and Android Chrome were not available as independent browser engines in this environment. Static compatibility and Chromium checks do not replace real-device acceptance.

## Required release sequence

1. Freeze production writes and confirm a current backup using `BACKUP_PLAN.md`.
2. Reconcile the 15 remote-only commits without discarding the current M1–M6 work.
3. Review and commit the complete release tree.
4. Run all automated tests again from the release commit.
5. Deploy Rules, Functions, Storage/Hosting configuration, and Hosting from the same commit.
6. Execute the authenticated production Smoke Test with dedicated QA records and remove/close those records afterward.
7. Run post-deploy Lighthouse and browser/device acceptance.
8. Only after all blockers are cleared, create and push annotated tag `v1.0.0`.
