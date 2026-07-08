const cards = document.querySelectorAll(
  ".system-price-card, .system-menu-card, .system-information, .system-reservation"
);

cards.forEach((card, index) => {
  card.style.setProperty("--system-card-delay", `${index * 70}ms`);
});
