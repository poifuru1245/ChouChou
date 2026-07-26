import { getDocument } from "./firestoreService.js";
import { USER_ROLES, canAccessAdminRoute, defaultRouteForRole, hasPermission, isActiveUser, normalizeRole, permissionForAdminHref, roleLabel } from "../../services/accessPolicy.js";
export { ROLE_LABELS, USER_ROLES, canAccessAdminRoute, defaultRouteForRole, hasPermission, isActiveUser, normalizeRole, permissionForAdminHref, roleLabel } from "../../services/accessPolicy.js";

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

function normalizeStatus(value) { const status = String(value || "active").trim().toLowerCase(); return ["active", "enabled", "利用中"].includes(status) ? "active" : status; }
