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
  <svg class="premium-cast-badge-svg premium-cast-badge-svg-new" viewBox="0 0 70 82" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="castNewBadgeFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffc6e6"/>
        <stop offset="30%" stop-color="#ff6fbd"/>
        <stop offset="68%" stop-color="#d90b7f"/>
        <stop offset="100%" stop-color="#850548"/>
      </linearGradient>
      <linearGradient id="castNewBadgeGloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity=".88"/>
        <stop offset="42%" stop-color="#fff" stop-opacity=".2"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <filter id="castNewBadgeShadow" x="-25%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#4f1231" flood-opacity=".34"/>
      </filter>
    </defs>
    <path d="M14 2H56Q65 2 65 11V63L51 63L35 80L19 63H5V11Q5 2 14 2Z" fill="#fffdf8" filter="url(#castNewBadgeShadow)"/>
    <path d="M16 5H54Q62 5 62 13V60L49 60L35 76L21 60H8V13Q8 5 16 5Z" fill="url(#castNewBadgeFill)" stroke="#d8ad46" stroke-width="2.2"/>
    <path d="M18 8H52Q58 8 58 14V25Q42 16 12 31V14Q12 8 18 8Z" fill="url(#castNewBadgeGloss)"/>
    <path d="M14 13Q35 4 56 13" fill="none" stroke="#fff8d8" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>
    <path d="M13 58H24L35 71L46 58H57" fill="none" stroke="#6e053d" stroke-width="2" opacity=".18"/>
    <text x="35" y="32" text-anchor="middle" fill="#fff" font-size="17" font-weight="900" font-family="Arial, sans-serif" letter-spacing="1" paint-order="stroke" stroke="#8e0a55" stroke-width="1.6" stroke-linejoin="round">NEW</text>
    <text x="35" y="53" text-anchor="middle" fill="#fff" font-size="15" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif" paint-order="stroke" stroke="#8e0a55" stroke-width="1.4" stroke-linejoin="round">新人</text>
  </svg>
</span>
`;

}

function createRecommendedBadgeSvg(label = "おすすめ"){

return `
<span class="premium-cast-badge premium-cast-badge-recommended" aria-label="${label}">
  <svg class="premium-cast-badge-svg premium-cast-badge-svg-recommended" viewBox="0 0 80 52" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="castRecommendedBadgeFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff5bd"/>
        <stop offset="32%" stop-color="#f2c64c"/>
        <stop offset="68%" stop-color="#bd7a0b"/>
        <stop offset="100%" stop-color="#6f4302"/>
      </linearGradient>
      <radialGradient id="castRecommendedBadgeGlow" cx=".32" cy=".18" r=".72">
        <stop offset="0%" stop-color="#fff" stop-opacity=".86"/>
        <stop offset="42%" stop-color="#fff" stop-opacity=".18"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <filter id="castRecommendedBadgeShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#4f3100" flood-opacity=".32"/>
      </filter>
    </defs>
    <path d="M9 14Q20 4 40 5Q60 4 71 14L77 26L71 38Q60 48 40 47Q20 48 9 38L3 26Z" fill="#fffdf5" filter="url(#castRecommendedBadgeShadow)"/>
    <path d="M12 15Q22 8 40 8Q58 8 68 15L73 26L68 37Q58 44 40 44Q22 44 12 37L7 26Z" fill="url(#castRecommendedBadgeFill)" stroke="#8d5c08" stroke-width="2.2"/>
    <path d="M15 16Q28 9 51 11Q63 13 68 21Q43 13 12 29Q10 21 15 16Z" fill="url(#castRecommendedBadgeGlow)"/>
    <path d="M13 34Q40 43 67 34" fill="none" stroke="#6b4101" stroke-width="3" opacity=".22"/>
    <path d="M16 18Q40 8 64 18" fill="none" stroke="#fff8d1" stroke-width="1.7" stroke-linecap="round" opacity=".72"/>
    <text x="40" y="32" text-anchor="middle" fill="#fff" font-size="14" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif" paint-order="stroke" stroke="#765005" stroke-width="2.2" stroke-linejoin="round">${label}</text>
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
