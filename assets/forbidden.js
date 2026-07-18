import { signOutUser, waitForAuthUser } from "./js/services/authService.js";
import { defaultRouteForRole, getUserAccessProfile, isActiveUser, roleLabel } from "./js/services/roleService.js";

const home = document.getElementById("forbiddenHome");
const userLabel = document.getElementById("forbiddenUser");

initialize();
document.getElementById("forbiddenLogout").addEventListener("click", async () => { await signOutUser(); location.replace("login.html"); });

async function initialize() {
  try {
    const user = await waitForAuthUser();
    const profile = user ? await getUserAccessProfile(user, { force:true }) : null;
    if (!isActiveUser(profile)) { home.href = "login.html"; home.textContent = "ログイン画面へ"; return; }
    home.href = defaultRouteForRole(profile.role);
    userLabel.textContent = `${profile.displayName} / ${roleLabel(profile.role)}`;
  } catch (error) {
    console.error("権限情報確認失敗", error);
    home.href = "login.html";
  }
}
