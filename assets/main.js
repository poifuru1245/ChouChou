const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DESKTOP_QUERY = "(min-width: 769px)";

document.addEventListener("DOMContentLoaded", () => {
  setupPremiumHeroExperience();
  setupHomepageImageLoading();
});

function setupPremiumHeroExperience() {
  const hero = document.querySelector(".hero.hero-ver6");

  if (!(hero instanceof HTMLElement) || hero.dataset.v61HeroReady === "true") return;

  hero.dataset.v61HeroReady = "true";

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const desktop = window.matchMedia(DESKTOP_QUERY);
  let frameId = 0;

  const revealHero = () => {
    hero.classList.add("is-v61-ready");
  };

  const updateParallax = () => {
    frameId = 0;

    if (reducedMotion.matches || !desktop.matches) {
      hero.style.setProperty("--v61-hero-parallax", "0px");
      return;
    }

    const heroBottom = hero.offsetTop + hero.offsetHeight;

    if (window.scrollY > heroBottom) return;

    const offset = Math.min(28, Math.max(0, window.scrollY * 0.065));
    hero.style.setProperty("--v61-hero-parallax", `${offset.toFixed(2)}px`);
  };

  const requestParallaxUpdate = () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(updateParallax);
  };

  window.requestAnimationFrame(revealHero);
  updateParallax();
  window.addEventListener("scroll", requestParallaxUpdate, { passive: true });
  window.addEventListener("resize", requestParallaxUpdate, { passive: true });
}

function setupHomepageImageLoading() {
  document.querySelectorAll(".princess-home img:not([loading])").forEach((image) => {
    if (image.closest(".hero")) return;

    image.setAttribute("loading", "lazy");
    image.setAttribute("decoding", "async");
  });
}
