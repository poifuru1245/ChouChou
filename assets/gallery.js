import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./app.js";

const COLLECTION_NAME = "gallery";

const elements = {
  grids: [
    ...document.querySelectorAll(".public-gallery-grid")
  ],
  lightbox: document.getElementById("galleryLightbox"),
  lightboxImage: document.getElementById("galleryLightboxImage"),
  lightboxTitle: document.getElementById("galleryLightboxTitle"),
  lightboxClose: document.getElementById("galleryLightboxClose"),
  lightboxBackdrop: document.getElementById("galleryLightboxBackdrop")
};

if (elements.grids.length) {
  loadGallery();
  bindLightboxEvents();
}

async function loadGallery() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const items = [];

    snapshot.forEach((docSnap) => {
      items.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    sortGalleryItems(items);
    renderGallery(items);
  } catch (error) {
    console.error("ギャラリー読み込み失敗", error);
    elements.grids.forEach((grid) => {
      grid.innerHTML = `<p class="gallery-empty">ギャラリーの読み込みに失敗しました。</p>`;
    });
  }
}

function renderGallery(items) {
  elements.grids.forEach((grid) => {
    const limit = Number(grid.dataset.limit || 0);
    const visibleItems = limit > 0 ? items.slice(0, limit) : items;

    if (!visibleItems.length) {
      grid.innerHTML = `<p class="gallery-empty">店内写真準備中</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    const isPremiumGallery = Boolean(grid.closest(".gallery"));

    visibleItems.forEach((item) => {
      if (!item.imageUrl) return;
      fragment.appendChild(createGalleryItem(item, { premium: isPremiumGallery }));
    });

    grid.innerHTML = "";

    if (!fragment.childNodes.length) {
      grid.innerHTML = `<p class="gallery-empty">店内写真準備中</p>`;
      return;
    }

    grid.appendChild(fragment);

    if (isPremiumGallery) {
      initializePremiumGalleryReveal(grid);
    }
  });
}

function createGalleryItem(item, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "public-gallery-item";
  button.dataset.imageUrl = item.imageUrl || "";
  button.dataset.title = item.title || "";
  button.setAttribute("aria-label", item.title || "ギャラリー画像を表示");
  let lightboxItem = item;

  const imageMarkup = `
    <img
      src="${escapeAttribute(item.imageUrl || "")}"
      alt="${escapeAttribute(item.title || "")}"
      loading="lazy"
    >
  `;

  if (options.premium) {
    const category = getGalleryCategory(item);
    const title = getPremiumGalleryTitle(item, category);
    const description = getPremiumGalleryDescription(item, category);

    button.classList.add("premium-gallery-item");
    button.dataset.title = title;
    button.setAttribute("aria-label", `${title}の画像を表示`);
    lightboxItem = { ...item, title };
    button.innerHTML = `
      ${imageMarkup}
      <span class="public-gallery-category">${escapeHtml(category)}</span>
      <span class="public-gallery-glass">
        <span class="public-gallery-title">${escapeHtml(title)}</span>
        <span class="public-gallery-description">${escapeHtml(description)}</span>
      </span>
    `;
  } else {
    button.innerHTML = `
      ${imageMarkup}
      ${item.title ? `<span>${escapeHtml(item.title)}</span>` : ""}
    `;
  }

  button.addEventListener("click", () => openLightbox(lightboxItem));

  return button;
}

function getGalleryCategory(item) {
  const configuredCategory = String(
    item?.category ||
    item?.galleryCategory ||
    item?.type ||
    ""
  ).trim();

  if (configuredCategory) {
    return configuredCategory.toUpperCase();
  }

  const normalizedTitle = String(item?.title || "").toLowerCase();
  const categoryRules = [
    { label: "VIP", keywords: ["vip"] },
    { label: "CHAMPAGNE", keywords: ["champagne", "シャンパン"] },
    { label: "EVENT", keywords: ["event", "イベント"] },
    { label: "LOUNGE", keywords: ["lounge", "ラウンジ", "フロア"] },
    { label: "INTERIOR", keywords: ["interior", "インテリア", "内装", "店内"] }
  ];

  return categoryRules.find((rule) =>
    rule.keywords.some((keyword) => normalizedTitle.includes(keyword))
  )?.label || "INTERIOR";
}

function getPremiumGalleryTitle(item, category) {
  const title = String(item?.title || "").trim();

  if (title) return title;

  const fallbackTitles = {
    VIP: "VIP Room",
    CHAMPAGNE: "Champagne Selection",
    EVENT: "Special Event",
    LOUNGE: "Private Lounge",
    INTERIOR: "Main Floor"
  };

  return fallbackTitles[category] || "Chou Chou Gallery";
}

function getPremiumGalleryDescription(item, category) {
  const description = String(
    item?.description ||
    item?.caption ||
    item?.subtitle ||
    ""
  ).trim();

  if (description) return description;

  const fallbackDescriptions = {
    VIP: "静けさと品格を備えた特別な空間。",
    CHAMPAGNE: "華やかな時間を彩るセレクション。",
    EVENT: "特別な夜を演出するイベントシーン。",
    LOUNGE: "上質なくつろぎを叶えるラウンジ。",
    INTERIOR: "やさしい光に包まれたメインフロア。"
  };

  return fallbackDescriptions[category] || fallbackDescriptions.INTERIOR;
}

function initializePremiumGalleryReveal(grid) {
  const items = [...grid.querySelectorAll(".premium-gallery-item")];

  if (!items.length) return;

  const revealImmediately =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window);

  if (revealImmediately) {
    items.forEach((item) => item.classList.add("is-gallery-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const item = entry.target;
      const index = items.indexOf(item);
      const delay = Math.max(0, index) * 70;

      window.setTimeout(() => {
        item.classList.add("is-gallery-visible");
      }, delay);

      observer.unobserve(item);
    });
  }, {
    threshold: .12,
    rootMargin: "0px 0px -6% 0px"
  });

  items.forEach((item) => observer.observe(item));
}

function openLightbox(item) {
  if (!elements.lightbox || !elements.lightboxImage) return;

  elements.lightboxImage.src = item.imageUrl || "";
  elements.lightboxImage.alt = item.title || "";

  if (elements.lightboxTitle) {
    elements.lightboxTitle.textContent = item.title || "";
  }

  elements.lightbox.classList.add("is-open");
  elements.lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-gallery-lightbox-open");
}

function closeLightbox() {
  if (!elements.lightbox || !elements.lightboxImage) return;

  elements.lightbox.classList.remove("is-open");
  elements.lightbox.setAttribute("aria-hidden", "true");
  elements.lightboxImage.src = "";
  document.body.classList.remove("is-gallery-lightbox-open");
}

function bindLightboxEvents() {
  elements.lightboxClose?.addEventListener("click", closeLightbox);
  elements.lightboxBackdrop?.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
}

function sortGalleryItems(items) {
  items.sort((a, b) => {
    const aOrder = getNumericDisplayOrder(a);
    const bOrder = getNumericDisplayOrder(b);

    if (aOrder !== null && bOrder !== null) {
      return aOrder - bOrder;
    }

    if (aOrder !== null) return -1;
    if (bOrder !== null) return 1;

    return getCreatedAtTime(a) - getCreatedAtTime(b);
  });
}

function getNumericDisplayOrder(item) {
  if (
    item?.displayOrder === undefined ||
    item?.displayOrder === null ||
    item?.displayOrder === ""
  ) {
    return null;
  }

  const order = Number(item.displayOrder);
  return Number.isFinite(order) ? order : null;
}

function getCreatedAtTime(item) {
  if (typeof item?.createdAt?.toMillis === "function") {
    return item.createdAt.toMillis();
  }

  if (typeof item?.createdAt === "number") {
    return item.createdAt;
  }

  return 0;
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
