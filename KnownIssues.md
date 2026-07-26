# ChouChou Known Issues

更新日: 2026-07-20

| 優先度 | 項目 | 影響 | 対応方針 |
|---|---|---|---|
| P0 | `main`が`origin/main`より102件先行・15件遅延し、M1〜M6が未コミット | 再現可能なrelease commit/tagを作れない | remote-only 15件をレビューし、現行成果物を保持して統合する |
| P0 | 本番HostingでM5正式URLが404 | 本番がVersion 1.0.0候補と不一致 | Git統合・バックアップ後、同一commitからdeployして確認する |
| P0 | 4ロールの認証済み本番Smoke未実施 | 業務フローと本番Auth/Rulesの最終保証がない | 専用QAアカウントとQAデータでAfter deploy smokeを実行する |
| P1 | 現行本番Lighthouse Performance 20、転送量約13.3MB | 初回表示、モバイル通信量、Hosting転送量 | M6 WebP版をdeployし、post-deploy Lighthouseで改善を確認する |
| P1 | Cloud Functionsの`enforceAppCheck:false` | 正規クライアント以外からCallable試行が可能。owner認証は必須 | 本番クライアントのApp Check導入後に段階強制 |
| P1 | FunctionsのAuth Emulator統合テスト未整備 | ユーザー作成・無効化・キャスト再リンクは静的確認のみ | Auth/Functions Emulatorを含む専用テストを追加 |
| P1 | 専用バックアップbucket・Scheduled Backup/PITR・自動ジョブの稼働未確認 | 誤削除時のRPO/RTOを保証できない | `BACKUP_PLAN.md`に従いownerが設定・復元訓練を実施 |
| P1 | Auth Export、hash設定、Secret/index/TTL台帳が未整備 | 完全災害復旧時にAuth・構成復元が遅れる | 暗号化保管と機密構成台帳を作成 |
| P2 | CI未導入 | ローカル検証の実行漏れリスク | node check、unit、Rules、static auditをCIへ追加 |
| P2 | ダークモード専用テーマなし | OSダークモードでもライトデザインを維持 | ブランド要件として明記。対応時は別デザインレビュー |
| P2 | 外部Firestore遮断時にFirebase SDKがConsoleへオフラインログを出す | オフライン環境でConsoleにerror/warn | 画面上はNetworkError処理済み。健康な本番回線で再確認 |
| P2 | 500経路のローカル再現なし | 静的Hostingページでは500が発生しない | Functions Error Reportingと本番ログで監視 |

## 解消済み

- 使用中のHero、Concept、Recruit、Contact、バッジ8画像はWebP・適正解像度版を追加し、参照を切替済み（本番deploy待ち）。
- 公開ランキングから管理分析Serviceが連鎖ロードされるM5性能回帰は、`castViewService`分離とキャッシュキー更新で解消。
- Rules Emulatorを実行できなかったJava不足は、Portable Temurin JREを一時利用して解消。21件すべてPASS。
- Rules、テスト、Markdown、EmulatorログがHosting対象になり得る設定は`firebase.json`のignore追加で解消。
- Firestore / Storage / Auth / Functions設定のバックアップ対象、復元、災害復旧、日常運用手順の未文書化は`BACKUP_PLAN.md`と`OPERATIONS_MANUAL.md`で解消。
