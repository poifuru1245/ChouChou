import { createDataService } from "./dataService.js";
import { uploadStorageFile } from "./storageService.js";

const settings = createDataService({ collectionName:"settings" });
const content = createDataService({ collectionName:"content" });

export function getSiteSettings(options = {}) { return settings.get("site", options); }
export function subscribeSiteSettings(onData, onError) { return settings.listenOne("site", onData, onError); }
export function saveSiteSettings(input) { return settings.upsert("site", input); }
export async function uploadEventBanner(file) { return uploadStorageFile(`event-banners/${Date.now()}_${file.name}`, file); }
export function getRecruitContent(options = {}) { return content.get("recruit", options); }
export function subscribeRecruitContent(onData, onError) { return content.listenOne("recruit", onData, onError); }
export function saveRecruitContent(input) { return content.upsert("recruit", input); }
export async function uploadRecruitImage(file) { return uploadStorageFile(`recruit/${Date.now()}_${file.name}`, file); }
