import { escapeAttribute, escapeHtml } from "../utils/dom.js";

export function imageMarkup({ src, alt, className = "", fallbackClassName = "", eager = false } = {}) {
  if (!src) return `<span class="ui-image-fallback${fallbackClassName ? ` ${escapeAttribute(fallbackClassName)}` : ""}" role="img" aria-label="${escapeAttribute(alt || "画像なし")}">NO IMAGE</span>`;
  return `<img${className ? ` class="${escapeAttribute(className)}"` : ""} src="${escapeAttribute(src)}" alt="${escapeAttribute(alt || "")}" loading="${eager ? "eager" : "lazy"}" decoding="async">`;
}

export function badgeMarkup(label, className = "badge-premium") {
  return label ? `<span class="${escapeAttribute(className)}">${escapeHtml(label)}</span>` : "";
}

export function tagMarkup(tags = [], className = "tag-premium") {
  return tags.map((tag) => `<span class="${escapeAttribute(className)}">${escapeHtml(tag)}</span>`).join("");
}

export function loadingMarkup(label = "読み込み中...") {
  return `<span class="ui-loading" role="status"><span class="ui-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></span>`;
}

export function skeletonMarkup(count = 3, className = "ui-skeleton-card") {
  return Array.from({ length: Math.max(1, count) }, () => `<span class="${escapeAttribute(className)}" aria-hidden="true"></span>`).join("");
}

export function errorMarkup(message = "通信に失敗しました。時間をおいて再度お試しください。") {
  return `<p class="ui-error" role="alert">${escapeHtml(message)}</p>`;
}
