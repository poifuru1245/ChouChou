import { commitDocumentBatch, serverTimestamp } from "../js/services/firestoreService.js";
import { createDataService } from "./dataService.js";
import { deleteStorageFile, uploadStorageFile } from "./storageService.js";

const news = createDataService({ collectionName:"news", searchableFields:["title", "body", "category"], defaultSort:{ field:"displayOrder", direction:"asc" } });
export function subscribeNews(onData, onError, options = {}) { return news.listen(onData, onError, options); }
export function listNews(options = {}) { return news.list(options); }
export function createNews(input) { return news.create(input); }
export function updateNews(id, input) { return news.update(id, input); }
export function deleteNews(id) { return news.remove(id); }
export async function uploadNewsImage(file) { return uploadStorageFile(`news/${Date.now()}_${file.name}`, file); }
export function deleteNewsImage(path) { return deleteStorageFile(path); }
export function reorderNews(ids) { return commitDocumentBatch(ids.map((id, index) => ({ type:"update", collection:"news", id, data:{ displayOrder:index + 1, updatedAt:serverTimestamp() } }))); }
