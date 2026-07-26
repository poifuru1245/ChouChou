import "./admin.js";
import { subscribeVisits } from "./services/visitService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";

const today = new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
const state = { visits:[], from:"", to:"", status:"", search:"" };
document.getElementById("visitDateFrom").addEventListener("change", (e) => { state.from = e.target.value; render(); });
document.getElementById("visitDateTo").addEventListener("change", (e) => { state.to = e.target.value; render(); });
document.getElementById("visitStatus").addEventListener("change", (e) => { state.status = e.target.value; render(); });
document.getElementById("visitSearch").addEventListener("input", (e) => { state.search = e.target.value.trim().toLowerCase(); render(); });
subscribeVisits((rows) => { state.visits = rows; render(); }, (error) => { console.error(error); setMessage("来店履歴を読み込めませんでした。", "error"); });

function render() {
  const todayRows = state.visits.filter((item) => item.visitDate === today);
  setText("visitToday", todayRows.filter((item) => !["予約", "キャンセル", "無断キャンセル"].includes(item.status)).length);
  setText("visitSeated", state.visits.filter((item) => ["着席", "延長", "会計"].includes(item.status)).length);
  setText("visitExtended", todayRows.reduce((sum, item) => sum + item.extensionCount, 0));
  setText("visitCompleted", todayRows.filter((item) => item.status === "完了").length);
  const rows = state.visits.filter((item) => (!state.from || item.visitDate >= state.from) && (!state.to || item.visitDate <= state.to) && (!state.status || item.status === state.status) && (!state.search || `${item.customerName} ${item.tableName} ${item.assignedCastName} ${item.nominationCastName}`.toLowerCase().includes(state.search)));
  setText("visitResultCount", `${rows.length}件`);
  document.getElementById("visitList").innerHTML = rows.length ? `<table class="operations-table"><thead><tr><th>来店日時</th><th>お客様</th><th>席</th><th>担当・指名</th><th>状態</th><th>履歴</th></tr></thead><tbody>${rows.map(row).join("")}</tbody></table>` : '<p class="operations-empty">該当する来店履歴はありません。</p>';
}
function row(item) { return `<tr><td>${escapeHtml(formatDate(item.visitDate))} ${escapeHtml(item.visitTime || "")}</td><td><a href="${item.customerId ? `customer-detail.html?id=${encodeURIComponent(item.customerId)}` : "#"}">${escapeHtml(item.customerName || "名称未設定")}</a></td><td>${escapeHtml(item.tableName || "未設定")}</td><td>${escapeHtml(item.assignedCastName || item.nominationCastName || "未設定")}</td><td><span class="ops-status is-${escapeAttribute(item.status)}">${escapeHtml(item.status)}</span></td><td>${item.timeline.length}件 <a href="reservation-detail.html?id=${encodeURIComponent(item.reservationId)}">詳細</a></td></tr>`; }
function formatDate(value) { return String(value || "").replaceAll("-", "/"); }
function setText(id, value) { document.getElementById(id).textContent = String(value); }
function setMessage(text, type = "") { const el = document.getElementById("visitMessage"); el.textContent = text; el.dataset.type = type; }
