import { adminSession } from "./admin.js";
import { subscribeAnalyticsData } from "./services/analyticsService.js";
import { buildCastRankings, buildCustomerAnalytics, buildKpiGoals, buildPaymentBreakdown, buildSalesSeries, calculateKpis } from "./services/analyticsCalculator.js";
import { renderChart } from "./components/chartManager.js";
import { kpiCard, rankingRows, setMessage, yen } from "./utils/analyticsUi.js";

subscribeAnalyticsData(render, loadError, { includePayrolls:adminSession.profile.role === "owner", includeAuditLogs:false });

function render(data) {
  const kpi = calculateKpis(data);
  const profit = adminSession.profile.role === "owner" ? yen(kpi.estimatedOperatingProfit) : "権限対象外";
  document.getElementById("analyticsKpis").innerHTML = [
    ["TODAY SALES", yen(kpi.todaySales), "今日売上"], ["MONTH SALES", yen(kpi.monthSales), "今月売上"], ["OPERATING PROFIT", profit, "営業利益（売上−総支給概算）"], ["CUSTOMERS", `${kpi.customerCount}名`, "今月客数"],
    ["AVERAGE", yen(kpi.averageSpend), "客単価"], ["EXTENSION", `${kpi.extensionRate}%`, "延長率"], ["HONMEI", `${kpi.honmeiRate}%`, "本指名率"], ["JOUNAI", `${kpi.jounaiRate}%`, "場内率"],
    ["RESERVATIONS", `${kpi.todayReservations}件`, "本日の予約"], ["VISITS", `${kpi.todayVisits}組`, "本日の来店"], ["SEATED", `${kpi.seatedCount}組`, "現在着席"], ["VACANT", `${kpi.vacantTables}席`, "空席"],
    ["CANCELED", `${kpi.todayCancellations}件`, "本日のキャンセル"], ["VIP", `${kpi.vipRate}%`, "VIP比率"], ["NEW", `${kpi.newCustomerRate}%`, "新規率"], ["REPEAT", `${kpi.repeatRate}%`, "リピート率"]
  ].map((row) => kpiCard(...row)).join("");
  document.getElementById("analyticsRealtime").innerHTML = [["本日の予約", `${kpi.todayReservations}件`], ["現在着席", `${kpi.seatedCount}組`], ["空席", `${kpi.vacantTables}席`], ["待機キャスト", waitingCastCount(data)], ["来店数", `${kpi.todayVisits}組`], ["売上速報", yen(kpi.todaySales)]].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  renderChart(document.getElementById("analyticsSalesChart"), { rows:buildSalesSeries(data.sales, "day", { period:"month" }), label:"売上", formatter:yen });
  renderChart(document.getElementById("analyticsPaymentChart"), { rows:buildPaymentBreakdown(data.sales, { period:"month" }), type:"doughnut", label:"決済", formatter:yen });
  const customers = buildCustomerAnalytics(data);
  renderChart(document.getElementById("analyticsCustomerChart"), { rows:[{ label:"新規", value:customers.newCustomers.length }, { label:"リピーター", value:customers.repeaters.length }, { label:"VIP", value:customers.vip.length }, { label:"NG", value:customers.ng.length }], type:"doughnut", label:"顧客数" });
  document.getElementById("analyticsCastRanking").innerHTML = rankingRows(buildCastRankings(data).slice(0, 5), (row) => yen(row.sales), (row) => `客単価 ${yen(row.averageSpend)}`);
  document.getElementById("analyticsGoals").innerHTML = buildKpiGoals(data).map(goalCard).join("");
  setMessage("analyticsMessage", `リアルタイム更新中（${data.readySources.length}/${data.expectedSources}データソース）`, "success");
}
function goalCard(row) { const actual = row.format === "currency" ? yen(row.actual) : `${row.actual}件`; const target = row.target > 0 ? (row.format === "currency" ? yen(row.target) : `${row.target}件`) : "未設定"; const rate = row.rate == null ? "—" : `${row.rate}%`; return `<article class="analytics-goal"><div><span>${row.label}</span><strong>${actual}</strong><small>目標 ${target}</small></div><b>${rate}</b><div class="analytics-progress" aria-label="${row.label}目標達成率 ${rate}"><i style="--progress:${Math.min(100, row.rate || 0)}%"></i></div></article>`; }
function waitingCastCount(data) { const today = new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); const count = (data.schedules || []).filter((row) => String(row.date || row.dateKey || "").slice(0, 10) === today && !["欠勤", "休み", "off"].includes(String(row.status || "").toLowerCase()) && row.isOff !== true).length; return `${count}名`; }
function loadError(error, source) { console.error(`分析データ ${source}`, error); setMessage("analyticsMessage", `${source}を読み込めませんでした。取得可能なデータで表示しています。`, "error"); }
