# ChouChou Version 1.0.0 Release Checklist

作成日: 2026-07-27
現在の総合判定: **BLOCKED**

このチェックリストはデプロイ前の確認用であり、作成時点ではCommit、Tag、Deploy、Remote変更を実行していない。

## A. Release blockers

- [ ] `main` と `origin/main` の 102 ahead / 79 behind を専用統合branchで解消した
- [ ] `MERGE_REPORT.md` 記載のテキスト18件・画像2件を担当者が目視レビューした
- [ ] 未コミット165ファイルを、意図したM1〜M6成果物と不要物に分類した
- [ ] origin変更と重なる66ファイルについて、採用内容をファイル単位で承認した
- [ ] `.DS_Store`、一時ファイル、バックアップファイルをrelease対象から除外した
- [ ] M1〜M6成果物が同一の再現可能なcommitに含まれた
- [ ] `admin/analytics-*.html` と `admin/notifications.html` がGit追跡済みになった
- [ ] `firebase.json` のRules / Functions / Hosting設定を統合後に再確認した
- [ ] 重大既知問題が0件になった

## B. Git / Version

- [ ] 作業ツリーがclean
- [ ] `git status --short --branch` に想定外の変更がない
- [ ] `git rev-list --left-right --count main...origin/main` が意図した値
- [ ] release commitからM1〜M6の全成果物を取得できる
- [ ] `VERSION` が `1.0.0`
- [ ] `CHANGELOG.md` と `RELEASE_NOTE.md` が最終commitと一致
- [ ] Tag作成は本番Smoke Test完了後に行う

## C. M1 Security

- [ ] `firebase.json` が `firestore.rules` を指定
- [ ] `firebase.json` が `storage.rules` を指定
- [ ] owner / manager / staff / cast / 未ログインのRulesテストがPASS
- [ ] users / auditLogs はAdmin SDK専用
- [ ] managerは給与設定・ユーザー管理不可
- [ ] staffは売上・給与・設定不可
- [ ] castは本人データのみ
- [ ] Storageのcasts / gallery / news / system権限がPASS

## D. M2 Service Layer

- [ ] UIからFirestore / Storage SDKの直接呼び出しが0件
- [ ] CRUD、listener、transaction、batch、uploadがService経由
- [ ] 共通エラーとバリデーションがService境界で機能
- [ ] `MigrationReport.md` と `ARCHITECTURE.md` が実装と一致

## E. M3 Reservation + CRM

- [ ] 顧客CRUD
- [ ] 予約CRUD・ステータス変更
- [ ] 予約から既存顧客を検索・紐付け
- [ ] 受付 → 着席 → 延長 → 会計の来店履歴
- [ ] 席状態と席移動
- [ ] salesへcustomerId / visitIdが連携
- [ ] owner / manager / staffの許可範囲が正しい

## F. M4 Sales + Payroll

- [ ] 売上計算と決済合計
- [ ] 基本給・バック・歩合・手当・控除の給与計算
- [ ] 日締め / 月締め
- [ ] 締め後編集禁止
- [ ] ownerのみ締め解除可能
- [ ] 売上修正・給与変更・締め解除・commission変更が監査記録される

## G. M4.5 QA / Operations

- [ ] Rules Emulatorテストをrelease commitで再実行
- [ ] RBAC / Analytics / Finance unit testsがPASS
- [ ] Public / Admin / Cast Portalの主要E2EがPASS
- [ ] PC / Tablet / Mobileで表示・スクロール確認
- [ ] Console Error 0件
- [ ] 404 / 500 / Unhandled Promise 0件
- [ ] `BACKUP_PLAN.md` に従いFirestore ExportとStorage Backupを確認
- [ ] `OPERATIONS_MANUAL.md` の運用フローを担当者が確認

## H. M5 Analytics / Notifications

- [ ] `/admin/analytics-dashboard.html` が200で表示
- [ ] `/admin/analytics-sales.html` が200で表示
- [ ] `/admin/analytics-cast.html` が200で表示
- [ ] `/admin/analytics-customers.html` が200で表示
- [ ] `/admin/notifications.html` が200で表示
- [ ] Chart.jsが正常ロード
- [ ] KPI、売上、キャスト、顧客の各集計が表示
- [ ] owner / managerのみアクセス可能
- [ ] manager画面へ給与・監査データを送らない
- [ ] Notification Centerが正常表示

## I. Firebase / Hosting

- [ ] `.firebaserc` のdefault projectが `chouchou-susukino`
- [ ] Firebase CLIのログイン先とproject IDを再確認
- [ ] `functions/` の依存関係とNode.js 22互換を確認
- [ ] callable Functions 4件をStagingまたはEmulatorで確認
- [ ] Secrets / Environment Variablesを一覧照合
- [ ] Hosting対象一覧にM5正式5ページが含まれる
- [ ] Rules、Functions、Hostingを同一release commitからdeployする
- [ ] HTMLは再検証、JS/CSSは短期cache、画像は長期cache
- [ ] Service Workerのcache versionがVersion 1.0.0と一致

## J. Pre-deploy backup

- [ ] Firestore Exportの保存先・時刻・世代を記録
- [ ] Storage Backupの保存先・時刻・世代を記録
- [ ] Authenticationユーザー復旧方針を確認
- [ ] 現行Hosting release IDを記録
- [ ] 現行Firestore / Storage Rulesを保存
- [ ] 現行Functions revisionを記録
- [ ] 復旧責任者と判断基準を確認

## K. Post-deploy smoke test

- [ ] 公開トップ / Cast / News / Gallery / Recruit
- [ ] ownerログイン
- [ ] managerログイン
- [ ] staffログイン
- [ ] castログイン
- [ ] WEB予約 / LINE予約
- [ ] 受付 / 着席 / 席移動 / 延長 / 会計
- [ ] 売上登録 / 給与計算 / 締め
- [ ] Analytics 5ページ
- [ ] Notification Center
- [ ] Firestore / Storage permission deniedの想定外発生なし
- [ ] Console Error 0件
- [ ] Lighthouse結果を記録
- [ ] 問題があれば `DEPLOY_PLAN.md` のRollbackへ移行

## L. Final release

- [ ] 重大バグ0件
- [ ] 本番Smoke Test成功
- [ ] Rules成功
- [ ] Analytics正常
- [ ] Backup確認済み
- [ ] ownerがリリース承認
- [ ] 承認後にのみ `v1.0.0` tagを作成・push
