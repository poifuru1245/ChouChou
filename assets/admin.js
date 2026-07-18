import { subscribeCollection, subscribeDocument } from "./js/services/firestoreService.js";
import { escapeHtml } from "./js/utils/dom.js";
import { bootstrapPage } from "./js/pages/bootstrapPage.js";

const TOKYO_TIME_ZONE = "Asia/Tokyo";

export { subscribeCollection, subscribeDocument };

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

  const outputType = "image/webp";
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("画像圧縮に失敗しました。")), outputType, quality);
  });
  const extension = "webp";
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
  if (!grid || document.body.classList.contains("owner-dashboard-page")) return;

  const state = { casts: [], schedules: [], news: [], gallery: [], events: [], reservations: [] };
  const render = () => {
    const today = getTokyoDateKey();
    const todaySchedules = state.schedules
      .filter((item) => getScheduleDateKey(item) === today)
      .filter((item) => !isInactiveSchedule(item));
    const attendance = classifyTodayAttendance(todaySchedules);
    const publishedNews = state.news.filter((item) => isNewsVisibleToday(item, today));
    const publishedEvents = state.events.filter((item) => isContentVisibleNow(item));
    const weeklyReservations = state.reservations.filter((item) => isCurrentWeek(item.createdAt || item.reservationDate || item.date));

    setDashboardValue("todayAttendanceCount", `${attendance.total.size}名`);
    setDashboardValue("castCount", `${state.casts.length}名`);
    setDashboardValue("newsCount", `${publishedNews.length}件`);
    setDashboardValue("eventCount", `${publishedEvents.length}件`);
    setDashboardValue("galleryCount", `${state.gallery.filter((item) => item.isPublished !== false).length}枚`);
    setDashboardValue("weeklyReservationCount", state.reservations.length ? `${weeklyReservations.length}件` : "--");
    setDashboardValue("finishedAttendanceCount", `${attendance.finished.size}名`);
    setDashboardValue("upcomingAttendanceCount", `${attendance.upcoming.size}名`);
    setDashboardValue("workingAttendanceCount", `${attendance.working.size}名`);

    const list = document.getElementById("dashboardTodayList");
    if (list) {
      list.innerHTML = todaySchedules.length
        ? todaySchedules.map((item) => createAttendanceListItem(item, state.casts, attendance.statusByKey)).join("")
        : "<li>本日の出勤登録はありません。</li>";
    }
  };

  subscribeCollection("casts", (items) => { state.casts = items; render(); });
  subscribeCollection("schedules", (items) => { state.schedules = items; render(); });
  subscribeCollection("news", (items) => { state.news = items; render(); });
  subscribeCollection("gallery", (items) => { state.gallery = items; render(); });
  subscribeCollection("events", (items) => { state.events = items; render(); }, () => { state.events = []; render(); });
  subscribeCollection("reservations", (items) => { state.reservations = items; render(); }, () => { state.reservations = []; render(); });
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCurrentWeek(value) {
  const date = toDate(value);
  if (!date) return false;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return date >= start && date < end;
}

function isContentVisibleNow(item) {
  if (item.isPublished === false) return false;
  const now = Date.now();
  const start = toDate(item.publishStart || item.startDate || item.publishDate)?.getTime();
  const end = toDate(item.publishEnd || item.endDate || item.publishEndDate)?.getTime();
  return (!start || start <= now) && (!end || end >= now);
}

function classifyTodayAttendance(schedules, date = new Date()) {
  const now = getTokyoMinutes(date);
  const result = {
    total: new Set(),
    finished: new Set(),
    upcoming: new Set(),
    working: new Set(),
    statusByKey: new Map()
  };

  schedules.forEach((schedule, index) => {
    const key = getSchedulePersonKey(schedule, index);
    const start = parseTimeToMinutes(schedule.start || schedule.startTime || schedule.time);
    const end = parseTimeToMinutes(schedule.end || schedule.endTime);
    let status = "upcoming";

    if (start === null) {
      status = "upcoming";
    } else {
      const normalizedNow = now < 12 * 60 && start >= 18 * 60 ? now + 24 * 60 : now;
      const normalizedEnd = end === null ? start + 12 * 60 : (end <= start ? end + 24 * 60 : end);
      status = normalizedNow < start ? "upcoming" : (normalizedNow >= normalizedEnd ? "finished" : "working");
    }

    result.total.add(key);
    result[status].add(key);
    result.statusByKey.set(key, status);
  });

  return result;
}

function createAttendanceListItem(schedule, casts, statusByKey) {
  const key = getSchedulePersonKey(schedule);
  const name = schedule.castName || casts.find((cast) => cast.id === schedule.castId)?.name || "名称未設定";
  const start = schedule.start || schedule.startTime || schedule.time || "未定";
  const end = schedule.end || schedule.endTime || "";
  const status = statusByKey.get(key) || "upcoming";
  const labels = { finished: "退勤済み", upcoming: "まもなく出勤", working: "出勤中" };
  return `<li><span>${escapeHtml(name)}</span><small>${escapeHtml(end ? `${start}〜${end}` : start)}</small><em class="admin-attendance-status is-${status}">${labels[status]}</em></li>`;
}

function getSchedulePersonKey(schedule, fallback = "") {
  return String(schedule.castId || schedule.castName || schedule.id || fallback);
}

function getScheduleDateKey(schedule) {
  return String(schedule.date || schedule.dateKey || schedule.workDate || "").slice(0, 10);
}

function isInactiveSchedule(schedule) {
  return schedule.isOff === true || schedule.status === "off" || schedule.start === "__OFF__";
}

function parseTimeToMinutes(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getTokyoMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TOKYO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function isNewsVisibleToday(item, today) {
  if (item.isPublished === false) return false;
  return isContentVisibleNow({ startDate: item.publishDate, endDate: item.publishEndDate || item.endDate });
}

function setDashboardValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

bootstrapPage({ pageName:"admin" });
setupAdminNavigation();
setupImagePreviews();
setupDashboard();
