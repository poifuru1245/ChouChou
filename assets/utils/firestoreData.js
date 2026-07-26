// Firestore Timestampやネストした値を画面で安全に扱えるプレーンデータへ変換する。
export function toPlainFirestoreData(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(value);
  if (typeof value.toDate === "function") return value.toDate();
  if (Array.isArray(value)) return value.map(toPlainFirestoreData);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlainFirestoreData(item)]));
  return value;
}

export function compactFirestoreData(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function normalizeString(value, maxLength = 1000) { return String(value || "").trim().slice(0, maxLength); }
export function normalizeInteger(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? Math.trunc(number) : fallback; }
export function uniqueStringArray(value, limit = 100) { return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, limit); }
