export const USER_ROLES = Object.freeze(["owner", "manager", "staff", "cast"]);
export const ROLE_LABELS = Object.freeze({ owner:"オーナー", manager:"マネージャー", staff:"スタッフ", cast:"キャスト" });

// 権限追加時はこの表へpermissionを追加する。各画面へロール条件を分散させない。
const ROLE_PERMISSIONS = Object.freeze({
  owner:new Set(["admin:dashboard", "analytics:view", "notifications:view", "cast:edit", "schedule:edit", "reservations:edit", "customers:edit", "sales:edit", "payroll:edit", "news:edit", "events:edit", "gallery:edit", "system:edit", "recruit:edit", "settings:edit", "users:manage", "ranking:view", "cast-portal:own"]),
  manager:new Set(["admin:dashboard", "analytics:view", "notifications:view", "cast:edit", "schedule:edit", "reservations:edit", "customers:edit", "sales:edit"]),
  staff:new Set(["reservations:edit", "news:edit"]),
  cast:new Set(["cast-portal:own"])
});

const ADMIN_ROUTE_PERMISSIONS = Object.freeze({
  "dashboard.html":"admin:dashboard", "analytics.html":"analytics:view", "analytics-dashboard.html":"analytics:view", "analytics-cast.html":"analytics:view", "analytics-customer.html":"analytics:view", "analytics-customers.html":"analytics:view", "analytics-sales.html":"analytics:view", "notifications.html":"notifications:view",
  "cast.html":"cast:edit", "schedule.html":"schedule:edit", "reservations.html":"reservations:edit", "reservation-detail.html":"reservations:edit", "table-manager.html":"reservations:edit", "visit-history.html":"reservations:edit",
  "customers.html":"customers:edit", "customer-detail.html":"customers:edit", "sales.html":"sales:edit", "sale-detail.html":"sales:edit", "payroll.html":"payroll:edit", "payroll-detail.html":"payroll:edit", "closing.html":"sales:edit",
  "news.html":"news:edit", "event.html":"events:edit", "gallery.html":"gallery:edit", "system.html":"system:edit", "recruit.html":"recruit:edit", "settings.html":"settings:edit", "users.html":"users:manage", "ranking.html":"ranking:view"
});

export function hasPermission(profileOrRole, permission) { const role = typeof profileOrRole === "string" ? normalizeRole(profileOrRole) : normalizeRole(profileOrRole?.role); return Boolean(role && ROLE_PERMISSIONS[role]?.has(permission)); }
export function canAccessAdminRoute(profile, pathname = globalThis.location?.pathname || "") { const page = String(pathname || "").split("/").pop() || "dashboard.html"; const permission = ADMIN_ROUTE_PERMISSIONS[page]; return Boolean(permission && hasPermission(profile, permission)); }
export function permissionForAdminHref(href) { const page = String(href || "").split("?")[0].split("#")[0].split("/").pop(); return ADMIN_ROUTE_PERMISSIONS[page] || ""; }
export function defaultRouteForRole(role) { if (role === "cast") return "../cast-portal.html"; if (role === "staff") return "reservations.html"; if (["owner", "manager"].includes(role)) return "dashboard.html"; return "login.html"; }
export function isActiveUser(profile) { return Boolean(profile && profile.status === "active" && USER_ROLES.includes(profile.role)); }
export function roleLabel(role) { return ROLE_LABELS[normalizeRole(role)] || "未設定"; }
export function normalizeRole(value) { const role = String(value || "").trim().toLowerCase(); return USER_ROLES.includes(role) ? role : ""; }
