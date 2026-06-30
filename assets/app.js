import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsNdnnTSJUIS2eO7P_Ks8eAmtm8ManDhY",
  authDomain: "chouchou-susukino.firebaseapp.com",
  projectId: "chouchou-susukino",
  storageBucket: "chouchou-susukino.firebasestorage.app",
  messagingSenderId: "611059453310",
  appId: "1:611059453310:web:c693ea8a0ce465ac79b72f",
  measurementId: "G-PR6J8WFEWL"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

let currentFilter = "today";
let searchKeyword = "";
let ranking = {};

const rankingList = document.getElementById("rankingList");

async function loadReservations() {
  const reservationList = document.getElementById("reservationList");

  if (!reservationList) return;

  reservationList.innerHTML = "";
  ranking = {};

  try {
    const snapshot = await getDocs(collection(db, "reservations"));

    let pending = 0;
    let confirmed = 0;
    let visited = 0;
    let canceled = 0;
    const today = new Date().toLocaleDateString("sv-SE");

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      [data.cast1, data.cast2, data.cast3].forEach((cast) => {
        if (!cast || cast === "なし") return;
        ranking[cast] = (ranking[cast] || 0) + 1;
      });

      if (!matchesReservationFilters(data, today)) return;

      const status = data.status || "予約中";

      if (status === "予約中") pending++;
      if (status === "確定") confirmed++;
      if (status === "来店済") visited++;
      if (status === "キャンセル") canceled++;

      reservationList.insertAdjacentHTML(
        "beforeend",
        createReservationCard(docSnap.id, data, status)
      );
    });

    setText("countPending", `${pending}件`);
    setText("countConfirmed", `${confirmed}件`);
    setText("countVisited", `${visited}件`);
    setText("countCanceled", `${canceled}件`);
    setText("reservationCount", `${snapshot.size}件`);

    renderReservationRanking();
  } catch (error) {
    console.error("予約読み込み失敗", error);
    reservationList.innerHTML = "予約情報の読み込みに失敗しました。";
  }
}

function matchesReservationFilters(data, today) {
  if (searchKeyword) {
    const target = `${data.name || ""}${data.phone || ""}`.toLowerCase();

    if (!target.includes(searchKeyword)) {
      return false;
    }
  }

  return currentFilter !== "today" || data.date === today;
}

function createReservationCard(id, data, status) {
  const statusColor = getStatusColor(status);

  return `
    <div class="reservation-card">
      <h3>${escapeHtml(data.name || "")}</h3>
      <p>電話番号：${escapeHtml(data.phone || "")}</p>
      <p>日付：${escapeHtml(data.date || "")}</p>
      <p>時間：${escapeHtml(data.time || "")}</p>
      <p>人数：${escapeHtml(data.people || "")}名</p>
      <p>
        状態：
        <span style="color:${statusColor};font-weight:bold;">
          ${escapeHtml(status)}
        </span>
      </p>
      <p>指名①：${escapeHtml(data.cast1 || "なし")}</p>
      <p>指名②：${escapeHtml(data.cast2 || "なし")}</p>
      <p>指名③：${escapeHtml(data.cast3 || "なし")}</p>
      <p>要望：${escapeHtml(data.request || "")}</p>
      <div class="reservation-actions">
        <button class="confirm-btn" data-id="${id}">確定</button>
        <button class="visit-btn" data-id="${id}">来店済</button>
        <button class="cancel-btn" data-id="${id}">キャンセル</button>
        <button class="delete-btn" data-id="${id}">削除</button>
      </div>
    </div>
  `;
}

function getStatusColor(status) {
  if (status === "確定") return "#2ecc71";
  if (status === "来店済") return "#3498db";
  if (status === "キャンセル") return "#e74c3c";
  return "#f1c40f";
}

function renderReservationRanking() {
  if (!rankingList) return;

  const sorted = Object.entries(ranking)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  rankingList.innerHTML = sorted.length ? "" : "指名データなし";
}

async function loadRanking() {
  if (!rankingList) return;

  rankingList.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "casts"));
    const casts = [];

    snapshot.forEach((docSnap) => {
      casts.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    casts
      .sort((a, b) => Number(b.nominate || 0) - Number(a.nominate || 0))
      .slice(0, 10)
      .forEach((cast, index) => {
        const medal = ["🥇", "🥈", "🥉"][index] || "";

        rankingList.insertAdjacentHTML(
          "beforeend",
          `
            <div class="ranking-card">
              <img
                src="${escapeAttribute(cast.image || "")}"
                style="
                  width:80px;
                  height:80px;
                  border-radius:50%;
                  object-fit:cover;
                "
                alt=""
              >
              <h3>${medal} ${index + 1}位 ${escapeHtml(cast.name || "")}</h3>
              <p>本指名：${escapeHtml(cast.nominate || 0)}本</p>
            </div>
          `
        );
      });
  } catch (error) {
    console.error("ランキング読み込み失敗", error);
    rankingList.innerHTML = "ランキングの読み込みに失敗しました。";
  }
}

async function loadTodayCast() {
  const wrap = document.getElementById("todayCastList");

  if (!wrap) return;

  try {
    const snapshot = await getDocs(collection(db, "casts"));
    const casts = [];

    wrap.innerHTML = "";

    snapshot.forEach((item) => {
      casts.push({
        id: item.id,
        ...item.data()
      });
    });

    sortCastsByDisplayOrder(casts);

    casts.forEach((cast) => {

      if (!cast.schedule) return;

      wrap.insertAdjacentHTML(
        "beforeend",
        `
          <div style="
            padding:10px;
            margin-bottom:10px;
            background:#f8f8f8;
            border-radius:10px;
          ">
            <b>${escapeHtml(cast.name || "")}</b><br>
            ${escapeHtml(cast.schedule || "")}
          </div>
        `
      );
    });

    if (!wrap.innerHTML) {
      wrap.innerHTML = "出勤情報なし";
    }
  } catch (error) {
    console.error("本日の出勤読み込み失敗", error);
    wrap.innerHTML = "出勤情報の読み込みに失敗しました。";
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) return;

  if (target.classList.contains("delete-btn")) {
    if (!document.getElementById("reservationList")) return;

    const id = target.dataset.id;

    if (!id || !confirm("削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "reservations", id));
      await loadReservations();
    } catch (error) {
      console.error("予約削除失敗", error);
      alert("予約の削除に失敗しました。");
    }
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) return;
  if (!document.getElementById("reservationList")) return;

  const id = target.dataset.id;
  if (!id) return;

  const statusMap = {
    "confirm-btn": "確定",
    "visit-btn": "来店済",
    "cancel-btn": "キャンセル"
  };

  const statusClass = Object.keys(statusMap).find((className) =>
    target.classList.contains(className)
  );

  if (!statusClass) return;

  try {
    await updateDoc(doc(db, "reservations", id), {
      status: statusMap[statusClass]
    });
    await loadReservations();
  } catch (error) {
    console.error("予約ステータス更新失敗", error);
    alert("予約ステータスの更新に失敗しました。");
  }
});

document.getElementById("todayBtn")?.addEventListener("click", () => {
  currentFilter = "today";
  loadReservations();
});

document.getElementById("allBtn")?.addEventListener("click", () => {
  currentFilter = "all";
  loadReservations();
});

document.getElementById("searchReservation")?.addEventListener("input", (event) => {
  searchKeyword = event.target.value.toLowerCase();
  loadReservations();
});

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function sortCastsByDisplayOrder(casts) {
  casts.sort((a, b) => {
    const aOrder = getNumericDisplayOrder(a);
    const bOrder = getNumericDisplayOrder(b);

    if (aOrder !== null && bOrder !== null) {
      return aOrder - bOrder;
    }

    if (aOrder !== null) return -1;
    if (bOrder !== null) return 1;

    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
  });
}

function getNumericDisplayOrder(cast) {
  if (
    cast?.displayOrder === undefined ||
    cast?.displayOrder === null ||
    cast?.displayOrder === ""
  ) {
    return null;
  }

  const order = Number(cast?.displayOrder);
  return Number.isFinite(order) ? order : null;
}

function setupPublicLanguageSwitch() {
  const switcher = document.querySelector(".language-switch");

  if (!switcher) return;

  const translations = {
    ja: {
      "nav.home": "ホーム",
      "nav.cast": "キャスト",
      "nav.schedule": "出勤情報",
      "nav.system": "料金システム",
      "nav.gallery": "ギャラリー",
      "nav.access": "アクセス",
      "nav.recruit": "求人情報",
      "nav.contact": "お問い合わせ",
      "section.schedule": "本日の出勤",
      "section.news": "お知らせ",
      "section.concept": "コンセプト",
      "section.system": "料金システム",
      "section.cast": "キャスト一覧",
      "section.gallery": "店内ギャラリー",
      "section.access": "アクセス",
      "section.instagram": "インスタグラム",
      "section.recruit": "求人情報",
      "section.contact": "お問い合わせ",
      "button.schedule": "出勤一覧を見る",
      "button.news": "お知らせ一覧を見る",
      "button.webReserve": "WEB予約",
      "button.cast": "キャスト一覧を見る",
      "button.gallery": "ギャラリーを見る",
      "button.recruit": "フォームはこちらから",
      "button.phone": "電話で予約",
      "button.line": "LINEで予約",
      "button.contact": "お問い合わせ",
      "concept.body": "日常を少しだけ忘れて、心がふわっと軽くなる場所。<br><br>可愛いだけではなく初めてのお客様も<br>お一人様も<br>気軽に楽しめる雰囲気の中で、笑顔あふれるひとときをお過ごしください。<br><br>可愛さ、癒し、そして少しの特別感。<br><br>そんな\"夢のような時間\"を、<br>Chou Chouでお楽しみください。"
    },
    en: {
      "nav.home": "Home",
      "nav.cast": "Cast",
      "nav.schedule": "Schedule",
      "nav.system": "System",
      "nav.gallery": "Gallery",
      "nav.access": "Access",
      "nav.recruit": "Recruit",
      "nav.contact": "Contact",
      "section.schedule": "Today's Cast",
      "section.news": "News",
      "section.concept": "Concept",
      "section.system": "System",
      "section.cast": "Cast List",
      "section.gallery": "Gallery",
      "section.access": "Access",
      "section.instagram": "Instagram",
      "section.recruit": "Recruit",
      "section.contact": "Contact",
      "button.schedule": "View Schedule",
      "button.news": "View News",
      "button.webReserve": "Web Reservation",
      "button.cast": "View Cast",
      "button.gallery": "View Gallery",
      "button.recruit": "Open Form",
      "button.phone": "Reserve by Phone",
      "button.line": "Reserve by LINE",
      "button.contact": "Contact",
      "concept.body": "A place where you can forget everyday life for a moment and feel your heart become lighter.<br><br>Not only cute, but also welcoming for first-time guests and solo visitors. Enjoy a bright, relaxed moment filled with smiles.<br><br>Cuteness, comfort, and a little sense of something special.<br><br>Please enjoy that dreamlike time at Chou Chou."
    },
    zh: {
      "nav.home": "首页",
      "nav.cast": "演员",
      "nav.schedule": "出勤信息",
      "nav.system": "料金系统",
      "nav.gallery": "相册",
      "nav.access": "交通",
      "nav.recruit": "招聘",
      "nav.contact": "咨询",
      "section.schedule": "今日出勤",
      "section.news": "公告",
      "section.concept": "概念",
      "section.system": "料金系统",
      "section.cast": "演员列表",
      "section.gallery": "店内相册",
      "section.access": "交通",
      "section.instagram": "Instagram",
      "section.recruit": "招聘信息",
      "section.contact": "咨询",
      "button.schedule": "查看出勤",
      "button.news": "查看公告",
      "button.webReserve": "网页预约",
      "button.cast": "查看演员",
      "button.gallery": "查看相册",
      "button.recruit": "前往表单",
      "button.phone": "电话预约",
      "button.line": "LINE预约",
      "button.contact": "咨询",
      "concept.body": "这里是可以暂时忘记日常、让心情轻轻放松的地方。<br><br>不只是可爱，也欢迎第一次来店的客人和一人前来的客人。在轻松的氛围中，享受充满笑容的时光。<br><br>可爱、治愈，以及一点特别感。<br><br>请在 Chou Chou 享受这样梦幻般的时间。"
    }
  };

  const applyLanguage = (lang) => {
    const dictionary = translations[lang] || translations.ja;

    document.documentElement.lang = lang === "zh" ? "zh" : lang;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      const text = dictionary[key];

      if (!text) return;

      if (key === "concept.body") {
        element.innerHTML = text;
        return;
      }

      element.textContent = text;
    });

    switcher.querySelectorAll("[data-lang]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.lang === lang);
    });

    localStorage.setItem("chouchou-language", lang);
  };

  switcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");

    if (!button) return;

    applyLanguage(button.dataset.lang);
  });

  applyLanguage(localStorage.getItem("chouchou-language") || "ja");
}

loadReservations();
loadRanking();
loadTodayCast();
setupPublicLanguageSwitch();
