import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsNdnnTSJUIS2eO7P_Ks8eAmtm8ManDhY",
  authDomain: "chouchou-susukino.firebaseapp.com",
  projectId: "chouchou-susukino",
  storageBucket: "chouchou-susukino.firebasestorage.app",
  messagingSenderId: "611059453310",
  appId: "1:611059453310:web:c693ea8a0ce465ac79b72f"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const params = new URLSearchParams(window.location.search);
const sliderState = {
  images: [],
  currentIndex: 0,
  touchStartX: 0,
  touchStartY: 0,
  lightboxTouchStartX: 0,
  lightboxTouchStartY: 0,
  returnFocus: null
};

initializeCastDetail();

async function initializeCastDetail() {
  setupSliderControls();

  const cast = await resolveCast();

  renderCast(cast);
  setupFavorite(cast);
  setupCastReservations(cast);
  await recordCastView(cast);
  await Promise.all([
    loadWeeklySchedule(cast),
    loadRelatedCasts(cast)
  ]);
  document.body.classList.add("cast-detail-ready");
}

async function recordCastView(cast){
  const castId=String(cast?.id||"").trim();
  const output=document.getElementById("castViewCount");
  const current=Number(cast?.viewCount||0);
  if(output) output.textContent=current.toLocaleString("ja-JP");
  if(!castId) return;
  const today=getTokyoDateKey();
  const sessionKey=`chouchou-view-${castId}-${today}`;
  if(sessionStorage.getItem(sessionKey)) return;
  try{
    const weekKey=getWeekKey();
    await Promise.all([
      updateDoc(doc(db,"casts",castId),{viewCount:increment(1),lastViewedAt:serverTimestamp()}),
      setDoc(doc(db,"castViews",`${castId}_${weekKey}`),{castId,castName:cast?.name||"",weekKey,count:increment(1),updatedAt:serverTimestamp()},{merge:true})
    ]);
    sessionStorage.setItem(sessionKey,"1");
    if(output) output.textContent=(current+1).toLocaleString("ja-JP");
  }catch(error){console.warn("閲覧数の保存をスキップしました",error);}
}

function getWeekKey(){
  const today=getTokyoDateKey();
  const [year,month,day]=today.split("-").map(Number);
  const date=new Date(Date.UTC(year,month-1,day,12));
  const mondayOffset=(date.getUTCDay()+6)%7;
  date.setUTCDate(date.getUTCDate()-mondayOffset);
  return date.toISOString().slice(0,10);
}

async function resolveCast() {
  const id = params.get("id");

  if (id) {
    try {
      const snapshot = await getDoc(doc(db, "casts", id));

      if (snapshot.exists()) {
        return {
          id: snapshot.id,
          ...snapshot.data()
        };
      }
    } catch (error) {
      console.error("キャスト詳細読み込み失敗", error);
    }
  }

  return getCastFromParams();
}

function getCastFromParams() {
  return {
    id: params.get("id") || "",
    name: params.get("name") || "",
    age: params.get("age") || "",
    height: params.get("height") || "",
    birthday: params.get("birthday") || "",
    bloodType: params.get("bloodType") || "",
    hobby: params.get("hobby") || "",
    favoriteDrink: params.get("favoriteDrink") || "",
    favoriteFood: params.get("favoriteFood") || "",
    charmPoint: params.get("charmPoint") || "",
    message: params.get("message") || "",
    image: params.get("image") || "",
    galleryImages: parseImageParam(params.get("galleryImages") || ""),
    instagram: params.get("instagram") || "",
    x: params.get("x") || "",
    line: params.get("line") || "",
    lineReservationEnabled: params.get("lineReservationEnabled") !== "false",
    tags: parseTags(params.get("tags") || ""),
    isNew: isBadgeEnabled(params.get("isNew")),
    isRecommended: isBadgeEnabled(params.get("isRecommended")),
    badgeText: params.get("badgeText") || ""
  };
}

function renderCast(cast) {
  const name = String(cast?.name || "Cast").trim();

  updateSeoMetadata(cast, name);
  setText("castName", name);
  renderProfile(cast);
  renderMessage(cast?.message);
  renderTags(getTags(cast));
  renderSns(cast);
  renderBadges(cast);
  renderSlider(getCastImages(cast), name);
}

function renderProfile(cast) {
  const wrap = document.getElementById("castProfileGrid");
  const fields = [
    ["年齢", formatAge(cast?.age)],
    ["身長", formatHeight(cast?.height)],
    ["血液型", cast?.bloodType],
    ["誕生日", cast?.birthday],
    ["趣味", cast?.hobby],
    ["好きなお酒", cast?.favoriteDrink],
    ["好きな食べ物", cast?.favoriteFood],
    ["チャームポイント", cast?.charmPoint]
  ].filter(([, value]) => String(value || "").trim());

  if (!wrap) return;

  wrap.innerHTML = "";
  fields.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "profile-item";

    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    description.textContent = String(value).trim();

    item.append(term, description);
    wrap.appendChild(item);
  });

  wrap.hidden = fields.length === 0;
}

function renderMessage(value) {
  const panel = document.getElementById("castMessagePanel");
  const message = String(value || "").trim();

  if (!panel) return;

  panel.hidden = !message;
  setText("castMessage", message);
}

function renderSlider(images, name) {
  sliderState.images = images;
  sliderState.currentIndex = 0;

  const thumbnails = document.getElementById("castThumbnails");
  const prev = document.getElementById("castSlidePrev");
  const next = document.getElementById("castSlideNext");
  const expand = document.getElementById("castImageExpand");
  const hasMultiple = images.length > 1;

  if (thumbnails) {
    thumbnails.innerHTML = "";
    thumbnails.hidden = images.length < 2;

    images.forEach((image, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `cast-thumb${index === 0 ? " is-active" : ""}`;
      button.setAttribute("aria-label", `${index + 1}枚目の写真を表示`);
      button.innerHTML = `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(name)} ${index + 1}">`;
      button.addEventListener("click", () => showSlide(index));
      thumbnails.appendChild(button);
    });
  }

  if (prev) prev.hidden = !hasMultiple;
  if (next) next.hidden = !hasMultiple;
  if (expand) expand.hidden = images.length === 0;

  showSlide(0, false, name);
}

function showSlide(index, animate = true, fallbackName = "") {
  const image = document.getElementById("castImage");
  const stage = document.getElementById("castSliderStage");
  const counter = document.getElementById("castSlideCounter");
  const total = sliderState.images.length;

  if (!image || !stage) return;

  if (!total) {
    image.hidden = true;
    image.removeAttribute("src");
    renderNoImagePlaceholder(image);
    if (counter) counter.hidden = true;
    return;
  }

  sliderState.currentIndex = (index + total) % total;
  const source = sliderState.images[sliderState.currentIndex];

  removeNoImagePlaceholder();
  image.hidden = false;
  image.alt = fallbackName || document.getElementById("castName")?.textContent || "Cast";

  if (animate) {
    stage.classList.remove("is-changing");
    void stage.offsetWidth;
    stage.classList.add("is-changing");
  }

  image.src = source;
  document.querySelectorAll("#castThumbnails .cast-thumb").forEach((thumb, thumbIndex) => {
    thumb.classList.toggle("is-active", thumbIndex === sliderState.currentIndex);
    thumb.setAttribute("aria-current", thumbIndex === sliderState.currentIndex ? "true" : "false");
  });

  if (counter) {
    counter.hidden = total < 2;
    counter.textContent = `${sliderState.currentIndex + 1} / ${total}`;
  }
}

function setupSliderControls() {
  const stage = document.getElementById("castSliderStage");
  const lightbox = document.getElementById("castLightbox");

  document.getElementById("castSlidePrev")?.addEventListener("click", () => {
    showSlide(sliderState.currentIndex - 1);
  });
  document.getElementById("castSlideNext")?.addEventListener("click", () => {
    showSlide(sliderState.currentIndex + 1);
  });

  stage?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showSlide(sliderState.currentIndex - 1);
    if (event.key === "ArrowRight") showSlide(sliderState.currentIndex + 1);
  });

  stage?.addEventListener("click", (event) => {
    if (event.target !== document.getElementById("castImage") || !sliderState.images.length) return;
    openLightbox();
  });
  document.getElementById("castImageExpand")?.addEventListener("click", openLightbox);

  stage?.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    sliderState.touchStartX = touch.clientX;
    sliderState.touchStartY = touch.clientY;
  }, { passive: true });

  stage?.addEventListener("touchend", (event) => {
    if (sliderState.images.length < 2) return;

    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - sliderState.touchStartX;
    const distanceY = touch.clientY - sliderState.touchStartY;

    if (Math.abs(distanceX) < 45 || Math.abs(distanceX) <= Math.abs(distanceY)) return;
    showSlide(sliderState.currentIndex + (distanceX < 0 ? 1 : -1));
  }, { passive: true });

  document.getElementById("castLightboxClose")?.addEventListener("click", closeLightbox);
  document.getElementById("castLightboxPrev")?.addEventListener("click", () => showLightboxSlide(sliderState.currentIndex - 1));
  document.getElementById("castLightboxNext")?.addEventListener("click", () => showLightboxSlide(sliderState.currentIndex + 1));

  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  lightbox?.addEventListener("keydown", handleLightboxKeydown);
  lightbox?.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    sliderState.lightboxTouchStartX = touch.clientX;
    sliderState.lightboxTouchStartY = touch.clientY;
  }, { passive: true });
  lightbox?.addEventListener("touchend", (event) => {
    if (sliderState.images.length < 2) return;
    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - sliderState.lightboxTouchStartX;
    const distanceY = touch.clientY - sliderState.lightboxTouchStartY;
    if (Math.abs(distanceX) < 45 || Math.abs(distanceX) <= Math.abs(distanceY)) return;
    showLightboxSlide(sliderState.currentIndex + (distanceX < 0 ? 1 : -1));
  }, { passive: true });
}

function openLightbox() {
  const lightbox = document.getElementById("castLightbox");
  if (!lightbox || !sliderState.images.length) return;
  sliderState.returnFocus = document.activeElement;
  lightbox.hidden = false;
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-cast-lightbox-open");
  showLightboxSlide(sliderState.currentIndex);
  document.getElementById("castLightboxClose")?.focus();
}

function closeLightbox() {
  const lightbox = document.getElementById("castLightbox");
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-cast-lightbox-open");
  if (sliderState.returnFocus instanceof HTMLElement) sliderState.returnFocus.focus();
}

function showLightboxSlide(index) {
  const image = document.getElementById("castLightboxImage");
  const counter = document.getElementById("castLightboxCounter");
  const total = sliderState.images.length;
  if (!image || !total) return;
  sliderState.currentIndex = (index + total) % total;
  image.src = sliderState.images[sliderState.currentIndex];
  image.alt = `${document.getElementById("castName")?.textContent || "キャスト"} ${sliderState.currentIndex + 1}枚目`;
  if (counter) counter.textContent = `${sliderState.currentIndex + 1} / ${total}`;
  showSlide(sliderState.currentIndex, false);
}

function handleLightboxKeydown(event) {
  if (event.key === "Escape") {
    closeLightbox();
    return;
  }
  if (event.key === "ArrowLeft") showLightboxSlide(sliderState.currentIndex - 1);
  if (event.key === "ArrowRight") showLightboxSlide(sliderState.currentIndex + 1);
  if (event.key !== "Tab") return;

  const lightbox = document.getElementById("castLightbox");
  const controls = [...lightbox.querySelectorAll("button:not([hidden])")];
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderNoImagePlaceholder(imageElement) {
  if (document.getElementById("castImagePlaceholder")) return;

  const placeholder = document.createElement("div");
  placeholder.id = "castImagePlaceholder";
  placeholder.className = "cast-main-no-image";
  placeholder.textContent = "NO IMAGE";
  imageElement.insertAdjacentElement("afterend", placeholder);
}

function removeNoImagePlaceholder() {
  document.getElementById("castImagePlaceholder")?.remove();
}

function renderBadges(cast) {
  const stage = document.getElementById("castSliderStage");
  const badges = [];

  document.querySelector(".cast-detail-image-badges")?.remove();

  if (isBadgeEnabled(cast?.isNew)) {
    badges.push(createNewBadgeImage());
  }
  if (isBadgeEnabled(cast?.isRecommended) || cast?.badgeText) {
    badges.push(createRecommendedBadgeImage(cast?.badgeText || "おすすめ"));
  }
  if (!stage || !badges.length) return;

  const layer = document.createElement("div");
  layer.className = "cast-detail-image-badges cast-badge-layer";
  layer.innerHTML = badges.join("");
  stage.appendChild(layer);
}

function createNewBadgeImage() {
  return `
    <span class="premium-cast-badge premium-cast-badge-new" aria-label="NEW 新人">
      <img class="premium-cast-badge-img premium-cast-badge-img-new" src="assets/img/badges/badge-new.png" alt="NEW 新人" loading="lazy">
    </span>
  `;
}

function createRecommendedBadgeImage(label) {
  const safeLabel = escapeAttribute(label);

  return `
    <span class="premium-cast-badge premium-cast-badge-recommended" aria-label="${safeLabel}">
      <img class="premium-cast-badge-img premium-cast-badge-img-recommended" src="assets/img/badges/badge-osusume.png" alt="${safeLabel}" loading="lazy">
    </span>
  `;
}

function renderTags(tags) {
  const wrap = document.getElementById("castTags");

  if (!wrap) return;

  wrap.innerHTML = "";
  tags.forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    wrap.appendChild(span);
  });
  wrap.hidden = tags.length === 0;
}

function renderSns(cast) {
  const wrap = document.getElementById("castSns");
  const links = [
    { key: "instagram", label: "Instagram", icon: "IG", value: cast?.instagram },
    { key: "x", label: "X", icon: "X", value: cast?.x },
    { key: "line", label: "LINE", icon: "LINE", value: cast?.line }
  ].map((item) => ({ ...item, url: normalizeSocialUrl(item.key, item.value) }))
    .filter((item) => item.url);

  if (!wrap) return;

  wrap.innerHTML = "";
  links.forEach(({ label, icon, url }) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${label}を開く`);
    link.innerHTML = `<span aria-hidden="true">${icon}</span><strong>${label}</strong>`;
    wrap.appendChild(link);
  });
  wrap.hidden = links.length === 0;
}

async function loadWeeklySchedule(cast) {
  const output = document.getElementById("castWeeklySchedule");
  const days = getUpcomingDays(7);

  if (!output) return;

  try {
    const snapshot = await getDocs(collection(db, "schedules"));
    const schedules = [];

    snapshot.forEach((scheduleDoc) => {
      const schedule = scheduleDoc.data();
      const dateKey = getScheduleDateKey(schedule);

      if (dateKey && isScheduleForCast(schedule, cast)) {
        schedules.push({
          dateKey,
          inactive: isInactiveSchedule(schedule),
          time: getScheduleTime(schedule)
        });
      }
    });

    renderWeeklySchedule(days, schedules);
  } catch (error) {
    console.error("週間出勤読み込み失敗", error);
    renderWeeklySchedule(days, [], true);
  }
}

function renderWeeklySchedule(days, schedules, unavailable = false) {
  const output = document.getElementById("castWeeklySchedule");

  if (!output) return;

  output.innerHTML = "";
  days.forEach((day) => {
    const entries = schedules.filter((schedule) => schedule.dateKey === day.dateKey);
    const working = entries.find((entry) => !entry.inactive);
    const item = document.createElement("article");
    const status = unavailable ? "お問い合わせ" : (working?.time || (working ? "出勤" : "休み"));

    item.className = `cast-weekly-item${working ? " is-working" : " is-off"}`;
    item.innerHTML = `
      <time datetime="${day.dateKey}">${day.label}</time>
      <strong>${escapeHtml(status)}</strong>
    `;
    output.appendChild(item);
  });
}

function setupFavorite(cast) {
  const button = document.getElementById("castFavoriteButton");

  if (!button) return;

  const castKey = String(cast?.id || cast?.name || "cast");
  button.dataset.favoriteCast = castKey;
  button.dataset.favoriteCastName = String(cast?.name || "キャスト");
  button.dataset.favoriteLabelInactive = "♡ お気に入りに登録";
  button.dataset.favoriteLabelActive = "♥ お気に入り登録済み";
  window.dispatchEvent(new CustomEvent("chouchou:favorites-render"));
}

function setupCastReservations(cast) {
  const name = String(cast?.name || "キャスト").trim();
  const enabled = cast?.lineReservationEnabled !== false;
  const lineButton = document.querySelector(".cast-fixed-line");
  const params = new URLSearchParams();
  if (cast?.id) params.set("castId", String(cast.id));
  if (name) params.set("castName", name);
  const webUrl = `reservation.html?${params.toString()}`;

  document.querySelectorAll('a[href^="reservation.html"]').forEach((link) => {
    link.href = webUrl;
    link.dataset.castReservationName = name;
  });

  if (!lineButton) return;
  lineButton.hidden = !enabled;
  if (!enabled) return;
  lineButton.dataset.lineCastName = name;
  lineButton.dataset.lineMessage = `${name}さんを指名して予約したいです。\n\n希望日時：\n\n人数：\n\nご質問：`;
  lineButton.setAttribute("aria-label", `${name}ちゃんを指名してLINE予約`);
  const content = document.createElement("span");
  content.className = "v6-line-content";
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "v6-line-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<path d="M12 3.25c-5.11 0-9.25 3.45-9.25 7.7 0 2.64 1.63 5.09 4.28 6.49l-.72 3.31 3.63-2.23c.68.1 1.37.15 2.06.15 5.11 0 9.25-3.46 9.25-7.72S17.11 3.25 12 3.25Z"/><circle cx="8.25" cy="11" r="1"/><circle cx="12" cy="11" r="1"/><circle cx="15.75" cy="11" r="1"/>';
  const label = document.createElement("span");
  label.className = "v6-line-label";
  label.textContent = `${name}ちゃんを指名 LINE予約`;
  content.append(icon, label);
  lineButton.replaceChildren(content);
}

async function loadRelatedCasts(currentCast) {
  const section = document.getElementById("relatedCasts");
  const list = document.getElementById("relatedCastList");
  if (!section || !list) return;

  try {
    const snapshot = await getDocs(collection(db, "casts"));
    const currentTags = new Set(getTags(currentCast));
    const casts = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((cast) => cast.isPublished !== false)
      .filter((cast) => String(cast.id) !== String(currentCast?.id || ""))
      .filter((cast) => getCastImages(cast).length)
      .sort((a, b) => relatedCastScore(b, currentTags) - relatedCastScore(a, currentTags) || compareCastDisplayOrder(a, b))
      .slice(0, 3);

    section.hidden = casts.length === 0;
    list.innerHTML = casts.length
      ? casts.map(createRelatedCastMarkup).join("")
      : '<p class="cast-related-state">おすすめキャストを準備中です。</p>';
  } catch (error) {
    console.error("関連キャスト読み込み失敗", error);
    section.hidden = true;
  }
}

function relatedCastScore(cast, currentTags) {
  const tagMatches = getTags(cast).filter((tag) => currentTags.has(tag)).length;
  return (isBadgeEnabled(cast?.isRecommended) ? 100 : 0) + tagMatches * 10 + (isBadgeEnabled(cast?.isNew) ? 1 : 0);
}

function compareCastDisplayOrder(a, b) {
  const aOrder = numericDisplayOrder(a?.displayOrder);
  const bOrder = numericDisplayOrder(b?.displayOrder);
  if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
  if (aOrder !== null) return -1;
  if (bOrder !== null) return 1;
  return String(a?.name || "").localeCompare(String(b?.name || ""), "ja");
}

function numericDisplayOrder(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createRelatedCastMarkup(cast) {
  const name = String(cast?.name || "CAST").trim();
  const image = getCastImages(cast)[0];
  const detailUrl = `cast-detail.html?id=${encodeURIComponent(cast.id)}&name=${encodeURIComponent(name)}`;
  return `<article class="cast-related-card card-premium"><a href="${escapeAttribute(detailUrl)}" aria-label="${escapeAttribute(name)}のプロフィールを見る"><div class="cast-related-photo"><img src="${escapeAttribute(image)}" alt="${escapeAttribute(name)}" loading="lazy" decoding="async">${isBadgeEnabled(cast?.isRecommended) ? '<span class="badge-premium">おすすめ</span>' : ""}</div><div class="cast-related-info"><h3>${escapeHtml(name)}</h3><span aria-hidden="true"></span><strong>プロフィールを見る</strong></div></a></article>`;
}

function getCastImages(cast) {
  const candidates = [
    cast?.image,
    cast?.imageUrl,
    cast?.mainImage,
    cast?.photo,
    cast?.photoUrl,
    cast?.profileImage,
    cast?.galleryImages,
    cast?.images,
    cast?.photos,
    cast?.imageUrls
  ].flatMap(normalizeImageValue);

  return [...new Set(candidates.map((value) => String(value).trim()).filter(Boolean))].slice(0, 5);
}

function normalizeImageValue(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [text];
      } catch {
        return [text];
      }
    }
    return text.includes(",") ? text.split(",").map((item) => item.trim()) : [text];
  }

  return [];
}

function parseImageParam(value) {
  return normalizeImageValue(value).slice(0, 5);
}

function getTags(cast) {
  if (Array.isArray(cast?.tags)) return cast.tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  if (typeof cast?.tags === "string") return parseTags(cast.tags);
  return [];
}

function parseTags(value) {
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function getUpcomingDays(total) {
  const today = getTokyoDateKey();
  const [year, month, day] = today.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, 12));

  return Array.from({ length: total }, (_, index) => {
    const date = new Date(base.getTime() + index * 86400000);
    const dateKey = date.toISOString().slice(0, 10);
    const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date);

    return {
      dateKey,
      label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${weekday})`
    };
  });
}

function getTokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
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

function isScheduleForCast(schedule, cast) {
  const castId = String(cast?.id || "").trim();
  const castName = String(cast?.name || "").trim();
  const scheduleId = String(schedule?.castId || schedule?.castID || schedule?.castDocId || schedule?.cast_id || schedule?.castRef?.id || "").trim();
  const scheduleName = String(schedule?.castName || schedule?.name || schedule?.cast || schedule?.cast_name || schedule?.girlName || "").trim();

  return Boolean(
    (scheduleId && [castId, castName].includes(scheduleId)) ||
    (scheduleName && [castName, castId].includes(scheduleName))
  );
}

function getScheduleTime(schedule) {
  const start = schedule?.start || schedule?.startTime || schedule?.from || "";
  const end = schedule?.end || schedule?.endTime || schedule?.to || "";

  if (start && end) return `${start}〜${end}`;
  return String(start || end || schedule?.time || schedule?.workTime || schedule?.scheduleTime || schedule?.shift || "").trim();
}

function isInactiveSchedule(schedule) {
  const status = String(schedule?.status || schedule?.attendanceStatus || "").trim().toLowerCase();
  return ["休み", "欠勤", "cancel", "canceled", "cancelled"].includes(status) || schedule?.isOff === true || schedule?.off === true;
}

function normalizeSocialUrl(type, value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;

  const account = text.replace(/^@/, "");
  if (type === "instagram") return `https://www.instagram.com/${encodeURIComponent(account)}/`;
  if (type === "x") return `https://x.com/${encodeURIComponent(account)}`;
  if (type === "line") return `https://line.me/R/ti/p/${encodeURIComponent(account)}`;
  return "";
}

function updateSeoMetadata(cast, name) {
  const profileSummary = [formatAge(cast?.age), formatHeight(cast?.height)]
    .filter(Boolean)
    .join("・");
  const message = String(cast?.message || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const description = [
    `Chou Chou（シュシュ）キャスト「${name}」のプロフィール。`,
    profileSummary ? `${profileSummary}。` : "",
    message ? `${message} ` : "",
    "写真ギャラリー、プロフィール、今週の出勤予定、指名予約をご案内します。"
  ].join("");
  const title = `${name} | キャストプロフィール | Chou Chou`;
  const image = getCastImages(cast)[0] || "";
  const canonicalUrl = cast?.id
    ? `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(cast.id)}`
    : window.location.href;

  document.title = title;
  setMetaContent("castMetaDescription", description);
  setMetaContent("castOgTitle", title);
  setMetaContent("castOgDescription", description);
  setMetaContent("castOgImage", image);
  setMetaContent("castOgUrl", canonicalUrl);
  setMetaContent("castTwitterTitle", title);
  setMetaContent("castTwitterDescription", description);
  setMetaContent("castTwitterImage", image);
  document.getElementById("castCanonical")?.setAttribute("href", canonicalUrl);
  updateStructuredData(cast, name, description, image, canonicalUrl);
}

function updateStructuredData(cast, name, description, image, url) {
  let script = document.getElementById("castStructuredData");
  if (!script) {
    script = document.createElement("script");
    script.id = "castStructuredData";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    description,
    image: image || undefined,
    url,
    worksFor: { "@type": "Organization", name: "Chou Chou" }
  });
}

function setMetaContent(id, value) {
  document.getElementById(id)?.setAttribute("content", value);
}

function formatAge(value) {
  const text = String(value || "").trim();
  return text ? (text.endsWith("歳") ? text : `${text}歳`) : "";
}

function formatHeight(value) {
  const text = String(value || "").trim();
  return text ? (/cm$/i.test(text) ? text : `${text}cm`) : "";
}

function isBadgeEnabled(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "on" || value === "yes";
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value || "");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
