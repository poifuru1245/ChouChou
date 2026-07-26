# ChouChou M6.1 Hosting Report

確認日: 2026-07-27
対象site: `chouchou-susukino`

## 1. Required M5 URLs

| URL file | Local | Git tracked | origin/main | Hosting ignore | Production |
|---|---|---|---|---|---|
| `admin/analytics-dashboard.html` | Yes | No | No | No | 404 |
| `admin/analytics-sales.html` | Yes | No | No | No | 404 |
| `admin/analytics-cast.html` | Yes | No | No | No | 404 |
| `admin/analytics-customers.html` | Yes | No | No | No | 404 |
| `admin/notifications.html` | Yes | No | No | No | 404 |

本番結果は2026-07-27にブラウザで各URLを直接確認した。すべてカスタム`Page Not Found`を返した。

## 2. Hosting target

working tree:

```json
{
  "hosting": {
    "site": "chouchou-susukino",
    "public": "."
  }
}
```

5ページは次のignore条件のいずれにも該当しない。

- Firebase config / logs
- Rules
- Functions
- Tests
- Markdown
- dotfile / node_modules
- backup / save
- xlsx / HEIC / 届出書

したがって、現在のworking treeをそのままHosting対象として評価すれば5ページは公開対象になる。

## 3. 404 root cause

確認できた事実:

1. 5ページはローカルに存在する。
2. 5ページは未追跡。
3. 5ページは`origin/main`に存在しない。
4. ignore設定は5ページを除外しない。
5. 本番は5件とも404。

結論:

**404の原因はignoreではなく、現在の本番Hosting releaseのソースに5ページが含まれていないこと。**

どのローカルcommit・端末から本番deployされたかはGitだけでは断定できない。ただし`origin/main`のclean checkoutからは5ページを生成できないため、originをrelease sourceとした場合は確実に欠落する。

## 4. Link integration

ローカルでは次から正式URLへのリンクが存在する。

- `admin/dashboard.html`
- `assets/admin.js`
- Analytics各画面のnav
- `assets/services/accessPolicy.js`
- Notification生成

リンク先だけが本番にない状態では、管理画面から遷移した時点で404になる。

## 5. Runtime dependencies

M5正式画面に必要:

- `assets/admin.js`
- `assets/analytics.js`
- `assets/analytics-sales.js`
- `assets/analytics-cast.js`
- `assets/analytics-customer.js`
- `assets/notifications.js`
- `assets/css/analytics.css`
- Analytics / Notification / dashboard / sales / customer / visit / audit Services
- Chart.js 4.4.7 CDN

HTMLだけを追加しても、未追跡runtimeとServiceが欠落すれば表示できない。Hosting manifestは依存ファイルを一組で確認する。

## 6. Hosting risks

- `public: "."`のため、release sourceに残ったbackupや不要ファイルはignore次第で公開される。
- origin版`firebase.json`のignoreは最小構成で、backup/save等を除外しない。
- working tree版は安全側のignoreとcache headerを持つが未コミット。
- Service Worker cacheとHosting cacheのversion整合が必要。

## 7. Pre-release acceptance

- clean checkoutに5 HTMLと全依存が存在
- 5 URLが200
- login/role guardが正常
- Chart.jsと各Serviceがロード
- Console Error 0
- Network 404 0
- owner / manager表示がRulesと整合
- staff / cast / 未ログインが拒否

今回Hosting deployは実行していない。
