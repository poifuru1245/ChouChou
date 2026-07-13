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
const MOBILE_HOME_LIMIT = 3;
const mobileHomeQuery =
typeof window !== "undefined"
? window.matchMedia("(max-width: 767px)")
: null;

async function loadCasts() {

const list =
document.querySelector(".cast-grid");

if(!list) return;

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
console.log(list);

  list.innerHTML = "";
  configureTodayCastMobileButton();

  if(todayCasts.length === 0){

  list.innerHTML = `
    <p class="no-cast">
      本日の出勤情報はありません
    </p>
  `;

  return;
}

  const todayDisplayCasts = [];

  casts.forEach((cast)=>{

    console.log("判定", cast.name);

const todayCast =
todayCasts.find(
  item => item.name === cast.name
);

if(!todayCast){
  return;
}

todayDisplayCasts.push({
  cast,
  todayCast
});

  });

  getVisibleItemsForList(list,todayDisplayCasts)
  .forEach(({ cast, todayCast })=>{

    const div =
      document.createElement("div");

    div.className = "cast-card public-cast-card";

const image =
getMainImage(cast);
const imageMarkup =
image
? `<img class="public-cast-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">`
: `<div class="cast-card-no-image public-cast-image">NO IMAGE</div>`;
const tagsMarkup =
createPublicTagMarkup(cast);
const detailUrl =
createCastDetailUrl(cast);

div.innerHTML = `
  <div class="public-cast-photo">
    ${imageMarkup}
  </div>

  <div class="cast-info public-cast-info">

    <span class="today-cast-status">本日出勤</span>

    <h3>${escapeHtml(cast.name || "")}</h3>

    <div class="today-cast-data-row">
      <p class="public-cast-profile-line today-cast-data-pill">
        <span class="today-cast-data-age">${escapeHtml(formatAge(cast.age))}</span>
        <span aria-hidden="true"> / - / </span>
        <span class="today-cast-data-height">${escapeHtml(formatHeight(cast.height))}</span>
      </p>

      <p class="cast-time public-cast-schedule today-cast-data-pill today-cast-time-pill">
        <span>出勤：</span>
        <span class="today-cast-data-time">${escapeHtml(formatSchedule(cast, todayCast.time))}</span>
      </p>
    </div>

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

const list =
document.querySelector(".all-cast-grid");

if(!list) return;

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

list.innerHTML = "";

getMobileLimitedItems(casts).forEach((cast)=>{

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
${badgeMarkup}
${imageMarkup}
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

function isMobileHomeView(){

return Boolean(
mobileHomeQuery?.matches &&
document.body &&
!document.body.classList.contains("cast-detail-page")
);

}

function getMobileLimitedItems(items){

return isMobileHomeView()
? items.slice(0,MOBILE_HOME_LIMIT)
: items;

}

function getVisibleItemsForList(list,items){

const limit =
typeof window !== "undefined" &&
window.innerWidth <= 767
? getListLimit(list)
: null;

return limit
? items.slice(0,limit)
: items;

}

function getListLimit(list){

const limit =
Number(list?.dataset?.visibleCount || MOBILE_HOME_LIMIT);

return Number.isFinite(limit) && limit > 0
? limit
: MOBILE_HOME_LIMIT;

}

function configureTodayCastMobileButton(){

if(!isMobileHomeView()) return;

const link =
document.querySelector(".today-cast-more-link");

if(!link) return;

link.href = "schedule.html";
link.innerHTML = `
  <span aria-hidden="true">♕</span>
  本日の出勤を見る
  <span aria-hidden="true">›</span>
`;

}

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
params.set("isNew",isBadgeEnabled(cast.isNew) ? "true" : "");
params.set("isRecommended",isBadgeEnabled(cast.isRecommended) ? "true" : "");
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

if(isBadgeEnabled(cast?.isNew)){
badges.push(createNewBadgeImage());
}

if(isBadgeEnabled(cast?.isRecommended)){
badges.push(createRecommendedBadgeImage());
}

if(!badges.length){
return "";
}

return `
<div class="cast-badges public-cast-badges" data-badge-layout="public">
${badges.join("")}
</div>
`;

}

function createNewBadgeImage(){

return `
<img class="badge-new" src="assets/img/badges/badge-new.png" alt="NEW 新人" width="48" decoding="async" onerror="this.remove()">
`;

}

function createRecommendedBadgeImage(label = "おすすめ"){

return `
<img class="badge-recommend" src="assets/img/badges/badge-osusume.png" alt="${label}" width="48" decoding="async" onerror="this.remove()">
`;

}

function isBadgeEnabled(value){

return value === true ||
value === "true" ||
value === 1 ||
value === "1" ||
value === "on";

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
