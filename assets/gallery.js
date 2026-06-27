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
    if (!items.length) {
      grid.innerHTML = `<p class="gallery-empty">店内写真準備中</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      if (!item.imageUrl) return;
      fragment.appendChild(createGalleryItem(item));
    });

    grid.innerHTML = "";

    if (!fragment.childNodes.length) {
      grid.innerHTML = `<p class="gallery-empty">店内写真準備中</p>`;
      return;
    }

    grid.appendChild(fragment);
  });
}

function createGalleryItem(item) {
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

  button.addEventListener("click", () => openLightbox(item));

  return button;
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
