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
  const sync = (root=document)=>{
    const favorites = readFavorites();
    root.querySelectorAll?.("[data-favorite-cast]").forEach((button)=>{
      const active = favorites.includes(String(button.dataset.favoriteCast || ""));
      button.classList.toggle("is-favorite",active);
      button.setAttribute("aria-pressed",String(active));
      button.textContent = active ? "♥" : "♡";
    });
  };
  document.addEventListener("click",(event)=>{
    const button = event.target.closest("[data-favorite-cast]");
    if(!button) return;
    event.preventDefault(); event.stopPropagation();
    const id = String(button.dataset.favoriteCast || "");
    const favorites = readFavorites();
    const next = favorites.includes(id) ? favorites.filter((item)=>item !== id) : [...favorites,id];
    try{ localStorage.setItem(FAVORITES_KEY,JSON.stringify(next)); }catch(error){ console.warn("お気に入りを保存できませんでした",error); }
    sync();
    if(document.querySelector("[data-favorites-only='true']") && !next.includes(id)) button.closest(".public-cast-card")?.remove();
    updateFavoriteCount(next.length);
  });
  const observer = new MutationObserver((mutations)=>mutations.forEach((mutation)=>mutation.addedNodes.forEach((node)=>{if(node instanceof Element) sync(node);}))); 
  observer.observe(document.body,{childList:true,subtree:true});
  sync(); updateFavoriteCount(readFavorites().length);
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
    window.addEventListener("load",()=>navigator.serviceWorker.register("/service-worker.js?v=6.0.0",{scope:"/"}).catch((error)=>console.warn("キャッシュ初期化をスキップしました",error)),{once:true});
  }
}

function readFavorites(){
  try{const value=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]");return Array.isArray(value)?value.map(String):[];}catch{return [];}
}
function updateFavoriteCount(count){document.querySelectorAll("[data-favorite-count]").forEach((item)=>item.textContent=String(count));}
function normalize(value){return String(value||"").trim().toLowerCase();}
