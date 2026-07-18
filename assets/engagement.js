const FAVORITES_KEY = "chouchou-favorite-casts";

if(!location.pathname.includes("/admin/")){
  setupPremiumLoading();
  setupFavorites();
  setupCastSearch();
  setupRevealMotion();
  setupPerformanceCache();
}

function setupPremiumLoading(){
  let overlay = document.getElementById("loading");
  if(!overlay){
    overlay = document.createElement("div");
    overlay.id = "loading";
    overlay.innerHTML = `<div class="v6-loading-mark" aria-hidden="true"><span>Chou Chou</span><i></i></div><p>Loading</p>`;
    document.body.prepend(overlay);
  }else if(!overlay.querySelector(".v6-loading-mark")){
    overlay.innerHTML = `<div class="v6-loading-mark" aria-hidden="true"><span>Chou Chou</span><i></i></div><p>Loading</p>`;
  }
  overlay.classList.add("v6-premium-loading","is-active");
  window.addEventListener("load",()=>window.setTimeout(()=>overlay.classList.remove("is-active"),260),{once:true});
  document.addEventListener("click",(event)=>{
    const link = event.target.closest("a[href]");
    if(!link || link.target === "_blank" || link.hasAttribute("download")) return;
    const href = link.getAttribute("href") || "";
    if(!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("javascript:")) return;
    const url = new URL(link.href,location.href);
    if(url.origin === location.origin) overlay.classList.add("is-active");
  });
  window.addEventListener("pageshow",()=>overlay.classList.remove("is-active"));
}

function setupFavorites(){
  setupFavoriteHeader();
  setupFavoriteEffect();

  const sync = (root=document)=>{
    const favorites = readFavorites();
    root.querySelectorAll?.("[data-favorite-cast]").forEach((button)=>{
      const active = favorites.includes(String(button.dataset.favoriteCast || ""));
      button.classList.toggle("is-favorite",active);
      button.setAttribute("aria-pressed",String(active));
      button.setAttribute("aria-label",getFavoriteAriaLabel(button,active));
      button.textContent = active
        ? button.dataset.favoriteLabelActive || "♥"
        : button.dataset.favoriteLabelInactive || "♡";
    });
    updateFavoriteCount(favorites.length);
    syncFavoriteOnlyPage(favorites);
  };
  document.addEventListener("click",(event)=>{
    const button = event.target.closest("[data-favorite-cast]");
    if(!button) return;
    event.preventDefault(); event.stopPropagation();
    const id = String(button.dataset.favoriteCast || "");
    if(!id) return;
    const favorites = readFavorites();
    const isAdding = !favorites.includes(id);
    const next = isAdding ? [...favorites,id] : favorites.filter((item)=>item !== id);
    writeFavorites(next);
    sync();
    animateFavoriteButton(button,isAdding);
    if(isAdding) showFavoriteCompleteEffect(button);
    window.dispatchEvent(new CustomEvent("chouchou:favorites-changed",{detail:{favorites:next,id,isFavorite:isAdding}}));
  });
  const observer = new MutationObserver((mutations)=>mutations.forEach((mutation)=>mutation.addedNodes.forEach((node)=>{if(node instanceof Element) sync(node);}))); 
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("storage",(event)=>{if(event.key === FAVORITES_KEY) sync();});
  window.addEventListener("chouchou:favorites-render",()=>sync());
  window.addEventListener("chouchou:favorites-changed",()=>sync());
  sync();
}

function setupFavoriteHeader(){
  const headerInner = document.querySelector("body:not(.admin-premium) > .header .header-inner");
  if(!headerInner || headerInner.querySelector(".v7-header-favorite")) return;
  const link = document.createElement("a");
  link.href = "favorite.html";
  link.className = "v7-header-favorite";
  link.setAttribute("aria-label","お気に入りキャスト一覧");
  link.innerHTML = `<span aria-hidden="true">♥</span><b data-favorite-count>0</b>`;
  const anchor = headerInner.querySelector(".language-switch,.header-cta");
  headerInner.insertBefore(link,anchor || null);
  headerInner.classList.add("has-v7-favorite");
}

function setupFavoriteEffect(){
  if(document.getElementById("favoriteCompleteEffect")) return;
  const effect = document.createElement("div");
  effect.id = "favoriteCompleteEffect";
  effect.className = "v7-favorite-complete";
  effect.setAttribute("role","status");
  effect.setAttribute("aria-live","polite");
  effect.textContent = "♥ お気に入りに登録しました";
  document.body.appendChild(effect);
}

function animateFavoriteButton(button,isAdding){
  button.classList.remove("is-favorite-pop","is-favorite-remove");
  void button.offsetWidth;
  button.classList.add(isAdding ? "is-favorite-pop" : "is-favorite-remove");
  window.setTimeout(()=>button.classList.remove("is-favorite-pop","is-favorite-remove"),260);
}

function showFavoriteCompleteEffect(button){
  const effect = document.getElementById("favoriteCompleteEffect");
  if(effect){
    effect.classList.remove("is-visible");
    void effect.offsetWidth;
    effect.classList.add("is-visible");
    window.setTimeout(()=>effect.classList.remove("is-visible"),1500);
  }
  const sparkle = document.createElement("span");
  sparkle.className = "v7-favorite-sparkle";
  sparkle.setAttribute("aria-hidden","true");
  sparkle.textContent = "♥";
  button.appendChild(sparkle);
  window.setTimeout(()=>sparkle.remove(),520);
}

function syncFavoriteOnlyPage(favorites){
  const grid = document.querySelector("[data-favorites-only='true']");
  if(!grid) return;
  grid.querySelectorAll(".public-cast-card").forEach((card)=>{
    const id = String(card.dataset.castId || card.querySelector("[data-favorite-cast]")?.dataset.favoriteCast || "");
    if(id && !favorites.includes(id)) card.remove();
  });
  const cards = grid.querySelectorAll(".public-cast-card");
  const existingEmpty = grid.querySelector(".v7-favorite-empty,.v6-favorite-empty");
  if(cards.length){
    existingEmpty?.remove();
    return;
  }
  if(!existingEmpty){
    grid.insertAdjacentHTML("beforeend",`<p class="no-cast v7-favorite-empty">まだお気に入り登録されていません</p>`);
  }else{
    existingEmpty.textContent = "まだお気に入り登録されていません";
    existingEmpty.classList.add("v7-favorite-empty");
  }
}

function getFavoriteAriaLabel(button,active){
  const name = String(button.dataset.favoriteCastName || "キャスト");
  return active ? `${name}のお気に入り登録を解除` : `${name}をお気に入りに登録`;
}

function setupCastSearch(){
  const form = document.querySelector("[data-cast-search]");
  const grid = document.querySelector(".interior-cast-grid");
  if(!form || !grid) return;

  const countOutput = document.getElementById("castSearchCount");
  const emptyOutput = document.getElementById("castSearchEmpty");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let knownCardCount = 0;
  let frameId = 0;
  let filterVersion = 0;

  const readNumber = (card,key)=>{
    const rawValue = card.dataset[key];
    if(rawValue === undefined || rawValue === "") return Number.POSITIVE_INFINITY;
    const value = Number(rawValue);
    return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
  };

  const baseOrder = (left,right)=>
    readNumber(left,"castOrder") - readNumber(right,"castOrder") ||
    readNumber(left,"castOriginalIndex") - readNumber(right,"castOriginalIndex");

  const flagOrder = (key)=>(left,right)=>
    Number(right.dataset[key] === "true") - Number(left.dataset[key] === "true") ||
    baseOrder(left,right);

  const comparators = {
    recommended:flagOrder("castRecommended"),
    new:flagOrder("castNew"),
    name:(left,right)=>left.dataset.castName.localeCompare(right.dataset.castName,"ja") || baseOrder(left,right),
    age:(left,right)=>readNumber(left,"castAge") - readNumber(right,"castAge") || baseOrder(left,right),
    height:(left,right)=>readNumber(left,"castHeight") - readNumber(right,"castHeight") || baseOrder(left,right),
    today:flagOrder("castToday")
  };

  const animateVisibility = (card,visible,version)=>{
    card.getAnimations?.().forEach((animation)=>animation.cancel());

    if(reducedMotion.matches){
      card.hidden = !visible;
      return;
    }

    if(visible){
      const wasHidden = card.hidden;
      card.hidden = false;
      if(wasHidden){
        card.animate(
          [{opacity:0,transform:"translateY(8px)"},{opacity:1,transform:"translateY(0)"}],
          {duration:250,easing:"ease",fill:"both"}
        );
      }
      return;
    }

    if(card.hidden) return;
    const animation = card.animate(
      [{opacity:1,transform:"translateY(0)"},{opacity:0,transform:"translateY(8px)"}],
      {duration:160,easing:"ease",fill:"both"}
    );
    animation.finished.then(()=>{
      if(version === filterVersion) card.hidden = true;
    }).catch(()=>{});
  };

  const filter = ()=>{
    frameId = 0;
    filterVersion += 1;
    const currentVersion = filterVersion;
    const data = new FormData(form);
    const keyword = normalize(data.get("keyword"));
    const cards = [...grid.querySelectorAll(".public-cast-card")];
    const selectedDecades = [
      data.get("twenties") === "on" ? 20 : null,
      data.get("thirties") === "on" ? 30 : null
    ].filter(Number.isFinite);
    const matches = new Set(cards.filter((card)=>{
      const age = Number(card.dataset.castAge);
      const matchesDecade = !selectedDecades.length || selectedDecades.some((start)=>age >= start && age < start + 10);
      return (!keyword || card.dataset.castSearchText?.includes(keyword)) &&
        (data.get("recommended") !== "on" || card.dataset.castRecommended === "true") &&
        (data.get("new") !== "on" || card.dataset.castNew === "true") &&
        (data.get("today") !== "on" || card.dataset.castToday === "true") &&
        matchesDecade;
    }));
    const comparator = comparators[String(data.get("sort") || "recommended")] || comparators.recommended;

    cards.sort(comparator);
    const fragment = document.createDocumentFragment();
    cards.forEach((card)=>{
      animateVisibility(card,matches.has(card),currentVersion);
      fragment.appendChild(card);
    });
    grid.appendChild(fragment);

    if(countOutput) countOutput.textContent = `${cards.length}名中${matches.size}名表示`;
    if(emptyOutput) emptyOutput.hidden = matches.size !== 0;
  };

  const scheduleFilter = ()=>{
    if(frameId) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(filter);
  };

  form.addEventListener("input",scheduleFilter);
  form.addEventListener("change",scheduleFilter);
  form.addEventListener("reset",()=>setTimeout(scheduleFilter));
  new MutationObserver(()=>{
    const currentCardCount = grid.querySelectorAll(".public-cast-card").length;
    if(currentCardCount === knownCardCount) return;
    knownCardCount = currentCardCount;
    scheduleFilter();
  }).observe(grid,{childList:true});
  knownCardCount = grid.querySelectorAll(".public-cast-card").length;
  scheduleFilter();
}

function setupRevealMotion(){
  const selector = ".card-premium,.public-cast-card,.v9-cast-item,.section-title,.image-premium,.public-gallery-item";
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const observer = new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add("v6-reveal-visible");observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:"0px 0px -5%"});
  const register = (root=document)=>root.querySelectorAll?.(selector).forEach((item)=>{if(!item.classList.contains("v6-reveal")){item.classList.add("v6-reveal");observer.observe(item);}});
  register();
  new MutationObserver((mutations)=>mutations.forEach((mutation)=>mutation.addedNodes.forEach((node)=>{if(node instanceof Element) register(node);}))).observe(document.body,{childList:true,subtree:true});
}

function setupPerformanceCache(){
  if("serviceWorker" in navigator && location.protocol.startsWith("http")){
    window.addEventListener("load",()=>navigator.serviceWorker.register("/service-worker.js?v=7.0.0",{scope:"/"}).catch((error)=>console.warn("キャッシュ初期化をスキップしました",error)),{once:true});
  }
}

function readFavorites(){
  try{const value=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]");return Array.isArray(value)?[...new Set(value.map(String).filter(Boolean))]:[];}catch{return [];}
}
function writeFavorites(favorites){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...new Set(favorites.map(String).filter(Boolean))]));}catch(error){console.warn("お気に入りを保存できませんでした",error);}}
function updateFavoriteCount(count){document.querySelectorAll("[data-favorite-count]").forEach((item)=>item.textContent=String(count));}
function normalize(value){return String(value||"").trim().toLowerCase();}
