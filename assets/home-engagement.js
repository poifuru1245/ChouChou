import { collection, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./app.js";

const TOKYO_TIME_ZONE = "Asia/Tokyo";
const state = { schedules: [] };
let lastSiteSettings = {};

setupHomeSettings();
setupManagedEvents();
setupNewCasts();
setupAttendanceFlash();

function setupHomeSettings() {
  const eventSection = document.getElementById("homeEventBanner");
  const instagramSection = document.getElementById("instagram");
  if (!eventSection && !instagramSection) return;

  onSnapshot(doc(db, "settings", "site"), (snapshot) => {
    const settings = snapshot.exists() ? snapshot.data() : {};
    lastSiteSettings = settings;
    if (instagramSection) instagramSection.hidden = settings.instagramSectionEnabled === false;
    if (eventSection && !eventSection.dataset.managedEvent) renderEventBanner(settings, eventSection);
  }, (error) => {
    console.error("ホーム表示設定の読み込みに失敗しました", error);
    if (eventSection) eventSection.hidden = true;
  });
}

function setupManagedEvents() {
  const section = document.getElementById("homeEventBanner");
  if (!section) return;
  onSnapshot(collection(db, "events"), (snapshot) => {
    const now = Date.now();
    const event = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.isPublished !== false && isWithinDateTime(item.publishStart || item.startDate, item.publishEnd || item.endDate, now))
      .sort((a, b) => toMillis(b.publishStart || b.startDate || b.createdAt) - toMillis(a.publishStart || a.startDate || a.createdAt))[0];
    if (!event) {
      delete section.dataset.managedEvent;
      renderEventBanner(lastSiteSettings, section);
      return;
    }
    section.dataset.managedEvent = "true";
    renderEventBanner({ eventBannerEnabled: true, eventBannerTitle: event.title, eventBannerImageUrl: event.imageUrl, eventBannerLink: event.linkUrl, eventBannerStartDate: "", eventBannerEndDate: "" }, section);
  }, (error) => console.warn("イベント管理データの読み込みに失敗しました", error));
}

function toMillis(value) { if (!value) return 0; if (typeof value.toMillis === "function") return value.toMillis(); const time = Date.parse(value); return Number.isFinite(time) ? time : 0; }
function isWithinDateTime(start, end, now) { const startTime = toMillis(start); const endTime = toMillis(end); return (!startTime || startTime <= now) && (!endTime || endTime >= now); }

function renderEventBanner(settings, section) {
  if (!section) return;
  const today = getTokyoDateKey();
  const start = String(settings.eventBannerStartDate || "").slice(0, 10);
  const end = String(settings.eventBannerEndDate || "").slice(0, 10);
  const title = String(settings.eventBannerTitle || "").trim();
  const imageUrl = String(settings.eventBannerImageUrl || "").trim();
  const isWithinPeriod = (!start || start <= today) && (!end || end >= today);
  const isVisible = settings.eventBannerEnabled === true && isWithinPeriod && Boolean(title && imageUrl);

  section.hidden = !isVisible;
  if (!isVisible) return;

  const link = section.querySelector("#homeEventBannerLink");
  const image = section.querySelector("#homeEventBannerImage");
  const titleElement = section.querySelector("#homeEventBannerTitle");
  const href = String(settings.eventBannerLink || "news.html").trim() || "news.html";
  link.href = href;
  if (/^https?:\/\//i.test(href)) {
    link.target = "_blank";
    link.rel = "noopener";
  } else {
    link.removeAttribute("target");
    link.removeAttribute("rel");
  }
  image.src = imageUrl;
  image.alt = title;
  titleElement.textContent = title;
}

function setupNewCasts() {
  const section = document.getElementById("new-cast");
  const list = document.getElementById("newCastList");
  if (!section || !list) return;

  onSnapshot(collection(db, "casts"), (snapshot) => {
    const casts = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((cast) => cast.isPublished !== false && (isEnabled(cast.isNewcomer) || isEnabled(cast.isNew)))
      .sort(compareDisplayOrder)
      .slice(0, 3);

    section.hidden = casts.length === 0;
    list.innerHTML = casts.map(createHomeCastCard).join("");
  }, (error) => {
    console.error("新人キャストの読み込みに失敗しました", error);
    section.hidden = true;
  });
}

function createHomeCastCard(cast) {
  const name = String(cast.name || "CAST").trim();
  const image = getCastImage(cast);
  const detailUrl = `cast-detail.html?id=${encodeURIComponent(cast.id)}&name=${encodeURIComponent(name)}`;
  const imageMarkup = image
    ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(name)}" loading="lazy" decoding="async">`
    : '<span class="v72-cast-no-image">NO IMAGE</span>';
  const lineMarkup = cast.lineReservationEnabled === false ? "" : `
    <a href="#" class="button-premium v72-cast-line" data-site-link="lineReservationUrl" data-line-cast-name="${escapeAttribute(name)}" target="_blank" rel="noopener" aria-label="${escapeAttribute(name)}ちゃんを指名してLINE予約">
      ${lineIcon()}<span>${escapeHtml(name)}ちゃんを指名 LINE予約</span>
    </a>`;

  return `<article class="v72-cast-card card-premium">
    <div class="v72-cast-photo">${imageMarkup}<span class="badge-premium">NEW</span></div>
    <div class="v72-cast-info"><h3>${escapeHtml(name)}</h3><span class="v72-name-line" aria-hidden="true"></span>
      <div class="v72-cast-actions"><a href="${escapeAttribute(detailUrl)}" class="button-premium">プロフィール</a>${lineMarkup}</div>
    </div>
  </article>`;
}

function setupAttendanceFlash() {
  const output = document.getElementById("todayUpcomingFlash");
  if (!output) return;

  const render = () => {
    const today = getTokyoDateKey();
    const nowMinutes = getTokyoMinutes();
    const scheduled = state.schedules.filter((item) => getScheduleDateKey(item) === today && !isInactiveSchedule(item));
    const upcomingKeys = new Set();

    scheduled.forEach((item, index) => {
      const start = parseTimeToMinutes(item.start || item.startTime || item.time);
      if (start === null || start > nowMinutes) upcomingKeys.add(String(item.castId || item.castName || item.id || index));
    });

    output.textContent = `本日あと${upcomingKeys.size}名出勤予定`;
    output.dataset.count = String(upcomingKeys.size);
  };

  onSnapshot(collection(db, "schedules"), (snapshot) => {
    state.schedules = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    render();
  }, (error) => {
    console.error("出勤速報の読み込みに失敗しました", error);
    output.textContent = "本日の出勤情報を確認できませんでした";
  });

  window.setInterval(render, 60 * 1000);
}

function getTokyoDateKey() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TOKYO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function getTokyoMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TOKYO_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function getScheduleDateKey(item) {
  return String(item.date || item.dateKey || item.scheduleDate || item.workDate || "").slice(0, 10);
}

function isInactiveSchedule(item) {
  return item.isOff === true || item.off === true || item.status === "off" || item.start === "__OFF__";
}

function parseTimeToMinutes(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function compareDisplayOrder(a, b) {
  const aOrder = numericOrder(a.displayOrder);
  const bOrder = numericOrder(b.displayOrder);
  if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
  if (aOrder !== null) return -1;
  if (bOrder !== null) return 1;
  return String(a.name || "").localeCompare(String(b.name || ""), "ja");
}

function numericOrder(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getCastImage(cast) {
  return cast.image || cast.imageUrl || (Array.isArray(cast.images) ? cast.images[0] : "") || "";
}

function isEnabled(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}

function lineIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.25c-5.11 0-9.25 3.45-9.25 7.7 0 2.64 1.63 5.09 4.28 6.49l-.72 3.31 3.63-2.23c.68.1 1.37.15 2.06.15 5.11 0 9.25-3.46 9.25-7.72S17.11 3.25 12 3.25Z"/><circle cx="8.25" cy="11" r="1"/><circle cx="12" cy="11" r="1"/><circle cx="15.75" cy="11" r="1"/></svg>';
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
