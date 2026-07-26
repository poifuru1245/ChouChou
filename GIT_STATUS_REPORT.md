# ChouChou M6.1 Git Status Report

確認日: 2026-07-27
判定: **統合前・リリース不可**

## 1. Snapshot

| 項目 | 値 |
|---|---|
| Branch | `main` |
| Upstream | `origin/main` |
| HEAD | `ff1db76cd49d7e2a1722aa8a4aebca18b0ec94bc` |
| origin/main | `868894fbf9757e4f8c939b8b778fcdff60a3ed2b` |
| Merge base | `bb3864d7ed87ba3df525663156d98c80cbbc197f` |
| Ahead | 102 commits |
| Behind | 79 commits |
| Staged | 0 files |
| Tracked changes | 69 files |
| Untracked | 99 files |
| 合計 | 168 files |
| Unmerged index | 0 files |
| Stash | 0 entries |
| Submodule | なし |

168件はM6.1文書生成前のファイル単位スナップショットである。前回確認時の165件との差は、未追跡の`DEPLOY_PLAN.md`、`MERGE_REPORT.md`、`RELEASE_CHECKLIST.md`の3件。今回指定された7文書の作成後は、コードを変更しなくても未追跡106件・合計175件になる。

## 2. Remote

```text
origin  https://github.com/poifuru1245/ChouChou.git (fetch)
origin  https://github.com/poifuru1245/ChouChou.git (push)
```

今回、fetch、pull、merge、rebase、push、remote URL変更は実行していない。使用した`origin/main`は前回監査で取得済みのローカルremote-tracking refである。

## 3. Tracked changes

### Modified: 64

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

### Deleted: 5

```text
assets/css/today-pc-scroll.css
assets/js/ranking.js
assets/js/reservation.js
assets/js/today.js
assets/today.js
```

削除は未コミットである。重複実装整理の可能性があるが、releaseへ採用する前にHTML importとService Worker参照を再確認する必要がある。

## 4. Untracked

未追跡は99ファイル。詳細と分類は`UNTRACKED_REPORT.md`を参照。

主なrelease blocker:

- `firestore.rules`
- `storage.rules`
- M5 Analytics正式5画面
- M3/M4の詳細・席・来店・締め画面
- 新Service群
- Rules / QA / Analytics / Financeテスト
- `VERSION`、Release・QA・運用文書

## 5. Stash / Submodule

- `git stash list`: 空
- `.gitmodules`: なし
- `git submodule status`: 出力なし

未コミット成果物を保護するstashやsubmodule依存は存在しない。現状でpull/mergeを実行すると、作業ツリーが直接影響を受ける。

## 6. Safety conclusion

現在の`main`はcleanではなく、originと大きく分岐している。次の操作は未実施であり、承認前に実行してはならない。

- `git merge`
- `git rebase`
- `git commit`
- `git push`
- `git tag`
- `firebase deploy`

先にrelease対象・不要物・origin採用内容を文書上で確定し、再現可能な統合作業単位を作る必要がある。
