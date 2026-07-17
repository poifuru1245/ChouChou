import { db } from "./app.js";
import {
  collection,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TOKYO_TIME_ZONE = "Asia/Tokyo";

export function subscribeCollection(name, onData, onError = console.error) {
  return onSnapshot(collection(db, name), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export function subscribeDocument(collectionName, documentId, onData, onError = console.error) {
  return onSnapshot(doc(db, collectionName, documentId), (snapshot) => {
    onData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export function getTokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export async function optimizeImage(file, options = {}) {
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください。");
  }

  const maxWidth = Number(options.maxWidth) || 1800;
  const maxHeight = Number(options.maxHeight) || 1800;
  const quality = Number(options.quality) || 0.84;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const outputType = file.type === "image/png" ? "image/webp" : "image/jpeg";
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("画像圧縮に失敗しました。")), outputType, quality);
  });
  const extension = outputType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^\w-]/g, "_") || "image";
  return new File([blob], `${baseName}.${extension}`, { type: outputType, lastModified: Date.now() });
}

function setupAdminNavigation() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || sidebar.querySelector(".admin-menu-toggle")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-menu-toggle";
  button.textContent = "管理メニュー";
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => {
    const open = sidebar.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(open));
  });
  sidebar.insertBefore(button, sidebar.children[1] || null);
}

function setupImagePreviews() {
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.accept.includes("image")) return;
    const previewId = input.dataset.previewTarget;
    if (!previewId || !input.files?.[0]) return;
    const preview = document.getElementById(previewId);
    if (!(preview instanceof HTMLImageElement)) return;
    preview.src = URL.createObjectURL(input.files[0]);
    preview.hidden = false;
  });
}

function setupDashboard() {
  const grid = document.getElementById("dashboardStats");
  if (!grid) return;

  const state = { casts: [], schedules: [], news: [], gallery: [], recruit: null };
  const render = () => {
    const today = getTokyoDateKey();
    const publishedCasts = state.casts.filter((item) => item.isPublished !== false);
    const workingIds = new Set(state.schedules.filter((item) => {
      const date = String(item.date || item.dateKey || "").slice(0, 10);
      const isOff = item.isOff === true || item.status === "off" || item.start === "__OFF__";
      return date === today && !isOff && Boolean(item.start || item.time || item.startTime);
    }).map((item) => item.castId || item.castName));

    setDashboardValue("todayAttendanceCount", `${workingIds.size}名`);
    setDashboardValue("castCount", `${publishedCasts.length}名`);
    setDashboardValue("newsCount", `${state.news.length}件`);
    setDashboardValue("galleryCount", `${state.gallery.length}枚`);
    setDashboardValue("recruitStatus", state.recruit?.isPublished === false ? "非公開" : "公開中");

    const list = document.getElementById("dashboardTodayList");
    if (list) {
      const names = state.schedules.filter((item) => String(item.date || item.dateKey || "").slice(0, 10) === today)
        .filter((item) => item.isOff !== true && item.status !== "off" && item.start !== "__OFF__")
        .map((item) => item.castName || state.casts.find((cast) => cast.id === item.castId)?.name)
        .filter(Boolean);
      list.innerHTML = names.length ? names.map((name) => `<li>${escapeHtml(name)}</li>`).join("") : "<li>本日の出勤登録はありません。</li>";
    }
  };

  subscribeCollection("casts", (items) => { state.casts = items; render(); });
  subscribeCollection("schedules", (items) => { state.schedules = items; render(); });
  subscribeCollection("news", (items) => { state.news = items; render(); });
  subscribeCollection("gallery", (items) => { state.gallery = items; render(); });
  subscribeDocument("content", "recruit", (item) => { state.recruit = item; render(); });
}

function setDashboardValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

setupAdminNavigation();
setupImagePreviews();
setupDashboard();
