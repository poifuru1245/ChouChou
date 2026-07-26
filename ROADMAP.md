# ChouChou Project Alpha — Roadmap

更新日: 2026-07-19

## 方針

新機能を増やす前に、セキュリティ、データ整合性、サービス層、テストを安定させる。既存デザイン・既存データ・既存導線を維持し、各フェーズを小さなコミットと検証可能な完了条件で進める。

## Phase Alpha 0 — 現状固定と安全基盤

目的: 現在動いている機能を壊さず、変更可能な基準線を作る。

- 現在の未コミットTask #004変更をレビューし、独立したコミットへ整理。
- `main`と`origin/main`のahead/behind差分を解消する方針を決定。
- Firebaseプロジェクト、Hosting、Functions、Firestore、Storageの環境対応表を作成。
- Firestore/Storage Rulesをリポジトリへ追加。（M1完了）
- EmulatorによるRBAC・本人データ制約テストを追加。（M1完了、18/18成功）
- 秘密情報、Firebase設定、管理者権限、監査ログ保持を確認。

完了条件:

- Rulesがコードレビュー可能で、許可/拒否テストが通る。
- owner/manager/staff/castのアクセス表と実際のRulesが一致する。
- 既存主要画面のスモークテスト結果を保存できる。

## Phase Alpha 1 — データ統合レイヤー完成

目的: Firestoreアクセスを画面から分離し、顧客・予約・売上の整合性を守る。

- `assets/services/dataService.js`を共通基盤として確定。
- customer/reservation/sales/cast/userサービスのAPI・例外・validationを統一。
- 画面側の直接Firestoreアクセスをサービス呼出しへ段階移行。
- 互換re-exportに廃止期限を設定。
- `customerId`、`reservationId`、`castId`の関係と更新責任を文書化。
- 来店確定、取消、売上更新時のtransaction/冪等性を実装・テスト。
- 旧データの欠損・重複を報告するdry-run移行ツールを作成。

完了条件:

- 業務画面からFirestore SDKの直接CRUDがなくなる。
- 予約→来店→売上→顧客集計の統合テストが通る。
- 旧データの移行件数と例外を事前確認できる。

## Phase Alpha 2 — 運営業務の閉ループ化

目的: 既に存在する画面とデータを、日々の運用で完結する状態にする。

- 公開WEB予約をCRMの顧客照合・確認付き新規作成へ統合。
- シフト希望の承認・差戻し・確定を管理画面に追加。
- キャスト向けお知らせの作成、公開、既読確認を管理画面に追加。
- 給与の計算結果を確定し、`payrollHistory`へ保存。
- ランキング集計を確定し、`castRankings`へ保存。
- 給与・ランキングの再計算、履歴、監査ログを実装。

完了条件:

- 管理画面の操作だけでシフト、予約、来店、売上、給与、告知が完結する。
- キャストポータルに表示する全データの生成元が存在する。
- 再実行しても集計が二重計上されない。

## Phase Beta — 品質・性能・保守性

目的: 既存の見た目と機能を維持しながら、変更コストと障害率を下げる。

- 自動テストとCIを導入。
- 大規模JavaScriptをページ、component、service、utilityへ分割。
- `style.css`と`admin.css`をトークン・component・page差分へ段階分割。
- 空ファイル、未参照CSS、移行完了後の互換ファイルを削除。
- Firestore read数、リアルタイムlistener数、index、初期表示速度を計測。
- 画像リサイズ、WebP/AVIF、lazy loading、失敗時fallbackを統一。
- PC/タブレット/スマホのVisual Regressionを導入。
- WCAGを基準にキーボード、focus、ARIA、コントラストを監査。

完了条件:

- PR/commitごとに静的検査、Rules、unit、主要E2Eが自動実行される。
- 未参照資産がレポート化され、削除根拠が残る。
- Core Web VitalsとFirestore read数の基準値を定義できる。

## Phase Gamma — 外部連携

目的: 予約獲得と運用通知を外部サービスへ安全に接続する。

- LINE Messaging API/Webhookで予約受付・変更・キャンセル通知。
- メール通知、来店前通知、失敗時再送。
- Google Calendar同期と競合解消。
- Instagram Graph API連携、期限切れtoken更新、キャッシュ。
- CSV export/importと監査可能なバッチ処理。

依存条件:

- Alpha 0のRules/App Checkが完了していること。
- Alpha 1のID・transaction・冪等性が完了していること。
- Webhook秘密情報をFunctions Secret Managerで管理できること。

完了条件:

- 外部API障害時も予約データを失わず、再送・手動復旧できる。
- 顧客同意、個人情報、通知停止、監査ログの運用手順がある。

## Phase Delta — 分析・経営支援

目的: 蓄積したCRM・予約・売上・給与データを意思決定に利用する。

- リピート率、LTV、休眠顧客、予約経路別成約率。
- キャスト別売上・指名・同伴・ドリンク推移。
- イベント・NEWS・おすすめ掲載と予約成果の比較。
- 給与原価、粗利、客単価、稼働率の月次レポート。
- 個人情報を除いた集計データの保持・匿名化方針。

完了条件:

- 指標定義が一意で、ダッシュボード・CSV・給与で同じ値になる。
- 集計再生成と監査が可能。

## 推奨実施順

1. Rules、App Check、テスト環境。
2. Task #004サービス層とCRM整合性。
3. キャストポータルに不足する管理側ワークフロー。
4. 給与・ランキング確定処理。
5. CSS/JS整理と性能改善。
6. LINE・メール・Calendar・Instagram連携。
7. 分析機能。

## リリース共通ゲート

各フェーズで次を満たすこと。

- `node --check`対象ファイルが成功。
- `git diff --check`が成功。
- Consoleエラーなし。
- 公開サイト、管理画面、キャストポータルの主要導線を確認。
- owner/manager/staff/castの許可・拒否を確認。
- PC・タブレット・スマホ表示を確認。
- Firestore書込前後のデータ整合性とロールバック手順を確認。
- Firebase deploy後に実配信ファイルと対象checkoutが一致することを確認。

## 現在地 — M4.5 Production Readiness

- M1 Security Rules: 完了、Emulator 21/21 PASS。
- M2 Service Layer: 完了、UI直接Firebaseアクセス0件。
- M3 Reservation + CRM: 完了、予約〜来店・席・顧客Transaction実装済み。
- M4 Sales + Payroll: 完了、給与計算・締めロック・監査実装済み。
- M5 Analytics: 完了、Executive KPI・目標、売上／キャスト／顧客分析、通知センター実装済み。
- M4.5 QA: 統合フロー、RBAC、Functions静的検査、3 viewport、404、性能監査完了。
- M6 Version 1.0.0: Release candidate整備済み。Git統合、バックアップ承認、認証済み本番Smoke、deploy、tagはブロック中。

次のリリース作業は`CHECKLIST.md`のBefore deployとAfter deploy smoke testを順番に実施する。大容量画像、App Check、Functions Emulator統合、CIは`KnownIssues.md`の残課題として別変更に分離する。
