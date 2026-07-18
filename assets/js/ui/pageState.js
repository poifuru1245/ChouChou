import { announce } from "../utils/dom.js";

let globalCleanup = null;

export function installGlobalUiStates(root = document) {
  if (globalCleanup) return globalCleanup;
  enhanceImages(root);
  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof Element) enhanceImages(node);
    }));
  });
  observer.observe(root.documentElement || root, { childList: true, subtree: true });
  window.addEventListener("offline", () => announce("通信が切断されました。接続をご確認ください。", "error"));
  window.addEventListener("online", () => announce("通信が復旧しました。"));
  globalCleanup = () => { observer.disconnect(); globalCleanup = null; };
  return globalCleanup;
}

export function setBusy(element, busy, label = "読み込み中") {
  if (!element) return;
  element.toggleAttribute("aria-busy", Boolean(busy));
  if (busy) element.setAttribute("aria-label", label);
  else element.removeAttribute("aria-label");
}

export function showPageError(target, message) {
  if (target) {
    target.textContent = message;
    target.classList.add("ui-error");
    target.setAttribute("role", "alert");
  }
  announce(message, "error");
}

function enhanceImages(root) {
  const images = root instanceof HTMLImageElement ? [root] : [...root.querySelectorAll?.("img") || []];
  images.forEach((image) => {
    if (!image.alt) image.alt = "";
    image.decoding ||= "async";
    if (!image.loading && !image.closest(".hero") && !image.matches("[data-eager], .cast-detail-main-image")) image.loading = "lazy";
    if (image.dataset.uiImageReady) return;
    image.dataset.uiImageReady = "true";
    image.addEventListener("error", () => {
      image.classList.add("is-image-unavailable");
      const fallback = document.createElement("span");
      fallback.className = "ui-image-fallback";
      fallback.setAttribute("role", "img");
      fallback.setAttribute("aria-label", image.alt || "画像を読み込めませんでした");
      fallback.textContent = "NO IMAGE";
      image.replaceWith(fallback);
    }, { once: true });
  });
}
