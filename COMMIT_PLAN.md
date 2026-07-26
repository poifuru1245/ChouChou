# ChouChou M6.2 Commit Plan

作成日: 2026-07-27
状態: 計画のみ。Commit未実行。

## 1. Principles

- ローカルM1〜M6を先に再現可能なcommit群へ固定する。
- 1 commitは1つのrollback理由を持つ。
- UIと業務データ処理を同一commitへ混在させない。
- Rules、Functions、Service API、画面を依存順にcommitする。
- `.DS_Store`、backup、`.save`、zipはcommitしない。
- origin統合は最後の明示merge commitにする。

## 2. Proposed commits

### Commit 1: repository hygiene

Proposed message:

```text
chore: prepare version 1.0.0 release source
```

対象:

- 不要な重複JS削除の確定
- `.gitignore`確認
- `.DS_Store`等のrelease除外
- ファイル移行後の参照整理

注意: 動作変更を含めない。削除5ファイルは参照0件を証明してから含める。

### Commit 2: M1 Security

```text
feat: finalize security rules and role access
```

対象:

- `firestore.rules`
- `storage.rules`
- RBAC / access policy
- Rules testsと結果
- `firebase.json`のRules / Emulator指定

Functions仕様は変更しない。既存Functionsはこのcommitで削除しない。

### Commit 3: M2 Service Layer

```text
refactor: finalize service layer architecture
```

対象:

- `assets/services/`
- `assets/js/services/`の移行互換
- common errors/runtime/logger/data
- storage/auth/role services
- UIからの直接Firebaseアクセス除去
- `MigrationReport.md`の実装部分は最後のdocs commitでも可

### Commit 4: M3 CRM and reservations

```text
feat: finalize crm reservation and visit platform
```

対象:

- customers / customer-detail
- reservations / reservation-detail
- table-manager / visit-history
- customer / reservation / table / visit Services
- operations CSS

### Commit 5: M4 Finance

```text
feat: finalize sales payroll and closing platform
```

対象:

- sales / sale-detail
- payroll / payroll-detail
- closing
- sales / payroll / closing / audit Services
- finance calculator / tests / CSS

### Commit 6: M5 Analytics

```text
feat: finalize analytics and notification platform
```

対象:

- M5正式5画面
- 互換Analytics URL
- analytics / notification JS
- Chart manager / analytics UI
- analytics Services / calculator / tests / CSS

このcommitで本番404のsource欠落を解消できる構造にする。

### Commit 7: M6 Production hardening

```text
perf: finalize version 1.0.0 production assets
```

対象:

- WebP assets
- HTML/JS参照先
- Service Worker version
- Hosting cache headers

UIの見た目を変更せず、画像参照とcacheだけを扱う。

### Commit 8: QA and operations documentation

```text
docs: finalize version 1.0.0 release operations
```

対象:

- `VERSION`
- README / CHANGELOG / RELEASE_NOTE
- ARCHITECTURE / MigrationReport
- QA / Checklist / KnownIssues
- Backup / Operations
- M6.1 / M6.2監査文書

### Commit 9: origin integration

```text
merge: integrate reviewed origin main changes
```

通常のmerge commitとして79 remote commitsの履歴を接続する。

含める内容:

- `MERGE_STRATEGY.md`で承認されたmanual merge
- Keep Local解決
- 不要remote backupの除外
- binary asset選択結果

### Commit 10: integration stabilization

必要な場合のみ:

```text
fix: stabilize version 1.0.0 release integration
```

対象:

- merge後テストで見つかった回帰のみ
- 新機能・UI刷新は禁止

このcommitが不要なら作らない。

## 3. Dependency order

```text
Hygiene
  ↓
Security
  ↓
Service Layer
  ↓
CRM / Reservation
  ↓
Sales / Payroll
  ↓
Analytics
  ↓
Production Assets
  ↓
Documentation
  ↓
origin merge
  ↓
Stabilization if required
```

## 4. Per-commit quality gate

各commit前:

- staged diffをpath単位で確認
- secrets / personal dataなし
- unrelated UI変更なし
- `git diff --cached --check`

関連commit後:

- JavaScript `node --check`
- static HTML audit
- unit tests
- Service boundary scan
- Rules変更時はEmulator

## 5. Release history policy

- 102 local commitsをrebaseで書き換えない。
- origin 79 commitsをsquashせず、統合merge commitで接続する。
- release branchからmainへはreview済みmergeを使用。
- `v1.0.0` tagはdeploy済みcommitへSmoke Test後に付ける。

## 6. Rollback units

| Problem | Revert target |
|---|---|
| Rules / RBAC | Commit 2 |
| Service/import | Commit 3 |
| CRM/Reservation | Commit 4 |
| Sales/Payroll | Commit 5 |
| Analytics/404 | Commit 6 |
| Image/cache | Commit 7 |
| Remote regression | Commit 9または10 |

## 7. Current prohibition

この計画作成時点では`git add`、`git commit`、`git merge`を実行していない。
