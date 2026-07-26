import "./admin.js";
import { createTable, deleteTable, subscribeTables, updateTable } from "./services/tableService.js";
import { moveVisitToTable, subscribeVisits } from "./services/visitService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";

const state = { tables:[], visits:[], filter:"", editingId:"", movingTableId:"" };
const grid = document.getElementById("tableGrid");
const editor = document.getElementById("tableEditorModal");
const moveModal = document.getElementById("tableMoveModal");
const form = document.getElementById("tableForm");

bindEvents();
subscribeTables((rows) => { state.tables = rows; render(); }, handleError);
subscribeVisits((rows) => { state.visits = rows; render(); }, handleError);

function bindEvents() {
  document.getElementById("openTableEditor").addEventListener("click", () => openEditor());
  document.getElementById("tableTypeFilter").addEventListener("change", (event) => { state.filter = event.target.value; render(); });
  document.querySelectorAll("[data-close-table]").forEach((button) => button.addEventListener("click", closeEditor));
  document.querySelectorAll("[data-close-move]").forEach((button) => button.addEventListener("click", () => { moveModal.hidden = true; }));
  form.addEventListener("submit", saveTable);
  document.getElementById("tableMoveForm").addEventListener("submit", moveTable);
  grid.addEventListener("click", handleGridAction);
}

function render() {
  setText("tableTotal", state.tables.length);
  setText("tableVacant", state.tables.filter((item) => item.status === "空席").length);
  setText("tableInUse", state.tables.filter((item) => item.status === "使用中").length);
  setText("tableReserved", state.tables.filter((item) => item.status === "予約済").length);
  const rows = state.tables.filter((item) => !state.filter || item.type === state.filter);
  grid.innerHTML = rows.length ? rows.map(tableCard).join("") : '<p class="operations-empty">登録された席はありません。</p>';
}

function tableCard(table) {
  const visit = state.visits.find((item) => item.id === table.currentVisitId || item.reservationId === table.currentReservationId);
  return `<article class="table-card operations-card"><span class="ops-status is-${escapeAttribute(table.status)}">${escapeHtml(table.status)}</span><h3>${escapeHtml(table.name)}</h3><p>${escapeHtml(table.type)} / ${table.capacity}名</p><p>${escapeHtml(table.customerName || visit?.customerName || "ご利用なし")}</p><footer><button type="button" data-action="edit" data-id="${escapeAttribute(table.id)}">編集</button>${visit && ["使用中", "予約済"].includes(table.status) ? `<button type="button" data-action="move" data-id="${escapeAttribute(table.id)}">席移動</button>` : ""}<button type="button" data-action="delete" data-id="${escapeAttribute(table.id)}">削除</button></footer></article>`;
}

function handleGridAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const table = state.tables.find((item) => item.id === button.dataset.id);
  if (!table) return;
  if (button.dataset.action === "edit") openEditor(table);
  if (button.dataset.action === "move") openMove(table);
  if (button.dataset.action === "delete") removeTable(table);
}

function openEditor(table = null) {
  state.editingId = table?.id || "";
  form.reset();
  if (table) ["name", "type", "capacity", "displayOrder", "status", "memo"].forEach((key) => { form.elements[key].value = table[key] ?? ""; });
  document.getElementById("tableEditorTitle").textContent = table ? "席情報を編集" : "席を登録";
  editor.hidden = false;
  form.elements.name.focus();
}
function closeEditor() { editor.hidden = true; state.editingId = ""; }

async function saveTable(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.capacity = Number(payload.capacity); payload.displayOrder = Number(payload.displayOrder);
  const current = state.tables.find((item) => item.id === state.editingId);
  if (current && ["使用中", "予約済"].includes(payload.status)) {
    payload.currentVisitId = current.currentVisitId;
    payload.currentReservationId = current.currentReservationId;
    payload.customerName = current.customerName;
  }
  try {
    if (state.editingId) await updateTable(state.editingId, payload); else await createTable(payload);
    closeEditor(); setMessage("席情報を保存しました。", "success");
  } catch (error) { handleError(error, "席情報を保存できませんでした。"); }
}

function openMove(table) {
  state.movingTableId = table.id;
  const select = document.getElementById("tableMoveForm").elements.targetTableId;
  select.innerHTML = '<option value="">移動先を選択</option>' + state.tables.filter((item) => item.id !== table.id && item.status === "空席").map((item) => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.name)}（${escapeHtml(item.type)}）</option>`).join("");
  moveModal.hidden = false;
}

async function moveTable(event) {
  event.preventDefault();
  const from = state.tables.find((item) => item.id === state.movingTableId);
  const visit = state.visits.find((item) => item.id === from?.currentVisitId || item.reservationId === from?.currentReservationId);
  const target = state.tables.find((item) => item.id === event.currentTarget.elements.targetTableId.value);
  if (!visit || !target) return setMessage("移動対象または移動先を選択してください。", "error");
  try { await moveVisitToTable(visit, target); moveModal.hidden = true; setMessage(`${target.name}へ席を移動しました。`, "success"); }
  catch (error) { handleError(error, "席を移動できませんでした。"); }
}

async function removeTable(table) {
  if (["使用中", "予約済"].includes(table.status)) return setMessage("使用中・予約済の席は削除できません。", "error");
  if (!confirm(`${table.name}を削除しますか？`)) return;
  try { await deleteTable(table.id); setMessage("席を削除しました。", "success"); } catch (error) { handleError(error, "席を削除できませんでした。"); }
}
function handleError(error, text = "席情報を読み込めませんでした。") { console.error(error); setMessage(text, "error"); }
function setMessage(text, type = "") { const el = document.getElementById("tableMessage"); el.textContent = text; el.dataset.type = type; }
function setText(id, text) { document.getElementById(id).textContent = String(text); }
