import { subscribeNotifications } from "./services/notificationService.js";
import { adminSession } from "./admin.js";
import { escape, formatDate, setMessage } from "./utils/analyticsUi.js";

const state = { rows:[], type:"all" };
document.querySelectorAll("[data-type]").forEach((button) => button.addEventListener("click", () => { state.type = button.dataset.type; document.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("is-active", item === button)); render(); }));
subscribeNotifications((rows) => { state.rows = rows; render(); }, loadError, { includeAuditLogs:adminSession.profile.role === "owner" });
function render() { const rows = state.type === "all" ? state.rows : state.rows.filter((row) => row.type === state.type); document.getElementById("notificationList").innerHTML = rows.length ? rows.map((row) => `<a class="notification-item" href="${escape(row.href)}"><span class="notification-icon" aria-hidden="true">${icon(row.type)}</span><div><strong>${escape(row.title)}</strong><p>${escape(row.message)}</p></div><time>${formatTime(row.time)}</time></a>`).join("") : '<p class="analytics-empty">該当する通知はありません。</p>'; setMessage("notificationMessage", `${rows.length}件の通知を表示しています。`, "success"); }
function icon(type) { return ({ vip:"♕", birthday:"✧", cancel:"◇", bottle:"♢", closing:"✓", target:"♕", audit:"◇" })[type] || "◇"; }
function formatTime(value) { if (typeof value?.toDate === "function") return new Intl.DateTimeFormat("ja-JP", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }).format(value.toDate()); return formatDate(value); }
function loadError(error, source) { console.error(source, error); setMessage("notificationMessage", `${source}を読み込めませんでした。`, "error"); }
