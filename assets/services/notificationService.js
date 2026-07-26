import { subscribeAnalyticsData } from "./analyticsService.js";
import { buildCustomerAnalytics, buildKpiGoals, calculateKpis, dateOf, tokyoDateKey } from "./analyticsCalculator.js";

const CANCEL_STATUSES = new Set(["キャンセル", "無断キャンセル", "cancel", "canceled", "no-show"]);

/** Cloud Functionsなしで既存業務データから通知をリアルタイム生成する。 */
export function subscribeNotifications(onData, onError = console.error, options = {}) {
  return subscribeAnalyticsData((data) => onData(buildNotifications(data, options)), onError, { includePayrolls:false, includeAuditLogs:options.includeAuditLogs === true });
}

export function buildNotifications(data = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const today = tokyoDateKey(now);
  const month = today.slice(0, 7);
  const kpis = calculateKpis(data, { now });
  const customerAnalytics = buildCustomerAnalytics(data, { period:"all", now });
  const customers = new Map((data.customers || []).map((row) => [String(row.id || row.customerId || ""), row]));
  const notifications = [];

  (data.visits || []).filter((row) => dateOf(row) === today && ["受付", "着席", "延長", "会計", "完了"].includes(String(row.status || ""))).forEach((row) => {
    const customer = customers.get(String(row.customerId || ""));
    if (customer?.isVip === true || String(customer?.rank || "").toUpperCase() === "VIP") notifications.push(item("vip", "VIP来店", `${row.customerName || customer.name || "VIPのお客様"}が${row.status}です。`, row.updatedAt || row.visitTime, `reservation-detail.html?id=${encodeURIComponent(row.reservationId || "")}`));
  });
  customerAnalytics.birthdays.slice(0, 20).forEach((row) => notifications.push(item("birthday", "誕生日", `${row.name || row.nickname || "お客様"}の誕生日は${formatDate(row.nextBirthday)}です。`, row.nextBirthday, `customer-detail.html?id=${encodeURIComponent(row.id || row.customerId || "")}`)));
  (data.reservations || []).filter((row) => CANCEL_STATUSES.has(String(row.status || "").toLowerCase()) || CANCEL_STATUSES.has(String(row.status || ""))).filter((row) => withinDays(row.updatedAt || row.visitDate || row.date, now, 7)).forEach((row) => notifications.push(item("cancel", "予約キャンセル", `${row.customerName || row.name || "お客様"} ${dateOf(row)} ${row.visitTime || row.time || ""}`, row.updatedAt || row.visitDate, `reservation-detail.html?id=${encodeURIComponent(row.id || row.reservationId || "")}`)));
  customerAnalytics.bottleExpirations.slice(0, 20).forEach((row) => notifications.push(item("bottle", "ボトル期限", `${row.name || "お客様"}のボトル期限は${formatDate(row.bottleExpiry)}です。`, row.bottleExpiry, `customer-detail.html?id=${encodeURIComponent(row.id || row.customerId || "")}`)));
  [...(data.dailyClosings || []), ...(data.monthlyClosings || [])].filter((row) => row.status === "closed" && withinDays(row.closedAt || row.date || `${row.month}-01`, now, 31)).forEach((row) => notifications.push(item("closing", "締め完了", `${row.date || row.month}の締めが完了しました。売上 ${yen(row.total)}`, row.closedAt || row.date || row.month, "closing.html")));
  const target = Number(options.monthlySalesTarget) > 0 ? Number(options.monthlySalesTarget) : buildKpiGoals(data, { now })[0].target;
  if (target > 0 && kpis.monthSales >= target) notifications.push(item("target", "売上目標達成", `${month}の売上が目標${yen(target)}を達成しました。`, today, "analytics-sales.html"));
  (data.businessAuditLogs || []).filter(isImportantAudit).filter((row) => withinDays(row.createdAt, now, 14)).slice(0, 30).forEach((row) => notifications.push(item("audit", "重要な監査イベント", auditMessage(row), row.createdAt, auditHref(row))));
  return notifications.sort((a, b) => b.sortTime - a.sortTime || a.title.localeCompare(b.title, "ja"));
}

function isImportantAudit(row) { const action = String(row.action || ""); return ["sales.update", "sales.delete", "payroll.update", "commission.update"].includes(action) || action.endsWith(".reopen"); }
function auditMessage(row) { return `${row.actorName || "管理ユーザー"}が${auditLabel(row.action)}を実行しました。`; }
function auditLabel(action) { const value = String(action || ""); if (value.includes("reopen")) return "締め解除"; if (value.includes("commission")) return "バック率変更"; if (value.includes("payroll")) return "給与変更"; if (value.includes("delete")) return "売上削除"; return "売上修正"; }
function auditHref(row) { if (String(row.targetType || "").includes("payroll")) return "payroll.html"; if (String(row.targetType || "").includes("Closing")) return "closing.html"; return "sales.html"; }

function item(type, title, message, time, href) { return { id:`${type}_${title}_${String(time || "")}_${message}`, type, title, message, time, sortTime:toTime(time), href }; }
function withinDays(value, now, days) { const time = toTime(value); return time > 0 && Math.abs(now.getTime() - time) <= days * 86400000; }
function toTime(value) { if (typeof value?.toMillis === "function") return value.toMillis(); if (typeof value?.toDate === "function") return value.toDate().getTime(); const parsed = Date.parse(String(value || "")); return Number.isFinite(parsed) ? parsed : 0; }
function formatDate(value) { const [, month, day] = String(value || "").split("-"); return month && day ? `${Number(month)}/${Number(day)}` : String(value || ""); }
function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(Number(value) || 0); }
