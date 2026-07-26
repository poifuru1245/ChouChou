import { subscribeCollection } from "./firestoreService.js";
import { normalizeSalesRecord, subscribeSales } from "./salesService.js";

const COLLECTIONS = ["casts", "schedules", "reservations", "news", "visits", "tables", "payrolls"];
const RANKING_FIELDS = {
  sales:"sales",
  honmei:"honmeiCount",
  jounai:"jounaiCount",
  douhan:"douhanCount",
  drink:"drinkSales"
};

export function subscribeOwnerDashboard(onData, onError = console.error) {
  const state = { casts:[], schedules:[], reservations:[], news:[], visits:[], tables:[], payrolls:[], sales:[], loaded:{} };
  const publish = () => onData({ ...state, loaded:{ ...state.loaded } });
  const handleError = (name) => (error) => {
    state.loaded[name] = true;
    state[name] = [];
    onError(error, name);
    publish();
  };
  const unsubscribers = COLLECTIONS.map((name) => subscribeCollection(name, (rows) => {
    state[name] = rows;
    state.loaded[name] = true;
    publish();
  }, handleError(name)));
  unsubscribers.push(subscribeSales((rows) => {
    state.sales = rows.map(normalizeSalesRecord);
    state.loaded.sales = true;
    publish();
  }, handleError("sales")));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
}

export function getDashboardOverview(state, today = getTokyoDateKey()) {
  const month = today.slice(0, 7);
  const todayReservations = getReservationsByPeriod(state.reservations, "today", today);
  const monthSales = state.sales.filter((item) => item.date.startsWith(month));
  const customerCount = sum(monthSales, "customerCount");
  return {
    todaySales:sum(state.sales.filter((item) => item.date === today), "sales"),
    monthSales:sum(state.sales.filter((item) => item.date.startsWith(month)), "sales"),
    attendanceCount:getTodayAttendance(state.schedules, state.casts, today).filter((item) => item.status !== "absent").length,
    castCount:state.casts.filter((item) => item.isPublished !== false && item.isActive !== false).length,
    todayReservations:todayReservations.filter((item) => !isCanceledReservation(item)).length,
    newReservations:state.reservations.filter((item) => !isCanceledReservation(item) && ["", "予約", "受付", "予約中", "新規"].includes(String(item.status || ""))).length,
    todayVisits:(state.visits || []).filter((item) => String(item.visitDate || item.date || "").slice(0, 10) === today && !["予約", "キャンセル", "無断キャンセル"].includes(String(item.status || ""))).length,
    todayCancellations:todayReservations.filter((item) => isCanceledReservation(item)).length,
    vacantTables:(state.tables || []).filter((item) => String(item.status || "空席") === "空席").length,
    averageSpend:customerCount ? Math.round(sum(monthSales, "sales") / customerCount) : 0,
    honmeiRate:customerCount ? Math.round(sum(monthSales, "honmeiCount") / customerCount * 1000) / 10 : 0,
    jounaiRate:customerCount ? Math.round(sum(monthSales, "jounaiCount") / customerCount * 1000) / 10 : 0,
    douhanRate:customerCount ? Math.round(sum(monthSales, "douhanCount") / customerCount * 1000) / 10 : 0
  };
}

export function buildSalesSeries(sales, period, today = getTokyoDateKey()) {
  const normalized = sales.map(normalizeSalesRecord);
  if (period === "today") {
    const rows = normalized.filter((item) => item.date === today);
    const map = groupSum(rows, (item) => item.castName || item.castId || "未設定", "sales");
    return [...map].map(([label, value]) => ({ label, value }));
  }
  if (period === "week") {
    const keys = getWeekDateKeys(today);
    return keys.map((key) => ({ label:`${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`, value:sum(normalized.filter((item) => item.date === key), "sales") }));
  }
  if (period === "year") {
    const year = today.slice(0, 4);
    return Array.from({ length:12 }, (_, index) => {
      const key = `${year}-${String(index + 1).padStart(2, "0")}`;
      return { label:`${index + 1}月`, value:sum(normalized.filter((item) => item.date.startsWith(key)), "sales") };
    });
  }
  const [year, month] = today.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length:days }, (_, index) => {
    const key = `${today.slice(0, 7)}-${String(index + 1).padStart(2, "0")}`;
    return { label:String(index + 1), value:sum(normalized.filter((item) => item.date === key), "sales") };
  });
}

export function buildCastRanking(sales, metric, today = getTokyoDateKey()) {
  const field = RANKING_FIELDS[metric] || RANKING_FIELDS.sales;
  const rows = sales.map(normalizeSalesRecord).filter((item) => item.date.startsWith(today.slice(0, 7)));
  const totals = new Map();
  rows.forEach((item) => {
    const key = item.castId || item.castName;
    const current = totals.get(key) || { castId:item.castId, name:item.castName || "名称未設定", value:0 };
    current.value += toNumber(item[field]);
    totals.set(key, current);
  });
  return [...totals.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "ja")).slice(0, 5);
}

export function buildPayrollRanking(payrolls = [], today = getTokyoDateKey()) {
  return payrolls.filter((row) => String(row.month || "") === today.slice(0, 7)).map((row) => ({ castId:row.castId, name:row.castName || "名称未設定", value:Number(row.netPay) || 0 })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "ja")).slice(0, 5);
}

export function getTodayAttendance(schedules, casts, today = getTokyoDateKey(), now = new Date()) {
  return schedules.filter((item) => getScheduleDate(item) === today && !isPlannedOff(item)).map((item) => {
    const cast = casts.find((candidate) => candidate.id === getScheduleCastId(item));
    return {
      id:item.id,
      castId:getScheduleCastId(item),
      name:String(item.castName || cast?.name || "名称未設定"),
      time:getScheduleDisplayTime(item),
      status:getAttendanceStatus(item, now)
    };
  }).sort((a, b) => attendanceOrder(a.status) - attendanceOrder(b.status) || a.name.localeCompare(b.name, "ja"));
}

export function getReservationsByPeriod(reservations, period, today = getTokyoDateKey()) {
  const tomorrow = addDays(today, 1);
  const week = new Set(getWeekDateKeys(today));
  return reservations.filter((item) => {
    const date = getReservationDate(item);
    return period === "tomorrow" ? date === tomorrow : period === "week" ? week.has(date) : date === today;
  }).sort((a, b) => `${getReservationDate(a)} ${a.time || ""}`.localeCompare(`${getReservationDate(b)} ${b.time || ""}`));
}

export function getVisibleNews(news, now = new Date()) {
  const current = now.getTime();
  return news.filter((item) => {
    if (item.isPublished === false) return false;
    const start = toMillis(item.publishDate || item.publishStart || item.createdAt);
    const end = toMillis(item.publishEndDate || item.publishEnd || item.endDate);
    return (!start || start <= current) && (!end || end >= current);
  }).sort((a, b) => toMillis(b.publishDate || b.createdAt) - toMillis(a.publishDate || a.createdAt)).slice(0, 5);
}

export function buildRecentUpdates(state) {
  const items = [
    ...state.casts.map((item) => createUpdate(item, "cast", "キャスト追加", item.name || "名称未設定")),
    ...state.sales.map((item) => createUpdate(item, "sales", "売上入力", `${item.castName || "名称未設定"} ${formatYen(item.sales)}`)),
    ...state.reservations.map((item) => createUpdate(item, "reservation", "予約", `${item.name || item.customerName || "お客様"} ${getReservationDate(item)}`)),
    ...state.news.map((item) => createUpdate(item, "news", "NEWS", item.title || "タイトル未設定"))
  ];
  return items.filter((item) => item.time > 0).sort((a, b) => b.time - a.time).slice(0, 10);
}

export function getReservationDate(item) { return String(item.date || item.reservationDate || item.visitDate || item.desiredDate || "").slice(0, 10); }
export function getTokyoDateKey(date = new Date()) { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(date); }
export function toMillis(value) { if (typeof value?.toMillis === "function") return value.toMillis(); if (typeof value?.toDate === "function") return value.toDate().getTime(); return Date.parse(value) || Number(value) || 0; }

function createUpdate(item, type, label, detail) { return { id:`${type}-${item.id}`, type, label, detail:String(detail || ""), time:toMillis(item.updatedAt || item.createdAt || item.publishDate) }; }
function groupSum(rows, keyGetter, field) { const map = new Map(); rows.forEach((item) => { const key = keyGetter(item); map.set(key, (map.get(key) || 0) + toNumber(item[field])); }); return map; }
function sum(rows, field) { return rows.reduce((total, item) => total + toNumber(item[field]), 0); }
function toNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function formatYen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(toNumber(value)); }
function getScheduleDate(item) { return String(item.date || item.dateKey || item.workDate || "").slice(0, 10); }
function getScheduleCastId(item) { return String(item.castId || item.castID || item.castDocId || item.castName || ""); }
function isPlannedOff(item) { const status = String(item.status || "").toLowerCase(); return item.isOff === true || item.start === "__OFF__" || ["休み", "off"].includes(status); }
function getScheduleDisplayTime(item) { const start = item.start || item.startTime || ""; const end = item.end || item.endTime || ""; return String(item.time || (start && end ? `${start}〜${end}` : start || "未定")); }
function getAttendanceStatus(item, now) {
  const status = String(item.status || item.attendanceStatus || "").toLowerCase();
  if (item.absent === true || ["欠勤", "cancel", "canceled", "cancelled"].includes(status)) return "absent";
  if (item.late === true || status.includes("遅刻")) return "late";
  const start = parseMinutes(item.start || item.startTime || item.time);
  const end = parseMinutes(item.end || item.endTime, true);
  if (start === null) return "upcoming";
  const nowMinutes = getTokyoMinutes(now);
  const normalizedNow = nowMinutes < 12 * 60 && start >= 18 * 60 ? nowMinutes + 24 * 60 : nowMinutes;
  const normalizedEnd = end === null ? start + 12 * 60 : (end <= start ? end + 24 * 60 : end);
  return normalizedNow >= normalizedEnd ? "finished" : normalizedNow >= start ? "working" : "upcoming";
}
function parseMinutes(value, allowLast = false) { const text = String(value || "").trim().toUpperCase(); if (allowLast && text === "LAST") return 25 * 60; const match = text.match(/(\d{1,2}):(\d{2})/); return match ? Number(match[1]) * 60 + Number(match[2]) : null; }
function getTokyoMinutes(date) { const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"Asia/Tokyo", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(date); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return Number(values.hour) * 60 + Number(values.minute); }
function attendanceOrder(status) { return ({ working:0, late:1, upcoming:2, absent:3, finished:4 })[status] ?? 5; }
function isCanceledReservation(item) { return ["キャンセル", "cancel", "canceled", "cancelled"].includes(String(item.status || "").toLowerCase()); }
function addDays(dateKey, count) { const date = new Date(`${dateKey}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); }
function getWeekDateKeys(today) { const date = new Date(`${today}T00:00:00Z`); const mondayOffset = (date.getUTCDay() + 6) % 7; return Array.from({ length:7 }, (_, index) => addDays(today, index - mondayOffset)); }
