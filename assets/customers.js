import "./admin.js";
import { subscribeSales } from "./services/salesService.js";
import { subscribeReservations } from "./services/reservationService.js";
import { subscribeCasts } from "./services/castService.js";
import {
  createCustomer,
  reservationsForCustomer,
  salesForCustomer,
  subscribeCustomers,
  updateCustomer
} from "./services/customerService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";

const form = document.getElementById("customerForm");
const list = document.getElementById("customerList");
const editorModal = document.getElementById("customerEditorModal");
const detailModal = document.getElementById("customerDetailModal");
const state = { customers:[], casts:[], reservations:[], sales:[], editingId:"", selectedId:"", search:"", rank:"", assignedCastId:"", lastVisitFrom:"", lastVisitTo:"", sort:"last-desc" };

initialize();

function initialize() {
  bindEvents();
  subscribeCustomers(handleCustomers, handleLoadError);
  subscribeCasts(handleCasts, handleLoadError);
  subscribeReservations((rows) => { state.reservations = rows; renderOpenDetail(); }, handleRelatedLoadError);
  subscribeSales((rows) => { state.sales = rows; renderOpenDetail(); }, handleRelatedLoadError);
}

function bindEvents() {
  document.getElementById("openCustomerEditor").addEventListener("click", () => openEditor());
  document.querySelectorAll("[data-close-customer-editor]").forEach((button) => button.addEventListener("click", closeEditor));
  document.querySelectorAll("[data-close-customer-detail]").forEach((button) => button.addEventListener("click", closeDetail));
  editorModal.addEventListener("click", (event) => { if (event.target === editorModal) closeEditor(); });
  detailModal.addEventListener("click", (event) => { if (event.target === detailModal) closeDetail(); });
  form.addEventListener("submit", saveCustomer);
  document.getElementById("customerSearch").addEventListener("input", (event) => { state.search = event.target.value.trim().toLowerCase(); render(); });
  document.getElementById("customerRankFilter").addEventListener("change", (event) => { state.rank = event.target.value; render(); });
  document.getElementById("customerCastFilter").addEventListener("change", (event) => { state.assignedCastId = event.target.value; render(); });
  document.getElementById("customerLastVisitFrom").addEventListener("change", (event) => { state.lastVisitFrom = event.target.value; render(); });
  document.getElementById("customerLastVisitTo").addEventListener("change", (event) => { state.lastVisitTo = event.target.value; render(); });
  document.getElementById("customerSort").addEventListener("change", (event) => { state.sort = event.target.value; render(); });
  list.addEventListener("click", handleListAction);
  document.getElementById("editCustomerFromDetail").addEventListener("click", () => { const customer = findCustomer(state.selectedId); if (customer) { closeDetail(); openEditor(customer); } });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeEditor(); closeDetail(); } });
}

function handleCustomers(rows) { state.customers = rows; render(); renderOpenDetail(); }

function handleCasts(rows) {
  state.casts = rows.filter((item) => item.isPublished !== false).sort((a, b) => Number(a.displayOrder ?? 9999) - Number(b.displayOrder ?? 9999));
  renderCastInputs();
  renderCastFilter();
  render();
  renderOpenDetail();
}

function render() {
  renderSummary();
  const rows = visibleCustomers();
  setText("customerResultCount", `${rows.length}件`);
  list.innerHTML = rows.length ? createCustomerTable(rows) : '<p class="customers-empty">該当する顧客はいません。</p>';
}

function renderSummary() {
  setText("customerTotalCount", state.customers.length);
  setText("customerVipCount", state.customers.filter((item) => item.isVip || item.rank === "VIP").length);
  setText("customerRepeatCount", state.customers.filter((item) => effectiveVisitCount(item) >= 2).length);
  setText("customerVisitCount", state.customers.reduce((total, item) => total + effectiveVisitCount(item), 0));
}

function visibleCustomers() {
  return state.customers.filter((item) => {
    const haystack = `${item.name} ${item.kana} ${item.nickname} ${item.phone} ${item.lineId}`.toLowerCase();
    return (!state.search || haystack.includes(state.search)) && (!state.rank || item.rank === state.rank) && (!state.assignedCastId || item.assignedCastId === state.assignedCastId) && (!state.lastVisitFrom || item.lastVisit >= state.lastVisitFrom) && (!state.lastVisitTo || item.lastVisit <= state.lastVisitTo);
  }).sort(compareCustomers);
}

function compareCustomers(a, b) {
  if (state.sort === "visits-desc") return effectiveVisitCount(b) - effectiveVisitCount(a) || a.name.localeCompare(b.name, "ja");
  if (state.sort === "created-desc") return dateMillis(b.createdAt) - dateMillis(a.createdAt);
  if (state.sort === "name-asc") return a.name.localeCompare(b.name, "ja");
  return String(b.lastVisit || "").localeCompare(String(a.lastVisit || "")) || dateMillis(b.updatedAt) - dateMillis(a.updatedAt);
}

function createCustomerTable(rows) {
  return `<table class="customers-table"><thead><tr><th>お客様</th><th>電話番号</th><th>LINE</th><th>来店</th><th>ランク</th><th>担当キャスト</th><th>操作</th></tr></thead><tbody>${rows.map((item) => `<tr><td><button class="customer-name-button" type="button" data-action="detail" data-id="${escapeAttribute(item.id)}"><strong>${escapeHtml(item.name || "名称未設定")}</strong><small>${escapeHtml(item.kana || item.nickname || "")}</small></button></td><td>${escapeHtml(item.phone || "未登録")}</td><td>${escapeHtml(item.lineId || "未登録")}</td><td><strong>${effectiveVisitCount(item)}回</strong><small class="customer-last-visit">最終 ${escapeHtml(formatDate(item.lastVisit, "未登録"))}</small></td><td><span class="customer-rank is-${escapeAttribute(item.rank.toLowerCase())}">${escapeHtml(item.rank)}</span></td><td>${escapeHtml(castName(item.assignedCastId) || "未設定")}</td><td><div class="customers-row-actions"><button type="button" data-action="detail" data-id="${escapeAttribute(item.id)}">詳細</button><button type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">編集</button></div></td></tr>`).join("")}</tbody></table>`;
}

function handleListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const customer = findCustomer(button.dataset.id);
  if (!customer) return;
  if (button.dataset.action === "detail") location.href = `customer-detail.html?id=${encodeURIComponent(customer.id)}`;
  if (button.dataset.action === "edit") openEditor(customer);
}

function openEditor(customer = null) {
  state.editingId = customer?.id || "";
  form.reset();
  form.elements.rank.value = "Regular";
  form.elements.visitCount.value = "0";
  renderCastInputs(customer);
  if (customer) {
    ["name", "kana", "nickname", "phone", "lineId", "birthday", "occupation", "rank", "firstVisit", "lastVisit", "visitCount", "assignedCastId", "favoriteDrink", "bottleInfo", "memo"].forEach((field) => { form.elements[field].value = customer[field] ?? ""; });
    form.elements.isVip.value = String(customer.isVip === true);
    form.elements.isNg.value = String(customer.isNg === true);
    setFavoriteChecks(customer.favoriteCastIds);
  }
  document.getElementById("customerEditorTitle").textContent = customer ? "顧客情報を編集" : "顧客を登録";
  document.getElementById("saveCustomer").textContent = customer ? "変更を保存" : "顧客を保存";
  setFormMessage("");
  editorModal.hidden = false;
  document.body.classList.add("is-modal-open");
  form.elements.name.focus();
}

function closeEditor() { editorModal.hidden = true; state.editingId = ""; releaseBodyLock(); setFormMessage(""); }

async function saveCustomer(event) {
  event.preventDefault();
  const payload = collectForm();
  const validation = validateCustomer(payload);
  if (validation) return setFormMessage(validation, "error");
  const duplicate = findDuplicateCustomer(payload);
  if (duplicate && !window.confirm(`${duplicate.name}さんと同じ電話番号またはLINE IDが登録されています。\n別のお客様として保存しますか？`)) return;
  const button = document.getElementById("saveCustomer");
  const wasEditing = Boolean(state.editingId);
  button.disabled = true;
  setFormMessage("保存中...");
  try {
    if (state.editingId) await updateCustomer(state.editingId, payload);
    else await createCustomer(payload);
    closeEditor();
    setMessage(wasEditing ? "顧客情報を更新しました。" : "顧客を登録しました。", "success");
  } catch (error) {
    console.error("顧客保存失敗", error);
    setFormMessage("保存できませんでした。通信状況とFirestoreの権限をご確認ください。", "error");
  } finally { button.disabled = false; }
}

function collectForm() {
  const values = Object.fromEntries(new FormData(form).entries());
  const current = findCustomer(state.editingId);
  return {
    ...values,
    visitCount:Number(values.visitCount),
    isVip:values.isVip === "true",
    isNg:values.isNg === "true",
    rank:values.isVip === "true" && values.rank === "Regular" ? "VIP" : values.rank,
    totalSpend:current?.totalSpend || 0,
    averageSpend:current?.averageSpend || 0,
    favoriteCastIds:[...form.querySelectorAll('input[name="favoriteCastIds"]:checked')].map((input) => input.value)
  };
}

function validateCustomer(item) {
  if (!item.name) return "氏名を入力してください。";
  if (!item.phone && !item.lineId) return "電話番号またはLINE IDのどちらかを入力してください。";
  if (!Number.isInteger(item.visitCount) || item.visitCount < 0) return "来店回数は0以上の整数で入力してください。";
  if (item.firstVisit && item.lastVisit && item.firstVisit > item.lastVisit) return "最終来店日は初回来店日以降に設定してください。";
  return "";
}

function findDuplicateCustomer(item) {
  const phone = digits(item.phone);
  const lineId = item.lineId.toLowerCase();
  return state.customers.find((customer) => customer.id !== state.editingId && ((phone && digits(customer.phone) === phone) || (lineId && customer.lineId.toLowerCase() === lineId)));
}

function openDetail(id) {
  state.selectedId = id;
  renderDetail();
  detailModal.hidden = false;
  document.body.classList.add("is-modal-open");
  detailModal.querySelector(".customers-modal-close").focus();
}

function closeDetail() { detailModal.hidden = true; state.selectedId = ""; releaseBodyLock(); }
function renderOpenDetail() { if (!detailModal.hidden && state.selectedId) renderDetail(); }

function renderDetail() {
  const customer = findCustomer(state.selectedId);
  const container = document.getElementById("customerDetailContent");
  if (!customer) { container.innerHTML = '<p class="customers-empty">顧客情報が見つかりません。</p>'; return; }
  const reservations = reservationsForCustomer(state.reservations, customer);
  const sales = salesForCustomer(state.sales, customer);
  const visits = reservations.filter((item) => ["来店", "会計済", "完了"].includes(item.status));
  const nominations = reservations.filter((item) => item.nominationCastId || item.nominationCastName);
  const salesTotal = sales.reduce((total, item) => total + Number(item.sales || 0), 0);
  document.getElementById("customerDetailTitle").textContent = `${customer.name || "名称未設定"} 様`;
  container.innerHTML = `
    <section class="customer-profile-grid">
      <div class="customer-profile-main"><span class="customer-rank is-${escapeAttribute(customer.rank.toLowerCase())}">${escapeHtml(customer.rank)}</span><h3>${escapeHtml(customer.name || "名称未設定")}</h3><p>${escapeHtml(customer.kana || customer.nickname || "")}</p></div>
      <dl>${profileItem("電話番号", customer.phone)}${profileItem("LINE ID", customer.lineId)}${profileItem("誕生日", formatDate(customer.birthday, ""))}${profileItem("職業", customer.occupation)}${profileItem("初回来店", formatDate(customer.firstVisit, ""))}${profileItem("最終来店", formatDate(customer.lastVisit, ""))}${profileItem("来店回数", `${effectiveVisitCount(customer)}回`)}${profileItem("担当キャスト", castName(customer.assignedCastId))}</dl>
    </section>
    <section class="customer-detail-summary"><article><span>予約履歴</span><strong>${reservations.length}</strong></article><article><span>来店履歴</span><strong>${Math.max(visits.length, customer.visitCount)}</strong></article><article><span>売上履歴</span><strong>${formatMoney(salesTotal)}</strong></article><article><span>指名履歴</span><strong>${nominations.length}</strong></article></section>
    ${detailSection("お気に入りキャスト", createFavoriteCasts(customer.favoriteCastIds))}
    ${detailSection("予約・来店履歴", createReservationHistory(reservations))}
    ${detailSection("売上履歴", createSalesHistory(sales))}
    ${detailSection("指名履歴", createNominationHistory(nominations))}
    ${detailSection("メモ", customer.memo ? `<p class="customer-memo">${escapeHtml(customer.memo).replaceAll("\n", "<br>")}</p>` : emptyHistory("メモはありません。"))}`;
}

function createFavoriteCasts(ids) {
  const casts = ids.map((id) => state.casts.find((cast) => cast.id === id)).filter(Boolean);
  return casts.length ? `<div class="customer-favorite-list">${casts.map((cast) => `<span>${escapeHtml(cast.name || "名称未設定")}</span>`).join("")}</div>` : emptyHistory("お気に入りキャストは未登録です。");
}

function createReservationHistory(rows) {
  if (!rows.length) return emptyHistory("紐付く予約履歴はありません。");
  return historyTable(["来店日時", "人数", "指名", "状態"], rows.slice(0, 30).map((item) => [
    `${formatDate(item.visitDate, "未定")} ${item.visitTime || ""}`,
    `${item.peopleCount || 0}名`,
    item.nominationCastName || "指名なし",
    item.status || "受付"
  ]));
}

function createSalesHistory(rows) {
  if (!rows.length) return emptyHistory("customerIdまたは連絡先に紐付く売上履歴はありません。");
  return historyTable(["営業日", "売上", "本指名", "担当キャスト"], rows.slice(0, 30).map((item) => [
    formatDate(item.date, "未定"), formatMoney(item.sales), `${item.honmeiCount || 0}本`, item.castName || castName(item.castId) || "未設定"
  ]));
}

function createNominationHistory(rows) {
  if (!rows.length) return emptyHistory("指名履歴はありません。");
  return historyTable(["来店日", "指名キャスト", "状態"], rows.slice(0, 30).map((item) => [formatDate(item.visitDate, "未定"), item.nominationCastName || castName(item.nominationCastId) || "未設定", item.status || "受付"]));
}

function detailSection(title, content) { return `<section class="customer-history-section"><h3>${title}</h3>${content}</section>`; }
function historyTable(headings, rows) { return `<div class="customer-history-wrap"><table><thead><tr>${headings.map((heading) => `<th>${heading}</th>`).join("")}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; }
function emptyHistory(message) { return `<p class="customers-empty is-compact">${escapeHtml(message)}</p>`; }
function profileItem(label, value) { return value ? `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>` : ""; }

function renderCastInputs(customer = null) {
  const selected = customer?.assignedCastId ?? form.elements.assignedCastId.value;
  const favoriteIds = customer?.favoriteCastIds ?? [...form.querySelectorAll('input[name="favoriteCastIds"]:checked')].map((input) => input.value);
  form.elements.assignedCastId.innerHTML = `<option value="">未設定</option>${state.casts.map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}</option>`).join("")}`;
  form.elements.assignedCastId.value = selected || "";
  document.getElementById("customerFavoriteCasts").innerHTML = state.casts.length ? state.casts.map((cast) => `<label><input type="checkbox" name="favoriteCastIds" value="${escapeAttribute(cast.id)}"><span>${escapeHtml(cast.name || "名称未設定")}</span></label>`).join("") : "<span>登録キャストがいません。</span>";
  setFavoriteChecks(favoriteIds);
}

function renderCastFilter() {
  const select = document.getElementById("customerCastFilter");
  const selected = select.value;
  select.innerHTML = `<option value="">すべて</option>${state.casts.map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}</option>`).join("")}`;
  select.value = selected;
}

function setFavoriteChecks(ids = []) { const selected = new Set(ids); form.querySelectorAll('input[name="favoriteCastIds"]').forEach((input) => { input.checked = selected.has(input.value); }); }
function effectiveVisitCount(customer) { const linked = reservationsForCustomer(state.reservations, customer).filter((item) => ["着席", "延長", "会計", "完了"].includes(item.status)).length; return Math.max(Number(customer.visitCount || 0), linked); }
function findCustomer(id) { return state.customers.find((item) => item.id === id); }
function castName(id) { return state.casts.find((item) => item.id === id)?.name || ""; }
function formatMoney(value) { return `${Math.max(0, Number(value) || 0).toLocaleString("ja-JP")}円`; }
function formatDate(value, fallback = "--") { const text = String(value || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback; const [year, month, day] = text.split("-"); return `${year}/${Number(month)}/${Number(day)}`; }
function dateMillis(value) { if (typeof value?.toDate === "function") return value.toDate().getTime(); if (typeof value?.seconds === "number") return value.seconds * 1000; return Date.parse(value || "") || 0; }
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function releaseBodyLock() { if (editorModal.hidden && detailModal.hidden) document.body.classList.remove("is-modal-open"); }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function setMessage(text, type = "") { const element = document.getElementById("customersMessage"); element.textContent = text; element.dataset.type = type; }
function setFormMessage(text, type = "") { const element = document.getElementById("customerFormMessage"); element.textContent = text; element.dataset.type = type; }
function handleLoadError(error) { console.error("顧客情報取得失敗", error); list.innerHTML = '<p class="customers-empty">顧客情報を読み込めませんでした。</p>'; setMessage("顧客情報を読み込めませんでした。Firestoreの権限と通信状況をご確認ください。", "error"); }
function handleRelatedLoadError(error) { console.error("顧客履歴取得失敗", error); setMessage("一部の関連履歴を読み込めませんでした。", "error"); }
