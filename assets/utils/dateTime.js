export const TOKYO_TIME_ZONE = "Asia/Tokyo";

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toMillis(value) { return toDate(value)?.getTime() || 0; }

export function tokyoDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone:TOKYO_TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit" }).format(toDate(value) || new Date());
}

export function normalizeDateKey(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function normalizeTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  return match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}` : "";
}

export function formatJapaneseDate(value, fallback = "未登録") {
  const key = normalizeDateKey(value);
  if (!key) return fallback;
  return new Intl.DateTimeFormat("ja-JP", { year:"numeric", month:"numeric", day:"numeric" }).format(new Date(`${key}T00:00:00+09:00`));
}
