import { db, storage } from "../firebase/firebaseClient.js";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { normalizeSalesRecord } from "./salesService.js";
import { normalizePayrollSettings } from "./payrollService.js";

const PROFILE_FIELDS = ["message", "hobby", "favoriteDrink", "instagram", "x", "line"];

export async function findCastForAuthenticatedUser(user) {
  if (!user?.uid) return null;
  const snapshot = await getDocs(query(collection(db, "casts"), where("authUid", "==", user.uid), limit(1)));
  if (snapshot.empty) return null;
  const result = snapshot.docs[0];
  return { id:result.id, ...result.data() };
}

export function subscribeCastPortalData({ user, cast }, onData, onError = console.error) {
  const state = {
    cast, sales:[], schedules:[], shiftRequests:[], rankings:[], payrollHistory:[],
    payrollSettings:normalizePayrollSettings(), announcements:[], announcementReads:[], loaded:{}
  };
  const announcementGroups = { all:[], targeted:[] };
  const unsubscribers = [];
  const publish = () => onData({ ...state, loaded:{ ...state.loaded } });
  const listen = (name, reference, transform = (rows) => rows) => {
    unsubscribers.push(onSnapshot(reference, (snapshot) => {
      const rows = "docs" in snapshot ? snapshot.docs.map((item) => ({ id:item.id, ...item.data() })) : (snapshot.exists() ? { id:snapshot.id, ...snapshot.data() } : null);
      state[name] = transform(rows);
      state.loaded[name] = true;
      publish();
    }, (error) => { state[name] = Array.isArray(state[name]) ? [] : state[name]; state.loaded[name] = true; onError(error, name); publish(); }));
  };

  listen("cast", doc(db, "casts", cast.id));
  listen("sales", query(collection(db, "sales"), where("castId", "==", cast.id)), (rows) => rows.map(normalizeSalesRecord));
  listen("schedules", query(collection(db, "schedules"), where("castId", "==", cast.id)));
  listen("shiftRequests", query(collection(db, "shiftRequests"), where("castId", "==", cast.id)));
  listen("rankings", query(collection(db, "castRankings"), where("castId", "==", cast.id)));
  listen("payrollHistory", query(collection(db, "payrollHistory"), where("castId", "==", cast.id)));
  listen("payrollSettings", doc(db, "payrollSettings", "default"), (data) => normalizePayrollSettings(data));
  listen("announcementReads", collection(db, "castPortalUsers", user.uid, "announcementReads"));

  const listenAnnouncements = (key, reference) => unsubscribers.push(onSnapshot(reference, (snapshot) => {
    announcementGroups[key] = snapshot.docs.map((item) => ({ id:item.id, ...item.data() }));
    state.announcements = mergeAnnouncements(announcementGroups.all, announcementGroups.targeted);
    state.loaded[`announcements-${key}`] = true;
    publish();
  }, (error) => { announcementGroups[key] = []; state.loaded[`announcements-${key}`] = true; onError(error, `announcements-${key}`); publish(); }));
  listenAnnouncements("all", query(collection(db, "castAnnouncements"), where("audience", "==", "all")));
  listenAnnouncements("targeted", query(collection(db, "castAnnouncements"), where("castIds", "array-contains", cast.id)));

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
}

export function submitShiftRequest({ user, castId, date, start, end, memo }) {
  return addDoc(collection(db, "shiftRequests"), {
    uid:user.uid,
    castId,
    date:String(date || "").slice(0, 10),
    start:String(start || ""),
    end:String(end || ""),
    memo:String(memo || "").trim().slice(0, 300),
    status:"pending",
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
}

export function markAnnouncementRead(user, announcementId) {
  return setDoc(doc(db, "castPortalUsers", user.uid, "announcementReads", announcementId), {
    announcementId,
    readAt:serverTimestamp()
  }, { merge:true });
}

export async function updateOwnCastProfile({ castId, user, profile }) {
  const payload = { profileUpdatedBy:user.uid, profileUpdatedAt:serverTimestamp() };
  PROFILE_FIELDS.forEach((field) => { payload[field] = String(profile[field] || "").trim(); });
  await updateDoc(doc(db, "casts", castId), payload);
}

export async function uploadOwnProfilePhoto({ castId, user, file }) {
  if (!(file instanceof File) || !file.type.startsWith("image/")) throw new Error("画像ファイルを選択してください。");
  if (file.size > 8 * 1024 * 1024) throw new Error("画像は8MB以内で選択してください。");
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storageRef = ref(storage, `cast-profiles/${user.uid}/profile-${Date.now()}.${extension}`);
  await uploadBytes(storageRef, file, { contentType:file.type, customMetadata:{ castId } });
  const image = await getDownloadURL(storageRef);
  await updateDoc(doc(db, "casts", castId), {
    image,
    images:arrayUnion(image),
    profileUpdatedBy:user.uid,
    profileUpdatedAt:serverTimestamp()
  });
  return image;
}

function mergeAnnouncements(...groups) {
  const unique = new Map();
  groups.flat().forEach((item) => unique.set(item.id, item));
  const now = Date.now();
  return [...unique.values()].filter((item) => item.isPublished !== false && (!toMillis(item.publishStart) || toMillis(item.publishStart) <= now) && (!toMillis(item.publishEnd) || toMillis(item.publishEnd) >= now)).sort((a, b) => toMillis(b.publishStart || b.createdAt) - toMillis(a.publishStart || a.createdAt));
}

function toMillis(value) { if (typeof value?.toMillis === "function") return value.toMillis(); if (typeof value?.toDate === "function") return value.toDate().getTime(); return Date.parse(value) || Number(value) || 0; }
