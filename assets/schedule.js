import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsNdnnTSJUIS2eO7P_Ks8eAmtm8ManDhY",
  authDomain: "chouchou-susukino.firebaseapp.com",
  projectId: "chouchou-susukino",
  storageBucket: "chouchou-susukino.firebasestorage.app",
  messagingSenderId: "611059453310",
  appId: "1:611059453310:web:c693ea8a0ce465ac79b72f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const TOKYO_TIME_ZONE = "Asia/Tokyo";
const DATE_RANGE_DAYS = 14;

let casts = [];
let schedules = [];
let selectedDate = getTokyoDateKey();

async function loadSchedule() {
  const wrap = document.getElementById("scheduleList");

  if (!wrap) return;

  wrap.innerHTML = "読み込み中...";

  const [castSnapshot, scheduleSnapshot] = await Promise.all([
    getDocs(collection(db, "casts")),
    getDocs(collection(db, "schedules"))
  ]);

  casts = [];
  schedules = [];

  castSnapshot.forEach((item) => {
    casts.push({
      id: item.id,
      ...item.data()
    });
  });

  scheduleSnapshot.forEach((item) => {
    const data = item.data();
    schedules.push({
      id: item.id,
      ...data,
      dateKey: getScheduleDateKey(data),
      castId: getScheduleCastId(data),
      castName: getScheduleCastName(data)
    });
  });

  sortCastsByDisplayOrder(casts);
  renderScheduleAdmin();
}

function renderScheduleAdmin() {
  const wrap = document.getElementById("scheduleList");
  const dateOptions = getDateOptions();

  if (!dateOptions.some((date) => date.value === selectedDate)) {
    selectedDate = dateOptions[0]?.value || getTokyoDateKey();
  }

  wrap.innerHTML = `
    <div class="schedule-admin-toolbar">
      <label>
        <span>日付</span>
        <select id="scheduleDateSelect" class="schedule-date-select">
          ${dateOptions.map((date) => `
            <option value="${date.value}" ${date.value === selectedDate ? "selected" : ""}>
              ${date.label}
            </option>
          `).join("")}
        </select>
      </label>
      <p>今日から2週間分の出勤を登録・編集できます。</p>
    </div>

    <div class="schedule-admin-list">
      ${casts.map((cast) => createScheduleCard(cast)).join("")}
    </div>
  `;

  wrap.querySelector("#scheduleDateSelect")?.addEventListener("change", (event) => {
    selectedDate = event.target.value;
    renderScheduleAdmin();
  });

  wrap.querySelectorAll(".save-btn").forEach((button) => {
    button.addEventListener("click", () => saveSchedule(button.closest(".schedule-admin-card")));
  });
}

function createScheduleCard(cast) {
  const schedule = findScheduleForCast(selectedDate, cast);
  const timeParts = parseScheduleTime(schedule);
  const image = cast.image || getCastImages(cast)[0] || "";

  return `
    <div class="cast-card schedule-admin-card" data-cast-id="${escapeAttribute(cast.id)}">
      <div class="schedule-admin-profile">
        ${image ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">` : `<div class="schedule-admin-no-image">NO IMAGE</div>`}
        <div>
          <h3>${escapeHtml(cast.name || "")}</h3>
          <p>${escapeHtml(formatCastMeta(cast))}</p>
        </div>
      </div>

      <div class="schedule-admin-controls">
        <label>
          <span>開始</span>
          <select class="schedule-start-select">
            ${createTimeOptions(timeParts.start)}
          </select>
        </label>

        <label>
          <span>終了</span>
          <select class="schedule-end-select">
            ${createTimeOptions(timeParts.end)}
          </select>
        </label>

        <button class="save-btn" type="button">保存</button>
      </div>
    </div>
  `;
}

async function saveSchedule(card) {
  if (!card) return;

  const castId = card.dataset.castId || "";
  const cast = casts.find((item) => item.id === castId);

  if (!cast) return;

  const start = card.querySelector(".schedule-start-select")?.value || "";
  const end = card.querySelector(".schedule-end-select")?.value || "";
  const time = formatScheduleTime(start, end);
  const existing = findScheduleForCast(selectedDate, cast);
  const scheduleId = existing?.id || `${selectedDate}_${cast.id}`;
  const isOff = !time;

  await setDoc(
    doc(db, "schedules", scheduleId),
    {
      date: selectedDate,
      dateKey: selectedDate,
      castId: cast.id,
      castName: cast.name || "",
      start,
      end,
      time,
      status: isOff ? "休み" : "出勤",
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  if (selectedDate === getTokyoDateKey()) {
    await updateDoc(
      doc(db, "casts", cast.id),
      {
        schedule: time
      }
    );
  }

  schedules = schedules.filter((schedule) => schedule.id !== scheduleId);
  schedules.push({
    id: scheduleId,
    date: selectedDate,
    dateKey: selectedDate,
    castId: cast.id,
    castName: cast.name || "",
    start,
    end,
    time,
    status: isOff ? "休み" : "出勤"
  });

  alert("保存しました");
  renderScheduleAdmin();
}

function getDateOptions() {
  const dates = [];
  const baseDate = new Date(`${getTokyoDateKey()}T00:00:00+09:00`);

  for (let index = 0; index < DATE_RANGE_DAYS; index += 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);

    const value = getTokyoDateKey(date);
    const label = new Intl.DateTimeFormat("ja-JP", {
      timeZone: TOKYO_TIME_ZONE,
      month: "numeric",
      day: "numeric",
      weekday: "short"
    }).format(date);

    dates.push({
      value,
      label: index === 0 ? `${label}（今日）` : label
    });
  }

  return dates;
}

function createTimeOptions(selectedValue) {
  const values = ["", ...createTimeValues(), "LAST"];

  return values.map((value) => `
    <option value="${value}" ${value === selectedValue ? "selected" : ""}>
      ${value || "未設定"}
    </option>
  `).join("");
}

function createTimeValues() {
  const values = [];

  for (let hour = 19; hour <= 29; hour += 1) {
    const displayHour = hour >= 24 ? hour - 24 : hour;

    ["00", "30"].forEach((minute) => {
      values.push(`${String(displayHour).padStart(2, "0")}:${minute}`);
    });
  }

  return values;
}

function parseScheduleTime(schedule) {
  const start = schedule?.start || "";
  const end = schedule?.end || "";

  if (start || end) {
    return {
      start,
      end
    };
  }

  const time = String(schedule?.time || schedule?.schedule || "").trim();
  const match = time.match(/^(.+?)[〜~\-](.+)$/);

  if (match) {
    return {
      start: match[1].trim(),
      end: match[2].trim()
    };
  }

  return {
    start: time,
    end: ""
  };
}

function formatScheduleTime(start, end) {
  if (start && end) return `${start}〜${end}`;
  return start || end || "";
}

function findScheduleForCast(date, cast) {
  const castId = String(cast?.id || "").trim();
  const castName = String(cast?.name || "").trim();

  return schedules.find((schedule) => (
    schedule.dateKey === date &&
    (
      (schedule.castId && schedule.castId === castId) ||
      (schedule.castId && schedule.castId === castName) ||
      (schedule.castName && schedule.castName === castName) ||
      (schedule.castName && schedule.castName === castId)
    )
  ));
}

function getTokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getScheduleDateKey(schedule) {
  return normalizeScheduleDate(
    schedule?.date ||
    schedule?.dateKey ||
    schedule?.scheduleDate ||
    schedule?.workDate ||
    schedule?.day ||
    schedule?.startDate
  );
}

function normalizeScheduleDate(value) {
  if (!value) return "";

  if (typeof value?.toDate === "function") {
    return getTokyoDateKey(value.toDate());
  }

  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    return getTokyoDateKey(new Date(value.seconds * 1000));
  }

  if (value instanceof Date) {
    return getTokyoDateKey(value);
  }

  const text = String(value).trim();

  if (!text) return "";

  const slashMatch = text.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/);

  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[3].padStart(2, "0")}`;
  }

  const hyphenMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (hyphenMatch) {
    return `${hyphenMatch[1]}-${hyphenMatch[2].padStart(2, "0")}-${hyphenMatch[3].padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);

  return Number.isNaN(parsedDate.getTime())
    ? text
    : getTokyoDateKey(parsedDate);
}

function getScheduleCastId(schedule) {
  return String(
    schedule?.castId ||
    schedule?.castID ||
    schedule?.castDocId ||
    schedule?.cast_id ||
    schedule?.castRef?.id ||
    ""
  ).trim();
}

function getScheduleCastName(schedule) {
  return String(
    schedule?.castName ||
    schedule?.name ||
    schedule?.cast ||
    schedule?.cast_name ||
    schedule?.girlName ||
    ""
  ).trim();
}

function formatCastMeta(cast) {
  return [
    cast.age ? `${cast.age}歳` : "-",
    formatCup(cast),
    cast.height || "-"
  ].join(" / ");
}

function formatCup(cast) {
  const cup = cast?.cup || cast?.cupSize || cast?.bust || cast?.bustCup || "";

  return cup
    ? `${cup}カップ`.replace("カップカップ", "カップ")
    : "-";
}

function getCastImages(cast) {
  const images = Array.isArray(cast?.images)
    ? cast.images.filter(Boolean)
    : [];

  if (images.length === 0 && cast?.image) {
    return [cast.image];
  }

  return images.slice(0, 5);
}

function sortCastsByDisplayOrder(items) {
  items.sort((a, b) => {
    const aOrder = getNumericDisplayOrder(a);
    const bOrder = getNumericDisplayOrder(b);

    if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
    if (aOrder !== null) return -1;
    if (bOrder !== null) return 1;

    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
  });
}

function getNumericDisplayOrder(cast) {
  const order = cast?.displayOrder;

  if (order === undefined || order === null || order === "") return null;

  const numericOrder = Number(order);

  return Number.isFinite(numericOrder) ? numericOrder : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

loadSchedule();
