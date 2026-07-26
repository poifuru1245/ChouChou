import "./admin.js";
import { subscribeCasts } from "./services/castService.js";
import { subscribeReservation, updateReservationStatus } from "./services/reservationService.js";
import { subscribeTables } from "./services/tableService.js";
import { subscribeVisit } from "./services/visitService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";

const id = new URLSearchParams(location.search).get("id") || "";
const state = { reservation:null, visit:null, tables:[], casts:[] };
let unsubscribeVisit = null;
if (!id) showError("予約IDが指定されていません。");
else {
  subscribeReservation(id, (row) => { state.reservation = row; bindVisit(); render(); }, showError);
  subscribeTables((rows) => { state.tables = rows; renderSelects(); render(); }, showError);
  subscribeCasts((rows) => { state.casts = rows; renderSelects(); render(); }, showError);
}
document.getElementById("reservationOperationForm").addEventListener("submit", saveOperation);

function bindVisit() {
  unsubscribeVisit?.();
  if (!state.reservation) return;
  unsubscribeVisit = subscribeVisit(state.reservation.visitId || state.reservation.id, (row) => { state.visit = row; render(); }, () => { state.visit = null; render(); });
}
function render() {
  const item = state.reservation;
  if (!item) return;
  document.title = `${item.customerName || "予約詳細"} | Chou Chou`;
  setText("reservationDetailTitle", `${item.customerName || "お客様"} 様`);
  setText("reservationDetailSubtitle", `${formatDate(item.visitDate)} ${item.visitTime || "時間未定"} / ${item.peopleCount}名`);
  const status = state.visit?.status || item.status;
  const badge = document.getElementById("reservationCurrentStatus"); badge.textContent = status; badge.className = `ops-status is-${status}`;
  document.getElementById("reservationProfile").innerHTML = detail("受付経路", item.source) + detail("日時", `${formatDate(item.visitDate)} ${item.visitTime}`) + detail("人数", `${item.peopleCount}名`) + detail("希望キャスト", item.nominationCastName || "なし") + detail("担当キャスト", item.assignedCastName || castName(item.assignedCastId) || "未設定") + detail("席", item.tableName || tableName(item.tableId) || item.tableType || "未設定") + detail("連絡先", item.phone || item.lineId || "未登録") + detail("備考", item.memo || "なし");
  document.getElementById("reservationCustomerLink").href = item.customerId ? `customer-detail.html?id=${encodeURIComponent(item.customerId)}` : "customers.html";
  const timeline = state.visit?.timeline || [];
  document.getElementById("reservationTimeline").innerHTML = timeline.length ? [...timeline].reverse().map((event) => `<article class="visit-event"><time>${escapeHtml(formatTimestamp(event.at))}</time><div><strong>${escapeHtml(event.status)}</strong>${event.note ? `<p>${escapeHtml(event.note)}</p>` : ""}</div></article>`).join("") : '<p class="operations-empty">状態更新時に来店履歴が記録されます。</p>';
  const form = document.getElementById("reservationOperationForm");
  form.elements.status.value = status;
  form.elements.tableId.value = item.tableId || "";
  form.elements.assignedCastId.value = item.assignedCastId || "";
  document.getElementById("reservationDetailStatus").hidden = true;
  document.getElementById("reservationDetailBody").hidden = false;
}
function renderSelects() {
  const form = document.getElementById("reservationOperationForm");
  const currentTableId = state.reservation?.tableId || "";
  form.elements.tableId.innerHTML = '<option value="">未設定</option>' + state.tables.filter((table) => table.id === currentTableId || ["空席", "予約済"].includes(table.status)).map((table) => `<option value="${escapeAttribute(table.id)}">${escapeHtml(table.name)}（${escapeHtml(table.type)} / ${escapeHtml(table.status)}）</option>`).join("");
  const castOptions = '<option value="">未設定</option>' + state.casts.filter((cast) => cast.isPublished !== false).map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}</option>`).join("");
  form.elements.assignedCastId.innerHTML = castOptions; form.elements.relationCastId.innerHTML = castOptions;
}
async function saveOperation(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const table = state.tables.find((item) => item.id === values.tableId);
  const assigned = state.casts.find((item) => item.id === values.assignedCastId);
  const relationCast = state.casts.find((item) => item.id === values.relationCastId);
  const castAssignments = [...(state.visit?.castAssignments || [])];
  if (relationCast) castAssignments.push({ castId:relationCast.id, castName:relationCast.name, relation:values.relation });
  try {
    await updateReservationStatus(id, values.status, { tableId:values.tableId, tableName:table?.name || "", tableType:table?.type || "", assignedCastId:values.assignedCastId, assignedCastName:assigned?.name || "", castAssignments, eventNote:values.eventNote });
    event.currentTarget.elements.eventNote.value = "";
    setMessage("予約状態・席・来店履歴を更新しました。", "success");
  } catch (error) { console.error(error); setMessage(error.message?.includes("table-conflict") ? "選択した席は使用中です。" : "更新できませんでした。権限と通信状況をご確認ください。", "error"); }
}
function detail(label, value) { return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value || "未登録"))}</dd></div>`; }
function castName(castId) { return state.casts.find((item) => item.id === castId)?.name || ""; }
function tableName(tableId) { return state.tables.find((item) => item.id === tableId)?.name || ""; }
function formatDate(value) { return String(value || "").replaceAll("-", "/"); }
function formatTimestamp(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "日時不明" : new Intl.DateTimeFormat("ja-JP", { dateStyle:"short", timeStyle:"short" }).format(date); }
function setText(target, value) { document.getElementById(target).textContent = String(value); }
function setMessage(text, type = "") { const el = document.getElementById("reservationOperationMessage"); el.textContent = text; el.dataset.type = type; }
function showError(error) { console.error(error); const el = document.getElementById("reservationDetailStatus"); el.textContent = typeof error === "string" ? error : "予約情報を読み込めませんでした。"; el.dataset.type = "error"; }
