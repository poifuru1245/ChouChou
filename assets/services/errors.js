/** Service層からUIへ公開する共通エラー基底型。 */
export class ServiceError extends Error {
  constructor(message, options = {}) {
    super(message, { cause:options.cause });
    this.name = new.target.name;
    this.code = options.code || "service/unknown";
    this.resource = options.resource || options.collection || "";
    this.operation = options.operation || "";
    this.details = options.details || null;
  }
}

export class PermissionDeniedError extends ServiceError {}
export class ValidationError extends ServiceError {}
export class NotFoundError extends ServiceError {}
export class ConflictError extends ServiceError {}
export class NetworkError extends ServiceError {}

/** Firebase等の下位例外を、画面が扱える共通エラーへ変換する。 */
export function normalizeServiceError(error, context = {}) {
  if (error instanceof ServiceError) return error;
  const rawCode = String(error?.code || "service/unknown");
  const code = rawCode.replace(/^(firestore|storage|auth|functions)\//, "");
  const options = { ...context, cause:error, code:rawCode };
  if (["permission-denied", "unauthorized"].includes(code)) return new PermissionDeniedError("この操作を行う権限がありません。", options);
  if (["invalid-argument", "failed-precondition"].includes(code)) return new ValidationError(error?.message || "入力内容を確認してください。", options);
  if (["not-found", "object-not-found", "user-not-found"].includes(code)) return new NotFoundError("対象データが見つかりません。", options);
  if (["already-exists", "aborted"].includes(code)) return new ConflictError("他の更新と競合しました。再読み込みしてお試しください。", options);
  if (["unavailable", "deadline-exceeded", "network-request-failed", "retry-limit-exceeded"].includes(code)) return new NetworkError("通信できませんでした。接続を確認して再度お試しください。", options);
  return new ServiceError(error?.message || "データ処理に失敗しました。", options);
}
