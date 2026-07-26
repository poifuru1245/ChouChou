import { storage } from "../js/firebase/firebaseClient.js";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { ServiceError, ValidationError } from "./errors.js";
import { runServiceOperation } from "./serviceRuntime.js";

// Storage SDKを画面から隠蔽し、アップロードと削除の例外を共通化する。
export async function uploadStorageFile(path, file) {
  if (!path || !file) throw new ValidationError("アップロード対象が指定されていません。", { code:"storage/file-required", resource:path });
  return runServiceOperation("upload", async () => {
    const target = ref(storage, path);
    await uploadBytes(target, file, { contentType:file.type || "application/octet-stream" });
    return { path, url:await getDownloadURL(target) };
  }, { resource:path });
}

export async function deleteStorageFile(pathOrUrl) {
  if (!pathOrUrl) return;
  return runServiceOperation("delete", async () => {
    try { await deleteObject(ref(storage, pathOrUrl)); }
    catch (error) { if (error?.code !== "storage/object-not-found") throw error; }
  }, { resource:pathOrUrl });
}

/** @deprecated 新規コードは共通ServiceError派生型を利用する。 */
export class StorageServiceError extends ServiceError {
  constructor(message, cause) { super(message, { cause }); this.name = "StorageServiceError"; this.code = cause?.code || "storage/unknown"; }
}
