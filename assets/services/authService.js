import {
  getAuthErrorMessage as getLegacyAuthErrorMessage,
  requestPasswordReset as resetPassword,
  signInCast as loginCast,
  signInUser as loginUser,
  signOutCast as logoutCast,
  signOutUser as logoutUser,
  subscribeAuth as subscribeAuthState,
  waitForAuthUser as waitForUser
} from "../js/services/authService.js";
import { normalizeServiceError } from "./errors.js";
import { runServiceOperation } from "./serviceRuntime.js";

// UIが利用する認証Serviceの正規入口。戻り値を変えず、例外と稼働状態だけ共通化する。
export function subscribeAuth(callback, onError = console.error) { return subscribeAuthState(callback, (error) => onError(normalizeServiceError(error, { resource:"auth", operation:"listen" }))); }
export function signInUser(email, password) { return runServiceOperation("signIn", () => loginUser(email, password), { resource:"auth" }); }
export function signInCast(email, password) { return runServiceOperation("signInCast", () => loginCast(email, password), { resource:"auth" }); }
export function signOutUser() { return runServiceOperation("signOut", logoutUser, { resource:"auth" }); }
export function signOutCast() { return runServiceOperation("signOutCast", logoutCast, { resource:"auth" }); }
export function waitForAuthUser() { return runServiceOperation("waitForUser", waitForUser, { resource:"auth" }); }
export function requestPasswordReset(email) { return runServiceOperation("passwordReset", () => resetPassword(email), { resource:"auth" }); }
export function getAuthErrorMessage(error) { return getLegacyAuthErrorMessage(error?.cause || error); }
