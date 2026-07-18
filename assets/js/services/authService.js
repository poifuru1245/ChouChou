import { auth } from "../firebase/firebaseClient.js";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let persistenceReady;

export function subscribeAuth(callback, onError = console.error) {
  return onAuthStateChanged(auth, callback, onError);
}

export async function signInCast(email, password) {
  await ensurePersistence();
  return signInWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
}

export function signOutCast() {
  return signOut(auth);
}

export async function requestPasswordReset(email) {
  await ensurePersistence();
  return sendPasswordResetEmail(auth, String(email || "").trim());
}

export function getAuthErrorMessage(error) {
  const code = String(error?.code || "");
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(code)) return "メールアドレスまたはパスワードが正しくありません。";
  if (code === "auth/invalid-email") return "メールアドレスの形式をご確認ください。";
  if (code === "auth/too-many-requests") return "ログイン試行が多すぎます。時間をおいてお試しください。";
  if (code === "auth/network-request-failed") return "通信できませんでした。ネットワークをご確認ください。";
  if (code === "auth/operation-not-allowed") return "メール・パスワード認証が有効になっていません。管理者へお問い合わせください。";
  return "認証処理に失敗しました。時間をおいてお試しください。";
}

function ensurePersistence() {
  if (!persistenceReady) persistenceReady = setPersistence(auth, browserLocalPersistence);
  return persistenceReady;
}
