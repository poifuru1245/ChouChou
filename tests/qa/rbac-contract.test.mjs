import test from "node:test";
import assert from "node:assert/strict";
import { canAccessAdminRoute, defaultRouteForRole, hasPermission, isActiveUser } from "../../assets/services/accessPolicy.js";

test("ownerは全管理領域へアクセスできる", () => {
  for (const path of ["dashboard.html", "analytics-dashboard.html", "analytics-sales.html", "analytics-cast.html", "analytics-customers.html", "notifications.html", "cast.html", "reservations.html", "customers.html", "sales.html", "payroll.html", "users.html"]) assert.equal(canAccessAdminRoute({ role:"owner" }, path), true, path);
});

test("managerは店舗運営を利用できるが給与・設定・ユーザー管理は禁止", () => {
  for (const path of ["dashboard.html", "analytics-dashboard.html", "analytics-sales.html", "analytics-cast.html", "analytics-customers.html", "notifications.html", "cast.html", "schedule.html", "reservations.html", "customers.html", "sales.html"]) assert.equal(canAccessAdminRoute({ role:"manager" }, path), true, path);
  for (const path of ["payroll.html", "settings.html", "users.html"]) assert.equal(canAccessAdminRoute({ role:"manager" }, path), false, path);
});

test("staffは予約とお知らせだけ利用できる", () => {
  assert.equal(canAccessAdminRoute({ role:"staff" }, "reservations.html"), true);
  assert.equal(canAccessAdminRoute({ role:"staff" }, "news.html"), true);
  for (const path of ["dashboard.html", "customers.html", "sales.html", "payroll.html", "users.html"]) assert.equal(canAccessAdminRoute({ role:"staff" }, path), false, path);
});

test("castと未ログインは管理画面を利用できない", () => {
  assert.equal(canAccessAdminRoute({ role:"cast" }, "dashboard.html"), false);
  assert.equal(canAccessAdminRoute(null, "reservations.html"), false);
  assert.equal(hasPermission("cast", "cast-portal:own"), true);
  assert.equal(defaultRouteForRole("cast"), "../cast-portal.html");
  assert.equal(isActiveUser({ role:"cast", status:"active" }), true);
  assert.equal(isActiveUser({ role:"cast", status:"inactive" }), false);
});
