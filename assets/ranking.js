import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./app.js";

const list = document.getElementById("weeklyRankingList");
const state = { casts: [], views: [] };

if(list){
  onSnapshot(collection(db,"casts"),(snapshot)=>{state.casts=snapshot.docs.map((item)=>({id:item.id,...item.data()}));render();},showError);
  onSnapshot(collection(db,"castViews"),(snapshot)=>{state.views=snapshot.docs.map((item)=>({id:item.id,...item.data()}));render();},(error)=>{console.warn("週間閲覧数を取得できませんでした",error);render();});
}

function render(){
  if(!state.casts.length) return;
  const weekKey = getWeekKey();
  const counts = new Map(state.views.filter((item)=>item.weekKey===weekKey).map((item)=>[String(item.castId||""),Number(item.count||0)]));
  const ranked = state.casts.filter((cast)=>cast.isPublished!==false && getImage(cast)).map((cast)=>({cast,count:counts.get(cast.id) ?? Number(cast.weeklyViews ?? cast.viewCount ?? 0)})).sort((a,b)=>{const ar=Number(a.cast.popularityRank);const br=Number(b.cast.popularityRank);const av=[1,2,3].includes(ar);const bv=[1,2,3].includes(br);if(av&&bv)return ar-br;if(av)return -1;if(bv)return 1;return b.count-a.count || Number(a.cast.displayOrder??9999)-Number(b.cast.displayOrder??9999);}).slice(0,3);
  if(!ranked.length){list.innerHTML='<p class="no-cast">ランキングを準備中です。</p>';return;}
  list.innerHTML=ranked.map(({cast,count},index)=>{
    const name=String(cast.name||"CAST").trim();
    const detailUrl=`cast-detail.html?id=${encodeURIComponent(cast.id)}&name=${encodeURIComponent(name)}`;
    const lineButton=cast.lineReservationEnabled===false ? "" : `<a href="#" class="button-premium v72-ranking-line" data-site-link="lineReservationUrl" data-line-cast-name="${escapeAttr(name)}" target="_blank" rel="noopener" aria-label="${escapeAttr(name)}ちゃんを指名してLINE予約">LINE予約</a>`;
    return `<article class="v6-ranking-card v72-ranking-card card-premium"><span class="v6-rank-number">${index+1}<small>RANK</small></span><img src="${escapeAttr(getImage(cast))}" alt="${escapeAttr(name)}" loading="lazy" decoding="async"><div class="v6-ranking-glass"><strong>${escapeHtml(name)}</strong><small>${count.toLocaleString("ja-JP")} views</small><div class="v72-ranking-actions"><a href="${escapeAttr(detailUrl)}" class="button-premium">プロフィール</a>${lineButton}</div></div></article>`;
  }).join("");
}
function getWeekKey(){const now=new Date();const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now).split("-").map(Number);const date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2],12));const day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);return date.toISOString().slice(0,10);}
function getImage(cast){return cast.image||cast.imageUrl||(Array.isArray(cast.images)?cast.images[0]:"")||"";}
function showError(error){console.error("週間ランキング読み込み失敗",error);list.innerHTML='<p class="no-cast">ランキングを読み込めませんでした。</p>';}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function escapeAttr(value){return escapeHtml(value);}
