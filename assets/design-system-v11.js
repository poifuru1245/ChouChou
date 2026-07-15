/* Chou Chou Ver11.3 — shared component class adapter */
(function initializePremiumDesignSystem() {
  const componentSelectors = {
    card: [
      ".premium-section-card",
      "#cast.v9-today-card",
      "#princess-pickup",
      ".public-cast-card",
      ".public-gallery-item",
      ".premium-gallery-item",
      ".public-news-card",
      ".profile-box",
      ".recruit-form-card",
      ".reservation-wrap"
    ],
    button: [
      ".reserve-btn",
      ".v9-cast-button",
      ".princess-pickup-button",
      ".public-profile-link",
      ".reserve-submit",
      ".recruit-notify-btn"
    ],
    badge: [
      ".premium-cast-badge",
      ".premium-cast-badge-popular",
      ".badge-popular",
      ".public-cast-text-badge",
      ".public-cast-today-label",
      ".public-gallery-category",
      ".public-news-category",
      ".public-news-pinned",
      ".cast-tag"
    ],
    glass: [
      ".system-price-card",
      ".access-box",
      ".princess-info-list",
      ".public-gallery-glass",
      ".profile-grid",
      ".reservation-form",
      ".recruit-form",
      ".contact-form",
      ".v9-cast-item"
    ],
    image: [
      ".public-cast-photo",
      ".v9-cast-photo",
      ".princess-pickup-photo",
      ".premium-gallery-item > img",
      ".public-gallery-item > img",
      ".cast-main-image"
    ],
    section: [
      ".public-news-section",
      ".public-gallery-section",
      ".cast-detail",
      ".reservation-wrap"
    ]
  };

  const applyClass = (root, selectors, className) => {
    selectors.forEach((selector) => {
      if (root instanceof Element && root.matches(selector)) {
        root.classList.add(className);
      }

      root.querySelectorAll?.(selector).forEach((element) => {
        element.classList.add(className);
      });
    });
  };

  const normalizeSectionTitle = (title) => {
    if (!(title instanceof HTMLElement)) return;

    title.classList.add("section-title");

    const subtitle = title.querySelector(":scope > .v9-today-eyebrow, :scope > .princess-pickup-eyebrow, :scope > span");
    const heading = title.querySelector(":scope > h1, :scope > h2");
    let divider = title.querySelector(":scope > .section-divider, :scope > .v9-today-divider, :scope > .princess-pickup-divider");

    subtitle?.classList.add("section-subtitle");
    heading?.classList.add("section-heading");

    if (!divider && (subtitle || heading)) {
      divider = document.createElement("span");
      divider.setAttribute("aria-hidden", "true");
      title.appendChild(divider);
    }

    divider?.classList.add("section-divider");
  };

  const upgrade = (root) => {
    if (!(root instanceof Element || root instanceof Document)) return;

    applyClass(root, componentSelectors.card, "card-premium");
    applyClass(root, componentSelectors.button, "button-premium");
    applyClass(root, componentSelectors.badge, "badge-premium");
    applyClass(root, componentSelectors.glass, "glass-panel");
    applyClass(root, componentSelectors.image, "image-premium");
    applyClass(root, componentSelectors.section, "premium-section");

    if (root instanceof Element && root.matches(".section-title, .v9-today-header, .princess-pickup-header")) {
      normalizeSectionTitle(root);
    }

    root.querySelectorAll?.(".section-title, .v9-today-header, .princess-pickup-header").forEach(normalizeSectionTitle);
  };

  const start = () => {
    document.body?.classList.add("premium-design-system");

    document.querySelectorAll(".hero-link, .ver6-contact-link, .ver6-image-link").forEach((link) => {
      link.classList.add("button-premium", "button-premium-hotspot");
    });

    upgrade(document);

    if (!("MutationObserver" in window) || !document.body) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) upgrade(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
