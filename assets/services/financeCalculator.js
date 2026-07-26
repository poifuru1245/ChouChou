export const SALE_CHARGE_FIELDS = Object.freeze([
  "setFee", "allYouCanDrinkSales", "extensionSales", "drinkSales", "bottleSales",
  "champagneSales", "foodSales", "otherSales"
]);
export const PAYMENT_FIELDS = Object.freeze(["cashPayment", "cardPayment", "qrPayment", "accountsReceivable"]);

/** 売上明細の金額を再計算する。保存済みの合計値は信用せず、常に内訳を正とする。 */
export function calculateSaleTotals(input = {}) {
  const grossItems = SALE_CHARGE_FIELDS.reduce((total, field) => total + money(input[field]), 0);
  const discount = Math.min(grossItems, money(input.discount));
  const subtotal = grossItems - discount;
  const serviceRate = rate(input.serviceRate, 20);
  const taxRate = rate(input.taxRate, 10);
  const serviceCharge = round(subtotal * serviceRate / 100);
  const taxableAmount = subtotal + serviceCharge;
  const taxAmount = round(taxableAmount * taxRate / 100);
  const total = taxableAmount + taxAmount;
  const payments = Object.fromEntries(PAYMENT_FIELDS.map((field) => [field, money(input[field])]));
  const paymentTotal = Object.values(payments).reduce((sum, value) => sum + value, 0);
  return { grossItems, discount, subtotal, serviceRate, serviceCharge, taxableAmount, taxRate, taxAmount, total, paymentTotal, paymentDifference:paymentTotal - total, ...payments };
}

export function validateSaleCalculation(input = {}) {
  const totals = calculateSaleTotals(input);
  const errors = [];
  [...SALE_CHARGE_FIELDS, "discount", ...PAYMENT_FIELDS].forEach((field) => {
    if (!Number.isFinite(Number(input[field] ?? 0)) || Number(input[field] ?? 0) < 0) errors.push(`${field}は0以上の数値で入力してください。`);
  });
  if (totals.paymentDifference !== 0) errors.push(`支払方法の合計を請求額と一致させてください（差額 ${totals.paymentDifference}円）。`);
  return errors;
}

export function summarizeSales(rows = []) {
  const summary = { salesCount:rows.length, total:sum(rows, "total", "sales"), customerCount:sum(rows, "customerCount"), honmeiCount:sum(rows, "honmeiCount"), jounaiCount:sum(rows, "jounaiCount"), douhanCount:sum(rows, "douhanCount") };
  PAYMENT_FIELDS.forEach((field) => { summary[field] = sum(rows, field); });
  summary.averageSpend = summary.customerCount ? Math.round(summary.total / summary.customerCount) : 0;
  return summary;
}

export function assertPeriodOpen(dailyClosing, monthlyClosing) {
  if (dailyClosing?.status === "closed" || monthlyClosing?.status === "closed") throw new Error("period-closed");
  return true;
}

export const DEFAULT_COMMISSION_RULES = Object.freeze({
  baseHourlyRate:0, honmeiBack:0, jounaiBack:0, douhanBack:0,
  drinkBack:0, bottleBack:0, champagneBack:0, salesCommissionRate:0,
  attendanceBonus:0, transportation:0, deductions:[]
});

/** 出勤・売上・バックルール・個別調整から1名分の給与明細を生成する。 */
export function calculatePayrollStatement({ castId, castName = "", month, sales = [], schedules = [], rules = {}, adjustments = {} }) {
  const normalizedRules = normalizeCommissionRules(rules);
  const castSales = sales.filter((row) => String(row.castId || "") === String(castId || "") && String(row.date || "").startsWith(month) && row.attendance !== false);
  const castSchedules = schedules.filter((row) => scheduleCastId(row) === String(castId || "") && scheduleDate(row).startsWith(month) && !inactiveSchedule(row));
  const workDates = new Set([...castSales.map((row) => String(row.date || "")), ...castSchedules.map(scheduleDate)].filter(Boolean));
  const scheduleMinutes = castSchedules.map(getScheduleMinutes);
  const workMinutes = scheduleMinutes.reduce((sum, row) => sum + row.minutes, 0);
  const unresolvedScheduleCount = scheduleMinutes.filter((row) => !row.resolved).length;
  const salesTotal = sum(castSales, "total", "sales");
  const basePay = round(workMinutes / 60 * normalizedRules.baseHourlyRate);
  const backs = {
    honmei:round(sum(castSales, "honmeiCount") * normalizedRules.honmeiBack),
    jounai:round(sum(castSales, "jounaiCount") * normalizedRules.jounaiBack),
    douhan:round(sum(castSales, "douhanCount") * normalizedRules.douhanBack),
    drink:round(sum(castSales, "drinkSales") * normalizedRules.drinkBack / 100),
    bottle:round(sum(castSales, "bottleSales") * normalizedRules.bottleBack / 100),
    champagne:round(sum(castSales, "champagneSales") * normalizedRules.champagneBack / 100),
    salesCommission:round(salesTotal * normalizedRules.salesCommissionRate / 100)
  };
  const backTotal = Object.values(backs).reduce((sumValue, value) => sumValue + value, 0);
  const transportation = round(workDates.size * normalizedRules.transportation);
  const attendanceBonus = money(adjustments.attendanceBonus ?? (unresolvedScheduleCount === 0 && workDates.size > 0 ? normalizedRules.attendanceBonus : 0));
  const specialAllowance = money(adjustments.specialAllowance);
  const grossPay = basePay + backTotal + transportation + attendanceBonus + specialAllowance;
  const standardDeductions = normalizedRules.deductions.map((item) => ({ ...item, amount:item.type === "percent" ? round(grossPay * item.value / 100) : money(item.value) }));
  const penalty = money(adjustments.penalty);
  const advance = money(adjustments.advance);
  const withholding = money(adjustments.withholding);
  const otherDeduction = money(adjustments.otherDeduction);
  const deductionTotal = standardDeductions.reduce((sumValue, item) => sumValue + item.amount, 0) + penalty + advance + withholding + otherDeduction;
  return {
    castId:String(castId || ""), castName:String(castName || castSales[0]?.castName || "名称未設定"), month,
    workDays:workDates.size, workMinutes, workHours:Math.round(workMinutes / 60 * 100) / 100, unresolvedScheduleCount,
    salesTotal, customerCount:sum(castSales, "customerCount"), basePay, backs, backTotal, transportation,
    attendanceBonus, specialAllowance, grossPay, deductions:standardDeductions, penalty, advance, withholding,
    otherDeduction, deductionTotal, netPay:Math.max(0, grossPay - deductionTotal), salesRecordIds:castSales.map((row) => row.id).filter(Boolean)
  };
}

export function calculateMonthlyPayroll(input = {}) {
  const month = String(input.month || "");
  const castIds = new Set([
    ...input.sales.filter((row) => String(row.date || "").startsWith(month)).map((row) => String(row.castId || "")),
    ...input.schedules.filter((row) => scheduleDate(row).startsWith(month)).map(scheduleCastId),
    ...(input.payrolls || []).filter((row) => row.month === month).map((row) => String(row.castId || ""))
  ]);
  castIds.delete("");
  return [...castIds].map((castId) => {
    const cast = input.casts.find((row) => row.id === castId);
    const saved = (input.payrolls || []).find((row) => row.month === month && row.castId === castId) || {};
    return calculatePayrollStatement({ castId, castName:cast?.name || saved.castName, month, sales:input.sales, schedules:input.schedules, rules:input.rules || input.settings, adjustments:saved });
  }).sort((a, b) => b.netPay - a.netPay || a.castName.localeCompare(b.castName, "ja"));
}

export function normalizeCommissionRules(input = {}) {
  const output = { ...DEFAULT_COMMISSION_RULES };
  const percentageFields = new Set(["drinkBack", "bottleBack", "champagneBack", "salesCommissionRate"]);
  Object.keys(output).filter((key) => key !== "deductions").forEach((key) => { output[key] = percentageFields.has(key) ? rate(input[key], 0) : money(input[key]); });
  output.deductions = Array.isArray(input.deductions) ? input.deductions.map((row) => ({ name:String(row.name || "").trim().slice(0, 50), type:row.type === "percent" ? "percent" : "fixed", value:row.type === "percent" ? rate(row.value, 0) : money(row.value) })).filter((row) => row.name) : [];
  return output;
}

function getScheduleMinutes(row) { const start = parseMinutes(row.start || row.startTime); const end = parseMinutes(row.end || row.endTime, true); if (start === null || end === null) return { minutes:0, resolved:false }; return { minutes:Math.max(0, (end <= start ? end + 1440 : end) - start), resolved:true }; }
function parseMinutes(value, allowLast = false) { const text = String(value || "").trim().toUpperCase(); if (allowLast && text === "LAST") return 1500; const match = text.match(/^(\d{1,2}):(\d{2})$/); return match && Number(match[2]) < 60 ? Number(match[1]) * 60 + Number(match[2]) : null; }
function scheduleDate(row) { return String(row.date || row.dateKey || row.workDate || "").slice(0, 10); }
function scheduleCastId(row) { return String(row.castId || row.castID || row.castDocId || ""); }
function inactiveSchedule(row) { const status = String(row.status || "").toLowerCase(); return row.isOff === true || row.start === "__OFF__" || ["休み", "欠勤", "off", "cancel", "canceled"].includes(status); }
function sum(rows, primary, fallback = "") { return rows.reduce((total, row) => total + money(row[primary] ?? (fallback ? row[fallback] : 0)), 0); }
function money(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0; }
function rate(value, fallback) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.min(100, number) : fallback; }
function round(value) { return Math.round(Number(value) || 0); }
