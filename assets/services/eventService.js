import { createDataService } from "./dataService.js";
import { uploadStorageFile } from "./storageService.js";

const events = createDataService({ collectionName:"events", searchableFields:["title", "description"], defaultSort:{ field:"createdAt", direction:"desc" } });
export function subscribeEvents(onData, onError, options = {}) { return events.listen(onData, onError, options); }
export function listEvents(options = {}) { return events.list(options); }
export function createEvent(input) { return events.create(input); }
export function updateEvent(id, input) { return events.update(id, input); }
export function deleteEvent(id) { return events.remove(id); }
export async function uploadEventImage(file) { return uploadStorageFile(`events/${Date.now()}_${file.name}`, file); }
