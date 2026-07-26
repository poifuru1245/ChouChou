import { subscribeCasts } from "./castService.js";
import { subscribeCustomers } from "./customerService.js";
import { subscribePayrolls } from "./payrollService.js";
import { subscribeReservations } from "./reservationService.js";
import { subscribeSales } from "./salesService.js";
import { subscribeSchedules } from "./scheduleService.js";
import { subscribeTables } from "./tableService.js";
import { subscribeVisits } from "./visitService.js";
import { subscribeDailyClosings, subscribeMonthlyClosings } from "./closingService.js";
import { subscribeBusinessAuditLogs } from "./auditService.js";
import { getDashboardOverview } from "./dashboardService.js";
import { calculateKpis } from "./analyticsCalculator.js";
export { recordCastView, subscribeCastViews } from "./castViewService.js";

const ANALYTICS_SOURCES = Object.freeze({
  sales:subscribeSales,
  payrolls:subscribePayrolls,
  customers:subscribeCustomers,
  visits:subscribeVisits,
  reservations:subscribeReservations,
  casts:subscribeCasts,
  tables:subscribeTables,
  schedules:subscribeSchedules,
  dailyClosings:subscribeDailyClosings,
  monthlyClosings:subscribeMonthlyClosings
});

/** M5の全画面で共有するリアルタイム分析スナップショット。UIは個別Collectionを購読しない。 */
export function subscribeAnalyticsData(onData, onError = console.error, options = {}) {
  const state = Object.fromEntries(Object.keys(ANALYTICS_SOURCES).map((key) => [key, []]));
  const ready = new Set();
  const publish = () => {
    const kpis = calculateKpis(state);
    onData({ ...state, dashboard:{ ...getDashboardOverview(state), ...kpis }, readySources:[...ready], expectedSources:sources.length, kpis });
  };
  const sources = Object.entries(ANALYTICS_SOURCES).filter(([key]) => key !== "payrolls" || options.includePayrolls === true);
  if (options.includeAuditLogs === true) sources.push(["businessAuditLogs", subscribeBusinessAuditLogs]);
  const unsubscribers = sources.map(([key, subscribe]) => subscribe((rows) => {
    state[key] = Array.isArray(rows) ? rows : [];
    ready.add(key);
    publish();
  }, (error) => {
    state[key] = [];
    ready.add(key);
    onError(error, key);
    publish();
  }));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
}
