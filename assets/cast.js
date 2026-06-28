import {
  getFirestore,
  collection,
  getDocs
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsNdnnTSJUIS2eO7P_Ks8eAmtm8ManDhY",
  authDomain: "chouchou-susukino.firebaseapp.com",
  projectId: "chouchou-susukino",
  storageBucket: "chouchou-susukino.firebasestorage.app",
  messagingSenderId: "611059453310",
  appId: "1:611059453310:web:c693ea8a0ce465ac79b72f"
};

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const app =
getApps().length
 ? getApp()
 : initializeApp(firebaseConfig);

const db = getFirestore(app);

async function loadCasts() {

const scheduleSnapshot =
await getDocs(
  collection(db,"schedules")
);

console.log(
scheduleSnapshot.size
);

const today = new Date()
  .toISOString()
  .split("T")[0];

const todayCasts = [];

scheduleSnapshot.forEach((docSnap)=>{

  const schedule = docSnap.data();

  if(schedule.date === today){

  todayCasts.push({
    name: schedule.castId,
    time: `${schedule.start}〜${schedule.end}`
  });

}

});

console.log("今日", today);
console.log("出勤者", todayCasts);

  const snapshot =
    await getDocs(collection(db,"casts"));

  const casts = [];

  snapshot.forEach((docSnap)=>{

    casts.push({
      id: docSnap.id,
      ...docSnap.data()
    });

  });

  sortCastsByDisplayOrder(casts);

console.log("cast.js 起動");
console.log(document.querySelector(".cast-grid"));

  const list =
document.querySelector(".cast-grid");

  list.innerHTML = "";

  if(todayCasts.length === 0){

  list.innerHTML = `
    <p class="no-cast">
      本日の出勤情報はありません
    </p>
  `;

  return;
}

  casts.forEach((cast)=>{

    console.log("判定", cast.name);

const todayCast =
todayCasts.find(
  item => item.name === cast.name
);

if(!todayCast){
  return;
}

    const div =
      document.createElement("div");

    div.className = "cast-card public-cast-card";

const image =
getMainImage(cast);
const imageMarkup =
image
? `<img class="public-cast-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">`
: `<div class="cast-card-no-image public-cast-image">NO IMAGE</div>`;
const badgeMarkup =
createCastBadgeMarkup(cast);
const tagsMarkup =
createPublicTagMarkup(cast);
const detailUrl =
createCastDetailUrl(cast);

div.innerHTML = `
  <div class="public-cast-photo">
    ${imageMarkup}
    ${badgeMarkup}
  </div>

  <div class="cast-info public-cast-info">

    <h3>${escapeHtml(cast.name || "")}</h3>

    <p class="public-cast-profile-line">
      ${escapeHtml(formatAge(cast.age))} / ${escapeHtml(formatHeight(cast.height))}
    </p>

    <p class="cast-time public-cast-schedule">
      出勤：${escapeHtml(formatSchedule(cast, todayCast.time))}
    </p>

    ${tagsMarkup}

   <a
class="reserve-btn public-profile-link"
href="${detailUrl}"
aria-label="${escapeAttribute(cast.name || "キャスト")}のプロフィール">
プロフィール
</a>

  </div>
`;

console.log("追加", cast.name);

    list.appendChild(div);

  });

}

loadCasts();

async function loadAllCasts(){

const snapshot =
await getDocs(collection(db,"casts"));

const casts = [];

snapshot.forEach((docSnap)=>{

casts.push({
id: docSnap.id,
...docSnap.data()
});

});

sortCastsByDisplayOrder(casts);

const list =
document.querySelector(".all-cast-grid");

if(!list) return;

list.innerHTML = "";

casts.forEach((cast)=>{

const div =
document.createElement("div");

div.className = "cast-card public-cast-card";

const image =
getMainImage(cast);
const imageMarkup =
image
? `<img class="public-cast-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">`
: `<div class="cast-card-no-image public-cast-image">NO IMAGE</div>`;
const badgeMarkup =
createCastBadgeMarkup(cast);
const tagsMarkup =
createPublicTagMarkup(cast);
const detailUrl =
createCastDetailUrl(cast);

div.innerHTML = `
<div class="public-cast-photo">
${imageMarkup}
${badgeMarkup}
</div>

<div class="cast-info public-cast-info">

<h3>${escapeHtml(cast.name || "")}</h3>

<p class="public-cast-profile-line">
${escapeHtml(formatAge(cast.age))} / ${escapeHtml(formatHeight(cast.height))}
</p>

<p class="cast-time public-cast-schedule">
出勤：${escapeHtml(formatSchedule(cast))}
</p>

${tagsMarkup}

<a
class="reserve-btn public-profile-link"
href="${detailUrl}"
aria-label="${escapeAttribute(cast.name || "キャスト")}のプロフィール">
プロフィール
</a>

</div>
`;

list.appendChild(div);

});

}

loadAllCasts();

function sortCastsByDisplayOrder(casts){

casts.sort((a,b)=>{

const aOrder =
getNumericDisplayOrder(a);

const bOrder =
getNumericDisplayOrder(b);

if(
aOrder !== null &&
bOrder !== null
){
return aOrder - bOrder;
}

if(aOrder !== null) return -1;
if(bOrder !== null) return 1;

return String(a.name || "")
.localeCompare(
String(b.name || ""),
"ja"
);

});

}

function getNumericDisplayOrder(cast){

const order =
cast?.displayOrder;

if(
order === undefined ||
order === null ||
order === ""
){
return null;
}

const numericOrder =
Number(order);

return Number.isFinite(numericOrder)
? numericOrder
: null;

}

function getCastImages(cast){

const images =
Array.isArray(cast?.images)
? cast.images.filter(Boolean)
: [];

if(
images.length === 0 &&
cast?.image
){
return [cast.image];
}

return images.slice(0,5);

}

function getMainImage(cast){

return cast?.image ||
getCastImages(cast)[0] ||
"";

}

function createCastDetailUrl(cast){

const params =
new URLSearchParams();

if(cast.id){
params.set("id",cast.id);
}

params.set("name",cast.name || "");
params.set("age",cast.age || "");
params.set("image",getMainImage(cast));
params.set("height",cast.height || "");
params.set("birthday",cast.birthday || "");
params.set("bloodType",cast.bloodType || "");
params.set("hobby",cast.hobby || "");
params.set("favoriteDrink",cast.favoriteDrink || "");
params.set("message",cast.message || "");
params.set("instagram",cast.instagram || "");
params.set("x",cast.x || "");
params.set("tiktok",cast.tiktok || "");
params.set("isNew",cast.isNew === true ? "true" : "");
params.set("isRecommended",cast.isRecommended === true ? "true" : "");
params.set("badgeText",cast.badgeText || "");

if(Array.isArray(cast.tags)){
params.set("tags",cast.tags.join(","));
}

return `cast-detail.html?${params.toString()}`;

}

function formatAge(age){

return age
? `${age}歳`
: "-";

}

function formatHeight(height){

return height || "-";

}

function formatSchedule(cast, time = ""){

return time ||
cast?.schedule ||
"未定";

}

function createCastBadgeMarkup(cast){

const badges = [];

if(cast?.isNew === true){
badges.push(createNewBadgeSvg());
}

if(cast?.isRecommended === true){
badges.push(createRecommendedBadgeSvg());
}

if(!badges.length){
return "";
}

return `
<div class="public-cast-badges cast-badge-layer">
${badges.join("")}
</div>
`;

}

function createNewBadgeSvg(){

return `
<span class="premium-cast-badge premium-cast-badge-new" aria-label="NEW 新人">
  <svg class="premium-cast-badge-svg premium-cast-badge-svg-new" viewBox="0 0 64 78" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="castNewBadgeFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffb8dc"/>
        <stop offset="40%" stop-color="#ff4fad"/>
        <stop offset="72%" stop-color="#df0f86"/>
        <stop offset="100%" stop-color="#990657"/>
      </linearGradient>
      <linearGradient id="castNewBadgeShine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity=".72"/>
        <stop offset="48%" stop-color="#fff" stop-opacity=".18"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <filter id="castNewBadgeShadow" x="-25%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#5e1438" flood-opacity=".32"/>
      </filter>
    </defs>
    <path d="M12 5H52Q57 5 57 10V61L43 61L32 74L21 61H7V10Q7 5 12 5Z" fill="url(#castNewBadgeFill)" stroke="#ffe9a9" stroke-width="3" filter="url(#castNewBadgeShadow)"/>
    <path d="M13 9H51Q53 9 53 11V17Q34 8 11 28V11Q11 9 13 9Z" fill="url(#castNewBadgeShine)"/>
    <path d="M13 5H51Q57 5 57 11V22H7V11Q7 5 13 5Z" fill="#ffffff" opacity=".08"/>
    <text x="32" y="30" text-anchor="middle" fill="#fff" font-size="16" font-weight="900" font-family="Arial, sans-serif" letter-spacing=".8">NEW</text>
    <text x="32" y="50" text-anchor="middle" fill="#fff" font-size="14" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif">新人</text>
  </svg>
</span>
`;

}

function createRecommendedBadgeSvg(label = "おすすめ"){

return `
<span class="premium-cast-badge premium-cast-badge-recommended" aria-label="${label}">
  <svg class="premium-cast-badge-svg premium-cast-badge-svg-recommended" viewBox="0 0 74 58" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="castRecommendedBadgeFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff4b6"/>
        <stop offset="34%" stop-color="#f4c948"/>
        <stop offset="70%" stop-color="#c78612"/>
        <stop offset="100%" stop-color="#7a4b05"/>
      </linearGradient>
      <radialGradient id="castRecommendedBadgeGlow" cx=".32" cy=".18" r=".72">
        <stop offset="0%" stop-color="#fff" stop-opacity=".78"/>
        <stop offset="45%" stop-color="#fff" stop-opacity=".16"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <filter id="castRecommendedBadgeShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#573500" flood-opacity=".34"/>
      </filter>
    </defs>
    <path d="M37 4C41 10 48 7 52 13C59 13 62 19 59 25C66 29 64 37 57 39C57 47 50 51 43 48C39 55 31 55 27 48C20 51 13 47 13 39C6 37 8 29 15 25C12 19 15 13 22 13C26 7 33 10 37 4Z" fill="url(#castRecommendedBadgeFill)" stroke="#8d5c08" stroke-width="3" filter="url(#castRecommendedBadgeShadow)"/>
    <path d="M22 15C31 8 45 9 53 17C44 14 28 17 16 29C15 24 17 19 22 15Z" fill="url(#castRecommendedBadgeGlow)"/>
    <path d="M20 18C28 12 46 12 54 22" fill="none" stroke="#fff7c8" stroke-width="2" stroke-linecap="round" opacity=".55"/>
    <text x="37" y="35" text-anchor="middle" fill="#fff" font-size="13" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif" paint-order="stroke" stroke="#8b5705" stroke-width="2" stroke-linejoin="round">${label}</text>
  </svg>
</span>
`;

}

function getTags(cast){

if(Array.isArray(cast?.tags)){
return cast.tags
.map((tag)=>String(tag).trim())
.filter(Boolean);
}

if(typeof cast?.tags === "string"){
return cast.tags
.split(",")
.map((tag)=>tag.trim())
.filter(Boolean);
}

return [];

}

function createPublicTagMarkup(cast){

const tags =
getTags(cast).slice(0,4);

if(!tags.length){
return '<div class="public-cast-tags" aria-label="タグ"></div>';
}

return `
<div class="public-cast-tags" aria-label="タグ">
${tags.map((tag)=>`<span>${escapeHtml(tag)}</span>`).join("")}
</div>
`;

}

function escapeHtml(value){

return String(value)
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
.replaceAll("'","&#039;");

}

function escapeAttribute(value){

return escapeHtml(value)
.replaceAll("`","&#096;");

}
