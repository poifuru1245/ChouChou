import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./app.js";

const PHOTO_COLLECTION = "gallery";

const elements = {
  photoWrapper: document.getElementById("recruitPhotoWrapper"),
  swiperRoot: document.getElementById("recruitPhotoSwiper")
};

let recruitSwiper = null;

if (elements.photoWrapper) {
  loadRecruitPhotos();
}

async function loadRecruitPhotos() {
  try {
    const snapshot = await getDocs(collection(db, PHOTO_COLLECTION));
    const photos = [];

    snapshot.forEach((docSnap) => {
      photos.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    const imageItems = photos
      .filter((item) => Boolean(item.imageUrl))
      .sort(sortByDisplayOrder)
      .slice(0, 8);

    renderPhotoSlides(imageItems);
  } catch (error) {
    console.error("Recruit写真読み込み失敗", error);
    renderPhotoSlides([]);
  }
}

function renderPhotoSlides(items) {
  if (!items.length) {
    elements.photoWrapper.innerHTML = `<div class="swiper-slide recruit-photo-placeholder">店内写真準備中</div>`;
    initRecruitSwiper();
    return;
  }

  elements.photoWrapper.innerHTML = items.map((item) => `
    <div class="swiper-slide recruit-photo-slide">
      <img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.title || "店内写真")}" loading="lazy">
      ${item.title ? `<p>${escapeHtml(item.title)}</p>` : ""}
    </div>
  `).join("");

  initRecruitSwiper();
}

function initRecruitSwiper() {
  if (!elements.swiperRoot || typeof window.Swiper !== "function") return;

  if (recruitSwiper) {
    recruitSwiper.destroy(true, true);
  }

  recruitSwiper = new window.Swiper(elements.swiperRoot, {
    loop: elements.photoWrapper.children.length > 1,
    spaceBetween: 22,
    slidesPerView: 1,
    pagination: {
      el: ".recruit-photo-swiper .swiper-pagination",
      clickable: true
    },
    navigation: {
      nextEl: ".recruit-photo-swiper .swiper-button-next",
      prevEl: ".recruit-photo-swiper .swiper-button-prev"
    },
    breakpoints: {
      768: {
        slidesPerView: 2
      },
      1100: {
        slidesPerView: 3
      }
    }
  });
}

function sortByDisplayOrder(a, b) {
  const aOrder = Number(a.displayOrder);
  const bOrder = Number(b.displayOrder);

  if (Number.isFinite(aOrder) && Number.isFinite(bOrder)) return aOrder - bOrder;
  if (Number.isFinite(aOrder)) return -1;
  if (Number.isFinite(bOrder)) return 1;

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
