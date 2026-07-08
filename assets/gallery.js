import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./app.js";

const COLLECTION_NAME = "gallery";
const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_COUNT = 3;

const elements = {
  grids: [
    ...document.querySelectorAll(".public-gallery-grid")
  ],
  moreButton: document.getElementById("galleryMoreButton"),
  lightbox: document.getElementById("galleryLightbox"),
  lightboxImage: document.getElementById("galleryLightboxImage"),
  lightboxTitle: document.getElementById("galleryLightboxTitle"),
  lightboxClose: document.getElementById("galleryLightboxClose"),
  lightboxBackdrop: document.getElementById("galleryLightboxBackdrop"),
  lightboxPrev: document.getElementById("galleryLightboxPrev"),
  lightboxNext: document.getElementById("galleryLightboxNext")
};

let galleryItems = [];
let activeGalleryIndex = 0;
let visibleGalleryCount = INITIAL_VISIBLE_COUNT;

if (elements.grids.length) {
  loadGallery();
  bindLightboxEvents();
  bindGalleryMore();
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
  galleryItems = items.filter((item) => Boolean(item.imageUrl));
  visibleGalleryCount = Math.min(INITIAL_VISIBLE_COUNT, galleryItems.length);

  elements.grids.forEach((grid) => {
    if (!galleryItems.length) {
      grid.innerHTML = `<p class="gallery-empty">店内写真準備中</p>`;
      updateGalleryMoreButton();
      return;
    }

    renderVisibleGalleryItems(grid);
  });

  updateGalleryMoreButton();
}

function renderVisibleGalleryItems(grid) {
  const fragment = document.createDocumentFragment();

  galleryItems.slice(0, visibleGalleryCount).forEach((item, index) => {
    fragment.appendChild(createGalleryItem(item, index));
  });

  grid.innerHTML = "";

  if (!fragment.childNodes.length) {
    grid.innerHTML = `<p class="gallery-empty">店内写真準備中</p>`;
    return;
  }

  grid.appendChild(fragment);
}

function bindGalleryMore() {
  elements.moreButton?.addEventListener("click", () => {
    visibleGalleryCount = Math.min(visibleGalleryCount + LOAD_MORE_COUNT, galleryItems.length);

    elements.grids.forEach((grid) => {
      renderVisibleGalleryItems(grid);
    });

    updateGalleryMoreButton();
  });
}

function updateGalleryMoreButton() {
  if (!elements.moreButton) return;

  elements.moreButton.hidden = visibleGalleryCount >= galleryItems.length;
}

function createGalleryItem(item, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "public-gallery-item";
  button.dataset.imageUrl = item.imageUrl || "";
  button.dataset.title = item.title || "";
  button.setAttribute("aria-label", item.title || "ギャラリー画像を表示");

  button.innerHTML = `
    <img
      src="${escapeAttribute(item.imageUrl || "")}"
      alt="${escapeAttribute(item.title || "")}"
      loading="lazy"
    >
    ${item.title ? `<span>${escapeHtml(item.title)}</span>` : ""}
  `;

  button.addEventListener("click", () => openLightbox(index));

  return button;
}

function openLightbox(index) {
  if (!elements.lightbox || !elements.lightboxImage) return;

  const item = galleryItems[index];
  if (!item) return;

  activeGalleryIndex = index;
  updateLightbox(item);
  updateLightboxNavigation();
  elements.lightbox.classList.add("is-open");
  elements.lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-gallery-lightbox-open");
}

function updateLightbox(item) {
  elements.lightboxImage.src = item.imageUrl || "";
  elements.lightboxImage.alt = item.title || "";

  if (elements.lightboxTitle) {
    elements.lightboxTitle.textContent = item.title || "";
  }
}

function showLightboxItem(direction) {
  if (!galleryItems.length) return;

  activeGalleryIndex = (activeGalleryIndex + direction + galleryItems.length) % galleryItems.length;
  updateLightbox(galleryItems[activeGalleryIndex]);
  updateLightboxNavigation();
}

function updateLightboxNavigation() {
  const shouldShow = galleryItems.length > 1;

  if (elements.lightboxPrev) elements.lightboxPrev.hidden = !shouldShow;
  if (elements.lightboxNext) elements.lightboxNext.hidden = !shouldShow;
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
  elements.lightboxPrev?.addEventListener("click", () => showLightboxItem(-1));
  elements.lightboxNext?.addEventListener("click", () => showLightboxItem(1));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }

    if (!elements.lightbox?.classList.contains("is-open")) return;

    if (event.key === "ArrowLeft") {
      showLightboxItem(-1);
    }

    if (event.key === "ArrowRight") {
      showLightboxItem(1);
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
