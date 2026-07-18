import { getDocument } from "./firestoreService.js";

export const USER_ROLES = Object.freeze(["owner", "manager", "staff", "cast"]);

export const ROLE_LABELS = Object.freeze({
  owner:"オーナー",
  manager:"マネージャー",
  staff:"スタッフ",
  cast:"キャスト"
});

// 権限追加時はこの表へpermissionを追加する。各画面へロール条件を分散させない。
const ROLE_PERMISSIONS = Object.freeze({
  owner:new Set(["admin:dashboard", "cast:edit", "schedule:edit", "reservations:edit", "sales:edit", "payroll:edit", "news:edit", "events:edit", "gallery:edit", "system:edit", "recruit:edit", "settings:edit", "ranking:view", "cast-portal:own"]),
  manager:new Set(["admin:dashboard", "cast:edit", "schedule:edit", "reservations:edit", "sales:edit"]),
  staff:new Set(["reservations:edit", "news:edit"]),
  cast:new Set(["cast-portal:own"])
});

const ADMIN_ROUTE_PERMISSIONS = Object.freeze({
  "dashboard.html":"admin:dashboard",
  "cast.html":"cast:edit",
  "schedule.html":"schedule:edit",
  "reservations.html":"reservations:edit",
  "sales.html":"sales:edit",
  "payroll.html":"payroll:edit",
  "news.html":"news:edit",
  "event.html":"events:edit",
  "gallery.html":"gallery:edit",
  "system.html":"system:edit",
  "recruit.html":"recruit:edit",
  "settings.html":"settings:edit",
  "ranking.html":"ranking:view"
});

export async function getUserAccessProfile(user, options = {}) {
  if (!user?.uid) return null;
  const row = await getDocument("users", user.uid, { force:options.force === true, maxAge:options.maxAge ?? 5000 });
  if (!row) return null;
  const role = normalizeRole(row.role);
  return {
    ...row,
    uid:user.uid,
    email:user.email || row.email || "",
    role,
    displayName:String(row.displayName || user.displayName || user.email || "ログインユーザー"),
    status:normalizeStatus(row.status)
  };
}

export function hasPermission(profileOrRole, permission) {
  const role = typeof profileOrRole === "string" ? normalizeRole(profileOrRole) : normalizeRole(profileOrRole?.role);
  return Boolean(role && ROLE_PERMISSIONS[role]?.has(permission));
}

export function canAccessAdminRoute(profile, pathname = window.location.pathname) {
  const page = String(pathname || "").split("/").pop() || "dashboard.html";
  const permission = ADMIN_ROUTE_PERMISSIONS[page];
  return Boolean(permission && hasPermission(profile, permission));
}

export function permissionForAdminHref(href) {
  const page = String(href || "").split("?")[0].split("#")[0].split("/").pop();
  return ADMIN_ROUTE_PERMISSIONS[page] || "";
}

export function defaultRouteForRole(role) {
  if (role === "cast") return "../cast-portal.html";
  if (role === "staff") return "reservations.html";
  if (["owner", "manager"].includes(role)) return "dashboard.html";
  return "login.html";
}

export function isActiveUser(profile) {
  return Boolean(profile && profile.status === "active" && USER_ROLES.includes(profile.role));
}

export function roleLabel(role) { return ROLE_LABELS[normalizeRole(role)] || "未設定"; }
export function normalizeRole(value) { const role = String(value || "").trim().toLowerCase(); return USER_ROLES.includes(role) ? role : ""; }
function normalizeStatus(value) { const status = String(value || "active").trim().toLowerCase(); return ["active", "enabled", "利用中"].includes(status) ? "active" : status; }
