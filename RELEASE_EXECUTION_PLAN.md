# ChouChou M6.2 Release Execution Plan

作成日: 2026-07-27
状態: **手順のみ・未実行**

## 1. Recommended branch model

推奨branch:

```text
codex/release-v1.0.0-integration
```

現在のdirty `main`上でいきなりmergeしない。明示承認後、ローカルM1〜M6を`COMMIT_PLAN.md`どおり固定してからrelease branchを使用する。

## 2. Phase A: preserve local source

1. 現在の175ファイル状態をbackup manifestへ記録。
2. 69 tracked changesと106 untrackedをreview。
3. release除外候補を分離。
4. M1〜M6をCommit 1〜8へ固定。
5. clean checkoutで47 HTMLと全Serviceを再現。

Gate:

- working tree clean
- local tests PASS
- release sourceからRules / Functions / M5を再現可能

## 3. Phase B: create release branch

承認後の予定:

```sh
git switch -c codex/release-v1.0.0-integration
```

branch作成前にHEADとbackup SHAを記録する。

## 4. Phase C: merge origin

最新remote確認後、release branch上でのみ実施。

予定:

```sh
git merge --no-commit --no-ff origin/main
```

この時点でcommitしない。

解決順:

1. Critical 7 files
2. High 7 files
3. Medium 4 files
4. Binary 2 files
5. 非競合remote additions/deletions

`MERGE_STRATEGY.md`にない判断が必要になった場合は停止して再承認を取る。

## 5. Phase D: merge validation

必須確認:

```sh
git diff --check
git diff --name-only --diff-filter=U
node --check assets/app.js
node --check assets/cast.js
node --check assets/admin.js
node --check assets/analytics.js
node --check assets/analytics-sales.js
node --check assets/analytics-cast.js
node --check assets/analytics-customer.js
node --check assets/notifications.js
node --check functions/index.js
node tests/qa/static-audit.mjs
node --test tests/qa/rbac-contract.test.mjs tests/analytics/analytics-calculator.test.mjs tests/finance/finance-calculator.test.mjs
firebase emulators:exec --only firestore,storage "npm test --prefix tests/rules"
```

追加:

- UI直接Firebase SDK 0
- Functions exports 4
- owner / manager / staff / cast / unauthenticated
- PC / tablet / mobile
- LINE / WEB reservation
- favorite同期
- admin CRUD

## 6. Phase E: merge commit

全競合と品質gateを通過後のみCommit 9を作成。

予定message:

```text
merge: integrate reviewed origin main changes
```

必要な回帰修正はCommit 10へ分離する。

## 7. Phase F: push and review

承認後のみ:

```sh
git push -u origin codex/release-v1.0.0-integration
```

Pull Requestで確認:

- 79 remote commits接続
- M1〜M6保持
- 91 remote deletionの不採用
- backup artifacts除外
- 20 conflict decisions
- CI / Rules / static audit

PR承認後にmainへ統合する。force push禁止。

## 8. Phase G: pre-deploy

mainのrelease SHAを記録し、次を完了:

- Firestore Export
- Storage Backup
- current Hosting release ID
- current Rules
- Functions revision
- Auth復旧方針
- Firebase project ID二名確認

`RELEASE_CHECKLIST.md`未完了項目があれば停止。

## 9. Phase H: deploy

明示承認後、同一release SHAから実行。

予定:

```sh
firebase use chouchou-susukino
firebase deploy --only firestore:rules,storage,functions,hosting
```

Rules互換性に懸念があれば、staging / Emulator確認を追加する。本番データ構造は変更しない。

## 10. Phase I: smoke test

デプロイ直後:

1. Public 16 pages
2. Admin主要画面
3. Cast Portal
4. owner / manager / staff / cast login
5. WEB / LINE reservation
6. 受付 → 着席 → 席移動 → 延長 → 会計
7. 売上 → 給与 → 締め
8. M5正式5 URL
9. Notification
10. Functions / Rules / Storage
11. Console Error 0
12. Network 404 / 500 0

重大障害ならtagを作らずrollback。

## 11. Phase J: Lighthouse

本番で記録:

- Performance
- Accessibility
- Best Practices
- SEO
- transfer size
- cache headers

Chrome、Safari、Edge、iPhone Safari、Android Chromeを確認する。

## 12. Phase K: tag

Smoke TestとLighthouse後、deploy済みSHAへtag。

予定:

```sh
git tag -a v1.0.0 -m "ChouChou Version 1.0.0"
git push origin v1.0.0
```

tag前にrelease SHAとHosting release SHAの一致を確認する。

## 13. Stop conditions

- 未解決conflict
- unexpected remote deletion
- Rules fail
- Service boundary violation
- Functions export不一致
- M5 404
- Console重大error
- backup未確認
- project ID不一致
- UIまたはFirestore構造の意図しない変更

## 14. Actions not executed in M6.2

- Merge
- Rebase
- Commit
- Push
- Deploy
- Tag
- Remote変更

本書は実行順と停止条件のみを定義する。
