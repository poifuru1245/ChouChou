# ChouChou M6.2 Merge Strategy

確認日: 2026-07-27
前提: **ローカルM1〜M6を正とする**
状態: 計画のみ。Merge / Rebase未実行。

## 1. Decision

`origin/main`の79コミットは、`git cherry main origin/main`では全件uniqueだった。ただし公開UIの試行錯誤、revert、位置微調整、古い構造が多く、Version 1.0.0へそのままcherry-pickできるcommitはない。

| 分類 | 件数 | 方針 |
|---|---:|---|
| 採用 | 0 | whole commitで採用できるものなし |
| 不要 | 41 | ローカル後続版で代替、revert済み、または純UI微調整 |
| 競合 | 38 | 行・asset単位でレビューし、必要部分だけmanual merge |
| 合計 | 79 | |

「採用0」はremoteの知見を無視する意味ではない。競合38件から、再現できるbug fixだけをローカル構造へ手動移植する。

## 2. Commit review: 採用

該当なし。

理由:

- ローカルにはremote後のM1〜M6機能とUI改善がある。
- remote commitは複数fileを跨いで古いHTML/JS/CSS構造へ依存する。
- whole cherry-pickはService Layer、RBAC、CRM、予約、分析を壊す可能性がある。

## 3. Commit review: 不要 41

次はwhole commitとして不要。主にUI試行、後続commitでの再修正、revert、ローカル後続版で代替済み。

- `e4234ed` feat: add ChouChou design system phase1
- `e465d22` fix: restore ChouChou layout before design system
- `305e837` style: unify top card dimensions
- `f1f74bc` fix: make top cards vertical rectangles
- `91af886` fix: force top cards to match lower card dimensions
- `fcec8e5` revert: restore layout after card size changes
- `3f6dbd0` style: align top section card dimensions
- `d5252cb` fix: wrap top sections into vertical card row
- `1dc4c0c` style: refine v10 today cast spacing
- `932db70` style: final polish v10 today cast
- `1ca974c` style: upgrade v11 premium today cast design
- `01cd8e2` style: optimize today cast background ratio
- `6241713` style: polish today cast premium assets
- `95cda8a` style: unify top cards with premium v11 design
- `dd97cb2` style: align today cast layout positions
- `cde825f` style: adjust top card text positions
- `f21b0bb` style: fine tune top card text positions
- `f224bf6` style: align top card title baselines
- `9816657` style: adjust today cast final text positions
- `dbef213` style: nudge today cast empty and button text
- `59f3e66` style: lower concept content box
- `8f7a171` style: restore concept content box height
- `7f289a9` style: redesign cast list cards
- `0e2e5b8` style: restore cast badge positions
- `c21704c` fix: pin cast badges to top left
- `886d37b` fix: restore cast badge stack
- `17dc88b` fix: correctly anchor cast badges
- `182a9e5` fix: isolate cast badge positioning
- `64838c4` chore: hide unstable cast badges
- `5467f2a` style: enhance public cast cards
- `40ec65e` style: refine public cast card design
- `248eb5e` style: rebuild cast list cards from today cast design
- `6e1e3d2` style: add jewel princess cast card effects
- `34ea23d` style: polish luxury cast card effects
- `13d1660` style: polish cast card depth and luxury
- `0255dc0` style: final polish for luxury cast cards
- `ed292e7` style: polish cast section luxury layout
- `657605f` style: unify cast detail with princess theme
- `26af055` style: polish top system section
- `095d8be` fix: isolate and repair mobile layout styles
- `7859037` fix: change desktop cast list to vertical scroll

`095d8be`はbackup HTML/CSSと専用mobile-fixを追加する構成で、ローカルの後続responsive構成へwhole commitで入れない。症状だけ回帰試験へ転記する。

## 4. Commit review: 競合 38

次は機能、DOM、Firestore描画、共通CSS、asset pathへ触れるためmanual review対象。

- `8c52c15` feat: separate badge layout for public site and admin panel
- `68dfdc1` fix: use uploaded png badge assets
- `0467c35` fix: render png cast badges from firestore flags
- `adabba2` fix: correct badge image paths
- `65991d4` fix: use root relative badge image paths
- `1a66259` fix: rebuild premium cast badge display
- `0d4a4ff` fix: fully repair cast badge image rendering
- `30ad5f7` fix: render badge images on cast cards
- `eb0cca8` fix: render premium badges on public cast list
- `7b6fd3d` fix: support public cast badge truthy flags
- `503b8f0` fix: prevent app.js from overriding cast badge display
- `c25b5bc` fix: adjust cast badge layout
- `78bd88b` fix: separate admin/public badge layout
- `aa9dde3` refactor: stabilize css and badge system for v6
- `5f6215a` fix: repair cast badges and admin form layout after v6
- `c846250` feat: ChouChou Ver6.0 complete
- `0546a93` chore: prepare today cast background asset
- `a7b3044` fix: move cast badges inside photo wrapper
- `de2b8b7` revert: restore cast badge display
- `649f638` feat: redesign luxury cast detail page
- `a5a258d` style: redesign cast detail with princess theme
- `f5b2ed8` feat: redesign luxury gallery section
- `faf805f` style: redesign luxury gallery showcase
- `6a3b910` style: redesign luxury system page
- `339d4a7` fix: restore system page content
- `598729c` fix: restore system section on top page
- `76fc728` style: redesign luxury access page
- `117b87d` feat: complete access section
- `68063aa` feat: add recruit page template
- `1844234` feat: add editable recruit page
- `adefc95` feat: add recruit card and complete home card grid
- `341d5e5` fix: repair mobile home page layout
- `9e6e615` fix: resolve mobile layout width and overlap issues
- `2652713` fix: improve top card layout and scrolling
- `968a3cf` layout: optimize news section layout
- `4d4e5c2` style: refine cast list cards
- `846db05` style: refine today's cast card decorations
- `868894f` style: move cast decorations behind photo

### Line-level review candidates

優先して差分を読む価値がある箇所:

- `7b6fd3d`: Firestoreのtruthy flag正規化
- `503b8f0`: `app.js`によるbadge上書き防止
- `341d5e5`, `9e6e615`: mobile幅・重なりの再現ケース
- `2652713`: top card scrollとDOM更新
- `968a3cf`: News表示件数・layout連携
- `868894f`: 装飾のstacking context

実装を直接採用せず、ローカルで同じ問題が再現する場合のみ現在のcomponentへ移植する。

## 5. Conflict priority

### Critical

- `admin/cast.html`
- `assets/app.js`
- `assets/cast-detail.js`
- `assets/cast-manager.js`
- `assets/cast.js`
- `index.html`
- `reservation.html`

Firestore描画、管理CRUD、予約、Service、公開トップに影響する。

### High

- `assets/css/style.css`
- `assets/gallery.js`
- `assets/js/news.js`
- `cast-detail.html`
- `cast.html`
- `gallery.html`
- `news.html`

全体表示またはService連携を壊す可能性がある。

### Medium

- `access.html`
- `assets/css/home-v11.css`
- `recruit.html`
- `system.html`

add/addまたは独立した公開ページ実装。ローカル管理連携を保持する。

### Low

- `assets/img/badges/badge-new.png`
- `assets/img/badges/badge-osusume.png`

binary選択。機能より表示影響だが、参照pathとcacheを確認する。

## 6. File-level strategy

| File | Priority | Strategy | Remoteから確認する内容 |
|---|---|---|---|
| `access.html` | Medium | Keep Local | 必要な文言・表示だけ比較 |
| `admin/cast.html` | Critical | Keep Local | badge formの不足だけ確認 |
| `assets/app.js` | Critical | Manual Merge | badge上書き防止、top描画 |
| `assets/cast-detail.js` | Critical | Keep Local | badge pathのみ確認 |
| `assets/cast-manager.js` | Critical | Keep Local | truthy flag互換 |
| `assets/cast.js` | Critical | Manual Merge | badge、scroll、stacking |
| `assets/css/home-v11.css` | Medium | Manual Merge | News/Cast装飾の限定差分 |
| `assets/css/style.css` | High | Manual Merge | mobile幅、重なり、badge |
| `assets/gallery.js` | High | Keep Local | 表示only差分を確認 |
| `assets/js/news.js` | High | Keep Local | 件数・空状態だけ確認 |
| `cast-detail.html` | High | Keep Local | markup互換だけ確認 |
| `cast.html` | High | Keep Local | badge wrapperだけ確認 |
| `gallery.html` | High | Keep Local | DOM class差分だけ確認 |
| `index.html` | Critical | Manual Merge | top/mobile/News導線 |
| `news.html` | High | Keep Local | DOM class差分だけ確認 |
| `recruit.html` | Medium | Keep Local | origin templateの文言確認 |
| `reservation.html` | Critical | Keep Local | CRM/Service連携を保護 |
| `system.html` | Medium | Keep Local | origin content欠落修正だけ確認 |
| badge PNG 2件 | Low | Manual Select | hash、寸法、透過、見た目 |

### Keep Remote

競合20ファイルについて、remote全体を採用するものは0件。必要箇所はManual Mergeでローカルへ限定移植する。

## 7. Recommended merge method

推奨はrelease integration branchでの通常merge commit。rebaseや79件の逐次cherry-pickは行わない。

1. 先にローカルM1〜M6を論理commitへ固定。
2. release branchで`origin/main`を`--no-commit` merge。
3. 20競合を本表で解決。
4. 非競合で入るbackup、`.DS_Store`、`.save`等を除外。
5. remoteの91 deletionsでM1〜M6が消えていないことを確認。
6. 全品質gate後にmerge commitを作る。

`-s ours`はremoteの全知見を不可視化するため第一選択にしない。rebaseは102 local commitsを書き換えるため使用しない。
