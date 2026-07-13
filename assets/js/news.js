import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../app.js";

const COLLECTION_NAME = "news";
const DEFAULT_CATEGORY = "お知らせ";
const mobileHomeQuery = window.matchMedia("(max-width: 767px)");

const lists = [...document.querySelectorAll(".public-news-list")];
let cachedNewsItems = [];

if (lists.length) {
  loadPublicNews();

  if (typeof mobileHomeQuery.addEventListener === "function") {
    mobileHomeQuery.addEventListener("change", () => renderNews(cachedNewsItems));
  } else if (typeof mobileHomeQuery.addListener === "function") {
    mobileHomeQuery.addListener(() => renderNews(cachedNewsItems));
  }
}

async function loadPublicNews() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const items = [];

    snapshot.forEach((docSnap) => {
      const item = normalizeNews({
        id: docSnap.id,
        ...docSnap.data()
      });

      if (item.isPublished) {
        items.push(item);
      }
    });

    sortNewsItems(items);
    cachedNewsItems = items;
    renderNews(items);
  } catch (error) {
    console.error("公開お知らせ読み込み失敗", error);
    lists.forEach((list) => {
      list.innerHTML = `<p class="public-news-empty">お知らせの読み込みに失敗しました。</p>`;
    });
  }
}

function renderNews(items) {
  lists.forEach((list) => {
    const limit = mobileHomeQuery.matches ? Number(list.dataset.limit || 0) : 0;
    const visibleItems = limit > 0 ? items.slice(0, limit) : items;

    if (!visibleItems.length) {
      list.innerHTML = `<p class="public-news-empty">現在お知らせはありません。</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    visibleItems.forEach((item) => {
      fragment.appendChild(createNewsCard(item));
    });

    list.innerHTML = "";
    list.appendChild(fragment);
  });
}

function createNewsCard(item) {
  const article = document.createElement("article");
  article.className = `public-news-card ${item.imageUrl ? "has-image" : "no-image"}`;

  const bodyPreview = createPreview(item.body, 120);
  const imageMarkup = item.imageUrl
    ? `
      <div class="public-news-image">
        <img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.title)}" loading="lazy">
      </div>
    `
    : "";
  const linkMarkup = item.linkUrl
    ? `
      <a class="public-news-link" href="${escapeAttribute(item.linkUrl)}" target="_blank" rel="noopener">
        詳しく見る
      </a>
    `
    : "";

  article.innerHTML = `
    ${imageMarkup}
    <div class="public-news-body">
      <div class="public-news-meta">
        <span class="public-news-category">${escapeHtml(item.category || DEFAULT_CATEGORY)}</span>
        ${item.isPinned ? `<span class="public-news-pinned">PIN</span>` : ""}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      ${bodyPreview ? `<p>${escapeHtml(bodyPreview)}</p>` : ""}
      ${linkMarkup}
    </div>
  `;

  return article;
}

function normalizeNews(item) {
  return {
    ...item,
    title: item.title || "",
    body: item.body || item.text || "",
    imageUrl: item.imageUrl || "",
    linkUrl: item.linkUrl || "",
    category: item.category || DEFAULT_CATEGORY,
    isPublished: item.isPublished !== false,
    isPinned: item.isPinned === true
  };
}

function sortNewsItems(items) {
  items.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    const aOrder = getNumericDisplayOrder(a);
    const bOrder = getNumericDisplayOrder(b);

    if (aOrder !== null && bOrder !== null) {
      return aOrder - bOrder;
    }

    if (aOrder !== null) return -1;
    if (bOrder !== null) return 1;

    return getCreatedAtTime(b) - getCreatedAtTime(a);
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

function createPreview(value, maxLength) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength)}...`;
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
