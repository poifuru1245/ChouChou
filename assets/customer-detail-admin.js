import "./admin.js";
import { subscribeSales } from "./services/salesService.js";
import { subscribeReservations } from "./services/reservationService.js";
import { reservationsForCustomer, salesForCustomer, subscribeCustomers } from "./services/customerService.js";
import { subscribeCasts } from "./services/castService.js";
import { subscribeVisits, visitsForCustomer } from "./services/visitService.js";
import { escapeHtml } from "./js/utils/dom.js";

const customerId = new URLSearchParams(location.search).get("id") || "";
const state = { customers:[], casts:[], reservations:[], sales:[], visits:[], ready:new Set() };

if (!customerId) showError("顧客IDが指定されていません。顧客一覧から開き直してください。");
else initialize();

function initialize() {
  subscribeCustomers((rows) => { state.customers = rows; markReady("customers"); }, handleError);
  subscribeCasts((rows) => { state.casts = rows; markReady("casts"); }, handleError);
  subscribeReservations((rows) => { state.reservations = rows; markReady("reservations"); }, handleError);
  subscribeSales((rows) => { state.sales = rows; markReady("sales"); }, handleError);
  subscribeVisits((rows) => { state.visits = rows; markReady("visits"); }, handleError);
}

function markReady(key) { state.ready.add(key); if (state.ready.size === 5) render(); }

function render() {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return showError("顧客情報が見つかりません。削除または権限変更された可能性があります。");
  const reservations = reservationsForCustomer(state.reservations, customer);
  const sales = salesForCustomer(state.sales, customer);
  const visits = visitsForCustomer(state.visits, customer.id);
  const completed = visits.filter((item) => item.status === "完了");
  const totalSales = sum(sales, "sales");
  const visitCount = Math.max(customer.visitCount, completed.length);
  const average = visitCount ? Math.round(totalSales / visitCount) : 0;
  document.title = `${customer.name || "顧客詳細"} | Chou Chou CRM`;
  setText("customerDetailName", `${customer.name || "名称未設定"} 様`);
  setText("customerDetailSubtitle", `${customer.rank} / ${customer.nickname || customer.kana || "登録顧客"}`);
  document.getElementById("customerReservationLink").href = `reservations.html?customerId=${encodeURIComponent(customer.id)}`;
  document.getElementById("customerMetricGrid").innerHTML = metric("FIRST VISIT", formatDate(customer.firstVisit), "初回来店") + metric("LAST VISIT", formatDate(customer.lastVisit), "最終来店") + metric("VISITS", `${visitCount}回`, "来店回数") + metric("TOTAL SALES", yen(totalSales), "累計売上") + metric("AVERAGE", yen(average), "平均客単価");
  document.getElementById("customerProfileList").innerHTML = profile("ランク", customer.rank) + profile("VIP", customer.isVip ? "VIP" : "") + profile("NG", customer.isNg ? "要注意" : "") + profile("氏名", customer.name) + profile("ふりがな", customer.kana) + profile("ニックネーム", customer.nickname) + profile("電話番号", customer.phone) + profile("LINE ID", customer.lineId) + profile("誕生日", formatDate(customer.birthday, "")) + profile("職業", customer.occupation) + profile("好きなお酒", customer.favoriteDrink) + profile("ボトル情報", customer.bottleInfo);
  renderCastRelations(customer);
  renderTimeline(reservations, visits, sales);
  document.getElementById("customerReservationHistory").innerHTML = reservationTable(reservations);
  document.getElementById("customerVisitHistory").innerHTML = visitTable(visits);
  document.getElementById("customerSalesHistory").innerHTML = salesTable(sales);
  document.getElementById("customerMemo").innerHTML = customer.memo ? escapeHtml(customer.memo).replaceAll("\n", "<br>") : "メモはありません。";
  document.getElementById("customerDetailStatus").hidden = true;
  document.getElementById("customerDetailBody").hidden = false;
}

function renderCastRelations(customer) {
  const assigned = castName(customer.assignedCastId);
  const favorites = customer.favoriteCastIds.map(castName).filter(Boolean);
  document.getElementById("customerCastRelations").innerHTML = `<div class="customer-assigned-cast"><span>担当キャスト</span><strong>${escapeHtml(assigned || "未設定")}</strong></div><div class="customer-favorite-casts"><span>お気に入りキャスト</span>${favorites.length ? favorites.map((name) => `<em>${escapeHtml(name)}</em>`).join("") : "<small>未登録</small>"}</div>`;
}

function renderTimeline(reservations, visits, sales) {
  const events = [
    ...reservations.map((item) => ({ date:item.visitDate, time:item.visitTime, type:"reservation", title:`予約 ${item.status}`, detail:`${item.nominationCastName || "指名なし"} / ${item.peopleCount}名` })),
    ...visits.map((item) => ({ date:item.visitDate, time:item.visitTime, type:"visit", title:`来店 ${item.status}`, detail:`${item.tableName || "席未設定"} / 延長${item.extensionCount}回` })),
    ...sales.map((item) => ({ date:item.date, time:"", type:"sales", title:`売上 ${yen(item.sales)}`, detail:`${item.castName || castName(item.castId) || "担当未設定"} / 本指名${item.honmeiCount || 0}` }))
  ].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  document.getElementById("customerTimeline").innerHTML = events.length ? events.slice(0, 40).map((item) => `<article class="is-${item.type}"><time>${escapeHtml(formatDate(item.date))}${item.time ? ` ${escapeHtml(item.time)}` : ""}</time><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div></article>`).join("") : empty("予約・来店・売上履歴はまだありません。");
}

function reservationTable(rows) {
  if (!rows.length) return empty("予約履歴はありません。");
  return table(["来店日時", "人数", "指名", "状態"], rows.map((item) => [`${formatDate(item.visitDate)} ${item.visitTime || ""}`, `${item.peopleCount}名`, item.nominationCastName || "指名なし", item.status]));
}

function visitTable(rows) {
  if (!rows.length) return empty("来店履歴はありません。");
  return table(["来店日時", "席", "状態", "延長"], rows.map((item) => [`${formatDate(item.visitDate)} ${item.visitTime || ""}`, item.tableName || "未設定", item.status, `${item.extensionCount}回`]));
}

function salesTable(rows) {
  if (!rows.length) return empty("顧客IDに紐付く売上履歴はありません。");
  return table(["営業日", "担当キャスト", "売上", "本指名"], rows.map((item) => [formatDate(item.date), item.castName || castName(item.castId) || "未設定", yen(item.sales), `${item.honmeiCount || 0}本`]));
}

function table(headings, rows) { return `<div><table><thead><tr>${headings.map((value) => `<th>${value}</th>`).join("")}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; }
function metric(label, value, caption) { return `<article class="customer-glass-card"><span>${label}</span><strong>${escapeHtml(value || "未登録")}</strong><small>${caption}</small></article>`; }
function profile(label, value) { return value ? `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>` : ""; }
function empty(text) { return `<p class="customer-detail-empty">${escapeHtml(text)}</p>`; }
function castName(id) { return state.casts.find((item) => item.id === id)?.name || ""; }
function sum(rows, field) { return rows.reduce((total, item) => total + (Number(item[field]) || 0), 0); }
function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(Number(value) || 0); }
function formatDate(value, fallback = "未登録") { const text = String(value || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback; return text.replaceAll("-", "/"); }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function handleError(error) { console.error("顧客詳細読み込み失敗", error); showError("顧客情報を読み込めませんでした。Firestoreの権限と通信状況をご確認ください。"); }
function showError(message) { const status = document.getElementById("customerDetailStatus"); status.textContent = message; status.dataset.type = "error"; }
