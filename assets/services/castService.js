import { createDataService } from "./dataService.js";
import { normalizeString } from "../utils/firestoreData.js";
import { commitDocumentBatch, updateDocument } from "../js/services/firestoreService.js";
import { deleteStorageFile, uploadStorageFile } from "./storageService.js";

export const CAST_COLLECTION = "casts";

export const castDataService = createDataService({
  collectionName:CAST_COLLECTION,
  normalize:normalizeCast,
  prepare:prepareCast,
  validate:validateCast,
  searchableFields:["name", "nameKana", "nickname", "instagram", "x", "line", "hobby"],
  defaultSort:compareCastsByDisplayOrder
});

export function subscribeCasts(onData, onError, options = {}) { return castDataService.listen(onData, onError, options); }
export function listCasts(options = {}) { return castDataService.list(options); }
export function pageCasts(options = {}) { return castDataService.page(options); }
export function getCast(id, options = {}) { return castDataService.get(id, options); }
export function subscribeCast(id, onData, onError) { return castDataService.listenOne(id, onData, onError); }
export function createCast(input) { return castDataService.create(input); }
export function updateCast(id, input) { return castDataService.update(id, input); }
export function deleteCast(id) { return castDataService.remove(id); }
export function patchCast(id, input) { return updateDocument(CAST_COLLECTION, id, input); }
export function reorderCasts(ids) { return commitDocumentBatch(ids.map((id, index) => ({ type:"update", collection:CAST_COLLECTION, id, data:{ displayOrder:index + 1 } }))); }
export function setCastPopularityRank(id, rank, casts = []) {
  return commitDocumentBatch(casts.flatMap((cast) => {
    if (cast.id === id) return [{ type:"update", collection:CAST_COLLECTION, id:cast.id, data:{ popularityRank:rank } }];
    return rank && Number(cast.popularityRank) === rank ? [{ type:"update", collection:CAST_COLLECTION, id:cast.id, data:{ popularityRank:null } }] : [];
  }));
}
export function setCastsPublished(ids, isPublished) { return commitDocumentBatch(ids.map((id) => ({ type:"update", collection:CAST_COLLECTION, id, data:{ isPublished } }))); }
export function deleteCasts(ids) { return commitDocumentBatch(ids.map((id) => ({ type:"delete", collection:CAST_COLLECTION, id }))); }
export async function uploadCastImage(file, slot = 0) { return uploadStorageFile(`casts/${Date.now()}_${slot}_${file.name.replace(/[^\w.-]/g, "_")}`, file); }
export function deleteCastImage(pathOrUrl) { return deleteStorageFile(pathOrUrl); }

export function normalizeCast(row = {}) {
  return {
    ...row,
    id:String(row.id || ""),
    name:normalizeString(row.name, 100),
    displayOrder:numericDisplayOrder(row.displayOrder),
    isPublished:row.isPublished !== false
  };
}

export function prepareCast(input = {}) {
  const cast = normalizeCast(input);
  const { id, createdAt, updatedAt, ...data } = cast;
  return { ...data, displayOrder:cast.displayOrder ?? 9999 };
}

export function validateCast(input = {}) { return normalizeString(input.name, 100) ? [] : ["キャスト名を入力してください。"]; }
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
