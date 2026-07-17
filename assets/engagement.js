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
  const filter = ()=>{
    const data = new FormData(form);
    const name = normalize(data.get("name"));
    const age = String(data.get("age") || "").replace(/\D/g,"");
    const height = String(data.get("height") || "").replace(/\D/g,"");
    const blood = normalize(data.get("bloodType"));
    const hobby = normalize(data.get("hobby"));
    const flags = ["recommended","new","today"];
    let count = 0;
    grid.querySelectorAll(".public-cast-card").forEach((card)=>{
      const visible = (!name || card.dataset.castName?.includes(name)) && (!age || card.dataset.castAge === age) && (!height || card.dataset.castHeight === height) && (!blood || card.dataset.castBlood?.includes(blood)) && (!hobby || card.dataset.castHobby?.includes(hobby)) && flags.every((flag)=>data.get(flag) !== "on" || card.dataset[`cast${flag[0].toUpperCase()}${flag.slice(1)}`] === "true");
      card.hidden = !visible;
      if(visible) count += 1;
    });
    const output = document.getElementById("castSearchCount");
    if(output) output.textContent = `${count}名`; 
    const empty = document.getElementById("castSearchEmpty");
    if(empty) empty.hidden = count !== 0;
  };
  form.addEventListener("input",filter);
  form.addEventListener("change",filter);
  form.addEventListener("reset",()=>setTimeout(filter));
  new MutationObserver(filter).observe(grid,{childList:true});
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
