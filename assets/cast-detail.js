import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc
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
const params = new URLSearchParams(location.search);

loadCastDetail();

async function loadCastDetail() {
  const cast = await resolveCast();

  renderCast(cast);
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
    name: params.get("name") || "",
    age: params.get("age") || "",
    height: params.get("height") || "",
    birthday: params.get("birthday") || "",
    bloodType: params.get("bloodType") || "",
    hobby: params.get("hobby") || "",
    favoriteDrink: params.get("favoriteDrink") || "",
    message: params.get("message") || "",
    image: params.get("image") || "",
    instagram: params.get("instagram") || "",
    x: params.get("x") || "",
    tiktok: params.get("tiktok") || "",
    tags: parseTags(params.get("tags") || ""),
    isNew: params.get("isNew") === "true",
    isRecommended: params.get("isRecommended") === "true",
    badgeText: params.get("badgeText") || ""
  };
}

function renderCast(cast) {
  const images = getCastImages(cast);
  const mainImage = getMainImage(cast);

  setText("castName", cast.name || "");
  setText("castAge", formatProfileValue("年齢", cast.age ? `${cast.age}歳` : ""));
  setText("castHeight", formatProfileValue("身長", cast.height));
  setText("castBirthday", formatProfileValue("誕生日", cast.birthday));
  setText("castBloodType", formatProfileValue("血液型", cast.bloodType));
  setText("castHobby", formatProfileValue("趣味", cast.hobby));
  setText("castDrink", formatProfileValue("好きなお酒", cast.favoriteDrink));
  setText("castMessage", cast.message || "");

  const imageElement = document.getElementById("castImage");

  if (imageElement) {
    if (mainImage) {
      imageElement.src = mainImage;
      imageElement.classList.remove("is-empty");
      imageElement.hidden = false;
      removeNoImagePlaceholder();
    } else {
      imageElement.removeAttribute("src");
      imageElement.classList.add("is-empty");
      imageElement.hidden = true;
      renderNoImagePlaceholder(imageElement);
    }

    imageElement.alt = cast.name || "Cast";
  }

  renderThumbnails(images, cast.name || "Cast");
  renderBadges(cast);
  renderTags(getTags(cast));
  renderSns(cast);
}

function renderBadges(cast) {
  const gallery = document.querySelector(".cast-gallery");
  const nameElement = document.getElementById("castName");
  const badges = getCastBadges(cast);

  document.querySelectorAll(".cast-detail-badges").forEach((element) => {
    element.remove();
  });

  if (!badges.length) return;

  const imageBadges = document.createElement("div");
  imageBadges.className = "cast-detail-badges cast-detail-image-badges cast-badge-layer";
  imageBadges.innerHTML = badges.map(createBadgeHtml).join("");

  const profileBadges = document.createElement("div");
  profileBadges.className = "cast-detail-badges cast-detail-profile-badges";
  profileBadges.innerHTML = badges.map(createBadgeHtml).join("");

  gallery?.insertAdjacentElement("afterbegin", imageBadges);
  nameElement?.insertAdjacentElement("afterend", profileBadges);
}

function getCastBadges(cast) {
  const badges = [];

  if (cast?.isNew === true) {
    badges.push(["premium-cast-badge-new", "new"]);
  }

  if (cast?.isRecommended === true) {
    badges.push(["premium-cast-badge-recommended", "recommended"]);
  }

  if (cast?.badgeText) {
    badges.push(["premium-cast-badge-recommended", cast.badgeText]);
  }

  return badges;
}

function createBadgeHtml([className, label]) {
  if (label === "new") {
    return createNewBadgeSvg(className);
  }

  const badgeLabel = label === "recommended" ? "おすすめ" : label;
  return createRecommendedBadgeSvg(className, badgeLabel);
}

function createNewBadgeSvg(className = "premium-cast-badge-new") {
  return `
    <span class="premium-cast-badge ${className}" aria-label="NEW 新人">
      <svg class="premium-cast-badge-svg premium-cast-badge-svg-new" viewBox="0 0 70 82" role="img" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="detailNewBadgeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffe0f1"/>
            <stop offset="30%" stop-color="#f6a3cb"/>
            <stop offset="68%" stop-color="#d85c9e"/>
            <stop offset="100%" stop-color="#a63472"/>
          </linearGradient>
          <linearGradient id="detailNewBadgeGloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff" stop-opacity=".88"/>
            <stop offset="42%" stop-color="#fff" stop-opacity=".2"/>
            <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
          </linearGradient>
          <filter id="detailNewBadgeShadow" x="-25%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="2.2" flood-color="#5a2441" flood-opacity=".2"/>
          </filter>
        </defs>
        <path d="M17 3H53Q60 3 60 11V62H48L35 78L22 62H10V11Q10 3 17 3Z" fill="#fffefd" filter="url(#detailNewBadgeShadow)"/>
        <path d="M18 7H52Q57 7 57 13V59H46L35 73L24 59H13V13Q13 7 18 7Z" fill="url(#detailNewBadgeFill)" stroke="#d7bb74" stroke-width="1.35"/>
        <path d="M18 9H52Q56 9 56 14V23Q39 16 14 29V14Q14 9 18 9Z" fill="url(#detailNewBadgeGloss)"/>
        <path d="M18 13Q35 7 52 13" fill="none" stroke="#fff8d8" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>
    <path d="M35 16L36.5 19.2L40 20L36.8 21.5L35 25L33.2 21.5L30 20L33.5 19.2Z" fill="#fff8d8" opacity=".72"/>
        <path d="M17 57H25L35 69L45 57H53" fill="none" stroke="#6e053d" stroke-width="1.2" opacity=".1"/>
        <text x="35" y="32" text-anchor="middle" fill="#fff" font-size="17" font-weight="900" font-family="Arial, sans-serif" letter-spacing="1" paint-order="stroke" stroke="#9f4f7e" stroke-width=".45" stroke-linejoin="round">NEW</text>
        <text x="35" y="53" text-anchor="middle" fill="#fff" font-size="15" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif" paint-order="stroke" stroke="#9f4f7e" stroke-width=".35" stroke-linejoin="round">新人</text>
      </svg>
    </span>
  `;
}

function createRecommendedBadgeSvg(className = "premium-cast-badge-recommended", label = "おすすめ") {
  const safeLabel = escapeAttribute(label);

  return `
    <span class="premium-cast-badge ${className}" aria-label="${safeLabel}">
      <svg class="premium-cast-badge-svg premium-cast-badge-svg-recommended" viewBox="0 0 80 52" role="img" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="detailRecommendedBadgeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff9dd"/>
            <stop offset="32%" stop-color="#ecd38a"/>
            <stop offset="68%" stop-color="#c69b45"/>
            <stop offset="100%" stop-color="#85621f"/>
          </linearGradient>
          <radialGradient id="detailRecommendedBadgeGlow" cx=".32" cy=".18" r=".72">
            <stop offset="0%" stop-color="#fff" stop-opacity=".72"/>
            <stop offset="42%" stop-color="#fff" stop-opacity=".14"/>
            <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
          </radialGradient>
          <filter id="detailRecommendedBadgeShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="2.2" flood-color="#5b4215" flood-opacity=".18"/>
          </filter>
        </defs>
        <path d="M9 16Q21 8 40 8Q59 8 71 16Q76 21 77 26Q76 31 71 36Q59 44 40 44Q21 44 9 36Q4 31 3 26Q4 21 9 16Z" fill="#fffef8" filter="url(#detailRecommendedBadgeShadow)"/>
        <path d="M12 17Q23 11 40 11Q57 11 68 17Q72 21 73 26Q72 31 68 35Q57 41 40 41Q23 41 12 35Q8 31 7 26Q8 21 12 17Z" fill="url(#detailRecommendedBadgeFill)" stroke="#a77d2e" stroke-width="1.35"/>
        <path d="M16 17Q29 11 50 13Q62 14 68 21Q45 15 12 28Q11 21 16 17Z" fill="url(#detailRecommendedBadgeGlow)"/>
        <path d="M15 34Q40 40 65 34" fill="none" stroke="#6b4101" stroke-width="2" opacity=".12"/>
        <path d="M17 19Q40 12 63 19" fill="none" stroke="#fff8d1" stroke-width="1.7" stroke-linecap="round" opacity=".72"/>
        <text x="40" y="32" text-anchor="middle" fill="#fff" font-size="14" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif" paint-order="stroke" stroke="#96733a" stroke-width=".65" stroke-linejoin="round">${safeLabel}</text>
      </svg>
    </span>
  `;
}

function renderThumbnails(images, name) {
  const wrap = document.getElementById("castThumbnails");

  if (!wrap) return;

  wrap.innerHTML = "";

  if (!images.length) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;

  images.forEach((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cast-thumb${index === 0 ? " is-active" : ""}`;
    button.innerHTML = `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(name)} ${index + 1}">`;

    button.addEventListener("click", () => {
      const mainImage = document.getElementById("castImage");
      if (mainImage) mainImage.src = image;

      wrap.querySelectorAll(".cast-thumb").forEach((thumb) => {
        thumb.classList.remove("is-active");
      });
      button.classList.add("is-active");
    });

    wrap.appendChild(button);
  });
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

function renderTags(tags) {
  const wrap = document.getElementById("castTags");

  if (!wrap) return;

  wrap.innerHTML = "";

  tags.forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    wrap.appendChild(span);
  });
}

function renderSns(cast) {
  const wrap = document.getElementById("castSns");
  const links = [
    ["Instagram", cast.instagram],
    ["X", cast.x],
    ["TikTok", cast.tiktok]
  ].filter(([, url]) => Boolean(url));

  if (!wrap) return;

  wrap.innerHTML = "";

  links.forEach(([label, url]) => {
    const link = document.createElement("a");
    link.href = url;
    link.textContent = label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    wrap.appendChild(link);
  });
}

function formatProfileValue(label, value) {
  return value ? `${label}：${value}` : `${label}：-`;
}

function getCastImages(cast) {
  const images = Array.isArray(cast?.images)
    ? cast.images.filter(Boolean)
    : [];

  if (!images.length && cast?.image) {
    return [cast.image];
  }

  return images.slice(0, 5);
}

function getMainImage(cast) {
  return cast?.image || getCastImages(cast)[0] || "";
}

function getTags(cast) {
  if (Array.isArray(cast?.tags)) {
    return cast.tags.filter(Boolean);
  }

  if (typeof cast?.tags === "string") {
    return parseTags(cast.tags);
  }

  return [];
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("`", "&#096;");
}
