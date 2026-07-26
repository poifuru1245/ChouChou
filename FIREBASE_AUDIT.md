# ChouChou M6.1 Firebase Audit

確認日: 2026-07-27
判定: **ローカル構成はM1〜M6対応、Git反映は未完了**

## 1. Project

`.firebaserc`:

```json
{
  "projects": {
    "default": "chouchou-susukino"
  }
}
```

`.firebaserc`はtracked、変更なし。

## 2. firebase.json comparison

| 機能 | Working tree | committed main | origin/main |
|---|---|---|---|
| Hosting site/public | あり | あり | あり |
| Functions Node.js 22 | あり | あり | なし |
| Firestore Rules指定 | あり | なし | なし |
| Storage Rules指定 | あり | なし | なし |
| Firestore Emulator | あり | なし | なし |
| Storage Emulator | あり | なし | なし |
| Cache headers | あり | なし | なし |
| Expanded ignore | あり | 一部あり | 最小構成 |

working treeの`firebase.json`はtracked modified。M1 Rules・M4.5 Emulator・M6 cache設定はまだcommitから再現できない。

## 3. Firestore Rules

- File: `firestore.rules`
- 状態: ローカル存在、未追跡
- `firebase.json` working treeから参照済み
- Rules test record: 21/21 PASS

明示collection:

- public/content: casts, schedules, news, gallery, events, content, systemItems
- operations: settings, reservations, customers, visits, tables
- finance: sales, payrollSettings, commissionRules, payrolls
- closing/audit: dailyClosings, monthlyClosings, businessAuditLogs, auditLogs
- portal: payrollHistory, castRankings, shiftRequests, castAnnouncements, castPortalUsers
- auth/forms: users, contacts, recruitApplications, castViews
- fallback deny: `/{document=**}`

owner / manager / staff / cast / inactive / unauthenticatedの境界をRules testsで保持している。

## 4. Storage Rules

- File: `storage.rules`
- 状態: ローカル存在、未追跡
- `firebase.json` working treeから参照済み

明示path:

- `casts`
- `gallery`
- `news`
- `system`
- `events`
- `event-banners`
- `recruit`
- `cast-profiles/{userId}`
- fallback deny

画像MIME、10MB上限、role、cast本人制御がテスト対象。

## 5. Cloud Functions

Source: `functions/`

| 項目 | 値 |
|---|---|
| Runtime | Node.js 22 |
| firebase-functions | 7.3.0 |
| firebase-admin | 14.2.0 |
| Tracking on main | 4 files tracked |
| Working changes | なし |
| origin comparison | 4 filesすべて削除扱い |

Exports:

- `adminListUsers`
- `adminCreateUser`
- `adminUpdateUser`
- `adminDeactivateUser`

Admin SDKは`users`、`casts`、`auditLogs`を扱う。仕様変更は今回行っていない。mergeではorigin側削除を採用してはならない。

## 6. Hosting

| 項目 | Working tree |
|---|---|
| site | `chouchou-susukino` |
| public | `.` |
| HTML cache | `max-age=0,must-revalidate` |
| JS/CSS cache | `max-age=3600,must-revalidate` |
| images/fonts cache | `max-age=31536000,immutable` |

Ignore:

- Firebase config/debug
- Rules
- Functions
- Tests
- Markdown
- dotfiles
- node_modules
- 届出書、xlsx、HEIC
- backup、save

Public rootが`.`のため、ignore漏れはそのままHosting upload候補になる。release前にbackupファイルと不要画像のmanifest確認が必要。

## 7. Emulator

working tree config:

- Firestore: 8080
- Storage: 9199
- Emulator UI: disabled

保持済み結果:

- 21 tests
- 21 pass
- 0 fail
- 本番データ読書きなし

今回Emulatorは再実行せず、既存`tests/rules/RESULTS.md`を監査した。

## 8. Cache audit

M6 cache方針はworking treeにのみ存在する。

- HTMLを常に再検証
- JS/CSSを1時間
- fingerprintされていない画像も1年immutable

画像URLにversion/hashがない場合、1年immutableは差し替え反映を遅らせる。release時はファイル名変更またはquery/version運用が成立しているか確認する。今回は設定変更しない。

## 9. Risk conclusion

1. Rules本体が未追跡。
2. full Firebase configが未コミット。
3. originにはRules / Functions設定がない。
4. originではFunctionsが削除扱い。
5. Hosting publicが`.`で、clean release treeの内容がそのまま重要。

Git統合完了前のFirebase deployは禁止。
