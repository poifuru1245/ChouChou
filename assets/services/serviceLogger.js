const listeners = new Set();

/** 個人情報を含むpayloadを記録せず、Serviceイベントのメタ情報だけを通知する。 */
export function logServiceEvent(level, event, context = {}) {
  const entry = Object.freeze({ level, event, context:{ ...context }, occurredAt:new Date() });
  listeners.forEach((listener) => listener(entry));
  if (level === "error") console.error(`[service] ${event}`, context.error || context);
  else if (level === "warn") console.warn(`[service] ${event}`, context);
  return entry;
}

export function subscribeServiceLogs(listener) { listeners.add(listener); return () => listeners.delete(listener); }
