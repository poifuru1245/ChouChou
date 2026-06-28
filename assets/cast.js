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
        <stop offset="0%" stop-color="#ffe0f1"/>
        <stop offset="30%" stop-color="#f6a3cb"/>
        <stop offset="68%" stop-color="#d85c9e"/>
        <stop offset="100%" stop-color="#a63472"/>
      </linearGradient>
      <linearGradient id="castNewBadgeGloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity=".88"/>
        <stop offset="42%" stop-color="#fff" stop-opacity=".2"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <filter id="castNewBadgeShadow" x="-25%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="2.2" flood-color="#5a2441" flood-opacity=".2"/>
      </filter>
    </defs>
    <path d="M17 3H53Q60 3 60 11V62H48L35 78L22 62H10V11Q10 3 17 3Z" fill="#fffefd" filter="url(#castNewBadgeShadow)"/>
    <path d="M18 7H52Q57 7 57 13V59H46L35 73L24 59H13V13Q13 7 18 7Z" fill="url(#castNewBadgeFill)" stroke="#d7bb74" stroke-width="1.35"/>
    <path d="M18 9H52Q56 9 56 14V23Q39 16 14 29V14Q14 9 18 9Z" fill="url(#castNewBadgeGloss)"/>
    <path d="M18 13Q35 7 52 13" fill="none" stroke="#fff8d8" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>
    <path d="M35 16L36.5 19.2L40 20L36.8 21.5L35 25L33.2 21.5L30 20L33.5 19.2Z" fill="#fff8d8" opacity=".72"/>
    <path d="M17 57H25L35 69L45 57H53" fill="none" stroke="#6e053d" stroke-width="1.2" opacity=".1"/>
    <text x="35" y="32" text-anchor="middle" fill="#fff" font-size="17" font-weight="900" font-family="Arial, sans-serif" letter-spacing="1" paint-order="stroke" stroke="#9f4f7e" stroke-width=".45" stroke-linejoin="round">NEW</text>
    <text x="35" y="53" text-anchor="middle" fill="#fff" font-size="15" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif" paint-order="stroke" stroke="#9f4f7e" stroke-width=".35" stroke-linejoin="round">新人</text>
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
        <stop offset="0%" stop-color="#fff9dd"/>
        <stop offset="32%" stop-color="#ecd38a"/>
        <stop offset="68%" stop-color="#c69b45"/>
        <stop offset="100%" stop-color="#85621f"/>
      </linearGradient>
      <radialGradient id="castRecommendedBadgeGlow" cx=".32" cy=".18" r=".72">
        <stop offset="0%" stop-color="#fff" stop-opacity=".72"/>
        <stop offset="42%" stop-color="#fff" stop-opacity=".14"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <filter id="castRecommendedBadgeShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="2.2" flood-color="#5b4215" flood-opacity=".18"/>
      </filter>
    </defs>
    <path d="M9 16Q21 8 40 8Q59 8 71 16Q76 21 77 26Q76 31 71 36Q59 44 40 44Q21 44 9 36Q4 31 3 26Q4 21 9 16Z" fill="#fffef8" filter="url(#castRecommendedBadgeShadow)"/>
    <path d="M12 17Q23 11 40 11Q57 11 68 17Q72 21 73 26Q72 31 68 35Q57 41 40 41Q23 41 12 35Q8 31 7 26Q8 21 12 17Z" fill="url(#castRecommendedBadgeFill)" stroke="#a77d2e" stroke-width="1.35"/>
    <path d="M16 17Q29 11 50 13Q62 14 68 21Q45 15 12 28Q11 21 16 17Z" fill="url(#castRecommendedBadgeGlow)"/>
    <path d="M15 34Q40 40 65 34" fill="none" stroke="#6b4101" stroke-width="2" opacity=".12"/>
    <path d="M17 19Q40 12 63 19" fill="none" stroke="#fff8d1" stroke-width="1.7" stroke-linecap="round" opacity=".72"/>
    <text x="40" y="32" text-anchor="middle" fill="#fff" font-size="14" font-weight="900" font-family="'Hiragino Sans', 'Yu Gothic', sans-serif" paint-order="stroke" stroke="#96733a" stroke-width=".65" stroke-linejoin="round">${label}</text>
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
