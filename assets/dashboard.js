import "./admin.js";
import {
  buildCastRanking,
  buildPayrollRanking,
  buildRecentUpdates,
  buildSalesSeries,
  getDashboardOverview,
  getReservationDate,
  getReservationsByPeriod,
  getTodayAttendance,
  getTokyoDateKey,
  getVisibleNews,
  subscribeOwnerDashboard
} from "./services/dashboardService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";

const REQUIRED_SOURCES = ["casts", "schedules", "reservations", "news", "sales", "visits", "tables", "payrolls"];
const state = { data:null, chartPeriod:"today", chartType:"line", ranking:"sales", reservationPeriod:"today" };
const message = document.getElementById("dashboardMessage");

if (document.body.classList.contains("owner-dashboard-page")) initialize();

function initialize() {
  renderTodayLabel();
  bindEvents();
  subscribeOwnerDashboard((data) => {
    state.data = data;
    if (REQUIRED_SOURCES.every((name) => data.loaded[name])) render();
  }, handleLoadError);
}

function bindEvents() {
  document.querySelectorAll("[data-chart-period]").forEach((button) => button.addEventListener("click", () => {
    state.chartPeriod = button.dataset.chartPeriod;
    setActiveButton("[data-chart-period]", button);
    renderChart();
  }));
  document.querySelectorAll("[data-chart-type]").forEach((button) => button.addEventListener("click", () => {
    state.chartType = button.dataset.chartType;
    setActiveButton("[data-chart-type]", button);
    renderChart();
  }));
  document.querySelectorAll("[data-ranking]").forEach((button) => button.addEventListener("click", () => {
    state.ranking = button.dataset.ranking;
    setActiveButton("[data-ranking]", button);
    renderRanking();
  }));
  document.querySelectorAll("[data-reservation-period]").forEach((button) => button.addEventListener("click", () => {
    state.reservationPeriod = button.dataset.reservationPeriod;
    setActiveButton("[data-reservation-period]", button);
    renderReservations();
  }));
}

function render() {
  renderOverview();
  renderChart();
  renderRanking();
  renderAttendance();
  renderReservations();
  renderNews();
  renderRecentUpdates();
  setMessage("");
}

function renderOverview() {
  const overview = getDashboardOverview(state.data);
  setText("dashboardTodaySales", yen(overview.todaySales));
  setText("dashboardMonthSales", yen(overview.monthSales));
  setText("dashboardAttendanceCount", `${overview.attendanceCount}名`);
  setText("dashboardCastCount", `${overview.castCount}名`);
  setText("dashboardTodayReservations", `${overview.todayReservations}件`);
  setText("dashboardNewReservations", `${overview.newReservations}件`);
  setText("dashboardTodayVisits", `${overview.todayVisits}件`);
  setText("dashboardTodayCancellations", `${overview.todayCancellations}件`);
  setText("dashboardVacantTables", `${overview.vacantTables}席`);
  setText("dashboardAverageSpend", yen(overview.averageSpend));
  setText("dashboardHonmeiRate", `${overview.honmeiRate}%`);
  setText("dashboardJounaiRate", `${overview.jounaiRate}%`);
  setText("dashboardDouhanRate", `${overview.douhanRate}%`);
  document.querySelectorAll(".owner-stat-card .dashboard-skeleton").forEach((element) => element.classList.remove("dashboard-skeleton"));
}

function renderChart() {
  if (!state.data) return;
  const series = buildSalesSeries(state.data.sales, state.chartPeriod);
  setText("dashboardChartTotal", yen(series.reduce((total, item) => total + item.value, 0)));
  document.getElementById("dashboardSalesChart").innerHTML = state.chartType === "bar" ? createBarChart(series) : createLineChart(series);
}

function createLineChart(series) {
  if (!series.length || !series.some((item) => item.value > 0)) return emptyChart();
  const width = 1000;
  const height = 300;
  const padding = { top:25, right:24, bottom:52, left:62 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(...series.map((item) => item.value), 1);
  const step = series.length > 1 ? innerWidth / (series.length - 1) : innerWidth / 2;
  const points = series.map((item, index) => ({ x:padding.left + (series.length > 1 ? index * step : step), y:padding.top + innerHeight - item.value / max * innerHeight, ...item }));
  const labelStep = Math.max(1, Math.ceil(series.length / 8));
  const labels = points.filter((_, index) => index % labelStep === 0 || index === points.length - 1).map((point) => `<text x="${point.x}" y="${height - 18}" text-anchor="middle">${escapeHtml(point.label)}</text>`).join("");
  const grid = [0, .25, .5, .75, 1].map((ratio) => { const y = padding.top + innerHeight * ratio; const value = Math.round(max * (1 - ratio)); return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/><text x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${compactNumber(value)}</text>`; }).join("");
  return `<svg class="owner-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="売上折れ線グラフ"><g class="owner-chart-grid">${grid}</g><polyline class="owner-chart-line" points="${points.map((point) => `${point.x},${point.y}`).join(" ")}"/><g class="owner-chart-points">${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5"><title>${escapeHtml(point.label)} ${yen(point.value)}</title></circle>`).join("")}</g><g class="owner-chart-labels">${labels}</g></svg>`;
}

function createBarChart(series) {
  if (!series.length || !series.some((item) => item.value > 0)) return emptyChart();
  const max = Math.max(...series.map((item) => item.value), 1);
  return `<div class="owner-bar-chart" role="img" aria-label="売上棒グラフ">${series.map((item) => `<div class="owner-bar-item"><span class="owner-bar-value">${compactNumber(item.value)}</span><i style="--bar-height:${Math.max(2, item.value / max * 100)}%" title="${escapeAttribute(`${item.label} ${yen(item.value)}`)}"></i><small>${escapeHtml(item.label)}</small></div>`).join("")}</div>`;
}

function renderRanking() {
  if (!state.data) return;
  const rankings = state.ranking === "payroll" ? buildPayrollRanking(state.data.payrolls) : buildCastRanking(state.data.sales, state.ranking);
  const list = document.getElementById("dashboardRankingList");
  if (!rankings.length) { list.innerHTML = '<li class="owner-empty-state">今月の売上データはありません。</li>'; return; }
  list.innerHTML = rankings.map((item, index) => `<li><span class="owner-rank-number is-rank-${index + 1}">${index + 1}</span><div><strong>${escapeHtml(item.name)}</strong><small>${rankingLabel(state.ranking)}</small></div><em>${["sales", "drink", "payroll"].includes(state.ranking) ? yen(item.value) : `${item.value}件`}</em></li>`).join("");
}

function renderAttendance() {
  const rows = getTodayAttendance(state.data.schedules, state.data.casts);
  const list = document.getElementById("dashboardAttendanceList");
  if (!rows.length) { list.innerHTML = '<li class="owner-empty-state">本日の出勤登録はありません。</li>'; return; }
  const labels = { working:"出勤中", late:"遅刻", absent:"欠勤", finished:"終了済み", upcoming:"出勤予定" };
  list.innerHTML = rows.map((item) => `<li><span class="owner-status-dot is-${escapeAttribute(item.status)}"></span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.time)}</small></div><em class="is-${escapeAttribute(item.status)}">${labels[item.status] || "出勤予定"}</em></li>`).join("");
}

function renderReservations() {
  const rows = getReservationsByPeriod(state.data.reservations, state.reservationPeriod);
  const list = document.getElementById("dashboardReservationList");
  if (!rows.length) { list.innerHTML = '<li class="owner-empty-state">該当する予約はありません。</li>'; return; }
  list.innerHTML = rows.map((item) => `<li><time datetime="${escapeAttribute(getReservationDate(item))}">${escapeHtml(formatShortDate(getReservationDate(item)))} ${escapeHtml(item.time || "時間未定")}</time><div><strong>${escapeHtml(item.name || item.customerName || "お客様")}</strong><small>${escapeHtml(getReservationCasts(item))}</small></div><span>${escapeHtml(String(item.people || item.partySize || "-") )}名</span><em>${escapeHtml(item.status || "予約中")}</em></li>`).join("");
}

function renderNews() {
  const rows = getVisibleNews(state.data.news);
  const list = document.getElementById("dashboardNewsList");
  if (!rows.length) { list.innerHTML = '<li class="owner-empty-state">公開中のお知らせはありません。</li>'; return; }
  list.innerHTML = rows.map((item) => `<li><time>${escapeHtml(formatTimestamp(item.publishDate || item.createdAt))}</time><strong>${escapeHtml(item.title || "タイトル未設定")}</strong>${isRecent(item.createdAt || item.publishDate) ? "<em>NEW</em>" : ""}</li>`).join("");
}

function renderRecentUpdates() {
  const rows = buildRecentUpdates(state.data);
  const list = document.getElementById("dashboardRecentUpdates");
  if (!rows.length) { list.innerHTML = '<li class="owner-empty-state">最近の更新はありません。</li>'; return; }
  list.innerHTML = rows.map((item) => `<li><span class="is-${escapeAttribute(item.type)}">${updateIcon(item.type)}</span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div><time>${escapeHtml(relativeTime(item.time))}</time></li>`).join("");
}

function renderTodayLabel() { const today = getTokyoDateKey(); const [year, month, day] = today.split("-"); document.getElementById("dashboardTodayLabel").textContent = `${year}.${month}.${day} OWNER DASHBOARD`; }
function setActiveButton(selector, active) { document.querySelectorAll(selector).forEach((button) => button.classList.toggle("is-active", button === active)); }
function emptyChart() { return '<div class="owner-chart-empty"><span>◇</span><p>選択期間の売上データはありません。</p></div>'; }
function rankingLabel(type) { return ({ sales:"売上", honmei:"本指名", jounai:"場内", douhan:"同伴", drink:"ドリンク売上", payroll:"給与" })[type] || "売上"; }
function getReservationCasts(item) { return [item.cast1, item.cast2, item.cast3].filter((value) => value && value !== "なし").join("・") || "指名なし"; }
function updateIcon(type) { return ({ cast:"♕", sales:"◇", reservation:"▢", news:"✧" })[type] || "◇"; }
function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(Number(value) || 0); }
function compactNumber(value) { return new Intl.NumberFormat("ja-JP", { notation:"compact", maximumFractionDigits:1 }).format(Number(value) || 0); }
function formatShortDate(value) { const [, month, day] = String(value || "").split("-"); return month && day ? `${Number(month)}/${Number(day)}` : value; }
function formatTimestamp(value) { const time = toTime(value); if (!time) return "日付未設定"; return new Intl.DateTimeFormat("ja-JP", { month:"numeric", day:"numeric" }).format(new Date(time)); }
function relativeTime(time) { const diff = Date.now() - time; if (diff < 60_000) return "たった今"; if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分前`; if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`; return formatTimestamp(time); }
function isRecent(value) { const time = toTime(value); return time > 0 && Date.now() - time < 7 * 86_400_000; }
function toTime(value) { if (typeof value?.toMillis === "function") return value.toMillis(); if (typeof value?.toDate === "function") return value.toDate().getTime(); return Date.parse(value) || Number(value) || 0; }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function setMessage(text, type = "") { message.textContent = text; message.dataset.type = type; }
function handleLoadError(error, source) { console.error(`ダッシュボード ${source} 読み込み失敗`, error); setMessage(`${source}データを読み込めませんでした。表示できる情報のみ更新しています。`, "error"); }
