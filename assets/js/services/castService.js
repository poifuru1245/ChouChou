export function sortCastsByDisplayOrder(casts = []) { return casts.sort(compareCastsByDisplayOrder); }
export function compareCastsByDisplayOrder(a, b) {
  const aOrder = numericDisplayOrder(a?.displayOrder); const bOrder = numericDisplayOrder(b?.displayOrder);
  if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
  if (aOrder !== null) return -1; if (bOrder !== null) return 1;
  return String(a?.name || "").localeCompare(String(b?.name || ""), "ja");
}
export function numericDisplayOrder(value) { if (value === undefined || value === null || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
export function getCastImages(cast, limit = 5) {
  const candidates = [cast?.image,cast?.imageUrl,cast?.mainImage,cast?.photo,cast?.photoUrl,cast?.profileImage,cast?.galleryImages,cast?.images,cast?.photos,cast?.imageUrls].flatMap(normalizeImageValue);
  return [...new Set(candidates.map((value) => String(value).trim()).filter(Boolean))].slice(0, limit);
}
export function getMainCastImage(cast) { return getCastImages(cast, 1)[0] || ""; }
export function getCastTags(cast, limit = 20) { const value = cast?.tags; const tags = Array.isArray(value) ? value : String(value || "").split(","); return tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, limit); }
export function isEnabledFlag(value) { return value === true || value === "true" || value === 1 || value === "1" || value === "on" || value === "yes"; }
function normalizeImageValue(value) {
  if (Array.isArray(value)) return value; if (!value) return []; if (typeof value !== "string") return [value];
  const text = value.trim(); if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) { try { const parsed = JSON.parse(text); return Array.isArray(parsed) ? parsed : [text]; } catch { return [text]; } }
  return text.includes(",") ? text.split(",").map((item) => item.trim()) : [text];
}
