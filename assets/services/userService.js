import {
  createManagedUser as createUser,
  deactivateManagedUser as deactivateUser,
  getUserAdminErrorMessage,
  listManagedUsers as listUsers,
  normalizeManagedUser,
  subscribeUserProfiles,
  updateManagedUser as updateUser,
  userProfileDataService
} from "./userAdminService.js";
import { runServiceOperation } from "./serviceRuntime.js";

// ユーザー管理画面の安定した入口。管理者操作は内部でCloud Functionsを経由する。
export { getUserAdminErrorMessage, normalizeManagedUser, subscribeUserProfiles, userProfileDataService };
export function listManagedUsers(options = {}) { return runServiceOperation("listUsers", () => listUsers(options), { resource:"users" }); }
export function createManagedUser(input) { return runServiceOperation("createUser", () => createUser(input), { resource:"users" }); }
export function updateManagedUser(input) { return runServiceOperation("updateUser", () => updateUser(input), { resource:`users/${input.uid || ""}` }); }
export function deactivateManagedUser(uid) { return runServiceOperation("deactivateUser", () => deactivateUser(uid), { resource:`users/${uid}` }); }
export { requestPasswordReset } from "./authService.js";
