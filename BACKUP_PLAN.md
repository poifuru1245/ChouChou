# ChouChou Backup & Restore Plan

最終更新: 2026-07-20
対象Firebase project: `chouchou-susukino`
対象Storage bucket: `chouchou-susukino.firebasestorage.app`

## 1. 目的と責任

Firestore、Storage、Authentication、Cloud Functions、設定ファイルを、誤削除・誤更新・アカウント侵害・デプロイ障害から復旧できる状態にする。バックアップ操作と復元承認はownerが担当し、manager以下へ本番復元権限を付与しない。

Version 1.0.0のデプロイ前に、最新Export時刻、Storage複製、Auth保管世代、manifest、復元責任者をownerが確認する。これらが未確認の間は正式リリースを行わない。

暫定運用目標（本番責任者の承認後に確定する）:

| 項目 | 暫定値 |
|---|---:|
| RPO（許容データ損失） | 24時間以内 |
| RTO（復旧目標時間） | 4時間以内 |
| Firestore保持期間 | 日次35日、週次14週間 |
| Storageバックアップ保持期間 | 日次35日、月次12か月 |
| 復元訓練 | 四半期ごと |

## 2. バックアップ対象

### Firestore

全コレクションを一括Exportする。特に次の業務・権限データを必須とする。

- 公開・運営: `casts`, `schedules`, `news`, `gallery`, `events`, `content`, `systemItems`, `settings`
- CRM・予約: `customers`, `reservations`, `visits`, `tables`
- 売上・給与・締め: `sales`, `payrollSettings`, `commissionRules`, `payrolls`, `dailyClosings`, `monthlyClosings`
- ポータル: `payrollHistory`, `castRankings`, `shiftRequests`, `castAnnouncements`, `castPortalUsers`と`announcementReads`
- 受付・分析: `contacts`, `recruitApplications`, `castViews`
- 権限・監査: `users`, `auditLogs`, `businessAuditLogs`

Firestore managed exportにはAuthenticationユーザー、Storage画像、Security Rules、TTL設定は含まれない。Importは既存IDを維持し、同一IDを上書きする一方、Exportに含まれない既存文書を削除しない。

### Cloud Storage

次のprefixを対象にする。

- `casts/`
- `cast-profiles/`
- `gallery/`
- `news/`
- `system/`
- `events/`
- `event-banners/`
- `recruit/`

### Firebase Authentication

AuthユーザーはFirestoreの`users`とは別にExportする。JSONにはパスワードハッシュ等の機密情報が含まれるため、暗号化された限定アクセス領域に保存し、Git・共有Drive・通常のバックアップbucketへ平文で置かない。

### コード・Functions・設定

| 対象 | 保存方法 | 注意 |
|---|---|---|
| HTML / JS / CSS / Functions | Gitリモートとリリースcommit | 未commitの作業はバックアップではない |
| `functions/package-lock.json` | Git | 依存関係の再現に必須 |
| `firebase.json`, `.firebaserc` | Git | project/site対応を確認 |
| `firestore.rules`, `storage.rules` | Git | Rulesテスト結果も保存 |
| Secret Manager | secret名・用途・利用Function・復旧責任者を別台帳化 | 値をGitへ保存しない |
| Functions環境変数 | キー名と再設定手順を別台帳化 | `.env*`の秘密値をGitへ保存しない |
| Firebase Auth provider設定 | Console画面または構成台帳 | Firestore Export対象外 |
| Firestore index / TTL / backup schedule | ConsoleまたはIaC台帳 | 現在`firestore.indexes.json`は未管理 |

現在の`functions/index.js`には`defineSecret`、`process.env`、旧`functions.config()`によるユーザー定義設定は見当たらない。ただし、デプロイ済み環境に残るSecretや設定はコードだけでは断定できないため、Console / CLIの棚卸しを別途行う。

## 3. 推奨バックアップ構成

本番Storage bucket自身をバックアップ先にしない。別bucket、可能なら別projectへ保存する。

例:

```text
gs://<BACKUP_BUCKET>/
  firestore/YYYY/MM/DD/<EXPORT_PREFIX>/
  storage/YYYY/MM/DD/<OBJECTS...>
  auth/YYYY/MM/DD/auth-users.json.enc
  manifests/YYYY/MM/DD/manifest.txt
```

バックアップbucketは一般公開禁止、ownerとバックアップ用サービスアカウントだけに最小権限を付与する。Retention PolicyまたはBucket Lockは、保持期間と費用を確認してから設定する。Storage本体ではSoft Deleteの有効状態と保持日数を毎月確認する。

## 4. 定期バックアップ手順

以下の`<BACKUP_BUCKET>`と日時prefixを実値へ置き換える。実行前に`gcloud config get-value project`が`chouchou-susukino`であることを確認する。

### 4.1 Firestore managed export

```bash
gcloud firestore export gs://<BACKUP_BUCKET>/firestore/YYYY/MM/DD/export-HHMM \
  --database='(default)' \
  --project=chouchou-susukino
```

完了確認:

```bash
gcloud firestore operations list --project=chouchou-susukino
gcloud storage ls gs://<BACKUP_BUCKET>/firestore/YYYY/MM/DD/export-HHMM/
```

Exportは開始時点の厳密なスナップショットではなく、処理中の変更を含む場合がある。会計・締めなど整合性を強く求める緊急Exportでは、管理画面の更新を一時停止してから実行する。日常バックアップはFirestoreのScheduled Backupも併用する。

### 4.2 Storage複製

```bash
gcloud storage rsync --recursive \
  gs://chouchou-susukino.firebasestorage.app \
  gs://<BACKUP_BUCKET>/storage/YYYY/MM/DD
```

同期元の誤削除をバックアップ先へ伝播させないため、削除同期オプションは使用しない。実行後に件数・合計容量と主要prefixを確認する。

### 4.3 Authentication

```bash
firebase auth:export auth-users-YYYY-MM-DD.json \
  --format=json \
  --project=chouchou-susukino
```

出力直後に暗号化し、平文を安全に削除する。復元に必要なSCRYPTパラメータは機密情報として別保管する。Auth ExportとFirestore `users` Exportを同じ世代として記録する。

### 4.4 構成・Functions

```bash
git rev-parse HEAD
firebase functions:list --project=chouchou-susukino
firebase functions:secrets:get <SECRET_NAME> --project=chouchou-susukino
```

manifestへ次を記録する。

- Git commit SHAとbranch
- Firebase CLI / Node.js version
- デプロイ済みFunction名、region、runtime
- Secret名とversion（値は記録しない）
- Auth provider、許可domain、App Check状態
- RulesファイルのSHA-256
- Firestore index、TTL、Scheduled Backup、PITRの設定状態

## 5. 復元の原則

1. ownerが障害範囲と復元時点を決定する。
2. 書き込みを止め、現状を別prefixへ退避する。
3. 可能なら本番へ直接戻さず、隔離projectまたは新規Firestore databaseで検証する。
4. Firestore、Storage、Authの世代を揃える。
5. RulesとFunctionsを先に検証し、データ投入後に公開する。
6. 復元操作・担当・時刻・対象・結果を監査記録へ残す。

## 6. Firestore復元

### 事前確認

- Export operationが成功している。
- `.overall_export_metadata`が存在し、親folder名と一致する。
- 対象project/databaseと復元prefixを二者確認した。
- 書き込み停止またはメンテナンス告知済み。
- 現在データを緊急Export済み。

### Import

```bash
gcloud firestore import gs://<BACKUP_BUCKET>/firestore/YYYY/MM/DD/<EXPORT_PREFIX>/ \
  --database='(default)' \
  --project=chouchou-susukino
```

Importは既存文書を全消去して置換する処理ではない。対象外の文書は残るため、「完全に過去状態へ戻す」場合は差分調査が必要であり、先に一括削除しない。ImportはCloud Functionsを起動しないが、Snapshot listenerには変更が通知される。

復元後に、`customers`・`reservations`・`visits`・`sales`の参照ID、締め状態、`users`とAuth UID、`casts.authUid`を確認する。

## 7. Storage復元

最初に復元対象を別prefixへコピーし、画像URL・content type・object名を確認する。

```bash
gcloud storage rsync --recursive \
  gs://<BACKUP_BUCKET>/storage/YYYY/MM/DD \
  gs://chouchou-susukino.firebasestorage.app
```

一部画像だけの誤削除は、Soft Deleteまたはobject generationからの個別復元を優先する。全体rsyncの前に`casts/`, `cast-profiles/`, `gallery/`, `news/`の代表画像を検証する。

## 8. Authentication復元

Auth Importはownerの明示承認後だけ実行する。事前に対象project、件数、既存UID衝突、hash algorithmとSCRYPTパラメータを確認する。

```bash
firebase auth:import auth-users-YYYY-MM-DD.json \
  --project=chouchou-susukino \
  --hash-algo=SCRYPT \
  --hash-key=<BASE64_SIGNER_KEY> \
  --salt-separator=<BASE64_SALT_SEPARATOR> \
  --rounds=<ROUNDS> \
  --mem-cost=<MEM_COST>
```

秘密値をshell historyやチケットへ残さない。復元後はowner、manager、staff、cast各1アカウントでログインし、Firestore `users.status/role`と`casts.authUid`を照合する。

## 9. 災害復旧手順

| 時間 | 対応 |
|---|---|
| 0〜15分 | 更新停止、影響範囲確認、owner招集、時刻と症状を記録 |
| 15〜30分 | Functions/Firestore/Storage/Auth/Hostingの障害を切り分け、現状Export |
| 30〜60分 | 復元世代決定、隔離環境で整合性検証、利用者へ一次報告 |
| 1〜4時間 | Rules→Functions→Firestore→Storage→Authの順で必要範囲を復元 |
| 復旧後 | `CHECKLIST.md`の本番スモークテスト、監査ログ確認、再開判断 |
| 24〜72時間 | 原因分析、再発防止、RPO/RTO実績、手順更新 |

侵害が疑われる場合は、復元より先に認証情報・IAM・API key・Secretをローテーションし、監査ログを保全する。

## 10. 復元検証チェック

- [ ] 公開キャスト一覧・画像・NEWSが表示される
- [ ] owner / manager / staff / castのログインと権限が正しい
- [ ] 新規予約と既存予約の更新ができる
- [ ] 来店→売上→給与→締めがつながる
- [ ] 締め後の編集拒否とowner解除が動作する
- [ ] `users`、Auth UID、`casts.authUid`が一致する
- [ ] Storage主要8prefixの件数と代表画像を確認した
- [ ] Functions 4件が正常で、Audit Logを書き込める
- [ ] Console Error、Functions Error Log、Rules拒否の異常増加がない
- [ ] 復元記録と次回改善点を保存した

## 11. 現在の未整備事項

- Scheduled Backup / PITR / Storage Soft Deleteの本番設定値はリポジトリから確認できない。
- 専用バックアップbucketと自動実行ジョブは未作成。
- `firestore.indexes.json`、Auth provider設定、Secret一覧はGit管理されていない。
- Auth復元と隔離projectへの完全復元訓練は未実施。

これらはデータ構造変更を伴わない運用整備として、初回本番公開前にownerが確認する。

## 12. 公式資料

- [Cloud Firestore: Export and import data](https://firebase.google.com/docs/firestore/manage-data/export-import)
- [Cloud Firestore: Back up and restore data](https://cloud.google.com/firestore/docs/backups)
- [Cloud Firestore: Disaster recovery planning](https://cloud.google.com/firestore/native/docs/disaster-recovery)
- [Firebase CLI: Auth import and export](https://firebase.google.com/docs/cli/auth)
- [Cloud Storage: Soft delete](https://cloud.google.com/storage/docs/soft-delete)
- [gcloud storage rsync](https://cloud.google.com/sdk/gcloud/reference/storage/rsync)
- [Cloud Functions: Environment configuration and secrets](https://firebase.google.com/docs/functions/config-env)
