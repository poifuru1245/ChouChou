import { subscribeNews } from "../services/newsService.js";

const COLLECTION_NAME = "news";
const DEFAULT_CATEGORY = "お知らせ";
const NEW_PERIOD_DAYS = 14;

const lists = [...document.querySelectorAll(".public-news-list")];

if (lists.length) {
  loadPublicNews();
}

function loadPublicNews() {
  subscribeNews((rows) => {
    const items = [];

    rows.forEach((row) => {
      const item = normalizeNews(row);

      if (item.isPublished && isPublishDateReached(item.publishDate) && !isPublishDateEnded(item.publishEndDate)) {
        items.push(item);
      }
    });

    sortNewsItems(items);
    renderNews(items);
  }, (error) => {
    console.error("公開お知らせ読み込み失敗", error);
    lists.forEach((list) => {
      updateNewsListState(list, 0);
      list.innerHTML = `<p class="public-news-empty">お知らせの読み込みに失敗しました。</p>`;
    });
  });
}

function renderNews(items) {
  lists.forEach((list) => {
    const limit = Number(list.dataset.limit || 0);
    const orderedItems = list.dataset.sort === "latest"
      ? [...items].sort((a, b) => getNewsTimestamp(b) - getNewsTimestamp(a))
      : items;
    const visibleItems = limit > 0 ? orderedItems.slice(0, limit) : orderedItems;

    if (!visibleItems.length) {
      updateNewsListState(list, 0);
      list.innerHTML = `<p class="public-news-empty">現在お知らせはありません。</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    const fallbackLink = list.closest(".princess-home") ? "news.html" : "";

    visibleItems.forEach((item) => {
      fragment.appendChild(createNewsCard(item, fallbackLink));
    });

    list.innerHTML = "";
    list.appendChild(fragment);
    updateNewsListState(list, visibleItems.length);
  });
}

function updateNewsListState(list, itemCount) {
  list.dataset.itemCount = String(itemCount);
  list.classList.toggle("is-news-compact", itemCount < 3);
  list.classList.toggle("has-news-overflow", itemCount >= 4);
}

function createNewsCard(item, fallbackLink = "") {
  const article = document.createElement("article");
  article.className = `public-news-card card-premium ${item.imageUrl ? "has-image" : "no-image"}`;

  const bodyPreview = createPreview(item.body, 120);
  const publishedAt = getNewsTimestamp(item);
  const dateLabel = formatNewsDate(publishedAt);
  const newBadge = isNewItem(item, publishedAt)
    ? `<span class="public-news-new badge-premium">NEW</span>`
    : "";
  const imageMarkup = item.imageUrl
    ? `
      <div class="public-news-image">
        <img class="image-premium" src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.title)}" loading="lazy">
      </div>
    `
    : "";
  const linkUrl = item.linkUrl || fallbackLink;
  const isExternalLink = /^https?:\/\//i.test(linkUrl);
  const linkMarkup = linkUrl
    ? `
      <a class="public-news-link" href="${escapeAttribute(linkUrl)}"${isExternalLink ? ' target="_blank" rel="noopener"' : ""}>
        続きを読む<span class="sr-only">：${escapeHtml(item.title)}</span>
      </a>
    `
    : "";

  article.innerHTML = `
    ${imageMarkup}
    <div class="public-news-body">
      <div class="public-news-meta">
        <time class="public-news-date"${publishedAt ? ` datetime="${new Date(publishedAt).toISOString()}"` : ""}>${escapeHtml(dateLabel)}</time>
        <span class="public-news-category badge-premium">${escapeHtml(item.category || DEFAULT_CATEGORY)}</span>
        ${newBadge}
        ${item.isPinned ? `<span class="public-news-pinned badge-premium">PIN</span>` : ""}
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
    isPinned: item.isPinned === true,
    isNew: item.isNew === true,
    publishEndDate: item.publishEndDate || item.endDate || ""
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

function getNewsTimestamp(item) {
  return getTimestampValue(item?.publishDate) || getTimestampValue(item?.createdAt) || getTimestampValue(item?.updatedAt);
}

function isPublishDateReached(value) {
  if (!value) return true;
  const publishDate = Date.parse(String(value).includes("T") ? value : `${value}T00:00:00+09:00`);
  return !Number.isFinite(publishDate) || publishDate <= Date.now();
}

function isPublishDateEnded(value) {
  if (!value) return false;
  const endDate = Date.parse(String(value).includes("T") ? value : `${value}T23:59:59+09:00`);
  return Number.isFinite(endDate) && endDate < Date.now();
}

function getTimestampValue(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  return 0;
}

function formatNewsDate(timestamp) {
  if (!timestamp) return "----.--.--";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(timestamp)).replaceAll("/", ".");
}

function isNewItem(item, timestamp) {
  if (item?.isNew === true) return true;
  if (!timestamp) return false;

  const age = Date.now() - timestamp;
  return age >= 0 && age <= NEW_PERIOD_DAYS * 24 * 60 * 60 * 1000;
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
