# ChouChou M6.3 Conflict Resolution Log

実施日: 2026-07-27
基準: `MERGE_STRATEGY.md`
方針: ローカルM1〜M6を正とし、Keep Remoteは禁止

## Critical

| File | Strategy | Resolution |
|---|---|---|
| `admin/cast.html` | Keep Local | RBAC、Service連携、現行管理項目を維持 |
| `assets/app.js` | Manual Merge | remoteの旧直接SDK・旧描画を比較。採用可能な独立差分なし、local維持 |
| `assets/cast-detail.js` | Keep Local | Ver7.3詳細、予約、お気に入り、Service連携を維持 |
| `assets/cast-manager.js` | Keep Local | 現行CRUD、flag互換、管理構造を維持 |
| `assets/cast.js` | Manual Merge | badge、truthy flag、scroll、stackingを比較。現行実装で包含、local維持 |
| `index.html` | Manual Merge | top/mobile/News導線を比較。M5/M6 URLと現行DOMを維持 |
| `reservation.html` | Keep Local | CRM・Reservation Service連携を維持 |

## High

| File | Strategy | Resolution |
|---|---|---|
| `assets/css/style.css` | Manual Merge | remoteは旧DOM向けで現行responsiveとM5/M6 styleを削除するためlocal維持 |
| `assets/gallery.js` | Keep Local | Gallery Service境界と現行表示を維持 |
| `assets/js/news.js` | Keep Local | News Service境界、件数、空状態を維持 |
| `cast-detail.html` | Keep Local | 現行詳細DOMとmodule構成を維持 |
| `cast.html` | Keep Local | 現行badge wrapperと一覧構造を維持 |
| `gallery.html` | Keep Local | 現行gallery DOMと管理データ連携を維持 |
| `news.html` | Keep Local | 現行news DOMとService連携を維持 |

## Medium

| File | Strategy | Resolution |
|---|---|---|
| `access.html` | Keep Local | 現行公開ページと管理設定連携を維持 |
| `assets/css/home-v11.css` | Manual Merge | remoteの旧`.home-top-card-row` patchを比較。現行613行responsive構成を維持 |
| `recruit.html` | Keep Local | 現行求人管理連携を維持 |
| `system.html` | Keep Local | 現行料金管理連携と欠落修正を維持 |

## Low / Binary

| File | Strategy | Resolution |
|---|---|---|
| `assets/img/badges/badge-new.png` | Manual Select | hash・寸法・実画像を確認。local 1536×1024の現行高解像度版を選択 |
| `assets/img/badges/badge-osusume.png` | Manual Select | hash・寸法・実画像を確認。local 1536×1024の現行高解像度版を選択 |

remote画像はそれぞれ70×82、80×52の旧小型assetだった。見た目も確認し、現行デザインと解像度を維持するためlocalを選択した。

## 競合外の自動マージ監査

次の18件は`origin/main`から自動で追加・変更されたが、計画の除外対象または現行構成の巻き戻しだったため不採用とした。

- 旧補助JS: `assets/access.js`、`assets/recruit.js`、`assets/system.js`
- 旧/backup CSS: `assets/css/mobile-fix.css`、`assets/css/recruit.css`、`assets/css/style-before-mobile-fix.css`
- backup HTML: `index-before-mobile-fix.html`
- 旧小型badge別path: `assets/img/badge-new.png`、`assets/img/badge-osusume.png`
- 旧背景asset 8件: `assets/img/home/*`、`assets/img/today-cast/*`
- 現行UIを巻き戻す変更: `assets/css/admin.css`

未参照確認とstaged diff監査を行い、全件をマージ結果から除外した。

## 完了確認

- Text conflict: 18/18解決
- Binary conflict: 2/2解決
- Keep Remote: 0
- Conflict marker: 0
- Unmerged entry: 0
