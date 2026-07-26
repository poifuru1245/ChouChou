import { adminSession } from "./admin.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";
import {
  createManagedUser,
  deactivateManagedUser,
  getUserAdminErrorMessage,
  listManagedUsers,
  requestPasswordReset,
  updateManagedUser
} from "./services/userService.js";
import { subscribeCasts } from "./services/castService.js";

const form = document.getElementById("userForm");
const list = document.getElementById("userList");
const modal = document.getElementById("userEditorModal");
const state = { users:[], casts:[], editingUid:"", search:"", role:"", status:"", sort:"created-desc" };

initialize();

function initialize() {
  bindEvents();
  subscribeCasts((rows) => { state.casts = rows.sort(compareCasts); renderCastOptions(); }, handleLoadError);
  loadUsers();
}

function bindEvents() {
  document.getElementById("openUserEditor").addEventListener("click", () => openEditor());
  document.getElementById("refreshUsers").addEventListener("click", loadUsers);
  document.querySelectorAll("[data-close-user-editor]").forEach((button) => button.addEventListener("click", closeEditor));
  modal.addEventListener("click", (event) => { if (event.target === modal) closeEditor(); });
  form.addEventListener("submit", saveUser);
  form.elements.role.addEventListener("change", updateCastField);
  document.getElementById("userSearch").addEventListener("input", (event) => { state.search = event.target.value.trim().toLowerCase(); render(); });
  document.getElementById("userRoleFilter").addEventListener("change", (event) => { state.role = event.target.value; render(); });
  document.getElementById("userStatusFilter").addEventListener("change", (event) => { state.status = event.target.value; render(); });
  document.getElementById("userSort").addEventListener("change", (event) => { state.sort = event.target.value; render(); });
  list.addEventListener("click", handleListAction);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeEditor(); });
}

async function loadUsers() {
  const button = document.getElementById("refreshUsers");
  button.disabled = true;
  list.innerHTML = '<span class="ui-loading">ユーザー情報を読み込み中...</span>';
  try {
    state.users = await listManagedUsers();
    render();
    setMessage("");
  } catch (error) {
    console.error("ユーザー一覧取得失敗", error);
    list.innerHTML = '<p class="users-empty">ユーザー情報を読み込めませんでした。</p>';
    setMessage(getUserAdminErrorMessage(error), "error");
  } finally { button.disabled = false; }
}

function render() {
  renderSummary();
  const rows = getVisibleUsers();
  document.getElementById("userResultCount").textContent = `${rows.length}件`;
  list.innerHTML = rows.length ? createUserTable(rows) : '<p class="users-empty">該当するユーザーはいません。</p>';
}

function renderSummary() {
  setText("userTotalCount", state.users.length);
  setText("userOwnerCount", state.users.filter((item) => item.role === "owner").length);
  setText("userTeamCount", state.users.filter((item) => ["manager", "staff"].includes(item.role)).length);
  setText("userCastCount", state.users.filter((item) => item.role === "cast").length);
  setText("userInactiveCount", state.users.filter((item) => item.status === "inactive").length);
}

function getVisibleUsers() {
  return state.users.filter((item) => {
    const searchMatch = !state.search || `${item.displayName} ${item.email}`.toLowerCase().includes(state.search);
    return searchMatch && (!state.role || item.role === state.role) && (!state.status || item.status === state.status);
  }).sort(compareUsers);
}

function compareUsers(a, b) {
  if (state.sort === "last-login-desc") return dateMillis(b.lastSignInAt) - dateMillis(a.lastSignInAt);
  if (state.sort === "name-asc") return a.displayName.localeCompare(b.displayName, "ja");
  if (state.sort === "role-asc") return a.role.localeCompare(b.role) || a.displayName.localeCompare(b.displayName, "ja");
  return dateMillis(b.createdAt) - dateMillis(a.createdAt);
}

function createUserTable(rows) {
  return `<table class="users-table"><thead><tr><th>ユーザー</th><th>ロール</th><th>状態</th><th>最終ログイン</th><th>作成日</th><th>操作</th></tr></thead><tbody>${rows.map((item) => `<tr><td><div class="users-person"><strong>${escapeHtml(item.displayName)}</strong><small>${escapeHtml(item.email)}</small></div></td><td><span class="user-role-badge is-${escapeAttribute(item.role || "unset")}">${escapeHtml(item.role || "未設定")}</span></td><td><span class="user-status-badge is-${escapeAttribute(item.status)}">${item.status === "active" ? "有効" : "無効"}</span></td><td>${escapeHtml(formatDateTime(item.lastSignInAt, "未ログイン"))}</td><td>${escapeHtml(formatDateTime(item.createdAt, "不明"))}</td><td><div class="users-row-actions"><button type="button" data-action="edit" data-uid="${escapeAttribute(item.uid)}">編集</button><button type="button" data-action="reset" data-uid="${escapeAttribute(item.uid)}">再設定メール</button>${item.status === "active" && item.uid !== adminSession.user.uid ? `<button type="button" data-action="deactivate" data-uid="${escapeAttribute(item.uid)}">無効化</button>` : ""}</div></td></tr>`).join("")}</tbody></table>`;
}

function handleListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const user = state.users.find((item) => item.uid === button.dataset.uid);
  if (!user) return;
  if (button.dataset.action === "edit") openEditor(user);
  if (button.dataset.action === "reset") sendResetEmail(user);
  if (button.dataset.action === "deactivate") deactivateUser(user);
}

function openEditor(user = null) {
  state.editingUid = user?.uid || "";
  form.reset();
  form.elements.status.value = "active";
  form.elements.email.readOnly = Boolean(user);
  document.getElementById("temporaryPasswordField").hidden = Boolean(user);
  form.elements.password.required = !user;
  document.getElementById("userEditorTitle").textContent = user ? "ユーザーを編集" : "ユーザーを追加";
  document.getElementById("saveUser").textContent = user ? "変更を保存" : "ユーザーを作成";
  if (user) {
    form.elements.displayName.value = user.displayName;
    form.elements.email.value = user.email;
    form.elements.role.value = user.role || "staff";
    form.elements.status.value = user.status;
    form.elements.castId.value = user.castId || "";
    const self = user.uid === adminSession.user.uid;
    form.elements.role.disabled = self;
    form.elements.status.disabled = self;
  } else {
    form.elements.role.disabled = false;
    form.elements.status.disabled = false;
  }
  updateCastField();
  setFormMessage("");
  modal.hidden = false;
  document.body.classList.add("is-modal-open");
  form.elements.displayName.focus();
}

function closeEditor() { modal.hidden = true; document.body.classList.remove("is-modal-open"); state.editingUid = ""; setFormMessage(""); }

async function saveUser(event) {
  event.preventDefault();
  const current = state.users.find((item) => item.uid === state.editingUid);
  const payload = {
    uid:state.editingUid,
    displayName:form.elements.displayName.value.trim(),
    email:form.elements.email.value.trim(),
    password:form.elements.password.value,
    role:form.elements.role.disabled ? current?.role : form.elements.role.value,
    status:form.elements.status.disabled ? current?.status : form.elements.status.value,
    castId:form.elements.role.value === "cast" ? form.elements.castId.value : ""
  };
  const validation = validate(payload);
  if (validation) return setFormMessage(validation, "error");
  const button = document.getElementById("saveUser"); button.disabled = true; setFormMessage("保存中...");
  const wasEditing = Boolean(state.editingUid);
  try {
    if (state.editingUid) await updateManagedUser(payload);
    else await createManagedUser(payload);
    closeEditor();
    setMessage(wasEditing ? "ユーザー情報を更新しました。" : "ユーザーを作成しました。", "success");
    await loadUsers();
  } catch (error) {
    console.error("ユーザー保存失敗", error);
    setFormMessage(getUserAdminErrorMessage(error), "error");
  } finally { button.disabled = false; }
}

function validate(input) {
  if (!input.displayName) return "氏名を入力してください。";
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return "メールアドレスの形式をご確認ください。";
  if (!state.editingUid && input.password.length < 8) return "仮パスワードは8文字以上で入力してください。";
  if (input.role === "cast" && !input.castId) return "紐付けるキャストを選択してください。";
  return "";
}

async function deactivateUser(user) {
  if (!window.confirm(`${user.displayName}さんのアカウントを無効化しますか？\nログインできなくなりますが、データは削除されません。`)) return;
  try { await deactivateManagedUser(user.uid); setMessage("ユーザーを無効化しました。", "success"); await loadUsers(); }
  catch (error) { console.error("ユーザー無効化失敗", error); setMessage(getUserAdminErrorMessage(error), "error"); }
}

async function sendResetEmail(user) {
  if (!user.email || !window.confirm(`${user.email}へパスワード再設定メールを送信しますか？`)) return;
  try { await requestPasswordReset(user.email); setMessage("パスワード再設定メールを送信しました。", "success"); }
  catch (error) { console.error("パスワード再設定メール送信失敗", error); setMessage("再設定メールを送信できませんでした。", "error"); }
}

function updateCastField() { document.getElementById("castLinkField").hidden = form.elements.role.value !== "cast"; }
function renderCastOptions() { const selected = form.elements.castId.value; form.elements.castId.innerHTML = `<option value="">キャストを選択</option>${state.casts.map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}${cast.authUid ? "（紐付け済み）" : ""}</option>`).join("")}`; form.elements.castId.value = selected; }
function compareCasts(a, b) { return Number(a.displayOrder ?? 9999) - Number(b.displayOrder ?? 9999) || String(a.name || "").localeCompare(String(b.name || ""), "ja"); }
function dateMillis(value) { return Date.parse(value || "") || 0; }
function formatDateTime(value, fallback) { const time = dateMillis(value); return time ? new Intl.DateTimeFormat("ja-JP", { year:"numeric", month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(time)) : fallback; }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function setMessage(text, type = "") { const element = document.getElementById("usersMessage"); element.textContent = text; element.dataset.type = type; }
function setFormMessage(text, type = "") { const element = document.getElementById("userFormMessage"); element.textContent = text; element.dataset.type = type; }
function handleLoadError(error) { console.error("キャスト一覧取得失敗", error); setMessage("キャスト情報を読み込めませんでした。", "error"); }
