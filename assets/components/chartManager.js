const charts = new Map();
const COLORS = ["#cf5f8b", "#c7a45a", "#8f6075", "#efadc4", "#856f9f", "#6c9b92", "#e28c77"];

export function renderChart(canvas, config = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  destroyChart(canvas.id);
  if (!globalThis.Chart) {
    canvas.hidden = true;
    const fallback = document.createElement("p");
    fallback.className = "analytics-chart-fallback";
    fallback.textContent = "グラフライブラリを読み込めませんでした。数値一覧をご確認ください。";
    canvas.after(fallback);
    return null;
  }
  canvas.hidden = false;
  canvas.parentElement?.querySelector(".analytics-chart-fallback")?.remove();
  const labels = (config.rows || []).map((row) => row.label);
  const values = (config.rows || []).map((row) => Number(row.value) || 0);
  const type = config.type || "line";
  const chart = new globalThis.Chart(canvas, {
    type,
    data:{ labels, datasets:[{ label:config.label || "売上", data:values, borderColor:COLORS[0], backgroundColor:type === "pie" || type === "doughnut" ? COLORS : "rgba(207,95,139,.2)", borderWidth:2, borderRadius:8, tension:.32, fill:type === "line" }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:{ duration:420 }, interaction:{ intersect:false, mode:"index" }, plugins:{ legend:{ display:["pie", "doughnut"].includes(type), position:"bottom", labels:{ usePointStyle:true, color:"#6a4052" } }, tooltip:{ callbacks:{ label:(context) => config.formatter ? config.formatter(context.raw, context) : `${context.dataset.label}: ${context.formattedValue}` } } }, scales:["pie", "doughnut"].includes(type) ? {} : { x:{ grid:{ display:false }, ticks:{ color:"#8a6876", maxRotation:0 } }, y:{ beginAtZero:true, grid:{ color:"rgba(201,164,90,.14)" }, ticks:{ color:"#8a6876", callback:(value) => compact(value) } } } }
  });
  charts.set(canvas.id, chart);
  return chart;
}

export function destroyChart(id) { const chart = charts.get(id); if (chart) { chart.destroy(); charts.delete(id); } }
export function destroyAllCharts() { [...charts.keys()].forEach(destroyChart); }
function compact(value) { return new Intl.NumberFormat("ja-JP", { notation:"compact", maximumFractionDigits:1 }).format(Number(value) || 0); }
