import { subscribeAnalyticsData } from "./services/analyticsService.js";
import { buildCastRankings, buildChargeBreakdown, buildHeatmap, buildPaymentBreakdown, buildSalesSeries } from "./services/analyticsCalculator.js";
import { renderChart } from "./components/chartManager.js";
import { escape, setMessage, table, yen } from "./utils/analyticsUi.js";

const state = { data:null, period:"month", dimension:"day" };
document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => { state.period = button.dataset.period; document.querySelectorAll("[data-period]").forEach((item) => item.classList.toggle("is-active", item === button)); render(); }));
document.getElementById("salesDimension").addEventListener("change", (event) => { state.dimension = event.target.value; render(); });
subscribeAnalyticsData((data) => { state.data = data; render(); }, loadError, { includePayrolls:false });

function render() {
  if (!state.data) return;
  const series = buildSalesSeries(state.data.sales, state.dimension, { period:state.period });
  renderChart(document.getElementById("salesAnalysisChart"), { rows:series, type:["nomination", "champagne", "bottle"].includes(state.dimension) ? "bar" : "line", label:"売上", formatter:yen });
  renderChart(document.getElementById("salesPaymentChart"), { rows:buildPaymentBreakdown(state.data.sales, { period:state.period }), type:"pie", label:"決済", formatter:yen });
  document.getElementById("salesAnalysisTable").innerHTML = table(["区分", "売上", "件数"], series.map((row) => `<tr><td>${escape(row.label)}</td><td>${yen(row.value)}</td><td>${row.count}件</td></tr>`));
  const charges = buildChargeBreakdown(state.data.sales, { period:state.period });
  document.getElementById("salesChargeBreakdown").innerHTML = table(["売上区分", "金額"], charges.map((row) => `<tr><td>${escape(row.label)}</td><td>${yen(row.value)}</td></tr>`));
  document.getElementById("salesRanking").innerHTML = buildCastRankings(state.data, { period:state.period }).slice(0, 10).map((row, index) => `<li><b>${index + 1}</b><div><strong>${escape(row.name)}</strong><small>客単価 ${yen(row.averageSpend)}</small></div><em>${yen(row.sales)}</em></li>`).join("");
  renderHeatmap(buildHeatmap(state.data.sales, { period:state.period }));
  setMessage("salesAnalyticsMessage", `${series.length}区分を集計しました。`, "success");
}
function renderHeatmap(cells) { const max = Math.max(1, ...cells.flat().map((cell) => cell.value)); const weekdays = ["日", "月", "火", "水", "木", "金", "土"]; const head = `<span class="heatmap-label"></span>${cells[0].map((cell) => `<span class="heatmap-label">${cell.hour}:00</span>`).join("")}`; const body = cells.map((row, index) => `<span class="heatmap-label">${weekdays[index]}</span>${row.map((cell) => `<span class="heatmap-cell" style="--heat:${(.05 + cell.value / max * .65).toFixed(2)}" title="${weekdays[index]}曜 ${cell.hour}:00 ${yen(cell.value)}">${cell.count || "-"}</span>`).join("")}`).join(""); document.getElementById("salesHeatmap").innerHTML = `<div class="heatmap-grid">${head}${body}</div>`; }
function loadError(error, source) { console.error(source, error); setMessage("salesAnalyticsMessage", `${source}を読み込めませんでした。`, "error"); }
