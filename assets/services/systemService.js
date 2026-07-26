import { commitDocumentBatch } from "../js/services/firestoreService.js";
import { createDataService } from "./dataService.js";

const items = createDataService({ collectionName:"systemItems", defaultSort:{ field:"displayOrder", direction:"asc" } });
export function subscribeSystemItems(onData, onError) { return items.listen(onData, onError); }
export function createSystemItem(input) { return items.create(input); }
export function updateSystemItem(id, input) { return items.update(id, input); }
export function deleteSystemItem(id) { return items.remove(id); }
export function reorderSystemItems(ids) { return commitDocumentBatch(ids.map((id, index) => ({ type:"update", collection:"systemItems", id, data:{ displayOrder:index + 1 } }))); }
