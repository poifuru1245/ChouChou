import { addDocument, serverTimestamp } from "../js/services/firestoreService.js";
import { createDataService } from "./dataService.js";

const auditLogs = createDataService({
  collectionName:"auditLogs",
  searchableFields:["action", "actorEmail", "targetUid", "targetType"],
  defaultSort:{ field:"createdAt", direction:"desc" }
});

/** owner向け監査ログ一覧。書き込みはAdmin SDK Functionsだけに限定する。 */
export function listAuditLogs(options = {}) { return auditLogs.list(options); }
export function pageAuditLogs(options = {}) { return auditLogs.page(options); }
export function subscribeAuditLogs(onData, onError, options = {}) { return auditLogs.listen(onData, onError, options); }

const businessAuditLogs = createDataService({
  collectionName:"businessAuditLogs",
  searchableFields:["action", "actorName", "actorRole", "targetType", "targetId"],
  defaultSort:{ field:"createdAt", direction:"desc" }
});

export function subscribeBusinessAuditLogs(onData, onError, options = {}) { return businessAuditLogs.listen(onData, onError, options); }
export function listBusinessAuditLogs(options = {}) { return businessAuditLogs.list(options); }

// M1のauditLogsはAdmin SDK専用のため、Cloud Functionsを変更しないM4では業務監査を別の追記専用コレクションへ保存する。
export function recordBusinessAudit(action, targetType, targetId, detail = {}, actor = {}) {
  return addDocument("businessAuditLogs", createBusinessAuditPayload(action, targetType, targetId, detail, actor));
}

export function createBusinessAuditPayload(action, targetType, targetId, detail = {}, actor = {}) {
  return {
    action:String(action || "").slice(0, 80),
    targetType:String(targetType || "").slice(0, 50),
    targetId:String(targetId || "").slice(0, 120),
    actorUid:String(actor.uid || ""),
    actorName:String(actor.displayName || actor.email || "管理ユーザー").slice(0, 100),
    actorRole:String(actor.role || ""),
    detail:sanitizeDetail(detail),
    createdAt:serverTimestamp()
  };
}

function sanitizeDetail(detail) {
  return Object.fromEntries(Object.entries(detail || {}).slice(0, 30).map(([key, value]) => [String(key).slice(0, 60), ["string", "number", "boolean"].includes(typeof value) ? value : String(value ?? "").slice(0, 300)]));
}
