import "./admin.js";
import {
  ACTIVE_RESERVATION_STATUSES,
  RESERVATION_STATUSES,
  createReservation,
  deleteReservation,
  getCustomerHistory,
  linkReservationToCustomer,
  reservationDateTime,
  subscribeReservations,
  updateReservation,
  updateReservationSchedule,
  updateReservationStatus
} from "./services/reservationService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";
import { createCustomer, findMatchingCustomer, subscribeCustomers } from "./services/customerService.js";
import { subscribeCasts } from "./services/castService.js";

const form = document.getElementById("reservationForm");
const list = document.getElementById("reservationList");
const editorModal = document.getElementById("reservationEditorModal");
const detailModal = document.getElementById("reservationDetailModal");
const DISMISSED_KEY = "chouchouReservationDismissedNotifications";
const state = {
  reservations:[], casts:[], customers:[], period:"today", view:"table", sort:"date-asc", search:"", status:"",
  editingId:"", selectedId:"", calendarView:"week", calendarDate:getTokyoDateKey(),
  known:new Map(), eventNotifications:[], dismissed:new Set(readJson(DISMISSED_KEY, [])), initialized:false,
  queryCustomerId:new URLSearchParams(location.search).get("customerId") || ""
};

initialize();

function initialize() {
  bindEvents();
  resetForm();
  subscribeCasts(handleCasts, handleLoadError);
  subscribeCustomers((rows) => { state.customers = rows.sort((a, b) => a.name.localeCompare(b.name, "ja")); renderCustomerOptions(); applyQueryCustomer(); }, handleLoadError);
  subscribeReservations(handleReservations, handleLoadError);
  window.setInterval(() => { renderSummary(); renderNotifications(); }, 60000);
}

function bindEvents() {
  document.getElementById("openReservationEditor").addEventListener("click", () => openEditor());
  form.addEventListener("submit", saveReservation);
  form.elements.customerId.addEventListener("change", applySelectedCustomer);
  ["customerName", "phone", "lineId"].forEach((field) => form.elements[field].addEventListener("blur", matchCustomerFromInput));
  document.querySelectorAll("[data-close-reservation-modal]").forEach((button) => button.addEventListener("click", closeEditor));
  document.querySelectorAll("[data-close-reservation-detail]").forEach((button) => button.addEventListener("click", closeDetail));
  editorModal.addEventListener("click", (event) => { if (event.target === editorModal) closeEditor(); });
  detailModal.addEventListener("click", (event) => { if (event.target === detailModal) closeDetail(); });
  document.querySelectorAll("[data-reservation-period]").forEach((button) => button.addEventListener("click", () => setPeriod(button.dataset.reservationPeriod)));
  document.querySelectorAll("[data-reservation-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.reservationView)));
  ["reservationDateFrom", "reservationDateTo"].forEach((id) => document.getElementById(id).addEventListener("change", renderList));
  document.getElementById("reservationStatusFilter").addEventListener("change", (event) => { state.status = event.target.value; renderList(); });
  document.getElementById("reservationSearch").addEventListener("input", (event) => { state.search = event.target.value.trim().toLowerCase(); renderList(); });
  document.getElementById("reservationSort").addEventListener("change", (event) => { state.sort = event.target.value; renderList(); });
  list.addEventListener("click", handleListClick);
  list.addEventListener("change", handleListChange);
  document.getElementById("editReservationFromDetail").addEventListener("click", editSelectedReservation);
  document.getElementById("deleteReservationFromDetail").addEventListener("click", deleteSelectedReservation);
  document.getElementById("clearReservationNotifications").addEventListener("click", clearNotifications);
  document.getElementById("reservationNotifications").addEventListener("click", handleNotificationClick);
  document.getElementById("exportReservationsCsv").addEventListener("click", exportCsv);
  document.querySelectorAll("[data-calendar-view]").forEach((button) => button.addEventListener("click", () => setCalendarView(button.dataset.calendarView)));
  document.getElementById("reservationCalendarPrev").addEventListener("click", () => moveCalendar(-1));
  document.getElementById("reservationCalendarNext").addEventListener("click", () => moveCalendar(1));
  const calendar = document.getElementById("reservationCalendar");
  calendar.addEventListener("dragstart", handleCalendarDragStart);
  calendar.addEventListener("dragover", (event) => { if (event.target.closest("[data-drop-date]")) event.preventDefault(); });
  calendar.addEventListener("drop", handleCalendarDrop);
  calendar.addEventListener("click", handleCalendarClick);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeEditor(); closeDetail(); } });
}

function handleCasts(rows) {
  state.casts = rows.filter((item) => item.isPublished !== false).sort((a, b) => Number(a.displayOrder ?? 9999) - Number(b.displayOrder ?? 9999));
  renderCastOptions();
}

function renderCustomerOptions() {
  const selected = form.elements.customerId.value;
  form.elements.customerId.innerHTML = `<option value="">入力内容から自動検索</option>${state.customers.map((customer) => `<option value="${escapeAttribute(customer.id)}">${escapeHtml(customer.name || "名称未設定")}${customer.phone ? `（${escapeHtml(customer.phone)}）` : ""}</option>`).join("")}`;
  form.elements.customerId.value = selected;
}

function applySelectedCustomer() {
  const customer = state.customers.find((item) => item.id === form.elements.customerId.value);
  if (!customer) return;
  form.elements.customerName.value = customer.name;
  form.elements.phone.value = customer.phone;
  form.elements.lineId.value = customer.lineId;
  setCustomerMatchStatus(`${customer.name}様の顧客データへ紐付けます。`, "matched");
}

function applyQueryCustomer() {
  if (!state.queryCustomerId) return;
  const customer = state.customers.find((item) => item.id === state.queryCustomerId);
  state.queryCustomerId = "";
  if (!customer) return setMessage("指定された顧客情報が見つかりませんでした。", "error");
  openEditor();
  form.elements.customerId.value = customer.id;
  applySelectedCustomer();
}

function matchCustomerFromInput() {
  if (form.elements.customerId.value) return;
  const match = findMatchingCustomer(state.customers, {
    customerName:form.elements.customerName.value,
    phone:form.elements.phone.value,
    lineId:form.elements.lineId.value
  });
  if (!match) return setCustomerMatchStatus("既存顧客は見つかりません。保存時に新規顧客として登録できます。", "new");
  form.elements.customerId.value = match.id;
  applySelectedCustomer();
}

function handleReservations(rows) {
  captureNotifications(rows);
  state.reservations = rows;
  state.known = new Map(rows.map((item) => [item.id, signature(item)]));
  state.initialized = true;
  renderAll();
}

function captureNotifications(rows) {
  if (!state.initialized) {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    rows.filter((item) => getMillis(item.createdAt) >= since).forEach((item) => addEventNotification("new", item, "新規予約を受け付けました"));
    return;
  }
  rows.forEach((item) => {
    const previous = state.known.get(item.id);
    const current = signature(item);
    if (!previous) addEventNotification("new", item, "新規予約を受け付けました");
    else if (previous !== current) addEventNotification(isCanceled(item) ? "cancel" : "change", item, isCanceled(item) ? "予約がキャンセルされました" : "予約内容が変更されました");
  });
}

function addEventNotification(type, item, label) {
  const id = `${type}-${item.id}-${getMillis(item.updatedAt || item.createdAt) || Date.now()}`;
  if (!state.eventNotifications.some((notice) => notice.id === id)) state.eventNotifications.unshift({ id, type, reservationId:item.id, label, createdAt:Date.now() });
  state.eventNotifications = state.eventNotifications.slice(0, 30);
}

function renderAll() { renderSummary(); renderList(); renderCalendar(); renderNotifications(); if (!detailModal.hidden) renderDetail(); }

function renderSummary() {
  const today = getTokyoDateKey();
  const todayRows = state.reservations.filter((item) => item.visitDate === today && !isCanceled(item));
  setText("reservationTodayCount", todayRows.length);
  setText("reservationTodayPeople", sum(todayRows, "peopleCount"));
  setText("reservationWaitingCount", state.reservations.filter((item) => item.status === "受付").length);
  setText("reservationVisitedCount", todayRows.filter((item) => ["着席", "延長", "会計"].includes(item.status)).length);
  setText("reservationNotificationCount", getNotifications().length);
}

function renderList() {
  const rows = getFilteredReservations();
  setText("reservationResultCount", `${rows.length}件`);
  list.dataset.view = state.view;
  if (!rows.length) { list.innerHTML = '<p class="reservation-empty">該当する予約はありません。</p>'; return; }
  list.innerHTML = state.view === "card" ? createCards(rows) : createTable(rows);
}

function createTable(rows) {
  const body = rows.map((item) => `<tr><td><button class="reservation-customer-link" type="button" data-action="detail" data-id="${escapeAttribute(item.id)}"><strong>${escapeHtml(item.customerName || "名称未設定")}</strong><small>${escapeHtml(item.phone || item.lineId || "連絡先なし")}</small></button></td><td><time>${escapeHtml(formatDate(item.visitDate))}<br>${escapeHtml(item.visitTime || "未定")}</time></td><td>${item.peopleCount}名</td><td>${escapeHtml(item.nominationCastName || "指名なし")}</td><td><span class="reservation-source is-${escapeAttribute(sourceClass(item.source))}">${escapeHtml(item.source)}</span></td><td>${statusSelect(item)}</td><td><div class="admin-item-actions"><button type="button" data-action="detail" data-id="${escapeAttribute(item.id)}">詳細</button><button type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">編集</button></div></td></tr>`).join("");
  return `<div class="reservation-table-wrap"><table class="reservation-table"><thead><tr><th>お客様</th><th>来店日時</th><th>人数</th><th>指名</th><th>経路</th><th>ステータス</th><th>操作</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function createCards(rows) {
  return `<div class="reservation-card-grid">${rows.map((item) => `<article class="reservation-card admin-premium-card"><header><div><span>${escapeHtml(item.source)}</span><h3>${escapeHtml(item.customerName || "名称未設定")} 様</h3></div><time>${escapeHtml(formatDate(item.visitDate))}<strong>${escapeHtml(item.visitTime || "未定")}</strong></time></header><dl><div><dt>人数</dt><dd>${item.peopleCount}名</dd></div><div><dt>指名</dt><dd>${escapeHtml(item.nominationCastName || "指名なし")}</dd></div><div><dt>コース</dt><dd>${escapeHtml(item.course || "未設定")}</dd></div></dl>${statusSelect(item)}<div class="admin-item-actions"><button type="button" data-action="detail" data-id="${escapeAttribute(item.id)}">詳細を見る</button><button type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">編集</button></div></article>`).join("")}</div>`;
}

function statusSelect(item) { return `<label class="reservation-status-control"><span class="sr-only">ステータス</span><select data-action="status" data-id="${escapeAttribute(item.id)}" class="is-${escapeAttribute(statusClass(item.status))}">${RESERVATION_STATUSES.map((status) => `<option${status === item.status ? " selected" : ""}>${status}</option>`).join("")}</select></label>`; }

function getFilteredReservations() {
  const today = getTokyoDateKey();
  const tomorrow = addDays(today, 1);
  const month = today.slice(0, 7);
  const from = document.getElementById("reservationDateFrom").value;
  const to = document.getElementById("reservationDateTo").value;
  return state.reservations.filter((item) => {
    const periodMatch = state.period === "today" ? item.visitDate === today : state.period === "tomorrow" ? item.visitDate === tomorrow : state.period === "week" ? item.visitDate >= today && item.visitDate <= addDays(today, 6) : state.period === "month" ? item.visitDate.startsWith(month) : (!from || item.visitDate >= from) && (!to || item.visitDate <= to);
    const searchText = `${item.customerName} ${item.phone} ${item.lineId} ${item.nominationCastName} ${item.memo}`.toLowerCase();
    return periodMatch && (!state.status || item.status === state.status) && (!state.search || searchText.includes(state.search));
  }).sort(compareReservations);
}

function compareReservations(a, b) {
  if (state.sort === "date-desc") return reservationKey(b).localeCompare(reservationKey(a));
  if (state.sort === "created-desc") return getMillis(b.createdAt) - getMillis(a.createdAt);
  if (state.sort === "name-asc") return a.customerName.localeCompare(b.customerName, "ja");
  return reservationKey(a).localeCompare(reservationKey(b));
}

function setPeriod(period) {
  state.period = period;
  document.querySelectorAll("[data-reservation-period]").forEach((button) => button.classList.toggle("is-active", button.dataset.reservationPeriod === period));
  const custom = period === "custom";
  document.getElementById("reservationDateFrom").disabled = !custom;
  document.getElementById("reservationDateTo").disabled = !custom;
  renderList();
}

function setView(view) { state.view = view === "card" ? "card" : "table"; document.querySelectorAll("[data-reservation-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.reservationView === state.view)); renderList(); }

function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const reservation = findReservation(button.dataset.id);
  if (!reservation) return;
  if (button.dataset.action === "detail") openDetail(reservation.id);
  if (button.dataset.action === "edit") openEditor(reservation);
}

async function handleListChange(event) {
  const select = event.target.closest('select[data-action="status"]');
  if (!select) return;
  const reservation = findReservation(select.dataset.id);
  select.disabled = true;
  try {
    if (select.value === "完了" && reservation) await ensureReservationCustomer(reservation);
    await updateReservationStatus(select.dataset.id, select.value);
    setMessage(select.value === "完了" ? "来店完了として顧客の来店情報を更新しました。" : "ステータスを更新しました。", "success");
  }
  catch (error) { console.error("予約ステータス更新失敗", error); select.value = reservation?.status || "受付"; setMessage(error?.message === "customer-creation-canceled" ? "顧客登録がキャンセルされたため、完了処理は行っていません。" : "ステータスを更新できませんでした。", "error"); }
  finally { select.disabled = false; }
}

async function ensureReservationCustomer(reservation) {
  if (reservation.customerId) return reservation.customerId;
  let customer = findMatchingCustomer(state.customers, reservation);
  if (!customer) {
    if (!window.confirm(`${reservation.customerName}様を顧客台帳へ登録して来店完了にしますか？`)) throw new Error("customer-creation-canceled");
    const id = await createCustomer({ name:reservation.customerName, phone:reservation.phone, lineId:reservation.lineId, rank:"Regular", visitCount:0, favoriteCastIds:[], assignedCastId:reservation.nominationCastId || "" });
    customer = { id, customerId:id, name:reservation.customerName, phone:reservation.phone, lineId:reservation.lineId };
  }
  await linkReservationToCustomer(reservation.id, customer);
  return customer.id;
}

function openEditor(reservation = null) {
  state.editingId = reservation?.id || "";
  resetForm();
  if (reservation) {
    ["customerId", "customerName", "phone", "lineId", "source", "visitDate", "visitTime", "peopleCount", "course", "nominationCastId", "assignedCastId", "tableType", "status", "memo"].forEach((field) => { form.elements[field].value = reservation[field] ?? ""; });
    document.getElementById("reservationEditorTitle").textContent = "予約を編集";
    document.getElementById("saveReservation").textContent = "変更を保存";
  }
  editorModal.hidden = false; document.body.classList.add("is-modal-open"); form.elements.customerName.focus();
}

function closeEditor() { editorModal.hidden = true; document.body.classList.remove("is-modal-open"); setFormMessage(""); }

function resetForm() { form.reset(); form.elements.visitDate.value = getTokyoDateKey(); form.elements.peopleCount.value = "1"; form.elements.status.value = "受付"; document.getElementById("reservationEditorTitle").textContent = "予約を登録"; document.getElementById("saveReservation").textContent = "予約を保存"; setCustomerMatchStatus("電話番号・LINE ID・名前から既存顧客を照合します。", ""); }

async function saveReservation(event) {
  event.preventDefault();
  const payload = collectForm();
  const error = validateReservation(payload);
  if (error) return setFormMessage(error, "error");
  const button = document.getElementById("saveReservation"); button.disabled = true; setFormMessage("保存中...");
  const wasEditing = Boolean(state.editingId);
  try {
    await resolveReservationCustomer(payload);
    const savedId = state.editingId || await createReservation(payload);
    if (state.editingId) await updateReservation(state.editingId, payload);
    await updateReservationStatus(savedId, payload.status, {
      assignedCastId:payload.assignedCastId,
      assignedCastName:payload.assignedCastName,
      tableType:payload.tableType,
      eventNote:state.editingId ? "予約内容を更新" : "予約を登録"
    });
    closeEditor();
    setMessage(wasEditing ? "予約を更新しました。" : "予約と顧客情報を登録しました。", "success");
  }
  catch (saveError) {
    if (saveError?.message === "customer-creation-canceled") return setFormMessage("顧客登録がキャンセルされたため、予約は保存していません。", "error");
    console.error("予約保存失敗", saveError);
    setFormMessage("保存できませんでした。入力内容、通信状況、Firestoreの権限をご確認ください。", "error");
  }
  finally { button.disabled = false; }
}

async function resolveReservationCustomer(payload) {
  if (payload.customerId) return payload.customerId;
  const match = findMatchingCustomer(state.customers, payload);
  if (match) {
    payload.customerId = match.id;
    payload.customerName = match.name || payload.customerName;
    payload.phone = match.phone || payload.phone;
    payload.lineId = match.lineId || payload.lineId;
    return match.id;
  }
  if (!window.confirm(`${payload.customerName}様は顧客台帳に未登録です。\n新規顧客として登録して予約へ紐付けますか？`)) throw new Error("customer-creation-canceled");
  payload.customerId = await createCustomer({
    name:payload.customerName,
    phone:payload.phone,
    lineId:payload.lineId,
    rank:"Regular",
    visitCount:0,
    favoriteCastIds:[],
    assignedCastId:payload.nominationCastId || ""
  });
  return payload.customerId;
}

function collectForm() {
  const values = Object.fromEntries(new FormData(form).entries());
  const cast = state.casts.find((item) => item.id === values.nominationCastId);
  const assigned = state.casts.find((item) => item.id === values.assignedCastId);
  const current = findReservation(state.editingId);
  return { ...values, peopleCount:Number(values.peopleCount), nominationCastName:cast?.name || "", assignedCastName:assigned?.name || "", tableId:current?.tableId || "", tableName:current?.tableName || "", visitId:current?.visitId || "", castAssignments:current?.castAssignments || [] };
}

function validateReservation(item) {
  if (!item.customerName) return "お客様名を入力してください。";
  if (!item.phone && !item.lineId) return "電話番号またはLINE IDのどちらかを入力してください。";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.visitDate)) return "来店日を選択してください。";
  if (!/^\d{2}:\d{2}$/.test(item.visitTime)) return "来店時間を選択してください。";
  if (!Number.isInteger(item.peopleCount) || item.peopleCount < 1 || item.peopleCount > 99) return "人数は1〜99名で入力してください。";
  return "";
}

function openDetail(id) { state.selectedId = id; renderDetail(); detailModal.hidden = false; document.body.classList.add("is-modal-open"); document.getElementById("editReservationFromDetail").focus(); }
function closeDetail() { detailModal.hidden = true; document.body.classList.remove("is-modal-open"); }

function renderDetail() {
  const item = findReservation(state.selectedId);
  if (!item) return closeDetail();
  const history = getCustomerHistory(state.reservations, item);
  document.getElementById("reservationDetailTitle").textContent = `${item.customerName || "名称未設定"} 様`;
  document.getElementById("reservationJourneyLink").href = `reservation-detail.html?id=${encodeURIComponent(item.id)}`;
  document.getElementById("reservationDetailContent").innerHTML = `${item.customerId ? `<a class="reservation-crm-link" href="customer-detail.html?id=${encodeURIComponent(item.customerId)}">顧客360°プロフィールを開く →</a>` : ""}<div class="reservation-detail-summary"><div><span>来店日時</span><strong>${escapeHtml(formatDate(item.visitDate))} ${escapeHtml(item.visitTime || "未定")}</strong></div><div><span>ステータス</span><strong>${escapeHtml(item.status)}</strong></div><div><span>指名キャスト</span><strong>${escapeHtml(item.nominationCastName || "指名なし")}</strong></div><div><span>過去利用回数</span><strong>${history.filter((row) => row.status === "完了").length}回</strong></div></div><dl class="reservation-detail-list"><div><dt>電話番号</dt><dd>${escapeHtml(item.phone || "未登録")}</dd></div><div><dt>LINE ID</dt><dd>${escapeHtml(item.lineId || "未登録")}</dd></div><div><dt>人数</dt><dd>${item.peopleCount}名</dd></div><div><dt>コース</dt><dd>${escapeHtml(item.course || "未設定")}</dd></div><div><dt>受付経路</dt><dd>${escapeHtml(item.source)}</dd></div><div><dt>メモ</dt><dd>${escapeHtml(item.memo || "なし")}</dd></div></dl><section class="reservation-guest-history"><h3>来店履歴</h3>${history.length ? `<ul>${history.slice(0, 10).map((row) => `<li><time>${escapeHtml(formatDate(row.visitDate))}</time><span>${escapeHtml(row.nominationCastName || "指名なし")}</span><em>${escapeHtml(row.status)}</em></li>`).join("")}</ul>` : "<p>過去の利用履歴はありません。</p>"}</section>`;
}

function editSelectedReservation() { const item = findReservation(state.selectedId); closeDetail(); if (item) openEditor(item); }
async function deleteSelectedReservation() { const item = findReservation(state.selectedId); if (!item || !window.confirm(`${item.customerName}様の予約を削除しますか？`)) return; try { await deleteReservation(item.id); closeDetail(); setMessage("予約を削除しました。", "success"); } catch (error) { console.error("予約削除失敗", error); setMessage("予約を削除できませんでした。", "error"); } }

function renderCalendar() {
  const calendar = document.getElementById("reservationCalendar");
  const date = state.calendarDate;
  document.querySelectorAll("[data-calendar-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.calendarView === state.calendarView));
  if (state.calendarView === "month") calendar.innerHTML = createMonthCalendar(date);
  else calendar.innerHTML = createTimeCalendar(date, state.calendarView === "day" ? 1 : 7);
}

function createMonthCalendar(date) {
  const month = date.slice(0, 7); const [year, number] = month.split("-").map(Number); const first = new Date(Date.UTC(year, number - 1, 1)).getUTCDay(); const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  setText("reservationCalendarLabel", `${year}年${number}月`);
  const cells = [...Array(first)].map(() => "<i></i>").concat([...Array(days)].map((_, index) => { const key = `${month}-${String(index + 1).padStart(2, "0")}`; const rows = reservationsForDate(key); return `<div class="reservation-month-day" data-drop-date="${key}"><strong>${index + 1}</strong>${rows.map(calendarCard).join("")}</div>`; }));
  return `<div class="reservation-calendar-weekdays">${["日", "月", "火", "水", "木", "金", "土"].map((day) => `<span>${day}</span>`).join("")}</div><div class="reservation-month-grid">${cells.join("")}</div>`;
}

function createTimeCalendar(date, dayCount) {
  const start = dayCount === 1 ? date : startOfWeek(date); const dates = Array.from({ length:dayCount }, (_, index) => addDays(start, index));
  setText("reservationCalendarLabel", dayCount === 1 ? formatDate(date) : `${formatDate(dates[0])} — ${formatDate(dates.at(-1))}`);
  const hours = Array.from({ length:7 }, (_, index) => 18 + index);
  const head = dates.map((day) => `<span>${escapeHtml(formatWeekday(day))}</span>`).join("");
  const rows = hours.map((hour) => `<div class="reservation-time-label">${hour}:00</div>${dates.map((day) => { const time = `${String(hour).padStart(2, "0")}:00`; const items = reservationsForDate(day).filter((item) => Number(item.visitTime.slice(0, 2)) === hour); return `<div class="reservation-time-slot" data-drop-date="${day}" data-drop-time="${time}">${items.map(calendarCard).join("")}</div>`; }).join("")}`).join("");
  return `<div class="reservation-time-calendar" style="--calendar-days:${dayCount}"><div></div>${head}${rows}</div>`;
}

function calendarCard(item) { return `<button class="reservation-calendar-card is-${escapeAttribute(statusClass(item.status))}" type="button" draggable="true" data-reservation-id="${escapeAttribute(item.id)}"><time>${escapeHtml(item.visitTime || "--:--")}</time><strong>${escapeHtml(item.customerName || "名称未設定")}</strong><small>${escapeHtml(item.nominationCastName || `${item.peopleCount}名`)}</small></button>`; }
function reservationsForDate(date) { return state.reservations.filter((item) => item.visitDate === date && !isCanceled(item)).sort((a, b) => a.visitTime.localeCompare(b.visitTime)); }
function setCalendarView(view) { state.calendarView = ["day", "week", "month"].includes(view) ? view : "week"; renderCalendar(); }
function moveCalendar(direction) { state.calendarDate = state.calendarView === "month" ? addMonths(state.calendarDate, direction) : addDays(state.calendarDate, direction * (state.calendarView === "week" ? 7 : 1)); renderCalendar(); }
function handleCalendarDragStart(event) { const card = event.target.closest("[data-reservation-id]"); if (card) event.dataTransfer.setData("text/plain", card.dataset.reservationId); }
async function handleCalendarDrop(event) { const slot = event.target.closest("[data-drop-date]"); const id = event.dataTransfer.getData("text/plain"); const item = findReservation(id); if (!slot || !item) return; event.preventDefault(); const time = slot.dataset.dropTime || item.visitTime; try { await updateReservationSchedule(id, slot.dataset.dropDate, time); setMessage(`来店日時を${formatDate(slot.dataset.dropDate)} ${time}へ変更しました。`, "success"); } catch (error) { console.error("予約日時変更失敗", error); setMessage("来店日時を変更できませんでした。", "error"); } }
function handleCalendarClick(event) { const card = event.target.closest("[data-reservation-id]"); if (card) openDetail(card.dataset.reservationId); }

function getNotifications() {
  const now = Date.now();
  const upcoming = state.reservations.filter((item) => ACTIVE_RESERVATION_STATUSES.has(item.status)).map((item) => ({ item, time:reservationDateTime(item)?.getTime() })).filter(({ time }) => time && time >= now && time - now <= 10 * 60 * 1000).map(({ item, time }) => ({ id:`soon-${item.id}-${item.visitDate}-${item.visitTime}`, type:"soon", reservationId:item.id, label:"来店10分前です", createdAt:time - 10 * 60 * 1000 }));
  return [...upcoming, ...state.eventNotifications].filter((notice) => !state.dismissed.has(notice.id)).sort((a, b) => b.createdAt - a.createdAt);
}

function renderNotifications() {
  const notices = getNotifications(); setText("reservationNotificationCount", notices.length);
  document.getElementById("reservationNotifications").innerHTML = notices.length ? notices.map((notice) => { const item = findReservation(notice.reservationId); return `<li><button type="button" data-notification-id="${escapeAttribute(notice.id)}" data-reservation-id="${escapeAttribute(notice.reservationId)}"><span class="is-${escapeAttribute(notice.type)}">${notificationIcon(notice.type)}</span><div><strong>${escapeHtml(notice.label)}</strong><small>${escapeHtml(item ? `${item.customerName}様 ${formatDate(item.visitDate)} ${item.visitTime}` : "予約情報")}</small></div><time>${escapeHtml(relativeTime(notice.createdAt))}</time></button></li>`; }).join("") : '<li class="reservation-notification-empty">新しい通知はありません。</li>';
}

function handleNotificationClick(event) { const button = event.target.closest("button[data-notification-id]"); if (!button) return; state.dismissed.add(button.dataset.notificationId); persistDismissed(); renderNotifications(); openDetail(button.dataset.reservationId); }
function clearNotifications() { getNotifications().forEach((notice) => state.dismissed.add(notice.id)); persistDismissed(); renderNotifications(); }
function persistDismissed() { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...state.dismissed].slice(-200))); }

function exportCsv() {
  const rows = getFilteredReservations();
  if (!rows.length) return setMessage("出力する予約がありません。", "error");
  const headers = ["予約ID", "顧客ID", "お客様名", "電話番号", "LINE ID", "来店日", "来店時間", "人数", "コース", "指名キャスト", "ステータス", "受付経路", "メモ"];
  const fields = rows.map((item) => [item.reservationId || item.id, item.customerId, item.customerName, item.phone, item.lineId, item.visitDate, item.visitTime, item.peopleCount, item.course, item.nominationCastName, item.status, item.source, item.memo]);
  const csv = `\uFEFF${[headers, ...fields].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `chouchou-reservations-${getTokyoDateKey()}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

function renderCastOptions() { const nomination = form.elements.nominationCastId.value; const assigned = form.elements.assignedCastId.value; const options = state.casts.map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}</option>`).join(""); form.elements.nominationCastId.innerHTML = `<option value="">指名なし</option>${options}`; form.elements.assignedCastId.innerHTML = `<option value="">未設定</option>${options}`; form.elements.nominationCastId.value = nomination; form.elements.assignedCastId.value = assigned; }
function findReservation(id) { return state.reservations.find((item) => item.id === id); }
function signature(item) { return JSON.stringify([item.customerName, item.phone, item.lineId, item.visitDate, item.visitTime, item.peopleCount, item.course, item.nominationCastId, item.nominationCastName, item.status, item.source, item.memo]); }
function reservationKey(item) { return `${item.visitDate}T${item.visitTime || "00:00"}`; }
function isCanceled(item) { return ["キャンセル", "無断キャンセル"].includes(item.status); }
function statusClass(value) { return ({ "予約":"confirmed", "受付":"received", "着席":"visited", "延長":"visited", "会計":"paid", "完了":"completed", "キャンセル":"canceled", "無断キャンセル":"noshow" })[value] || "received"; }
function sourceClass(value) { return String(value || "web").toLowerCase().replace(/[^a-z]/g, "") || "other"; }
function notificationIcon(type) { return ({ new:"＋", change:"↻", cancel:"×", soon:"!" })[type] || "•"; }
function relativeTime(time) { const minutes = Math.round((Date.now() - time) / 60000); if (minutes < 1) return "今"; if (minutes < 60) return `${minutes}分前`; const hours = Math.round(minutes / 60); return hours < 24 ? `${hours}時間前` : `${Math.round(hours / 24)}日前`; }
function getMillis(value) { if (typeof value?.toMillis === "function") return value.toMillis(); if (typeof value?.toDate === "function") return value.toDate().getTime(); return Date.parse(value) || Number(value) || 0; }
function getTokyoDateKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
function addDays(value, amount) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function addMonths(value, amount) { const date = new Date(`${value.slice(0, 7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount); return date.toISOString().slice(0, 10); }
function startOfWeek(value) { const date = new Date(`${value}T00:00:00Z`); return addDays(value, -date.getUTCDay()); }
function formatDate(value) { if (!value) return "日付未定"; return new Intl.DateTimeFormat("ja-JP", { month:"numeric", day:"numeric", weekday:"short" }).format(new Date(`${value}T00:00:00+09:00`)); }
function formatWeekday(value) { return new Intl.DateTimeFormat("ja-JP", { month:"numeric", day:"numeric", weekday:"short" }).format(new Date(`${value}T00:00:00+09:00`)); }
function sum(rows, field) { return rows.reduce((total, item) => total + (Number(item[field]) || 0), 0); }
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function setMessage(text, type = "") { const element = document.getElementById("reservationMessage"); element.textContent = text; element.dataset.type = type; }
function setFormMessage(text, type = "") { const element = document.getElementById("reservationFormMessage"); element.textContent = text; element.dataset.type = type; }
function setCustomerMatchStatus(text, type = "") { const element = document.getElementById("customerMatchStatus"); if (!element) return; element.textContent = text; element.dataset.type = type; }
function handleLoadError(error) { console.error("予約管理読み込み失敗", error); list.innerHTML = '<p class="reservation-empty">予約情報を読み込めませんでした。通信状況とFirestoreの権限をご確認ください。</p>'; setMessage("データの読み込みに失敗しました。", "error"); }
