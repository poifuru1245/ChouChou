# ChouChou Release Candidate Merge Report

確認日: 2026-07-27
対象: `/Users/konponasahinin/Desktop/ChouChou`
判定: **BLOCKED — 現状のまま取り込み・リリース不可**

## 1. 実施範囲

- `git fetch --prune origin` でリモート追跡参照のみ更新した。
- 実際の `merge` / `pull` / `rebase` は実行していない。
- 元リポジトリを変更せず、`git merge-tree` でコミット間の競合をシミュレーションした。
- Commit、Tag、Deploy、Remoteへの書き込み、Firestoreデータ変更は行っていない。

## 2. Git同期状態

| 項目 | 値 |
|---|---|
| Branch | `main` |
| Local HEAD | `ff1db76cd49d7e2a1722aa8a4aebca18b0ec94bc` |
| `origin/main` | `868894fbf9757e4f8c939b8b778fcdff60a3ed2b` |
| Merge base | `bb3864d7ed87ba3df525663156d98c80cbbc197f` |
| Local only | 102 commits |
| Origin only | 79 commits |
| Working tree changes | 165 files |
| Origin変更と作業ツリー変更の重複 | 66 files |

事前資料にあった「15 commits behind」は、最新のfetch前の値だった。2026-07-27時点の実数は **102 ahead / 79 behind** であり、fast-forwardではない。

`origin/main` の79コミットは、バッジ、公開キャストカード、トップページ、モバイル表示、News、System、Access、Recruit等の変更を含む。一方、ローカル側にはM1〜M6の管理機能・Service・Rules・Functions・分析画面がある。両者は独立して大きく進んでいる。

## 3. コミット間マージシミュレーション

`main` と `origin/main` のコミット済み内容を3-way比較した結果、次の20ファイルはGitが自動的に一本化できない。

### テキスト競合（18）

- `access.html`（add/add）
- `admin/cast.html`
- `assets/app.js`
- `assets/cast-detail.js`
- `assets/cast-manager.js`
- `assets/cast.js`
- `assets/css/home-v11.css`（add/add）
- `assets/css/style.css`
- `assets/gallery.js`
- `assets/js/news.js`
- `cast-detail.html`
- `cast.html`
- `gallery.html`
- `index.html`
- `news.html`
- `recruit.html`（add/add）
- `reservation.html`
- `system.html`（add/add）

### バイナリ競合（2）

- `assets/img/badges/badge-new.png`（add/add、内容が異なる）
- `assets/img/badges/badge-osusume.png`（add/add、内容が異なる）

これらはデザイン、公開導線、Firestore描画、管理画面を横断する。どちらか一方を機械的に採用すると既存機能または現行デザインを失う可能性があるため、勝手な解決は行っていない。

## 4. 未コミット成果物との重複

現在の作業ツリー変更165ファイルのうち、次の66ファイルは `main..origin/main` の変更対象とも重なる。実際の取り込み時には、コミット間競合に加えて未コミット内容の消失・上書きリスクがある。

```text
.DS_Store
404.html
access.html
admin/cast.html
admin/customer-detail.html
admin/customers.html
admin/dashboard.html
admin/payroll.html
admin/reservations.html
admin/sales.html
admin/settings.html
assets/admin-login.js
assets/admin.js
assets/app.js
assets/cast-detail.js
assets/cast-manager.js
assets/cast-portal.js
assets/cast.js
assets/contact-form.js
assets/css/style.css
assets/css/today-pc-scroll.css
assets/customer-detail-admin.js
assets/customers.js
assets/dashboard.js
assets/engagement.js
assets/event-manager.js
assets/forbidden.js
assets/gallery-manager.js
assets/gallery.js
assets/home-engagement.js
assets/js/news.js
assets/js/services/castService.js
assets/js/services/dashboardService.js
assets/js/services/firestoreService.js
assets/js/services/roleService.js
assets/js/services/salesService.js
assets/news-manager.js
assets/payroll.js
assets/ranking.js
assets/recruit-form.js
assets/recruit-manager.js
assets/reservation.js
assets/reservations.js
assets/sales.js
assets/schedule.js
assets/services/customerService.js
assets/services/reservationService.js
assets/services/userAdminService.js
assets/settings-manager.js
assets/system-manager.js
assets/today.js
assets/users.js
cast-detail.html
cast.html
contact.html
favorite.html
firebase.json
gallery.html
index.html
news.html
recruit-form.html
recruit.html
reservation.html
schedule.html
service-worker.js
system.html
```

## 5. M1〜M6反映確認

| Milestone | ローカル実体 | Release branch / origin反映 | 判定 |
|---|---|---|---|
| M1 Security | `firestore.rules`, `storage.rules`, Rules testsあり。記録済み結果21/21 PASS | Rules一式は未追跡。`origin/main` の `firebase.json` にRules指定なし | BLOCKED |
| M2 Service Layer | `assets/services/`, `MigrationReport.md`, `ARCHITECTURE.md`あり。UI直接SDK候補0件 | 多数が未追跡またはorigin側で削除扱い | BLOCKED |
| M3 Reservation + CRM | customers / reservation detail / table manager / visit history と各Serviceあり | 一部は追跡済み、一部は未追跡 | BLOCKED |
| M4 Sales + Payroll | sales / payroll / closing画面、各Service、計算テストあり | 詳細画面・closing等が未追跡 | BLOCKED |
| M4.5 QA | `QA_REPORT.md`, `CHECKLIST.md`, `KnownIssues.md`, `BACKUP_PLAN.md`, `OPERATIONS_MANUAL.md`あり | 主要文書が未追跡 | BLOCKED |
| M5 Analytics | 正式5画面、Analytics/Notification Service、Chart.js画面あり | 5画面すべて未追跡、`origin/main` に0件、本番は5件とも404 | BLOCKED |
| M6 Release | `VERSION`, `CHANGELOG.md`, `RELEASE_NOTE.md`あり | すべて未追跡、`v1.0.0` tagなし | BLOCKED |

結論として、M1〜M6は「ローカル作業ツリーには存在」するが、「再現可能なrelease branchへすべて反映済み」とは確認できない。

## 6. Hosting / 404調査

対象5ページ:

- `admin/analytics-dashboard.html`
- `admin/analytics-sales.html`
- `admin/analytics-cast.html`
- `admin/analytics-customers.html`
- `admin/notifications.html`

確認結果:

1. 5ファイルはローカルに存在する。
2. ローカル `firebase.json` は `hosting.public` が `.` であり、5ファイルは `ignore` に該当しない。この作業ツリーからdeployすれば公開対象に含まれる構成である。
3. 5ファイルはすべてGit未追跡である。
4. `origin/main` に5ファイルは1件も存在しない。
5. 2026-07-27に本番URLをブラウザ確認し、5件すべて `Page Not Found` を返した。

したがって404原因はHosting ignore設定ではなく、**現在の本番デプロイ元に5ファイルが含まれていないこと**である。どのcommitから本番deployされたかはリポジトリだけでは断定できないが、少なくとも現在の `origin/main` からは5ページを再現できない。

## 7. Firebase構成差分

ローカル `firebase.json`:

- Functions: `functions/`, Node.js 22
- Firestore Rules: `firestore.rules`
- Storage Rules: `storage.rules`
- Emulator: Firestore / Storage
- Hosting site: `chouchou-susukino`
- Hosting public: `.`
- HTML / JS / CSS / image cache headersあり
- Functions、Rules、tests、Markdown等をHostingから除外

`origin/main` の `firebase.json`:

- Hostingのみ
- Firestore Rules、Storage Rules、Functions、Emulator、cache headersの指定なし

Functionsはローカルに4 callable exportがある。

- `adminListUsers`
- `adminCreateUser`
- `adminUpdateUser`
- `adminDeactivateUser`

## 8. 確認結果

- Commit間で20ファイルが明示競合。
- 未コミット内容とorigin変更が66ファイル重複。
- M1〜M6の主要成果物が未追跡。
- 本番M5正式URLは5件とも404。
- originのFirebase設定ではM1 Rules / Functionsを再現できない。

この状態で `pull`、`merge`、`rebase`、`firebase deploy` を行ってはならない。まず現行作業ツリーを再現可能な形で保全し、専用統合branch上で20競合をファイルごとにレビューする必要がある。
