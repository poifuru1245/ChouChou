import { app } from "../js/firebase/firebaseClient.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { applyListOptions, createDataService } from "./dataService.js";

const functions = getFunctions(app, "asia-northeast1");
const callListUsers = httpsCallable(functions, "adminListUsers");
const callCreateUser = httpsCallable(functions, "adminCreateUser");
const callUpdateUser = httpsCallable(functions, "adminUpdateUser");
const callDeactivateUser = httpsCallable(functions, "adminDeactivateUser");

// Authの管理操作はFunctions、Firestore usersのリアルタイム参照は共通DataServiceに分離する。
const userProfiles = createDataService({
  collectionName:"users",
  normalize:normalizeManagedUser,
  searchableFields:["displayName", "email", "role", "status"],
  defaultSort:{ field:"createdAt", direction:"desc" }
});
export const userProfileDataService = Object.freeze({ list:userProfiles.list, page:userProfiles.page, get:userProfiles.get, listen:userProfiles.listen, listenOne:userProfiles.listenOne, query:userProfiles.query });

export async function listManagedUsers(options = {}) {
  const response = await callListUsers();
  const rows = Array.isArray(response.data?.users) ? response.data.users.map(normalizeManagedUser) : [];
  return applyListOptions(rows, options, ["displayName", "email", "role", "status"], { field:"createdAt", direction:"desc" });
}

export function subscribeUserProfiles(onData, onError, options = {}) { return userProfiles.listen(onData, onError, options); }

export async function createManagedUser(input) {
  const response = await callCreateUser(input);
  return normalizeManagedUser(response.data?.user);
}

export async function updateManagedUser(input) {
  const response = await callUpdateUser(input);
  return normalizeManagedUser(response.data?.user);
}

export function deactivateManagedUser(uid) {
  return callDeactivateUser({ uid });
}

export function normalizeManagedUser(row = {}) {
  return {
    uid:String(row.uid || ""),
    displayName:String(row.displayName || "名称未設定"),
    email:String(row.email || ""),
    role:String(row.role || ""),
    status:row.status === "inactive" || row.disabled === true ? "inactive" : "active",
    castId:String(row.castId || ""),
    lastSignInAt:String(row.lastSignInAt || ""),
    createdAt:String(row.createdAt || "")
  };
}

export function getUserAdminErrorMessage(error) {
  const message = String(error?.message || "").replace(/^FirebaseError:\s*/, "").replace(/^functions\/[\w-]+:\s*/, "");
  if (message && !message.includes("INTERNAL")) return message;
  if (error?.code === "functions/permission-denied") return "オーナー権限が必要です。";
  if (error?.code === "functions/unauthenticated") return "ログイン状態を確認できません。再ログインしてください。";
  if (error?.code === "functions/unavailable") return "サーバーへ接続できませんでした。時間をおいてお試しください。";
  return "ユーザー管理処理に失敗しました。";
}
