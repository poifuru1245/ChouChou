# ChouChou M6.1 Merge Analysis

確認日: 2026-07-27
対象比較: `main` (`ff1db76`) ↔ `origin/main` (`868894f`)

## 1. Summary

| 項目 | 値 |
|---|---|
| Local-only commits | 102 |
| Origin-only commits | 79 |
| origin差分対象 | 154 files |
| Added on origin side | 28 |
| Modified on origin side | 35 |
| Deleted on origin side | 91 |
| Commit間text conflict | 18 |
| Commit間binary conflict | 2 |
| 現作業ツリーとの重複 | 66 files |

`origin/main`は単なる15件の追加ではない。公開サイトのデザインを大きく進める一方、M1〜M6側の管理画面・Service・Functions等を多数持たない別系統である。

## 2. Origin changes by area

### Public / UI

- `index.html`, `cast.html`, `cast-detail.html`, `news.html`, `gallery.html`, `system.html`, `access.html`, `recruit.html`, `reservation.html`
- `assets/app.js`, `assets/cast.js`, `assets/cast-detail.js`, `assets/gallery.js`, `assets/js/news.js`
- `assets/css/style.css`, `assets/css/home-v11.css`, `assets/css/admin.css`
- badge、Today Cast、home card、mobile layout、Recruit、Access、System、Gallery関連画像とCSS

### Admin

- `admin/cast.html`, `admin/dashboard.html`, `admin/gallery.html`, `admin/login.html`, `admin/news.html`, `admin/ranking.html`, `admin/schedule.html`を変更
- CRM、予約、売上、給与、設定、ユーザー等のM1〜M4画面はorigin側では削除扱い

### Architecture

- `assets/js/firebase.js`等の簡易構成を追加
- M2の`assets/js/services/`、components、page bootstrap、UI state、Firebase clientをorigin側では削除
- `assets/services/`の主要業務Serviceもorigin側では削除

### Firebase

- origin側`firebase.json`はHostingのみ
- Functions一式をorigin側では削除
- Rulesはローカル未追跡のためoriginに存在しない

## 3. Predicted conflicts

### Text conflicts: 18

| File | Type | 主な競合理由 |
|---|---|---|
| `access.html` | add/add | 両branchで独立作成 |
| `admin/cast.html` | modify/modify | 管理機能拡張とorigin側レイアウト変更 |
| `assets/app.js` | modify/modify | 公開描画・UI・Service移行とorigin側表示修正 |
| `assets/cast-detail.js` | modify/modify | 予約・お気に入り・詳細機能とorigin側デザイン描画 |
| `assets/cast-manager.js` | modify/modify | 管理項目・RBACとorigin側管理表示 |
| `assets/cast.js` | modify/modify | Today Cast・予約導線・Service化とorigin側カード装飾 |
| `assets/css/home-v11.css` | add/add | 両branchで独立したv11定義 |
| `assets/css/style.css` | modify/modify | 大規模な共通CSSとorigin側モバイル・カード修正 |
| `assets/gallery.js` | modify/modify | Service化・管理連携とorigin側表示変更 |
| `assets/js/news.js` | modify/modify | Service境界とorigin側News構造 |
| `cast-detail.html` | modify/modify | premium detail機能とorigin側プリンセスUI |
| `cast.html` | modify/modify | 一覧機能とorigin側カードUI |
| `gallery.html` | modify/modify | 管理連携とorigin側luxury gallery |
| `index.html` | modify/modify | M5導線・Service構成とorigin側top/mobile変更 |
| `news.html` | modify/modify | Service化とorigin側Newsレイアウト |
| `recruit.html` | add/add | 両branchで独立作成 |
| `reservation.html` | modify/modify | CRM連携・Service化とorigin側予約ページ |
| `system.html` | add/add | 両branchで独立作成 |

### Binary conflicts: 2

- `assets/img/badges/badge-new.png`
- `assets/img/badges/badge-osusume.png`

両branchが同じpathへ異なる画像を追加している。画像hash、寸法、透明領域、参照CSS、管理画面表示を比較せずにours/theirsを選択してはならない。

## 4. Classification by milestone

### M1 Security

- ローカル作業ツリー: `firestore.rules`, `storage.rules`, Rules testsあり
- origin: Rulesなし、Functions削除、Hosting-only config
- リスク: origin採用でSecurity RulesとAdmin SDK管理機能がreleaseから欠落

### M2 Architecture

- ローカル: Service Layer、共通error/runtime、UI境界あり
- origin: Service・components・Firebase clientの多くを削除
- リスク: origin一括採用でUIからFirebaseへ戻る、またはimport切れ

### M3 CRM

- ローカル: customers、reservation detail、table manager、visit history
- origin: customers / reservations関連画面・Serviceを削除
- リスク: 顧客・予約・来店・席の一連フロー消失

### M4 Sales

- ローカル: sales、payroll、closing、finance calculator、audit
- origin: sales / payroll / settingsを削除
- リスク: 売上・給与・締め・監査の消失

### M5 Analytics

- ローカル正式5画面とServiceは未追跡
- originにも存在しない
- リスク: 通常mergeだけではM5がrelease commitに入らず、本番404が継続

### M6 Release

- `VERSION`, `CHANGELOG.md`, `RELEASE_NOTE.md`, QA・運用文書は未追跡
- originの公開UI変更にはM6最適化前後の画像が混在
- リスク: tagが再現可能な成果物を指さない

## 5. Origin diff file groups

154ファイルの変更は次のpath群へ集中する。

| Group | 主なpath |
|---|---|
| Root HTML | `404`, access, cast, cast-detail, gallery, index, news, recruit, reservation, system |
| Admin | cast, dashboard, gallery, login, news, ranking, schedule。CRM/finance/user画面は削除 |
| Public JS | app, cast, cast-detail, gallery, news, schedule, reservation |
| Admin JS | admin、dashboard、manager群。M1〜M4関連は削除 |
| CSS | admin, home-v11, style, mobile/recruit。M2〜M5 CSSの多くは削除 |
| Images | badge、Today Cast、home card、hero。旧画像の削除・新画像追加 |
| Architecture | `assets/js/**`, `assets/services/**`, components、utils |
| Firebase | `firebase.json`, `functions/**` |
| Misc | backup HTML/JS/CSS、`.DS_Store`、`.save`、zip |

releaseへ不要な`.DS_Store`、backup、`.save`、zipは、origin変更であっても本番成果物へ採用しない候補として別レビューする。

## 6. Merge policy

自動解決または一括ours/theirsは禁止。

1. M1〜M6の機能・Service・Rules・Functionsをrelease基準とする。
2. originの公開UI変更はファイルごとに抽出し、機能境界を壊さない形で採用判断する。
3. 20競合はブラウザ表示、import、Firestore描画、RBACを同時確認する。
4. 66重複ファイルは未コミット内容を固定してから比較する。
5. merge後に47 HTML監査、Service境界、Rules、E2Eを再実行する。

今回、実merge・rebase・競合解消は行っていない。
