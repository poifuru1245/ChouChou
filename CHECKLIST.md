# ChouChou Version 1.0.0 Production Checklist

## M6 release blockers

- [ ] `main`のahead 102 / behind 15を安全に統合し、作業ツリーをcommitする
- [ ] 最新Firestore / Storage / Authバックアップとmanifestをownerが承認する
- [ ] owner / manager / staff / castの専用QAアカウントを準備する
- [ ] App Check未強制をownerが受容、または導入する
- [ ] 同一release commitから本番deployする
- [ ] post-deploy Smoke / Lighthouse / 実機ブラウザ確認後に`v1.0.0`をtag・pushする

## Automated QA

- [x] 全`assets/**/*.js`の`node --check`
- [x] `functions/index.js`の`node --check`とexport読込
- [x] `git diff --check`
- [x] Firestore / Storage Rules 21件PASS
- [x] 予約〜締め統合フローPASS
- [x] 売上・給与・分析純粋関数テストPASS
- [x] RBAC Route GuardポリシーテストPASS
- [x] UI直接Firestore / Storage API 0件
- [x] 47 HTMLのローカル参照、ID、alt、noopener監査PASS

## Browser QA

- [x] Public PC 1280px
- [x] Public Tablet 768px
- [x] Public Mobile 390px
- [x] キャスト・ギャラリー・料金・求人・問い合わせ
- [x] Admin未ログインRoute Guard
- [x] Cast Portal未ログイン表示
- [x] 横溢れなし
- [x] 実画像404なし
- [x] コード由来の予期しないConsole Errorなし
- [x] 存在しないローカルURLが404

## Before deploy

- [ ] `firebase use`で本番projectを再確認
- [ ] Rulesテストを再実行
- [ ] `BACKUP_PLAN.md`のproject ID・bucket・復元責任者を確認
- [ ] 最新Firestore / Storage / Authバックアップの完了時刻を確認
- [ ] Firestore Export operationとバックアップmanifestを確認
- [ ] 緊急時の更新停止・連絡・owner承認経路を確認
- [ ] 大容量画像10件を今回許容するか確認
- [ ] App Check未強制を今回許容するか確認
- [ ] 変更差分とHosting ignoreをレビュー

## After deploy smoke test

- [ ] 公開トップ・キャスト一覧・詳細が表示される
- [ ] WEB予約が作成できる
- [ ] ownerログイン・ユーザー一覧Callableが成功する
- [ ] managerで予約・顧客・売上を操作できる
- [ ] staffで予約・NEWSのみ操作できる
- [ ] castが自分のポータルだけ利用できる
- [ ] 売上登録、給与表示、締めロック、owner解除をQAデータで確認する
- [ ] Console Error、404、Functions Error Logを確認する
- [ ] `OPERATIONS_MANUAL.md`の営業開始・終了チェックを担当者が確認する
- [ ] 監査ログと最新バックアップ世代を確認する

## Production operations acceptance

- [ ] 新規キャスト登録・公開・Cast Portal紐付け
- [ ] キャスト画像アップロードと公開画面表示
- [ ] 出勤登録とToday's Cast反映
- [ ] WEB予約と既存顧客照合
- [ ] LINE指名予約文面とAdminへの転記
- [ ] 来店受付・着席・席移動・延長
- [ ] 売上入力と決済合計一致
- [ ] 給与計算と二者確認
- [ ] 日締め・月締め・owner解除・再締め
- [ ] `auditLogs` / `businessAuditLogs`確認
- [ ] Firestore / Storage / Authバックアップ確認
- [ ] 障害初動と復元判断の連絡訓練
