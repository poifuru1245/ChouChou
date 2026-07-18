const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const auth = getAuth();
const REGION = "asia-northeast1";
const ROLES = new Set(["owner", "manager", "staff", "cast"]);
const STATUSES = new Set(["active", "inactive"]);
const callableOptions = { region:REGION, timeoutSeconds:60, memory:"256MiB", enforceAppCheck:false };

exports.adminListUsers = onCall(callableOptions, async (request) => {
  const actor = await requireOwner(request);
  const authUsers = await listAllAuthUsers();
  const userSnapshot = await db.collection("users").get();
  const profiles = new Map(userSnapshot.docs.map((doc) => [doc.id, doc.data()]));
  const users = authUsers.map((record) => serializeUser(record, profiles.get(record.uid)));
  await writeAuditLog(actor, "users.list", "users", { count:users.length });
  return { users };
});

exports.adminCreateUser = onCall(callableOptions, async (request) => {
  const actor = await requireOwner(request);
  const input = validateCreateInput(request.data);
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email:input.email,
      password:input.password,
      displayName:input.displayName,
      disabled:input.status === "inactive",
      emailVerified:false
    });
    await saveUserAndCastLink({ uid:userRecord.uid, input, actorUid:actor.uid, isCreate:true });
    await writeAuditLog(actor, "user.create", userRecord.uid, safeAuditPayload(input));
    return { user:serializeUser(userRecord, { ...input, createdAt:new Date().toISOString() }) };
  } catch (error) {
    if (userRecord?.uid) await auth.deleteUser(userRecord.uid).catch((rollbackError) => logger.error("Auth user rollback failed", rollbackError));
    throw toHttpsError(error);
  }
});

exports.adminUpdateUser = onCall(callableOptions, async (request) => {
  const actor = await requireOwner(request);
  const input = validateUpdateInput(request.data);
  if (actor.uid === input.uid && (input.role !== "owner" || input.status !== "active")) throw new HttpsError("failed-precondition", "自分自身のowner権限または有効状態は変更できません。");
  try {
    await validateCastLink(input.uid, input);
    const record = await auth.updateUser(input.uid, { displayName:input.displayName, disabled:input.status === "inactive" });
    await saveUserAndCastLink({ uid:input.uid, input, actorUid:actor.uid, isCreate:false });
    await writeAuditLog(actor, "user.update", input.uid, safeAuditPayload(input));
    return { user:serializeUser(record, input) };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.adminDeactivateUser = onCall(callableOptions, async (request) => {
  const actor = await requireOwner(request);
  const uid = cleanText(request.data?.uid, 128);
  if (!uid) throw new HttpsError("invalid-argument", "ユーザーUIDが必要です。");
  if (uid === actor.uid) throw new HttpsError("failed-precondition", "自分自身を無効化できません。");
  try {
    await auth.updateUser(uid, { disabled:true });
    await db.collection("users").doc(uid).set({ status:"inactive", updatedAt:FieldValue.serverTimestamp(), updatedBy:actor.uid }, { merge:true });
    await writeAuditLog(actor, "user.deactivate", uid, {});
    return { uid, status:"inactive" };
  } catch (error) {
    throw toHttpsError(error);
  }
});

async function requireOwner(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "ログインが必要です。");
  const snapshot = await db.collection("users").doc(request.auth.uid).get();
  const profile = snapshot.data();
  if (!snapshot.exists || profile?.role !== "owner" || normalizeStatus(profile?.status) !== "active") throw new HttpsError("permission-denied", "オーナー権限が必要です。");
  return { uid:request.auth.uid, displayName:String(profile.displayName || request.auth.token.email || "owner"), role:"owner" };
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function saveUserAndCastLink({ uid, input, actorUid, isCreate }) {
  const userRef = db.collection("users").doc(uid);
  const previousLinks = await db.collection("casts").where("authUid", "==", uid).get();
  const batch = db.batch();
  previousLinks.docs.forEach((doc) => { if (doc.id !== input.castId) batch.update(doc.ref, { authUid:FieldValue.delete(), updatedAt:FieldValue.serverTimestamp() }); });

  if (input.role === "cast" && input.castId) {
    const castRef = db.collection("casts").doc(input.castId);
    const castSnapshot = await castRef.get();
    if (!castSnapshot.exists) throw new HttpsError("not-found", "選択したキャストが見つかりません。");
    const linkedUid = String(castSnapshot.data()?.authUid || "");
    if (linkedUid && linkedUid !== uid) throw new HttpsError("already-exists", "このキャストは別のユーザーと紐付いています。");
    batch.update(castRef, { authUid:uid, updatedAt:FieldValue.serverTimestamp() });
  }

  const userData = {
    uid,
    email:input.email,
    role:input.role,
    displayName:input.displayName,
    status:input.status,
    castId:input.role === "cast" ? input.castId : "",
    updatedAt:FieldValue.serverTimestamp(),
    updatedBy:actorUid
  };
  if (isCreate) { userData.createdAt = FieldValue.serverTimestamp(); userData.createdBy = actorUid; }
  batch.set(userRef, userData, { merge:true });
  await batch.commit();
}

async function validateCastLink(uid, input) {
  if (input.role !== "cast" || !input.castId) return;
  const snapshot = await db.collection("casts").doc(input.castId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "選択したキャストが見つかりません。");
  const linkedUid = String(snapshot.data()?.authUid || "");
  if (linkedUid && linkedUid !== uid) throw new HttpsError("already-exists", "このキャストは別のユーザーと紐付いています。");
}

function validateCreateInput(data = {}) {
  const input = validateCommonInput(data);
  const password = String(data.password || "");
  if (password.length < 8 || password.length > 128) throw new HttpsError("invalid-argument", "仮パスワードは8〜128文字で入力してください。");
  return { ...input, password };
}

function validateUpdateInput(data = {}) {
  const uid = cleanText(data.uid, 128);
  if (!uid) throw new HttpsError("invalid-argument", "ユーザーUIDが必要です。");
  return { ...validateCommonInput(data), uid };
}

function validateCommonInput(data = {}) {
  const displayName = cleanText(data.displayName, 80);
  const email = String(data.email || "").trim().toLowerCase();
  const role = String(data.role || "").trim().toLowerCase();
  const status = normalizeStatus(data.status);
  const castId = cleanText(data.castId, 128);
  if (!displayName) throw new HttpsError("invalid-argument", "氏名を入力してください。");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError("invalid-argument", "メールアドレスの形式をご確認ください。");
  if (!ROLES.has(role)) throw new HttpsError("invalid-argument", "ロールが正しくありません。");
  if (!STATUSES.has(status)) throw new HttpsError("invalid-argument", "状態が正しくありません。");
  return { displayName, email, role, status, castId:role === "cast" ? castId : "" };
}

function serializeUser(record, profile = {}) {
  return {
    uid:record.uid,
    email:record.email || profile.email || "",
    displayName:profile.displayName || record.displayName || "名称未設定",
    role:ROLES.has(profile.role) ? profile.role : "",
    status:normalizeStatus(profile.status || (record.disabled ? "inactive" : "active")),
    disabled:Boolean(record.disabled),
    castId:String(profile.castId || ""),
    lastSignInAt:record.metadata?.lastSignInTime ? new Date(record.metadata.lastSignInTime).toISOString() : "",
    createdAt:toIsoString(profile.createdAt) || (record.metadata?.creationTime ? new Date(record.metadata.creationTime).toISOString() : "")
  };
}

async function writeAuditLog(actor, action, targetUid, detail) {
  await db.collection("auditLogs").add({ actorUid:actor.uid, actorName:actor.displayName, actorRole:actor.role, action, targetUid, detail, createdAt:FieldValue.serverTimestamp() }).catch((error) => logger.error("Audit log write failed", error));
}

function safeAuditPayload(input) { return { displayName:input.displayName, email:input.email, role:input.role, status:input.status, castId:input.castId || "" }; }
function normalizeStatus(value) { return String(value || "active").toLowerCase() === "inactive" ? "inactive" : "active"; }
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function toIsoString(value) { if (typeof value?.toDate === "function") return value.toDate().toISOString(); const date = new Date(value || 0); return Number.isNaN(date.getTime()) || !value ? "" : date.toISOString(); }

function toHttpsError(error) {
  if (error instanceof HttpsError) return error;
  logger.error("User administration failed", error);
  const code = String(error?.code || "");
  if (code.includes("email-already-exists")) return new HttpsError("already-exists", "このメールアドレスは既に使用されています。");
  if (code.includes("user-not-found")) return new HttpsError("not-found", "対象ユーザーが見つかりません。");
  if (code.includes("invalid-password") || code.includes("invalid-email")) return new HttpsError("invalid-argument", "メールアドレスまたはパスワードが正しくありません。");
  return new HttpsError("internal", "ユーザー管理処理に失敗しました。");
}
