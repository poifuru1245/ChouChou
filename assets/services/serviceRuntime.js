import { normalizeServiceError } from "./errors.js";
import { logServiceEvent } from "./serviceLogger.js";

const pending = new Map();
const listeners = new Set();

/** Service Promiseの開始・終了・例外変換を統一し、UIへローディング状態を公開する。 */
export async function runServiceOperation(operation, action, context = {}) {
  const key = `${context.resource || "service"}:${operation}`;
  pending.set(key, (pending.get(key) || 0) + 1);
  publish();
  try {
    const value = await action();
    logServiceEvent("debug", `${operation}:success`, { resource:context.resource || "" });
    return value;
  } catch (error) {
    const normalized = normalizeServiceError(error, { ...context, operation });
    logServiceEvent("error", `${operation}:failure`, { resource:context.resource || "", code:normalized.code, errorName:normalized.name });
    throw normalized;
  } finally {
    const count = (pending.get(key) || 1) - 1;
    if (count > 0) pending.set(key, count); else pending.delete(key);
    publish();
  }
}

export function subscribeServiceActivity(listener) { listeners.add(listener); listener(getServiceActivity()); return () => listeners.delete(listener); }
export function getServiceActivity() { return Object.freeze({ busy:pending.size > 0, operations:Object.freeze([...pending.keys()]) }); }
function publish() { const state = getServiceActivity(); listeners.forEach((listener) => listener(state)); }
