const CANCEL_STATUSES = new Set(["キャンセル", "無断キャンセル", "cancel", "canceled", "no-show"]);
const ACTIVE_TABLE_STATUSES = new Set(["使用中", "予約済"]);

export const ANALYTICS_PERIODS = Object.freeze(["today", "week", "month", "year", "all"]);

/** M1〜M4の正規化済みデータから経営KPIを計算するFirebase非依存の純粋関数。 */
export function calculateKpis(data = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const today = tokyoDateKey(now);
  const month = today.slice(0, 7);
  const sales = array(data.sales);
  const todaySales = sales.filter((row) => dateOf(row) === today);
  const monthSales = sales.filter((row) => dateOf(row).startsWith(month));
  const monthPayrolls = array(data.payrolls).filter((row) => String(row.month || "") === month);
  const reservations = array(data.reservations);
  const monthReservations = reservations.filter((row) => dateOf(row).startsWith(month));
  const completedVisits = array(data.visits).filter((row) => String(row.status || "") === "完了" && dateOf(row).startsWith(month));
  const customers = array(data.customers);
  const customerCount = sum(monthSales, "customerCount") || completedVisits.reduce((total, row) => total + positive(row.peopleCount, 1), 0);
  const monthRevenue = sum(monthSales, "total", "sales");
  const payrollCost = sum(monthPayrolls, "grossPay", "netPay");
  const extensionVisits = completedVisits.filter((row) => Number(row.extensionCount || 0) > 0).length;
  const canceled = monthReservations.filter((row) => CANCEL_STATUSES.has(String(row.status || "").toLowerCase()) || CANCEL_STATUSES.has(String(row.status || ""))).length;
  const visitedCustomerIds = new Set(completedVisits.map((row) => String(row.customerId || "")).filter(Boolean));
  const newCustomers = customers.filter((row) => String(row.firstVisit || "").startsWith(month));
  const repeatCustomers = customers.filter((row) => Number(row.visitCount || 0) >= 2 && (!visitedCustomerIds.size || visitedCustomerIds.has(String(row.id || row.customerId || ""))));
  return {
    todaySales:sum(todaySales, "total", "sales"), monthSales:monthRevenue,
    estimatedOperatingProfit:monthRevenue - payrollCost,
    customerCount, averageSpend:customerCount ? Math.round(monthRevenue / customerCount) : 0,
    extensionRate:percent(extensionVisits, completedVisits.length),
    honmeiRate:percent(sum(monthSales, "honmeiCount", "honmei"), customerCount),
    jounaiRate:percent(sum(monthSales, "jounaiCount", "jounai"), customerCount),
    douhanRate:percent(sum(monthSales, "douhanCount", "douhan"), customerCount),
    cancellationRate:percent(canceled, monthReservations.length),
    vipRate:percent(customers.filter(isVip).length, customers.length),
    newCustomerRate:percent(newCustomers.length, customers.length),
    repeatRate:percent(repeatCustomers.length, customers.length),
    todayReservations:reservations.filter((row) => dateOf(row) === today && !isCanceled(row)).length,
    todayCancellations:reservations.filter((row) => dateOf(row) === today && isCanceled(row)).length,
    seatedCount:array(data.visits).filter((row) => dateOf(row) === today && ["着席", "延長", "会計"].includes(String(row.status || ""))).length,
    vacantTables:array(data.tables).filter((row) => String(row.status || "空席") === "空席").length,
    occupiedTables:array(data.tables).filter((row) => ACTIVE_TABLE_STATUSES.has(String(row.status || ""))).length,
    todayVisits:array(data.visits).filter((row) => dateOf(row) === today && !isCanceled(row)).length,
    todayCustomerCount:sum(todaySales, "customerCount"),
    payrollCost
  };
}

/** 保存済み売上内訳をカテゴリ別に集計する。合計値から推測せず、M4の正規フィールドだけを使う。 */
export function buildChargeBreakdown(rows = [], options = {}) {
  const filtered = filterByPeriod(rows, options.period || "month", options.now || new Date());
  return [
    ["セット料金", "setFee"], ["飲み放題", "allYouCanDrinkSales"], ["延長", "extensionSales"],
    ["ドリンク", "drinkSales"], ["ボトル", "bottleSales"], ["シャンパン", "champagneSales"],
    ["フード", "foodSales"], ["その他", "otherSales"]
  ].map(([label, field]) => ({ label, field, value:sum(filtered, field) }));
}

/** 既存の目標フィールドがある場合だけ達成率を算出する。目標未設定を0%達成とは扱わない。 */
export function buildKpiGoals(data = {}, options = {}) {
  const actual = calculateKpis(data, options);
  const casts = array(data.casts);
  const dashboard = data.dashboard || {};
  const targets = {
    sales:positiveTarget(dashboard.monthlySalesTarget) || sumTargets(casts, ["monthlySalesTarget", "salesTarget", "targetSales"]),
    customers:positiveTarget(dashboard.monthlyCustomerTarget) || sumTargets(casts, ["monthlyCustomerTarget", "customerTarget"]),
    honmei:positiveTarget(dashboard.monthlyHonmeiTarget) || sumTargets(casts, ["monthlyHonmeiTarget", "honmeiTarget"]),
    douhan:positiveTarget(dashboard.monthlyDouhanTarget) || sumTargets(casts, ["monthlyDouhanTarget", "douhanTarget"])
  };
  return [
    goal("売上", actual.monthSales, targets.sales, "currency"),
    goal("客数", actual.customerCount, targets.customers, "count"),
    goal("本指名", sum(filterByPeriod(data.sales, "month", options.now || new Date()), "honmeiCount", "honmei"), targets.honmei, "count"),
    goal("同伴", sum(filterByPeriod(data.sales, "month", options.now || new Date()), "douhanCount", "douhan"), targets.douhan, "count")
  ];
}

export function filterByPeriod(rows = [], period = "month", now = new Date()) {
  const range = periodRange(period, now);
  return array(rows).filter((row) => { const date = dateOf(row); return date && (!range.start || date >= range.start) && (!range.end || date <= range.end); });
}

export function buildSalesSeries(rows = [], dimension = "day", options = {}) {
  const filtered = filterByPeriod(rows, options.period || "month", options.now || new Date());
  const buckets = new Map();
  filtered.forEach((row) => {
    const key = salesDimensionKey(row, dimension);
    if (!key) return;
    const current = buckets.get(key) || { key, label:salesDimensionLabel(key, dimension), value:0, count:0 };
    current.value += amount(row.total ?? row.sales);
    current.count += 1;
    buckets.set(key, current);
  });
  return [...buckets.values()].sort((a, b) => dimensionOrder(a.key, b.key, dimension));
}

export function buildPaymentBreakdown(rows = [], options = {}) {
  const filtered = filterByPeriod(rows, options.period || "month", options.now || new Date());
  return [
    ["現金", "cashPayment"], ["カード", "cardPayment"], ["QR決済", "qrPayment"], ["売掛", "accountsReceivable"]
  ].map(([label, field]) => ({ label, value:sum(filtered, field) })).filter((row) => row.value > 0);
}

export function buildHeatmap(rows = [], options = {}) {
  const filtered = filterByPeriod(rows, options.period || "month", options.now || new Date());
  const cells = Array.from({ length:7 }, (_, weekday) => Array.from({ length:8 }, (_, slot) => ({ weekday, hour:18 + slot, value:0, count:0 })));
  filtered.forEach((row) => {
    const date = dateOf(row); if (!date) return;
    const weekday = new Date(`${date}T12:00:00+09:00`).getDay();
    const hour = Number(String(row.visitTime || row.time || "20:00").slice(0, 2));
    const slot = Math.min(7, Math.max(0, Number.isFinite(hour) ? (hour < 6 ? hour + 6 : hour - 18) : 2));
    cells[weekday][slot].value += amount(row.total ?? row.sales);
    cells[weekday][slot].count += 1;
  });
  return cells;
}

export function buildCastAnalytics(data = {}, castId = "", options = {}) {
  const sales = filterByPeriod(data.sales, options.period || "month", options.now || new Date()).filter((row) => !castId || String(row.castId || "") === String(castId));
  const schedules = filterByPeriod(data.schedules, options.period || "month", options.now || new Date()).filter((row) => !castId || scheduleCastId(row) === String(castId));
  const activeSchedules = schedules.filter((row) => !["休み", "off", "cancel", "canceled"].includes(String(row.status || "").toLowerCase()) && row.isOff !== true);
  const attended = activeSchedules.filter((row) => !["欠勤", "absent"].includes(String(row.status || "").toLowerCase()));
  const customers = sum(sales, "customerCount");
  const total = sum(sales, "total", "sales");
  const visits = filterByPeriod(data.visits, options.period || "month", options.now || new Date()).filter((row) => !castId || visitBelongsToCast(row, castId));
  const completedVisits = visits.filter((row) => String(row.status || "") === "完了");
  const target = castSalesTarget(data.casts, castId);
  return {
    total, customers, averageSpend:customers ? Math.round(total / customers) : 0,
    honmeiCount:sum(sales, "honmeiCount", "honmei"), jounaiCount:sum(sales, "jounaiCount", "jounai"), douhanCount:sum(sales, "douhanCount", "douhan"),
    honmeiRate:percent(sum(sales, "honmeiCount", "honmei"), customers), jounaiRate:percent(sum(sales, "jounaiCount", "jounai"), customers), douhanRate:percent(sum(sales, "douhanCount", "douhan"), customers),
    extensionRate:percent(completedVisits.filter((row) => Number(row.extensionCount || 0) > 0).length, completedVisits.length),
    attendanceRate:percent(attended.length, activeSchedules.length),
    drinkRate:percent(sum(sales, "drinkSales"), total), champagneRate:percent(sum(sales, "champagneSales"), total),
    target, targetRate:target > 0 ? percent(total, target) : null,
    series:buildSalesSeries(sales, "day", { period:"all" })
  };
}

export function buildCastRankings(data = {}, options = {}) {
  const sales = filterByPeriod(data.sales, options.period || "month", options.now || new Date());
  const casts = new Map(array(data.casts).map((row) => [String(row.id || row.castId || ""), row]));
  const groups = new Map();
  sales.forEach((row) => {
    const id = String(row.castId || ""); if (!id) return;
    const current = groups.get(id) || { id, name:String(row.castName || casts.get(id)?.name || "名称未設定"), sales:0, honmei:0, jounai:0, douhan:0, drink:0, champagne:0, customers:0 };
    current.sales += amount(row.total ?? row.sales); current.honmei += amount(row.honmeiCount ?? row.honmei); current.jounai += amount(row.jounaiCount ?? row.jounai); current.douhan += amount(row.douhanCount ?? row.douhan); current.drink += amount(row.drinkSales); current.champagne += amount(row.champagneSales); current.customers += amount(row.customerCount);
    groups.set(id, current);
  });
  return [...groups.values()].map((row) => ({ ...row, averageSpend:row.customers ? Math.round(row.sales / row.customers) : 0 })).sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name, "ja"));
}

export function buildCustomerAnalytics(data = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const customers = array(data.customers);
  const sales = filterByPeriod(data.sales, options.period || "all", now);
  const spend = new Map(); sales.forEach((row) => { const id = String(row.customerId || ""); if (id) spend.set(id, (spend.get(id) || 0) + amount(row.total ?? row.sales)); });
  const month = tokyoDateKey(now).slice(0, 7);
  const rows = customers.map((row) => ({ ...row, analyticsSpend:spend.get(String(row.id || row.customerId || "")) || amount(row.totalSpend), visitCount:amount(row.visitCount), intervalDays:visitIntervalDays(row) }));
  return {
    newCustomers:rows.filter((row) => String(row.firstVisit || "").startsWith(month)), repeaters:rows.filter((row) => row.visitCount >= 2),
    vip:rows.filter(isVip), ng:rows.filter((row) => row.isNg === true),
    averageVisitInterval:average(rows.map((row) => row.intervalDays).filter((value) => value > 0)),
    totalLtv:rows.reduce((total, row) => total + row.analyticsSpend, 0),
    averageLtv:rows.length ? Math.round(rows.reduce((total, row) => total + row.analyticsSpend, 0) / rows.length) : 0,
    visitRanking:[...rows].sort((a, b) => b.visitCount - a.visitCount).slice(0, 20),
    salesRanking:[...rows].sort((a, b) => b.analyticsSpend - a.analyticsSpend).slice(0, 20),
    birthdays:upcomingBirthdays(rows, now), bottleExpirations:upcomingBottleExpirations(rows, now)
  };
}

export function periodRange(period, now = new Date()) {
  const today = tokyoDateKey(now); const date = new Date(`${today}T12:00:00+09:00`);
  if (period === "today") return { start:today, end:today };
  if (period === "week") { const start = new Date(date); start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); const end = new Date(start); end.setDate(start.getDate() + 6); return { start:tokyoDateKey(start), end:tokyoDateKey(end) }; }
  if (period === "month") return { start:`${today.slice(0, 7)}-01`, end:`${today.slice(0, 7)}-31` };
  if (period === "year") return { start:`${today.slice(0, 4)}-01-01`, end:`${today.slice(0, 4)}-12-31` };
  return { start:"", end:"" };
}

export function tokyoDateKey(date = new Date()) { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(date); }
export function dateOf(row = {}) { return String(row.date || row.visitDate || row.reservationDate || row.workDate || "").slice(0, 10); }
export function percent(part, total) { return total > 0 ? Math.round(Number(part || 0) / Number(total) * 1000) / 10 : 0; }

function salesDimensionKey(row, dimension) {
  const date = dateOf(row);
  if (dimension === "hour") return `${String(row.visitTime || row.time || "20:00").slice(0, 2).padStart(2, "0")}:00`;
  if (dimension === "weekday") return String(date ? new Date(`${date}T12:00:00+09:00`).getDay() : "");
  if (dimension === "cast") return String(row.castName || "担当未設定");
  if (dimension === "nomination") return Number(row.honmeiCount || row.honmei) > 0 ? "本指名" : Number(row.jounaiCount || row.jounai) > 0 ? "場内" : Number(row.douhanCount || row.douhan) > 0 ? "同伴" : "指名なし";
  if (dimension === "champagne") return amount(row.champagneSales) > 0 ? "シャンパンあり" : "シャンパンなし";
  if (dimension === "bottle") return amount(row.bottleSales) > 0 ? "ボトルあり" : "ボトルなし";
  if (dimension === "month") return date.slice(0, 7);
  if (dimension === "year") return date.slice(0, 4);
  if (dimension === "week") { const d = new Date(`${date}T12:00:00+09:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return tokyoDateKey(d); }
  return date;
}
function salesDimensionLabel(key, dimension) { if (dimension === "weekday") return ["日", "月", "火", "水", "木", "金", "土"][Number(key)] || "未定"; if (dimension === "week") return `${key.slice(5).replace("-", "/")}週`; if (dimension === "day") return key.slice(5).replace("-", "/"); return key; }
function dimensionOrder(a, b, dimension) { if (dimension === "weekday") return (Number(a) + 6) % 7 - (Number(b) + 6) % 7; return String(a).localeCompare(String(b), "ja", { numeric:true }); }
function upcomingBirthdays(rows, now) { const today = tokyoDateKey(now); const year = today.slice(0, 4); return rows.map((row) => ({ ...row, nextBirthday:nextAnnualDate(row.birthday, year, today) })).filter((row) => row.nextBirthday && daysBetween(today, row.nextBirthday) <= 31).sort((a, b) => a.nextBirthday.localeCompare(b.nextBirthday)); }
function upcomingBottleExpirations(rows, now) { const today = tokyoDateKey(now); return rows.map((row) => ({ ...row, bottleExpiry:String(row.bottleExpiry || row.bottleExpiresAt || row.bottleInfo?.expiresAt || "").slice(0, 10) })).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.bottleExpiry) && row.bottleExpiry >= today && daysBetween(today, row.bottleExpiry) <= 60).sort((a, b) => a.bottleExpiry.localeCompare(b.bottleExpiry)); }
function nextAnnualDate(value, year, today) { const match = String(value || "").match(/(?:\d{4}-)?(\d{2})-(\d{2})$/); if (!match) return ""; const current = `${year}-${match[1]}-${match[2]}`; return current >= today ? current : `${Number(year) + 1}-${match[1]}-${match[2]}`; }
function visitIntervalDays(row) { if (!row.firstVisit || !row.lastVisit || Number(row.visitCount) < 2) return 0; return Math.round(daysBetween(String(row.firstVisit).slice(0, 10), String(row.lastVisit).slice(0, 10)) / (Number(row.visitCount) - 1)); }
function daysBetween(a, b) { return Math.max(0, Math.round((Date.parse(`${b}T12:00:00+09:00`) - Date.parse(`${a}T12:00:00+09:00`)) / 86400000)); }
function average(values) { return values.length ? Math.round(values.reduce((sumValue, value) => sumValue + value, 0) / values.length * 10) / 10 : 0; }
function scheduleCastId(row) { return String(row.castId || row.castID || row.castDocId || ""); }
function isVip(row) { return row.isVip === true || String(row.rank || "").toUpperCase() === "VIP"; }
function isCanceled(row) { return CANCEL_STATUSES.has(String(row.status || "").toLowerCase()) || CANCEL_STATUSES.has(String(row.status || "")); }
function visitBelongsToCast(row, castId) { return [row.castId, row.assignedCastId, ...(Array.isArray(row.castAssignments) ? row.castAssignments.map((item) => typeof item === "string" ? item : item.castId) : [])].map(String).includes(String(castId)); }
function castSalesTarget(casts, castId) { const rows = array(casts).filter((row) => !castId || String(row.id || row.castId || "") === String(castId)); return sumTargets(rows, ["monthlySalesTarget", "salesTarget", "targetSales"]); }
function sumTargets(rows, fields) { return array(rows).reduce((total, row) => total + positiveTarget(fields.map((field) => row[field]).find((value) => Number(value) > 0)), 0); }
function positiveTarget(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }
function goal(label, actual, target, format) { return { label, actual, target, format, rate:target > 0 ? percent(actual, target) : null }; }
function sum(rows, primary, fallback = "") { return array(rows).reduce((total, row) => total + amount(row[primary] ?? (fallback ? row[fallback] : 0)), 0); }
function positive(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
function amount(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }
function array(value) { return Array.isArray(value) ? value : []; }
