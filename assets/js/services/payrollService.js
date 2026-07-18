import {
  serverTimestamp,
  setDocument,
  subscribeDocument
} from "./firestoreService.js";

export const PAYROLL_SETTINGS_DOCUMENT = "default";
export const DEFAULT_PAYROLL_SETTINGS = Object.freeze({
  baseHourlyRate:0,
  honmeiBack:0,
  jounaiBack:0,
  douhanBack:0,
  drinkBack:0,
  bottleBack:0,
  champagneBack:0,
  otherBack:0,
  transportation:0,
  deductions:[]
});

// 出勤管理の「LAST」は翌日1:00として給与計算する。
const LAST_MINUTES = 25 * 60;
const PERCENT_SETTING_KEYS = new Set(["drinkBack", "bottleBack", "champagneBack", "otherBack"]);

export function subscribePayrollSettings(onData, onError) {
  return subscribeDocument("payrollSettings", PAYROLL_SETTINGS_DOCUMENT, (data) => onData(normalizePayrollSettings(data)), onError);
}

export function savePayrollSettings(settings) {
  return setDocument("payrollSettings", PAYROLL_SETTINGS_DOCUMENT, {
    ...normalizePayrollSettings(settings),
    updatedAt:serverTimestamp()
  }, { merge:true });
}

export function normalizePayrollSettings(settings = {}) {
  const normalized = { ...DEFAULT_PAYROLL_SETTINGS };
  Object.keys(DEFAULT_PAYROLL_SETTINGS).filter((key) => key !== "deductions").forEach((key) => {
    const value = toNonNegativeNumber(settings?.[key]);
    normalized[key] = PERCENT_SETTING_KEYS.has(key) ? Math.min(100, value) : value;
  });
  normalized.deductions = Array.isArray(settings?.deductions)
    ? settings.deductions.map(normalizeDeduction).filter((item) => item.name && item.value >= 0)
    : [];
  return normalized;
}

export function calculateMonthlyPayroll({ month, sales = [], schedules = [], casts = [], settings = DEFAULT_PAYROLL_SETTINGS }) {
  // 保存データは加工せず、PDFやCSVへ流用できる月次明細オブジェクトを生成する。
  const normalizedSettings = normalizePayrollSettings(settings);
  const monthSales = sales.filter((item) => String(item.date || "").startsWith(month));
  const monthSchedules = schedules.filter((item) => getScheduleDate(item).startsWith(month) && !isInactiveSchedule(item));
  const castIds = new Set([
    ...monthSales.map((item) => String(item.castId || "")),
    ...monthSchedules.map((item) => getScheduleCastId(item))
  ]);
  castIds.delete("");

  return [...castIds].map((castId) => {
    const cast = casts.find((item) => item.id === castId);
    const castSales = monthSales.filter((item) => String(item.castId || "") === castId && item.attendance !== false);
    const castSchedules = monthSchedules.filter((item) => getScheduleCastId(item) === castId);
    const workDates = new Set([...castSales.map((item) => item.date), ...castSchedules.map(getScheduleDate)]);
    const scheduleMinutes = castSchedules.map(getScheduleMinutes);
    const workMinutes = scheduleMinutes.reduce((total, item) => total + item.minutes, 0);
    const unresolvedScheduleCount = scheduleMinutes.filter((item) => !item.resolved).length;
    const salesTotal = sum(castSales, "sales");
    const basePay = roundCurrency((workMinutes / 60) * normalizedSettings.baseHourlyRate);
    const backs = {
      honmei:roundCurrency(sum(castSales, "honmeiCount") * normalizedSettings.honmeiBack),
      jounai:roundCurrency(sum(castSales, "jounaiCount") * normalizedSettings.jounaiBack),
      douhan:roundCurrency(sum(castSales, "douhanCount") * normalizedSettings.douhanBack),
      drink:roundCurrency(sum(castSales, "drinkSales") * normalizedSettings.drinkBack / 100),
      bottle:roundCurrency(sum(castSales, "bottleSales") * normalizedSettings.bottleBack / 100),
      champagne:roundCurrency(sum(castSales, "champagneSales") * normalizedSettings.champagneBack / 100),
      other:roundCurrency(sum(castSales, "otherSales") * normalizedSettings.otherBack / 100)
    };
    const backTotal = Object.values(backs).reduce((total, value) => total + value, 0);
    const transportation = roundCurrency(workDates.size * normalizedSettings.transportation);
    const grossPay = basePay + backTotal + transportation;
    const deductions = normalizedSettings.deductions.map((item) => ({
      ...item,
      amount:item.type === "percent" ? roundCurrency(grossPay * item.value / 100) : roundCurrency(item.value)
    }));
    const deductionTotal = deductions.reduce((total, item) => total + item.amount, 0);

    return {
      castId,
      castName:String(cast?.name || castSales[0]?.castName || castSchedules[0]?.castName || "名称未設定"),
      month,
      workDays:workDates.size,
      workMinutes,
      workHours:roundHours(workMinutes / 60),
      unresolvedScheduleCount,
      salesTotal,
      customerCount:sum(castSales, "customerCount"),
      basePay,
      backs,
      backTotal,
      transportation,
      grossPay,
      deductions,
      deductionTotal,
      netPay:Math.max(0, grossPay - deductionTotal),
      salesRecords:castSales,
      scheduleRecords:castSchedules
    };
  }).sort((a, b) => b.netPay - a.netPay || a.castName.localeCompare(b.castName, "ja"));
}

function normalizeDeduction(item = {}) {
  const type = item.type === "percent" ? "percent" : "fixed";
  return {
    name:String(item.name || "").trim().slice(0, 50),
    type,
    value:type === "percent" ? Math.min(100, toNonNegativeNumber(item.value)) : toNonNegativeNumber(item.value)
  };
}

function getScheduleMinutes(schedule) {
  const { start, end } = getScheduleTimes(schedule);
  const startMinutes = parseMinutes(start);
  const endMinutes = parseMinutes(end, true);
  if (startMinutes === null || endMinutes === null) return { minutes:0, resolved:false };
  const normalizedEnd = endMinutes <= startMinutes ? endMinutes + 24 * 60 : endMinutes;
  return { minutes:Math.max(0, normalizedEnd - startMinutes), resolved:true };
}

function getScheduleTimes(schedule) {
  const start = String(schedule.start || schedule.startTime || "").trim();
  const end = String(schedule.end || schedule.endTime || "").trim();
  if (start || end) return { start, end };
  const match = String(schedule.time || schedule.schedule || "").match(/^(.+?)[〜~\-](.+)$/);
  return match ? { start:match[1].trim(), end:match[2].trim() } : { start:"", end:"" };
}

function parseMinutes(value, allowLast = false) {
  const text = String(value || "").trim().toUpperCase();
  if (allowLast && text === "LAST") return LAST_MINUTES;
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 47 && minute <= 59 ? hour * 60 + minute : null;
}

function getScheduleDate(item) { return String(item.date || item.dateKey || item.workDate || "").slice(0, 10); }
function getScheduleCastId(item) { return String(item.castId || item.castID || item.castDocId || item.castName || ""); }
function isInactiveSchedule(item) { const status = String(item.status || item.attendanceStatus || "").toLowerCase(); return item.isOff === true || item.off === true || item.start === "__OFF__" || ["休み", "欠勤", "off", "cancel", "canceled", "cancelled"].includes(status); }
function sum(rows, field) { return rows.reduce((total, item) => total + toNonNegativeNumber(item[field]), 0); }
function toNonNegativeNumber(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; }
function roundCurrency(value) { return Math.round(toNonNegativeNumber(value)); }
function roundHours(value) { return Math.round(toNonNegativeNumber(value) * 100) / 100; }
