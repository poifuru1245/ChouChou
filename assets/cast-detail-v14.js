import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./app.js";

const params = new URLSearchParams(location.search);
const cast = {
  id: params.get("id") || "",
  name: params.get("name") || ""
};

setupFavorite();
loadNextSchedule();

function setupFavorite() {
  const button = document.getElementById("castFavoriteButton");
  if (!button) return;

  const storageKey = "chouchou-favorite-casts";
  const castKey = cast.id || cast.name || "cast";
  let favorites = readFavorites(storageKey);

  const render = () => {
    const isFavorite = favorites.includes(castKey);
    button.setAttribute("aria-pressed", String(isFavorite));
    button.textContent = isFavorite ? "♥ お気に入り登録済み" : "♡ お気に入りに登録";
  };

  render();
  button.addEventListener("click", () => {
    favorites = favorites.includes(castKey)
      ? favorites.filter((key) => key !== castKey)
      : [...favorites, castKey];
    writeFavorites(storageKey, favorites);
    render();
  });
}

async function loadNextSchedule() {
  const output = document.getElementById("castNextSchedule");
  if (!output) return;

  output.textContent = "次回出勤はお問い合わせください";

  try {
    const snapshot = await getDocs(collection(db, "schedules"));
    const today = getTokyoDateKey();
    const schedules = [];

    snapshot.forEach((scheduleDoc) => {
      const schedule = scheduleDoc.data();
      const dateKey = getScheduleDateKey(schedule);

      if (dateKey >= today && isScheduleForCast(schedule) && !isInactiveSchedule(schedule)) {
        schedules.push({ dateKey, time: getScheduleTime(schedule) });
      }
    });

    schedules.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const next = schedules[0];
    if (next) {
      output.textContent = `${formatJapaneseDate(next.dateKey)}${next.time ? `　${next.time}` : ""}`;
    }
  } catch (error) {
    console.error("次回出勤読み込み失敗", error);
  }
}

function readFavorites(storageKey) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function writeFavorites(storageKey, favorites) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(favorites));
  } catch (error) {
    console.warn("お気に入りを保存できませんでした", error);
  }
}

function getTokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function getScheduleDateKey(schedule) {
  const value = schedule?.date || schedule?.dateKey || schedule?.scheduleDate || schedule?.workDate || schedule?.day || schedule?.startDate;
  if (!value) return "";
  if (typeof value?.toDate === "function") return getTokyoDateKey(value.toDate());
  if (typeof value === "object" && Number.isFinite(value.seconds)) return getTokyoDateKey(new Date(value.seconds * 1000));

  const text = String(value).trim();
  const match = text.match(/^(\d{4})[\/.年-](\d{1,2})[\/.月-](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : getTokyoDateKey(parsed);
}

function isScheduleForCast(schedule) {
  const scheduleId = String(schedule?.castId || schedule?.castID || schedule?.castDocId || schedule?.cast_id || schedule?.castRef?.id || "").trim();
  const scheduleName = String(schedule?.castName || schedule?.name || schedule?.cast || schedule?.cast_name || schedule?.girlName || "").trim();
  return Boolean((scheduleId && [cast.id, cast.name].includes(scheduleId)) || (scheduleName && [cast.name, cast.id].includes(scheduleName)));
}

function getScheduleTime(schedule) {
  const start = schedule?.start || schedule?.startTime || schedule?.from || "";
  const end = schedule?.end || schedule?.endTime || schedule?.to || "";
  if (start && end) return `${start}〜${end}`;
  return String(start || end || schedule?.time || schedule?.workTime || schedule?.scheduleTime || schedule?.shift || "");
}

function isInactiveSchedule(schedule) {
  const status = String(schedule?.status || schedule?.attendanceStatus || "").trim().toLowerCase();
  return ["休み", "欠勤", "cancel", "canceled", "cancelled"].includes(status) || schedule?.isOff === true || schedule?.off === true;
}

function formatJapaneseDate(dateKey) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}月${Number(day)}日`;
}
