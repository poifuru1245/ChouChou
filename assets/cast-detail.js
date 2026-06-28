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

  if (isBadgeEnabled(cast?.isNew)) {
    badges.push(["premium-cast-badge-new", "new"]);
  }

  if (isBadgeEnabled(cast?.isRecommended)) {
    badges.push(["premium-cast-badge-recommended", "recommended"]);
  }

  if (cast?.badgeText) {
    badges.push(["premium-cast-badge-recommended", cast.badgeText]);
  }

  return badges;
}

function createBadgeHtml([className, label]) {
  if (label === "new") {
    return createNewBadgeImage(className);
  }

  const badgeLabel = label === "recommended" ? "おすすめ" : label;
  return createRecommendedBadgeImage(className, badgeLabel);
}

function createNewBadgeImage(className = "premium-cast-badge-new") {
  return `
    <span class="premium-cast-badge ${className}" aria-label="NEW 新人">
      <img class="premium-cast-badge-img premium-cast-badge-img-new" src="assets/img/badge-new.png" alt="NEW 新人" loading="lazy">
    </span>
  `;
}

function createRecommendedBadgeImage(className = "premium-cast-badge-recommended", label = "おすすめ") {
  const safeLabel = escapeAttribute(label);

  return `
    <span class="premium-cast-badge ${className}" aria-label="${safeLabel}">
      <img class="premium-cast-badge-img premium-cast-badge-img-recommended" src="assets/img/badge-osusume.png" alt="${safeLabel}" loading="lazy">
    </span>
  `;
}

function isBadgeEnabled(value) {
  return value === true || String(value).toLowerCase() === "true";
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
