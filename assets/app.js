import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  onSnapshot,
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
            <div class="ranking-card ranking-card-compact">
              <span class="ranking-rank">${medal} ${index + 1}位</span>
              <h3>${escapeHtml(cast.name || "")}</h3>
              <p>指名数：${escapeHtml(cast.nominate || 0)}本</p>
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
      "section.access.en": "Access",
      "section.instagram": "最新の投稿",
      "section.recruit": "求人情報",
      "recruit.v11.title": "キャスト募集",
      "recruit.v11.message": "甘くとろける夢の時間を、一緒につくりませんか。",
      "recruit.v11.point.beginner": "未経験歓迎",
      "recruit.v11.point.trial": "体験入店OK",
      "recruit.v11.point.daily": "日払いOK",
      "recruit.v11.point.ride": "送迎あり",
      "recruit.v11.point.costume": "衣装貸出無料",
      "recruit.v11.button.details": "募集要項を見る",
      "recruit.v11.button.line": "LINEで応募",
      "section.contact": "お問い合わせ",
      "state.loading": "読み込み中...",
      "access.address.label": "住所",
      "access.address.value": "〒064-0805 北海道札幌市中央区南5条西5丁目5-1 サン・ドゥビル7F",
      "access.hours.label": "営業時間",
      "access.hours.value": "19:00〜LAST",
      "access.closed.label": "定休日",
      "access.closed.value": "日曜",
      "instagram.body": "最新の雰囲気やイベント情報をお届けします。",
      "instagram.loading": "投稿を読み込み中...",
      "instagram.empty": "最新の投稿を準備中です。",
      "instagram.error": "投稿を読み込めませんでした。",
      "instagram.follow": "Follow on Instagram",
      "button.schedule": "出勤一覧を見る",
      "button.news": "お知らせ一覧を見る",
      "button.webReserve": "WEB予約",
      "button.cast": "キャスト一覧を見る",
      "button.gallery": "ギャラリーを見る",
      "button.recruit": "フォームはこちらから",
      "button.detail": "詳細",
      "button.profile": "プロフィール",
      "button.phone": "電話で予約",
      "button.line": "LINEで予約",
      "button.contact": "お問い合わせ",
      "cast.schedule.label": "出勤",
      "today.empty": "本日の出勤情報はありません",
      "recruit.form.eyebrow": "Recruit Entry",
      "recruit.form.title": "応募フォーム",
      "recruit.form.lead": "Chou Chouで働いてみたい方は、下記フォームよりお気軽にご応募ください。",
      "form.name": "名前",
      "form.age": "年齢",
      "form.phone": "電話番号",
      "form.lineId": "LINE ID",
      "form.workDays": "希望勤務日",
      "form.workDays.placeholder": "例：週3日 / 金土希望",
      "form.experience": "経験有無",
      "form.select": "選択してください",
      "form.experience.yes": "あり",
      "form.experience.no": "なし",
      "form.message": "メッセージ",
      "form.submit": "送信する",
      "contact.form.eyebrow": "Contact",
      "contact.form.title": "お問い合わせ",
      "contact.form.lead": "ご意見・ご質問などがございましたら、下記フォームよりお気軽にお問い合わせください。",
      "contact.form.name": "お名前",
      "contact.form.email": "メールアドレス",
      "contact.form.phone": "電話番号",
      "contact.form.type": "お問い合わせ種別",
      "contact.form.message": "ご意見・ご質問内容",
      "contact.type.opinion": "ご意見",
      "contact.type.question": "ご質問",
      "contact.type.reservation": "予約について",
      "contact.type.other": "その他",
      "system.first": "初回セット",
      "system.regular": "通常セット",
      "system.extend20": "延長20分",
      "system.extend40": "延長40分",
      "system.singleDrink": "CASTシングルドリンク",
      "system.wineCocktail": "CASTワインカクテル",
      "system.shot": "CASTショット",
      "system.note": "※税込みの料金表記となっております。",
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
      "section.access.en": "Access",
      "section.instagram": "Latest Posts",
      "section.recruit": "Recruit",
      "recruit.v11.title": "Cast Recruitment",
      "recruit.v11.message": "Would you like to create sweet, dreamlike moments with us?",
      "recruit.v11.point.beginner": "Beginners Welcome",
      "recruit.v11.point.trial": "Trial Shifts Available",
      "recruit.v11.point.daily": "Daily Pay Available",
      "recruit.v11.point.ride": "Transportation Available",
      "recruit.v11.point.costume": "Complimentary Costumes",
      "recruit.v11.button.details": "View Recruitment Details",
      "recruit.v11.button.line": "Apply via LINE",
      "section.contact": "Contact",
      "state.loading": "Loading...",
      "access.address.label": "Address",
      "access.address.value": "Sun Do Building 7F, 5-1 South 5 West 5, Chuo-ku, Sapporo, Hokkaido 064-0805",
      "access.hours.label": "Hours",
      "access.hours.value": "19:00〜LAST",
      "access.closed.label": "Closed",
      "access.closed.value": "Sunday",
      "instagram.body": "Follow us for the latest atmosphere and event updates.",
      "instagram.loading": "Loading posts...",
      "instagram.empty": "New posts are coming soon.",
      "instagram.error": "Posts could not be loaded.",
      "instagram.follow": "Follow on Instagram",
      "button.schedule": "View Schedule",
      "button.news": "View News",
      "button.webReserve": "Web Reservation",
      "button.cast": "View Cast",
      "button.gallery": "View Gallery",
      "button.recruit": "Open Form",
      "button.detail": "Details",
      "button.profile": "Profile",
      "button.phone": "Reserve by Phone",
      "button.line": "Reserve by LINE",
      "button.contact": "Contact",
      "cast.schedule.label": "Schedule",
      "today.empty": "No cast schedule is available today.",
      "recruit.form.eyebrow": "Recruit Entry",
      "recruit.form.title": "Application Form",
      "recruit.form.lead": "If you would like to work at Chou Chou, please apply using the form below.",
      "form.name": "Name",
      "form.age": "Age",
      "form.phone": "Phone",
      "form.lineId": "LINE ID",
      "form.workDays": "Preferred Work Days",
      "form.workDays.placeholder": "Example: 3 days a week / Friday and Saturday",
      "form.experience": "Experience",
      "form.select": "Please select",
      "form.experience.yes": "Yes",
      "form.experience.no": "No",
      "form.message": "Message",
      "form.submit": "Submit",
      "contact.form.eyebrow": "Contact",
      "contact.form.title": "Contact",
      "contact.form.lead": "Please use the form below for opinions, questions, or other inquiries.",
      "contact.form.name": "Name",
      "contact.form.email": "Email",
      "contact.form.phone": "Phone",
      "contact.form.type": "Inquiry Type",
      "contact.form.message": "Opinion or Question",
      "contact.type.opinion": "Opinion",
      "contact.type.question": "Question",
      "contact.type.reservation": "Reservation",
      "contact.type.other": "Other",
      "system.first": "First Set",
      "system.regular": "Regular Set",
      "system.extend20": "Extension 20 min",
      "system.extend40": "Extension 40 min",
      "system.singleDrink": "Cast Single Drink",
      "system.wineCocktail": "Cast Wine Cocktail",
      "system.shot": "Cast Shot",
      "system.note": "All prices include tax.",
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
      "section.access.en": "Access",
      "section.instagram": "最新动态",
      "section.recruit": "招聘信息",
      "recruit.v11.title": "招募演员",
      "recruit.v11.message": "愿意和我们一起创造甜蜜梦幻的时光吗？",
      "recruit.v11.point.beginner": "欢迎无经验者",
      "recruit.v11.point.trial": "可体验入店",
      "recruit.v11.point.daily": "可日结工资",
      "recruit.v11.point.ride": "提供接送",
      "recruit.v11.point.costume": "免费提供服装",
      "recruit.v11.button.details": "查看招聘详情",
      "recruit.v11.button.line": "通过LINE应聘",
      "section.contact": "咨询",
      "state.loading": "读取中...",
      "access.address.label": "地址",
      "access.address.value": "北海道札幌市中央区南5条西5丁目5-1 Sun Do大楼7F 〒064-0805",
      "access.hours.label": "营业时间",
      "access.hours.value": "19:00〜LAST",
      "access.closed.label": "定休日",
      "access.closed.value": "周日",
      "instagram.body": "为您带来最新店内氛围与活动信息。",
      "instagram.loading": "正在加载动态...",
      "instagram.empty": "最新动态准备中。",
      "instagram.error": "无法加载动态。",
      "instagram.follow": "在Instagram关注",
      "button.schedule": "查看出勤",
      "button.news": "查看公告",
      "button.webReserve": "网页预约",
      "button.cast": "查看演员",
      "button.gallery": "查看相册",
      "button.recruit": "前往表单",
      "button.detail": "详情",
      "button.profile": "个人资料",
      "button.phone": "电话预约",
      "button.line": "LINE预约",
      "button.contact": "咨询",
      "cast.schedule.label": "出勤",
      "today.empty": "今天没有出勤信息。",
      "recruit.form.eyebrow": "Recruit Entry",
      "recruit.form.title": "应聘表单",
      "recruit.form.lead": "想在 Chou Chou 工作的朋友，请通过下方表单轻松应聘。",
      "form.name": "姓名",
      "form.age": "年龄",
      "form.phone": "电话号码",
      "form.lineId": "LINE ID",
      "form.workDays": "希望工作日",
      "form.workDays.placeholder": "例：每周3天 / 希望周五周六",
      "form.experience": "有无经验",
      "form.select": "请选择",
      "form.experience.yes": "有",
      "form.experience.no": "无",
      "form.message": "留言",
      "form.submit": "发送",
      "contact.form.eyebrow": "Contact",
      "contact.form.title": "咨询",
      "contact.form.lead": "如有意见、问题或其他咨询，请通过下方表单联系我们。",
      "contact.form.name": "姓名",
      "contact.form.email": "邮箱地址",
      "contact.form.phone": "电话号码",
      "contact.form.type": "咨询类别",
      "contact.form.message": "意见・问题内容",
      "contact.type.opinion": "意见",
      "contact.type.question": "问题",
      "contact.type.reservation": "预约相关",
      "contact.type.other": "其他",
      "system.first": "初回套组",
      "system.regular": "通常套组",
      "system.extend20": "延长20分钟",
      "system.extend40": "延长40分钟",
      "system.singleDrink": "CAST单杯饮品",
      "system.wineCocktail": "CAST葡萄酒鸡尾酒",
      "system.shot": "CAST Shot",
      "system.note": "以上价格均为含税价格。",
      "concept.body": "这里是可以暂时忘记日常、让心情轻轻放松的地方。<br><br>不只是可爱，也欢迎第一次来店的客人和一人前来的客人。在轻松的氛围中，享受充满笑容的时光。<br><br>可爱、治愈，以及一点特别感。<br><br>请在 Chou Chou 享受这样梦幻般的时间。"
    }
  };

  const applyLanguage = (lang) => {
    const dictionary = translations[lang] || translations.ja;

    document.documentElement.lang = lang === "zh" ? "zh" : lang;

    applyTranslations(document, dictionary);

    switcher.querySelectorAll("[data-lang]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.lang === lang);
    });

    localStorage.setItem("chouchou-language", lang);
  };

  const applyTranslations = (root, dictionary) => {
    const elements = [];

    if (root instanceof Element && root.matches("[data-i18n]")) {
      elements.push(root);
    }

    root.querySelectorAll?.("[data-i18n]").forEach((element) => {
      elements.push(element);
    });

    elements.forEach((element) => {
      const key = element.dataset.i18n;
      const text = dictionary[key];

      if (!text) return;

      if (key === "concept.body") {
        element.innerHTML = text;
        return;
      }

      element.textContent = text;
    });

    const placeholderElements = [];

    if (root instanceof Element && root.matches("[data-i18n-placeholder]")) {
      placeholderElements.push(root);
    }

    root.querySelectorAll?.("[data-i18n-placeholder]").forEach((element) => {
      placeholderElements.push(element);
    });

    placeholderElements.forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      const text = dictionary[key];

      if (!text) return;

      element.setAttribute("placeholder", text);
    });
  };

  let currentDictionary = translations[localStorage.getItem("chouchou-language") || "ja"] || translations.ja;

  switcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");

    if (!button) return;

    currentDictionary = translations[button.dataset.lang] || translations.ja;
    applyLanguage(button.dataset.lang);
  });

  applyLanguage(localStorage.getItem("chouchou-language") || "ja");

  if ("MutationObserver" in window) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;

          applyTranslations(node, currentDictionary);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

async function setupSiteSettings() {
  const configurableElements = document.querySelectorAll(
    "[data-site-link], [data-site-phone], [data-site-map-embed], [data-site-hero-image], [data-site-business-hours], [data-site-closed-day]"
  );

  if (!configurableElements.length) return;

  try {
    const settingsSnapshot = await getDoc(doc(db, "settings", "site"));
    const settings = settingsSnapshot.exists() ? settingsSnapshot.data() : {};

    applySiteLink("webReservationUrl", settings.webReservationUrl);
    applySiteLink("lineReservationUrl", settings.lineReservationUrl);
    applySiteLink("recruitUrl", settings.recruitUrl);
    applySiteLink("contactFormUrl", settings.contactFormUrl);
    applySiteLink("instagramUrl", settings.instagramUrl);
    applySiteLink("xUrl", settings.xUrl);
    applyPhoneLink(settings.phoneNumber);
    applyGoogleMap(settings.googleMapUrl);
    applyHeroImage(settings.heroImageUrl);
    applyTextSetting("[data-site-business-hours]", settings.businessHours);
    applyTextSetting("[data-site-closed-day]", settings.closedDay);
  } catch (error) {
    console.error("サイト設定読み込み失敗", error);
  }
}

function applySiteLink(key, value) {
  const href = normalizeSiteUrl(value);

  if (!href) return;

  document.querySelectorAll(`[data-site-link="${key}"]`).forEach((element) => {
    element.setAttribute("href", href);

    if (isExternalUrl(href)) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener");
    }
  });
}

function applyPhoneLink(value) {
  const phone = String(value || "").trim();

  if (!phone) return;

  const href = `tel:${phone.replace(/[^\d+]/g, "")}`;

  document.querySelectorAll("[data-site-phone]").forEach((element) => {
    element.setAttribute("href", href);
  });

  document.querySelectorAll("[data-site-phone-text]").forEach((element) => {
    element.textContent = phone;
  });
}

function applyGoogleMap(value) {
  const mapUrl = normalizeSiteUrl(value);

  if (!mapUrl) return;

  document.querySelectorAll("[data-site-map-embed]").forEach((iframe) => {
    iframe.setAttribute("src", toGoogleMapEmbedUrl(mapUrl));
  });
}

function applyHeroImage(value) {
  const imageUrl = normalizeSiteUrl(value);

  if (!imageUrl) return;

  document.querySelectorAll("[data-site-hero-image]").forEach((image) => {
    image.setAttribute("src", imageUrl);
  });
}

function applyTextSetting(selector, value) {
  const text = String(value || "").trim();

  if (!text) return;

  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = text;
  });
}

function normalizeSiteUrl(value) {
  const url = String(value || "").trim();

  if (!url) return "";

  return url;
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

function toGoogleMapEmbedUrl(url) {
  if (url.includes("output=embed")) return url;

  if (url.includes("google.com/maps/embed")) return url;

  return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
}

function setupRevealAnimations() {
  const selector = ".premium-section-card, .ver6-contact-image-section, .cast-card, .news-card, .gallery-card";
  const revealRoot = document.querySelector(".princess-home") || document.body;
  const targets = revealRoot.querySelectorAll(selector);

  if (!("IntersectionObserver" in window)) {
    targets.forEach((target) => {
      target.classList.add("reveal-card");
      target.classList.add("is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.08
    }
  );

  const registerRevealTarget = (target) => {
    if (!(target instanceof HTMLElement)) return;
    if (target.classList.contains("reveal-card")) return;

    target.classList.add("reveal-card");
    observer.observe(target);
  };

  targets.forEach((target) => {
    registerRevealTarget(target);
  });

  if (!("MutationObserver" in window)) return;

  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        if (node.matches(selector)) {
          registerRevealTarget(node);
        }

        node.querySelectorAll(selector).forEach((child) => {
          registerRevealTarget(child);
        });
      });
    });
  });

  mutationObserver.observe(revealRoot, {
    childList: true,
    subtree: true
  });
}

async function setupInstagramBrandGallery() {
  const grid = document.querySelector("[data-instagram-brand-grid]");

  if (!grid || grid.dataset.instagramState) return;

  grid.dataset.instagramState = "loading";

  try {
    const snapshot = await getDocs(collection(db, "gallery"));
    const limit = Number(grid.dataset.limit || 6);
    const posts = [];

    snapshot.forEach((docSnap) => {
      const post = {
        id: docSnap.id,
        ...docSnap.data()
      };

      if (post.imageUrl) posts.push(post);
    });

    posts.sort((a, b) => {
      const timeDifference = getInstagramPostTime(b) - getInstagramPostTime(a);

      if (timeDifference !== 0) return timeDifference;

      const aOrder = Number(a.displayOrder ?? Number.MAX_SAFE_INTEGER);
      const bOrder = Number(b.displayOrder ?? Number.MAX_SAFE_INTEGER);
      return aOrder - bOrder;
    });

    const visiblePosts = posts.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 6);

    if (!visiblePosts.length) {
      grid.dataset.instagramState = "empty";
      grid.innerHTML = `<p class="instagram-brand-state" data-i18n="instagram.empty">最新の投稿を準備中です。</p>`;
      return;
    }

    grid.dataset.instagramState = "ready";
    grid.innerHTML = visiblePosts.map((post) => {
      const title = String(post.title || "").trim();
      const date = formatInstagramPostDate(post);
      const caption = title || date || "Chou Chou";

      return `
        <article class="instagram-brand-post card-premium">
          <div class="instagram-brand-photo">
            <img src="${escapeAttribute(post.imageUrl)}" alt="${escapeAttribute(caption)}" loading="lazy">
          </div>
          <p class="instagram-brand-caption">${escapeHtml(caption)}</p>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error("Instagramブランドギャラリー読み込み失敗", error);
    grid.dataset.instagramState = "error";
    grid.innerHTML = `<p class="instagram-brand-state" data-i18n="instagram.error">投稿を読み込めませんでした。</p>`;
  }
}

function getInstagramPostTime(post) {
  const value = post?.createdAt || post?.updatedAt;

  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;

  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInstagramPostDate(post) {
  const timestamp = getInstagramPostTime(post);

  if (!timestamp) return "";

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(timestamp)).replaceAll("/", ".");
}

function setupPremiumHeader() {
  const header = document.querySelector(".header");

  if (!header || header.dataset.premiumHeaderReady === "true") return;

  header.dataset.premiumHeaderReady = "true";

  let ticking = false;

  const updateHeaderState = () => {
    header.classList.toggle("is-compact", window.scrollY > 32);
    ticking = false;
  };

  const requestHeaderUpdate = () => {
    if (ticking) return;

    ticking = true;
    window.requestAnimationFrame(updateHeaderState);
  };

  updateHeaderState();
  window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
}

function setupHeroSlider() {
  const hero = document.querySelector(".hero.hero-ver6");
  const slides = Array.from(document.querySelectorAll(".hero.hero-ver6 .hero-slide"));

  if (!hero || slides.length <= 1) return;

  let currentIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));

  if (currentIndex < 0) {
    currentIndex = 0;
    slides[0].classList.add("is-active");
  }

  window.setInterval(() => {
    const nextIndex = (currentIndex + 1) % slides.length;

    slides[currentIndex].classList.remove("is-active");
    slides[nextIndex].classList.add("is-active");
    currentIndex = nextIndex;
  }, 4800);
}

function setupManagedSystem() {
  const homeList = document.querySelector("#system .system-price-card");
  const interiorGroups = document.querySelector(".system-groups");
  if (!homeList && !interiorGroups) return;

  onSnapshot(collection(db, "systemItems"), (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.isPublished !== false)
      .sort((a,b) => Number(a.displayOrder ?? 9999) - Number(b.displayOrder ?? 9999));
    if (!items.length) return;

    if (homeList) {
      homeList.innerHTML = items.map((item) => `<div class="system-price-row"><span>${escapeHtml(item.label || "")}</span><strong>${escapeHtml(item.price || "")}</strong></div>`).join("");
    }

    if (interiorGroups) {
      const labels = { fee:["Set Menu","セット料金"], drink:["Cast Drink","ドリンク"], champagne:["Champagne","シャンパンメニュー"] };
      interiorGroups.innerHTML = ["fee","drink","champagne"].map((type) => {
        const group = items.filter((item) => item.type === type);
        if (!group.length) return "";
        const [english,japanese] = labels[type];
        return `<section class="system-group card-premium"><h2>${english}</h2><p class="system-group-label">${japanese}</p><dl class="system-menu-list">${group.map((item) => `<div><dt>${escapeHtml(item.label || "")}</dt><dd>${escapeHtml(item.price || "")}</dd></div>`).join("")}</dl></section>`;
      }).join("");
    }
  }, (error) => console.error("料金リアルタイム読み込み失敗", error));
}

function setupManagedRecruit() {
  const home = document.getElementById("recruit");
  const interior = document.querySelector(".recruit-brand-layout");
  if (!home && !interior) return;

  onSnapshot(doc(db, "content", "recruit"), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    const section = home || interior?.closest("section");
    if (section) section.hidden = data.isPublished === false;
    const title = home?.querySelector(".section-title h2") || interior?.querySelector("h2");
    const lead = home?.querySelector(".recruit-v11-message") || interior?.querySelector("p");
    const image = home?.querySelector(".recruit-v11-media img") || interior?.querySelector("img");
    const benefits = home?.querySelector(".recruit-v11-points") || interior?.querySelector(".recruit-benefits");
    const line = home?.querySelector(".recruit-v11-actions a:last-child") || interior?.querySelector(".interior-actions a:last-child");
    if (title && data.title) title.textContent = data.title;
    if (lead && (data.lead || data.description)) lead.textContent = data.lead || data.description;
    if (image && data.imageUrl) image.src = data.imageUrl;
    if (line && data.applicationLineUrl) line.href = data.applicationLineUrl;
    if (benefits && Array.isArray(data.benefits) && data.benefits.length) {
      benefits.innerHTML = data.benefits.map((benefit) => home ? `<li><span class="recruit-v11-point-icon" aria-hidden="true">✓</span><span>${escapeHtml(benefit)}</span></li>` : `<li>${escapeHtml(benefit)}</li>`).join("");
    }
  }, (error) => console.error("求人リアルタイム読み込み失敗", error));
}

loadReservations();
loadRanking();
loadTodayCast();
setupPublicLanguageSwitch();
setupSiteSettings();
setupInstagramBrandGallery();
setupPremiumHeader();
setupRevealAnimations();
setupHeroSlider();
setupManagedSystem();
setupManagedRecruit();
