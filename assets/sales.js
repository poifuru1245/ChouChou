import "./admin.js";
import { addDocument, removeDocument, serverTimestamp, subscribeCollection, updateDocument } from "./js/services/firestoreService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";
import { setBusy, showPageError } from "./js/ui/pageState.js";

const NUMBER_FIELDS = ["sales","customerCount","honmei","jounai","douhan","extension","drink","bottle","champagne"];
const COUNT_FIELDS = NUMBER_FIELDS.filter((name) => name !== "sales");
const form = document.getElementById("salesForm");
const list = document.getElementById("salesList");
const message = document.getElementById("salesMessage");
const castSelect = form?.elements.castId;
const historySelect = document.getElementById("salesHistoryCast");
const state = { casts: [], sales: [], editingId: "", period: "today", search: "" };

if (form && list) initialize();

function initialize() {
  resetForm();
  bindEvents();
  setBusy(list, true, "売上情報を読み込み中");
  subscribeCollection("casts", (rows) => { state.casts = rows.filter((cast) => cast.isPublished !== false).sort(compareCastOrder); renderCastOptions(); render(); }, handleLoadError);
  subscribeCollection("sales", (rows) => { state.sales = rows.map(normalizeSale).sort(compareSales); setBusy(list, false); render(); }, handleLoadError);
}

function bindEvents() {
  form.addEventListener("submit", saveSale);
  document.getElementById("resetSales")?.addEventListener("click", resetForm);
  document.getElementById("cancelSalesEdit")?.addEventListener("click", resetForm);
  document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => setPeriod(button.dataset.period)));
  document.getElementById("salesDateFrom")?.addEventListener("change", render);
  document.getElementById("salesDateTo")?.addEventListener("change", render);
  document.getElementById("salesSearch")?.addEventListener("input", (event) => { state.search = event.target.value.trim().toLowerCase(); render(); });
  historySelect?.addEventListener("change", renderCastHistory);
  list.addEventListener("click", handleListAction);
}

async function saveSale(event) {
  event.preventDefault();
  if (!String(form.elements.sales.value).trim() || !String(form.elements.customerCount.value).trim()) {
    return setMessage("売上と接客人数を入力してください。", "error");
  }
  const payload = collectFormData();
  const validation = validate(payload);
  if (!validation.valid) return setMessage(validation.message, "error");
  const button = document.getElementById("saveSales");
  button.disabled = true;
  setMessage("保存中...");
  try {
    if (state.editingId) await updateDocument("sales", state.editingId, { ...payload, updatedAt:serverTimestamp() });
    else await addDocument("sales", { ...payload, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
    const wasEditing = Boolean(state.editingId);
    resetForm();
    setMessage(wasEditing ? "売上を更新しました。" : "売上を保存しました。", "success");
  } catch (error) {
    console.error("売上保存失敗", error);
    setMessage("保存に失敗しました。入力内容と通信状況をご確認ください。", "error");
  } finally { button.disabled = false; }
}

function collectFormData() {
  const data = new FormData(form);
  const castId = String(data.get("castId") || "");
  const cast = state.casts.find((item) => item.id === castId);
  const payload = { date:String(data.get("date") || ""), castId, castName:String(cast?.name || ""), memo:String(data.get("memo") || "").trim() };
  NUMBER_FIELDS.forEach((field) => { payload[field] = parseFormNumber(data.get(field)); });
  return payload;
}

function validate(payload) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return invalid("営業日を選択してください。");
  if (!payload.castId || !state.casts.some((cast) => cast.id === payload.castId)) return invalid("キャストを選択してください。");
  for (const field of NUMBER_FIELDS) {
    const max = field === "sales" ? 999999999 : 9999;
    if (!Number.isInteger(payload[field]) || payload[field] < 0 || payload[field] > max) return invalid(`${fieldLabel(field)}は0以上の整数で入力してください。`);
  }
  if (payload.memo.length > 500) return invalid("メモは500文字以内で入力してください。");
  return { valid:true, message:"" };
}

async function handleListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const sale = state.sales.find((item) => item.id === button.dataset.id);
  if (!sale) return;
  if (button.dataset.action === "edit") return editSale(sale);
  if (button.dataset.action === "delete" && confirm(`${sale.date} ${sale.castName || "キャスト"}の売上を削除しますか？`)) {
    button.disabled = true;
    try { await removeDocument("sales", sale.id); setMessage("売上を削除しました。", "success"); }
    catch (error) { console.error("売上削除失敗", error); setMessage("削除に失敗しました。通信状況をご確認ください。", "error"); button.disabled = false; }
  }
}

function editSale(sale) {
  state.editingId = sale.id;
  form.elements.date.value = sale.date;
  form.elements.castId.value = sale.castId;
  NUMBER_FIELDS.forEach((field) => { form.elements[field].value = sale[field]; });
  form.elements.memo.value = sale.memo;
  document.getElementById("salesFormTitle").textContent = "営業実績を編集";
  document.getElementById("saveSales").textContent = "変更を保存";
  document.getElementById("cancelSalesEdit").hidden = false;
  form.scrollIntoView({ behavior:"smooth", block:"start" });
  form.elements.sales.focus();
}

function resetForm() {
  state.editingId = "";
  form.reset();
  form.elements.date.value = getTokyoDateKey();
  COUNT_FIELDS.forEach((field) => { form.elements[field].value = "0"; });
  document.getElementById("salesFormTitle").textContent = "営業実績を入力";
  document.getElementById("saveSales").textContent = "売上を保存";
  document.getElementById("cancelSalesEdit").hidden = true;
}

function setPeriod(period) {
  state.period = ["today","month","custom"].includes(period) ? period : "today";
  document.querySelectorAll("[data-period]").forEach((button) => button.classList.toggle("is-active", button.dataset.period === state.period));
  const custom = state.period === "custom";
  document.getElementById("salesDateFrom").disabled = !custom;
  document.getElementById("salesDateTo").disabled = !custom;
  render();
}

function render() {
  renderSummary();
  const visible = getFilteredSales();
  document.getElementById("salesResultCount").textContent = `${visible.length}件`;
  list.innerHTML = visible.length ? visible.map(createSaleCard).join("") : '<p class="sales-empty">該当する売上データはありません。</p>';
  renderCastHistory();
}

function renderSummary() {
  const today = getTokyoDateKey();
  const month = today.slice(0, 7);
  const todayRows = state.sales.filter((item) => item.date === today);
  const monthRows = state.sales.filter((item) => item.date.startsWith(month));
  const filtered = getFilteredSales();
  const monthSales = sum(monthRows, "sales");
  const monthCustomers = sum(monthRows, "customerCount");
  setText("salesTodayTotal", yen(sum(todayRows, "sales")));
  setText("salesMonthTotal", yen(monthSales));
  setText("salesAverageSpend", yen(monthCustomers ? Math.round(monthSales / monthCustomers) : 0));
  setText("salesHonmeiTotal", sum(filtered, "honmei"));
  setText("salesJounaiTotal", sum(filtered, "jounai"));
  setText("salesDouhanTotal", sum(filtered, "douhan"));
}

function createSaleCard(item) {
  return `<article class="sales-record-card admin-premium-card" data-id="${escapeAttribute(item.id)}"><div class="sales-record-head"><div><time datetime="${escapeAttribute(item.date)}">${escapeHtml(formatDate(item.date))}</time><h3>${escapeHtml(item.castName || getCastName(item.castId))}</h3></div><strong>${yen(item.sales)}</strong></div><dl class="sales-record-metrics"><div><dt>接客</dt><dd>${item.customerCount}名</dd></div><div><dt>本指名</dt><dd>${item.honmei}</dd></div><div><dt>場内</dt><dd>${item.jounai}</dd></div><div><dt>同伴</dt><dd>${item.douhan}</dd></div><div><dt>延長</dt><dd>${item.extension}</dd></div><div><dt>ドリンク</dt><dd>${item.drink}</dd></div><div><dt>ボトル</dt><dd>${item.bottle}</dd></div><div><dt>シャンパン</dt><dd>${item.champagne}</dd></div></dl>${item.memo ? `<p class="sales-record-memo">${escapeHtml(item.memo)}</p>` : ""}<div class="admin-item-actions"><button type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">編集</button><button type="button" data-action="delete" data-id="${escapeAttribute(item.id)}">削除</button></div></article>`;
}

function renderCastHistory() {
  const output = document.getElementById("salesCastHistory");
  const castId = historySelect.value;
  if (!castId) { output.innerHTML = "<p>キャストを選択すると、売上・指名・同伴履歴を表示します。</p>"; return; }
  const rows = state.sales.filter((item) => item.castId === castId);
  const castName = getCastName(castId);
  if (!rows.length) { output.innerHTML = `<p>${escapeHtml(castName)}の売上履歴はまだありません。</p>`; return; }
  output.innerHTML = `<div class="sales-cast-totals"><div><span>累計売上</span><strong>${yen(sum(rows,"sales"))}</strong></div><div><span>本指名</span><strong>${sum(rows,"honmei")}</strong></div><div><span>場内</span><strong>${sum(rows,"jounai")}</strong></div><div><span>同伴</span><strong>${sum(rows,"douhan")}</strong></div></div><div class="sales-history-table-wrap"><table class="sales-history-table"><thead><tr><th>営業日</th><th>売上</th><th>本指名</th><th>場内</th><th>同伴</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${yen(item.sales)}</td><td>${item.honmei}</td><td>${item.jounai}</td><td>${item.douhan}</td></tr>`).join("")}</tbody></table></div>`;
}

function getFilteredSales() {
  const today = getTokyoDateKey();
  const from = document.getElementById("salesDateFrom")?.value || "";
  const to = document.getElementById("salesDateTo")?.value || "";
  return state.sales.filter((item) => {
    const periodMatch = state.period === "today" ? item.date === today : state.period === "month" ? item.date.startsWith(today.slice(0,7)) : (!from || item.date >= from) && (!to || item.date <= to);
    const searchMatch = !state.search || `${item.castName || getCastName(item.castId)} ${item.memo}`.toLowerCase().includes(state.search);
    return periodMatch && searchMatch;
  });
}

function renderCastOptions() {
  const current = castSelect.value;
  const historyCurrent = historySelect.value;
  const options = state.casts.map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}</option>`).join("");
  castSelect.innerHTML = `<option value="">キャストを選択</option>${options}`;
  historySelect.innerHTML = `<option value="">キャストを選択</option>${options}`;
  castSelect.value = current;
  historySelect.value = historyCurrent;
}

function normalizeSale(item) { const result = { ...item, date:String(item.date || "").slice(0,10), castId:String(item.castId || ""), castName:String(item.castName || ""), memo:String(item.memo || "") }; NUMBER_FIELDS.forEach((field) => { result[field] = toNumber(item[field]); }); return result; }
function compareSales(a,b) { return b.date.localeCompare(a.date) || getTime(b.updatedAt || b.createdAt) - getTime(a.updatedAt || a.createdAt); }
function compareCastOrder(a,b) { return Number(a.displayOrder ?? 9999) - Number(b.displayOrder ?? 9999) || String(a.name || "").localeCompare(String(b.name || ""),"ja"); }
function getTime(value) { if (typeof value?.toMillis === "function") return value.toMillis(); return Date.parse(value) || 0; }
function getCastName(id) { return state.casts.find((cast) => cast.id === id)?.name || "名称未設定"; }
function sum(rows, field) { return rows.reduce((total, item) => total + toNumber(item[field]), 0); }
function parseFormNumber(value) { const raw = String(value ?? "").trim(); return raw === "" ? 0 : Number(raw); }
function toNumber(value) { const number = Number(value); return Number.isFinite(number) ? Math.trunc(number) : 0; }
function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(toNumber(value)); }
function formatDate(value) { const [year,month,day] = String(value || "").split("-"); return year && month && day ? `${year}/${month}/${day}` : value; }
function getTokyoDateKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
function fieldLabel(field) { return ({sales:"売上",customerCount:"接客人数",honmei:"本指名",jounai:"場内",douhan:"同伴",extension:"延長",drink:"ドリンク",bottle:"ボトル",champagne:"シャンパン"})[field] || field; }
function invalid(message) { return { valid:false, message }; }
function setText(id,value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function setMessage(text,type="") { message.textContent = text; message.dataset.type = type; }
function handleLoadError(error) { console.error("売上管理データ読み込み失敗", error); setBusy(list,false); showPageError(list,"売上情報を読み込めませんでした。Firestoreの権限と通信状況をご確認ください。"); }
