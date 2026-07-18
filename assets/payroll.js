import "./admin.js";
import { subscribeCollection } from "./js/services/firestoreService.js";
import { subscribeSales } from "./js/services/salesService.js";
import {
  calculateMonthlyPayroll,
  DEFAULT_PAYROLL_SETTINGS,
  savePayrollSettings,
  subscribePayrollSettings
} from "./js/services/payrollService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";
import { setBusy, showPageError } from "./js/ui/pageState.js";

const SETTINGS_FIELDS = ["baseHourlyRate", "honmeiBack", "jounaiBack", "douhanBack", "drinkBack", "bottleBack", "champagneBack", "otherBack", "transportation"];
const PERCENT_FIELDS = new Set(["drinkBack", "bottleBack", "champagneBack", "otherBack"]);
const form = document.getElementById("payrollSettingsForm");
const list = document.getElementById("payrollList");
const monthInput = document.getElementById("payrollMonth");
const message = document.getElementById("payrollSettingsMessage");
const modal = document.getElementById("payrollDetailModal");
const state = {
  casts:[], sales:[], schedules:[], settings:{ ...DEFAULT_PAYROLL_SETTINGS }, payroll:[],
  loaded:{ casts:false, sales:false, schedules:false, settings:false }, detailTrigger:null
};

if (form && list && monthInput) initialize();

function initialize() {
  monthInput.value = getTokyoMonthKey();
  bindEvents();
  fillSettingsForm(state.settings);
  setBusy(list, true, "給与情報を読み込み中");
  subscribeCollection("casts", (rows) => updateSource("casts", rows), handleSourceError);
  subscribeSales((rows) => updateSource("sales", rows), handleSourceError);
  subscribeCollection("schedules", (rows) => updateSource("schedules", rows), handleSourceError);
  subscribePayrollSettings((settings) => {
    state.settings = settings;
    state.loaded.settings = true;
    fillSettingsForm(settings);
    render();
  }, handleSettingsError);
}

function bindEvents() {
  monthInput.addEventListener("change", render);
  form.addEventListener("submit", saveSettings);
  document.getElementById("addPayrollDeduction")?.addEventListener("click", () => addDeductionRow());
  document.getElementById("payrollDeductionRows")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-deduction]");
    if (button) button.closest(".payroll-deduction-row")?.remove();
  });
  document.getElementById("togglePayrollSettings")?.addEventListener("click", toggleSettings);
  list.addEventListener("click", handlePayrollAction);
  document.getElementById("closePayrollDetail")?.addEventListener("click", closeDetail);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeDetail(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal?.hidden) closeDetail(); });
}

function updateSource(name, rows) {
  state[name] = rows;
  state.loaded[name] = true;
  render();
}

function render() {
  if (!Object.values(state.loaded).every(Boolean)) return;
  state.payroll = calculateMonthlyPayroll({
    month:monthInput.value || getTokyoMonthKey(),
    sales:state.sales,
    schedules:state.schedules,
    casts:state.casts,
    settings:state.settings
  });
  setBusy(list, false);
  renderSummary();
  renderPayrollTable();
}

function renderSummary() {
  setText("payrollSalesTotal", yen(sumPayroll("salesTotal")));
  setText("payrollHoursTotal", `${formatHours(sumPayroll("workHours"))}h`);
  setText("payrollGrossTotal", yen(sumPayroll("grossPay")));
  setText("payrollDeductionTotal", yen(sumPayroll("deductionTotal")));
  setText("payrollNetTotal", yen(sumPayroll("netPay")));
}

function renderPayrollTable() {
  document.getElementById("payrollResultCount").textContent = `${state.payroll.length}名`;
  if (!state.payroll.length) {
    list.innerHTML = '<p class="payroll-empty">選択した月の売上・出勤データはありません。</p>';
    return;
  }
  const rows = state.payroll.map((item) => `<tr><td><strong>${escapeHtml(item.castName)}</strong>${item.unresolvedScheduleCount ? `<small class="payroll-warning">時刻未登録 ${item.unresolvedScheduleCount}件</small>` : ""}</td><td>${item.workDays}日</td><td>${formatHours(item.workHours)}h</td><td>${yen(item.salesTotal)}</td><td>${yen(item.backTotal)}</td><td>${yen(item.grossPay)}</td><td>${yen(item.deductionTotal)}</td><td class="is-net-pay">${yen(item.netPay)}</td><td><button class="payroll-detail-button" type="button" data-payroll-detail="${escapeAttribute(item.castId)}">明細</button></td></tr>`).join("");
  list.innerHTML = `<div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>キャスト</th><th>勤務日数</th><th>勤務時間</th><th>売上</th><th>各種バック</th><th>総支給額</th><th>控除額</th><th>差引支給額</th><th>明細</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function saveSettings(event) {
  event.preventDefault();
  const settings = collectSettings();
  const validation = validateSettings(settings);
  if (!validation.valid) return setMessage(validation.message, "error");
  const button = document.getElementById("savePayrollSettings");
  button.disabled = true;
  setMessage("保存中...");
  try {
    await savePayrollSettings(settings);
    state.settings = settings;
    setMessage("給与設定を保存しました。月次給与を再計算しました。", "success");
    render();
  } catch (error) {
    console.error("給与設定保存失敗", error);
    setMessage("給与設定の保存に失敗しました。通信状況とFirestoreの権限をご確認ください。", "error");
  } finally {
    button.disabled = false;
  }
}

function collectSettings() {
  const settings = {};
  SETTINGS_FIELDS.forEach((field) => { settings[field] = parseNumber(form.elements[field]?.value); });
  settings.deductions = [...document.querySelectorAll(".payroll-deduction-row")].map((row) => ({
    name:String(row.querySelector('[name="deductionName"]')?.value || "").trim(),
    type:row.querySelector('[name="deductionType"]')?.value === "percent" ? "percent" : "fixed",
    value:parseNumber(row.querySelector('[name="deductionValue"]')?.value)
  }));
  return settings;
}

function validateSettings(settings) {
  for (const field of SETTINGS_FIELDS) {
    const raw = String(form.elements[field]?.value || "").trim();
    if (!raw) return invalid(`${settingLabel(field)}を入力してください。`);
    const max = PERCENT_FIELDS.has(field) ? 100 : 999999;
    if (!Number.isFinite(settings[field]) || settings[field] < 0 || settings[field] > max) return invalid(`${settingLabel(field)}は0〜${max}の範囲で入力してください。`);
  }
  for (const item of settings.deductions) {
    if (!item.name) return invalid("控除項目名を入力してください。");
    const max = item.type === "percent" ? 100 : 99999999;
    if (!Number.isFinite(item.value) || item.value < 0 || item.value > max) return invalid(`控除「${item.name}」の値を0〜${max}の範囲で入力してください。`);
  }
  return { valid:true, message:"" };
}

function fillSettingsForm(settings) {
  SETTINGS_FIELDS.forEach((field) => { if (form.elements[field]) form.elements[field].value = settings[field] ?? 0; });
  const rows = document.getElementById("payrollDeductionRows");
  rows.innerHTML = "";
  settings.deductions.forEach(addDeductionRow);
}

function addDeductionRow(item = { name:"", type:"fixed", value:0 }) {
  const row = document.createElement("div");
  row.className = "payroll-deduction-row";
  row.innerHTML = `<label class="admin-field"><span>項目名</span><input name="deductionName" type="text" maxlength="50" value="${escapeAttribute(item.name || "")}" placeholder="例：所得税"></label><label class="admin-field"><span>計算方法</span><select name="deductionType"><option value="fixed"${item.type !== "percent" ? " selected" : ""}>固定額</option><option value="percent"${item.type === "percent" ? " selected" : ""}>総支給額の%</option></select></label><label class="admin-field"><span>金額・率</span><input name="deductionValue" type="number" min="0" step="0.1" value="${escapeAttribute(item.value ?? 0)}"></label><button type="button" data-remove-deduction aria-label="この控除項目を削除">削除</button>`;
  document.getElementById("payrollDeductionRows").appendChild(row);
}

function toggleSettings(event) {
  const collapsed = form.hidden;
  form.hidden = !collapsed;
  message.hidden = !collapsed;
  event.currentTarget.textContent = collapsed ? "設定を閉じる" : "設定を開く";
  event.currentTarget.setAttribute("aria-expanded", String(collapsed));
}

function handlePayrollAction(event) {
  const button = event.target.closest("button[data-payroll-detail]");
  if (!button) return;
  const payroll = state.payroll.find((item) => item.castId === button.dataset.payrollDetail);
  if (payroll) openDetail(payroll, button);
}

function openDetail(item, trigger) {
  state.detailTrigger = trigger;
  document.getElementById("payrollDetailContent").innerHTML = createStatement(item);
  modal.hidden = false;
  document.body.classList.add("is-modal-open");
  document.getElementById("closePayrollDetail").focus();
}

function closeDetail() {
  modal.hidden = true;
  document.body.classList.remove("is-modal-open");
  state.detailTrigger?.focus();
  state.detailTrigger = null;
}

function createStatement(item) {
  const deductionRows = item.deductions.length
    ? item.deductions.map((deduction) => `<tr><th>${escapeHtml(deduction.name)}${deduction.type === "percent" ? `（${deduction.value}%）` : ""}</th><td>-${yen(deduction.amount)}</td></tr>`).join("")
    : '<tr><th>控除</th><td>¥0</td></tr>';
  return `<article class="payroll-statement"><header><span>PAYROLL STATEMENT</span><h2 id="payrollDetailTitle">${escapeHtml(item.castName)} 給与明細</h2><p>${escapeHtml(formatMonth(item.month))}</p></header><dl class="payroll-statement-meta"><div><dt>勤務日数</dt><dd>${item.workDays}日</dd></div><div><dt>勤務時間</dt><dd>${formatHours(item.workHours)}時間</dd></div><div><dt>売上</dt><dd>${yen(item.salesTotal)}</dd></div><div><dt>来客人数</dt><dd>${item.customerCount}名</dd></div></dl>${item.unresolvedScheduleCount ? `<p class="payroll-statement-warning">時刻未登録の出勤が${item.unresolvedScheduleCount}件あります。基本給へ含まれていません。</p>` : ""}<table><tbody><tr><th>基本給</th><td>${yen(item.basePay)}</td></tr><tr><th>本指名バック</th><td>${yen(item.backs.honmei)}</td></tr><tr><th>場内バック</th><td>${yen(item.backs.jounai)}</td></tr><tr><th>同伴バック</th><td>${yen(item.backs.douhan)}</td></tr><tr><th>ドリンクバック</th><td>${yen(item.backs.drink)}</td></tr><tr><th>ボトルバック</th><td>${yen(item.backs.bottle)}</td></tr><tr><th>シャンパンバック</th><td>${yen(item.backs.champagne)}</td></tr><tr><th>その他バック</th><td>${yen(item.backs.other)}</td></tr><tr><th>交通費</th><td>${yen(item.transportation)}</td></tr><tr class="is-subtotal"><th>総支給額</th><td>${yen(item.grossPay)}</td></tr>${deductionRows}<tr class="is-total"><th>差引支給額</th><td>${yen(item.netPay)}</td></tr></tbody></table></article>`;
}

function sumPayroll(field) { return state.payroll.reduce((total, item) => total + Number(item[field] || 0), 0); }
function parseNumber(value) { const text = String(value ?? "").trim(); return text === "" ? Number.NaN : Number(text); }
function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(Math.round(Number(value) || 0)); }
function formatHours(value) { return new Intl.NumberFormat("ja-JP", { maximumFractionDigits:2 }).format(Number(value) || 0); }
function getTokyoMonthKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit" }).format(new Date()); }
function formatMonth(value) { const [year, month] = String(value || "").split("-"); return year && month ? `${year}年${Number(month)}月分` : value; }
function settingLabel(field) { return ({ baseHourlyRate:"基本時給", honmeiBack:"本指名バック", jounaiBack:"場内バック", douhanBack:"同伴バック", drinkBack:"ドリンクバック", bottleBack:"ボトルバック", champagneBack:"シャンパンバック", otherBack:"その他バック", transportation:"交通費" })[field] || field; }
function invalid(text) { return { valid:false, message:text }; }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function setMessage(text, type = "") { message.textContent = text; message.dataset.type = type; }
function handleSourceError(error) { console.error("給与計算データ読み込み失敗", error); setBusy(list, false); showPageError(list, "給与計算に必要なデータを読み込めませんでした。Firestoreの権限と通信状況をご確認ください。"); }
function handleSettingsError(error) { console.error("給与設定読み込み失敗", error); state.loaded.settings = true; setMessage("給与設定を読み込めませんでした。Firestoreの権限をご確認ください。", "error"); render(); }
