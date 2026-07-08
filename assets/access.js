const accessCards = document.querySelectorAll(
  ".access-map-card, .access-shop-card, .access-info-card, .access-photo-card, .access-reservation"
);

accessCards.forEach((card, index) => {
  card.style.setProperty("--access-card-delay", `${index * 70}ms`);
});
