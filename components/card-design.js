const CARD_CONFIGS = [
  {
    selector: ".cc-card-today",
    elements: ["glass", "tiara", "ribbon", "lace", "jewel", "heart", "sparkle", "sparkle", "sparkle", "sparkle"]
  },
  {
    selector: ".cc-card-news",
    elements: ["glass", "envelope", "ribbon", "lace", "jewel", "sparkle", "sparkle", "sparkle", "sparkle"]
  },
  {
    selector: ".cc-card-concept",
    elements: ["glass", "chandelier", "tiara", "lace", "jewel", "heart", "sparkle", "sparkle", "sparkle", "sparkle"]
  }
];

const ELEMENT_CLASS = {
  glass: "cc-card-glass",
  tiara: "cc-tiara",
  ribbon: "cc-ribbon",
  lace: "cc-lace",
  jewel: "cc-jewel",
  heart: "cc-heart-jewel",
  sparkle: "cc-sparkle",
  envelope: "cc-envelope",
  chandelier: "cc-chandelier"
};

document.addEventListener("DOMContentLoaded", () => {
  const cards = CARD_CONFIGS
    .map((config) => enhanceCard(config))
    .filter(Boolean);

  revealCards(cards);
});

function enhanceCard(config) {
  const card = document.querySelector(config.selector);

  if (!card) return null;

  card.classList.add("cc-brand-card");

  if (!card.querySelector(":scope > .cc-card-art")) {
    const art = document.createElement("div");
    art.className = "cc-card-art";
    art.setAttribute("aria-hidden", "true");

    config.elements.forEach((name) => {
      const element = document.createElement("span");
      element.className = ELEMENT_CLASS[name];
      art.appendChild(element);
    });

    card.prepend(art);
  }

  return card;
}

function revealCards(cards) {
  if (!cards.length) return;

  if (!("IntersectionObserver" in window)) {
    cards.forEach(showCard);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      showCard(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.22 });

  cards.forEach((card) => observer.observe(card));
}

function showCard(card) {
  card.classList.add("cc-card-visible");

  window.setTimeout(() => {
    card.classList.add("cc-card-spark");
  }, 620);

  window.setTimeout(() => {
    card.classList.remove("cc-card-spark");
  }, 1600);
}
