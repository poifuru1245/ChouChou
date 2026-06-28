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
      <svg class="premium-cast-badge-svg premium-cast-badge-svg-new" viewBox="0 0 64 78" role="img" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="detailNewBadgeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffb8dc"/>
            <stop offset="40%" stop-color="#ff4fad"/>
            <stop offset="72%" stop-color="#df0f86"/>
            <stop offset="100%" stop-color="#990657"/>
          </linearGradient>
          <linearGradient id="detailNewBadgeShine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff" stop-opacity=".72"/>
            <stop offset="48%" stop-color="#fff" stop-opacity=".18"/>
            <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
          </linearGradient>
          <filter id="detailNewBadgeShadow" x="-25%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#5e1438" flood-opacity=".32"/>
          </filter>
        </defs>
        <path d="M12 5H52Q57 5 57 10V61L43 61L32 74L21 61H7V10Q7 5 12 5Z" fill="url(#detailNewBadgeFill)" stroke="#ffe9a9" stroke-width="3" filter="url(#detailNewBadgeShadow)"/>
        <path d="M13 9H51Q53 9 53 11V17Q34 8 11 28V11Q11 9 13 9Z" fill="url(#detailNewBadgeShine)"/>
        <path d="M13 5H51Q57 5 57 11V22H7V11Q7 5 13 5Z" fill="#ffffff" opacity=".08"/>
        <text x="32" y="30" text-anchor="middle" fill="#fff" font-size="16" font-weight="900" font-family="Arial, sans-serif" letter-spacing=".8">NEW</text>
        <text x="32" y="50" text-anchor="middle" fill="#fff" font-size="14" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif">新人</text>
      </svg>
    </span>
  `;
}

function createRecommendedBadgeSvg(className = "premium-cast-badge-recommended", label = "おすすめ") {
  const safeLabel = escapeAttribute(label);

  return `
    <span class="premium-cast-badge ${className}" aria-label="${safeLabel}">
      <svg class="premium-cast-badge-svg premium-cast-badge-svg-recommended" viewBox="0 0 74 58" role="img" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="detailRecommendedBadgeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff4b6"/>
            <stop offset="34%" stop-color="#f4c948"/>
            <stop offset="70%" stop-color="#c78612"/>
            <stop offset="100%" stop-color="#7a4b05"/>
          </linearGradient>
          <radialGradient id="detailRecommendedBadgeGlow" cx=".32" cy=".18" r=".72">
            <stop offset="0%" stop-color="#fff" stop-opacity=".78"/>
            <stop offset="45%" stop-color="#fff" stop-opacity=".16"/>
            <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
          </radialGradient>
          <filter id="detailRecommendedBadgeShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#573500" flood-opacity=".34"/>
          </filter>
        </defs>
        <path d="M37 4C41 10 48 7 52 13C59 13 62 19 59 25C66 29 64 37 57 39C57 47 50 51 43 48C39 55 31 55 27 48C20 51 13 47 13 39C6 37 8 29 15 25C12 19 15 13 22 13C26 7 33 10 37 4Z" fill="url(#detailRecommendedBadgeFill)" stroke="#8d5c08" stroke-width="3" filter="url(#detailRecommendedBadgeShadow)"/>
        <path d="M22 15C31 8 45 9 53 17C44 14 28 17 16 29C15 24 17 19 22 15Z" fill="url(#detailRecommendedBadgeGlow)"/>
        <path d="M20 18C28 12 46 12 54 22" fill="none" stroke="#fff7c8" stroke-width="2" stroke-linecap="round" opacity=".55"/>
        <text x="37" y="35" text-anchor="middle" fill="#fff" font-size="13" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif" paint-order="stroke" stroke="#8b5705" stroke-width="2" stroke-linejoin="round">${safeLabel}</text>
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
