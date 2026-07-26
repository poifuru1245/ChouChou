import { commitDocumentBatch, serverTimestamp } from "../js/services/firestoreService.js";
import { createDataService } from "./dataService.js";
import { deleteStorageFile, uploadStorageFile } from "./storageService.js";

const gallery = createDataService({ collectionName:"gallery", searchableFields:["title", "category"], defaultSort:{ field:"displayOrder", direction:"asc" } });
export function subscribeGallery(onData, onError, options = {}) { return gallery.listen(onData, onError, options); }
export function listGallery(options = {}) { return gallery.list(options); }
export function createGalleryItem(input) { return gallery.create(input); }
export function updateGalleryItem(id, input) { return gallery.update(id, input); }
export function deleteGalleryItem(id) { return gallery.remove(id); }
export async function uploadGalleryImage(file) { return uploadStorageFile(`gallery/${Date.now()}_${file.name}`, file); }
export function deleteGalleryImage(path) { return deleteStorageFile(path); }
export function reorderGallery(ids) { return commitDocumentBatch(ids.map((id, index) => ({ type:"update", collection:"gallery", id, data:{ displayOrder:index + 1, updatedAt:serverTimestamp() } }))); }
