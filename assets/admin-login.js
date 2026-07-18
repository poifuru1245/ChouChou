import { getAuthErrorMessage, requestPasswordReset, signInUser, signOutUser, waitForAuthUser } from "./js/services/authService.js";
import { defaultRouteForRole, getUserAccessProfile, isActiveUser } from "./js/services/roleService.js";

const form = document.getElementById("adminLoginForm");
const button = document.getElementById("adminLoginButton");
const message = document.getElementById("adminLoginMessage");

initialize();

async function initialize() {
  form.addEventListener("submit", handleLogin);
  document.getElementById("adminPasswordReset").addEventListener("click", handlePasswordReset);
  try {
    const user = await waitForAuthUser();
    if (user) await completeRoleLogin(user);
  } catch (error) {
    console.error("ログイン状態確認失敗", error);
    setMessage("ログイン状態を確認できませんでした。", "error");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  if (!email || !password) return setMessage("メールアドレスとパスワードを入力してください。", "error");
  button.disabled = true;
  setMessage("ログイン情報を確認しています...");
  try {
    const credential = await signInUser(email, password);
    await completeRoleLogin(credential.user);
  } catch (error) {
    console.error("管理画面ログイン失敗", error);
    setMessage(getAuthErrorMessage(error), "error");
    button.disabled = false;
  }
}

async function completeRoleLogin(user) {
  const profile = await getUserAccessProfile(user, { force:true });
  if (!isActiveUser(profile)) {
    await signOutUser();
    setMessage(profile ? "このアカウントは現在利用できません。管理者へお問い合わせください。" : "権限情報が登録されていません。usersドキュメントをご確認ください。", "error");
    button.disabled = false;
    return;
  }
  const requested = new URLSearchParams(location.search).get("return");
  const safeRequested = /^[a-z0-9-]+\.html$/i.test(requested || "") ? requested : "";
  const route = profile.role === "owner" && safeRequested ? safeRequested : defaultRouteForRole(profile.role);
  location.replace(route);
}

async function handlePasswordReset() {
  const email = form.elements.email.value.trim();
  if (!email) return setMessage("再設定メールの送信先を入力してください。", "error");
  try { await requestPasswordReset(email); setMessage("パスワード再設定メールを送信しました。", "success"); }
  catch (error) { console.error("パスワード再設定失敗", error); setMessage(getAuthErrorMessage(error), "error"); }
}

function setMessage(text, type = "") { message.textContent = text; message.dataset.type = type; }
