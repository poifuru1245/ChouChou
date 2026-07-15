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
const TOKYO_TIME_ZONE = "Asia/Tokyo";

async function loadCasts() {

const scheduleSnapshot =
await getDocs(
  collection(db,"schedules")
);

const today =
getTokyoDateKey();

const todayCasts = [];

scheduleSnapshot.forEach((docSnap)=>{

  const schedule = {
    id: docSnap.id,
    ...docSnap.data()
  };

  const scheduleDate =
  getScheduleDateKey(schedule);

  const normalizedSchedule = {
    ...schedule,
    dateKey: scheduleDate,
    castId: getScheduleCastId(schedule),
    castName: getScheduleCastName(schedule),
    time: getScheduleTime(schedule)
  };

  if(
    scheduleDate === today &&
    !isInactiveSchedule(schedule)
  ){

  todayCasts.push(normalizedSchedule);

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

  renderPrincessPickUp(casts);
  loadAllCasts(todayCasts);

console.log("cast.js 起動");
console.log(document.querySelector(".v9-cast-list, .cast-grid"));

  const list =
document.querySelector(".v9-cast-list, .cast-grid");

  if(!list) return;

  const requestedLimit =
getListLimit(list);

  const limit =
window.matchMedia("(max-width: 767px)").matches
? requestedLimit
: null;

  const isScheduleList =
list?.dataset?.view === "schedule";

  list.innerHTML = "";

  const schedulesForDisplay =
todayCasts;

  if(isScheduleList){

  if(schedulesForDisplay.length === 0){

  const legacyScheduleCasts =
  casts
  .filter((cast)=>String(cast?.schedule || "").trim());

  if(legacyScheduleCasts.length){

  legacyScheduleCasts
.slice(0, limit ?? legacyScheduleCasts.length)
.forEach((cast)=>{

const div =
document.createElement("div");

div.className = "v9-cast-item";
makeTodayScheduleCardClickable(div, createCastDetailUrl(cast));

const image =
getMainImage(cast);

div.innerHTML =
createV9TodayCastMarkup(cast, formatSchedule(cast), image);

list.appendChild(div);

  });

  return;

  }

  list.innerHTML = `
    <p class="no-cast">
      本日の出勤情報はありません
    </p>
  `;

  return;
}

  schedulesForDisplay
  .slice(0, limit ?? schedulesForDisplay.length)
  .forEach((schedule)=>{

const cast =
casts.find((item)=>isScheduleForCast(schedule,item)) ||
createScheduleFallbackCast(schedule);

const div =
document.createElement("div");

div.className = "v9-cast-item";
makeTodayScheduleCardClickable(div, createCastDetailUrl(cast));

const image =
getMainImage(cast);

div.innerHTML =
createV9TodayCastMarkup(cast, formatSchedule(cast, schedule.time), image);

list.appendChild(div);

  });

  return;

  }

  if(todayCasts.length === 0){

  list.innerHTML = `
    <p class="no-cast">
      本日の出勤情報はありません
    </p>
  `;

  return;
}

  let renderedCount = 0;

  casts.forEach((cast)=>{

    if(
limit !== null &&
renderedCount >= limit
){
return;
}

    console.log("判定", cast.name);

const todayCast =
todayCasts.find((item)=>isScheduleForCast(item,cast));

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

if(isScheduleList){

div.className = "v9-cast-item";
makeTodayScheduleCardClickable(div, detailUrl);

div.innerHTML = `
  ${createV9TodayCastMarkup(cast, formatSchedule(cast, todayCast.time), image)}
`;

}else{

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
      <span data-i18n="cast.schedule.label">出勤</span>：${escapeHtml(formatSchedule(cast, todayCast.time))}
    </p>

    ${tagsMarkup}

   <a
class="reserve-btn public-profile-link"
href="${detailUrl}"
aria-label="${escapeAttribute(cast.name || "キャスト")}のプロフィール">
<span data-i18n="button.detail">詳細</span>
</a>

  </div>
`;

}

console.log("追加", cast.name);

    list.appendChild(div);
    renderedCount += 1;

  });

  if(renderedCount === 0){

  list.innerHTML = `
    <p class="no-cast today-cast-empty" data-i18n="today.empty">
      本日の出勤情報はありません
    </p>
  `;

  }

}

loadCasts();

async function loadAllCasts(todayCasts = []){

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

const limit =
getListLimit(list);

list.innerHTML = "";

casts
.slice(0, limit ?? casts.length)
.forEach((cast)=>{

const div =
document.createElement("div");

div.className = "cast-card public-cast-card";

const image =
getMainImage(cast);
const imageMarkup =
image
? `<img class="public-cast-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">`
: `<div class="cast-card-no-image public-cast-image">NO IMAGE</div>`;
const todaySchedule =
todayCasts.find((schedule)=>isScheduleForCast(schedule,cast));
const badgeMarkup =
createCastBadgeMarkup(cast,{
  textStyle:true
});
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
${escapeHtml(formatAge(cast.age))} <span aria-hidden="true">◇</span>${escapeHtml(formatHeight(cast.height))}
</p>

${createCastListHobbyMarkup(cast)}

<p class="public-cast-schedule-row">
  ${todaySchedule ? '<span class="public-cast-today-label">TODAY</span>' : ""}
  <span class="public-cast-schedule-time">${escapeHtml(formatSchedule(cast,todaySchedule?.time))}</span>
</p>

<a
class="reserve-btn public-profile-link"
href="${detailUrl}"
aria-label="${escapeAttribute(cast.name || "キャスト")}のプロフィール">
<span>PROFILE</span>
</a>

</div>
`;

makePublicCastCardClickable(div, detailUrl);
list.appendChild(div);

});

}

function createCastListHobbyMarkup(cast){

const hobby =
String(cast?.hobby || "").trim();

if(!hobby){
return "";
}

return `
<p class="public-cast-hobby">
  <span class="public-cast-hobby-label">趣味</span>
  <span class="public-cast-hobby-value">${escapeHtml(hobby)}</span>
</p>
`;

}

function getTokyoDateKey(date = new Date()){

return new Intl.DateTimeFormat("en-CA",{
  timeZone:TOKYO_TIME_ZONE,
  year:"numeric",
  month:"2-digit",
  day:"2-digit"
}).format(date);

}

function getScheduleDateKey(schedule){

return normalizeScheduleDate(
schedule?.date ||
schedule?.dateKey ||
schedule?.scheduleDate ||
schedule?.workDate ||
schedule?.day ||
schedule?.startDate
);

}

function normalizeScheduleDate(value){

if(!value){
return "";
}

if(typeof value?.toDate === "function"){
return getTokyoDateKey(value.toDate());
}

if(
typeof value === "object" &&
Number.isFinite(value.seconds)
){
return getTokyoDateKey(new Date(value.seconds * 1000));
}

if(value instanceof Date){
return getTokyoDateKey(value);
}

const text =
String(value).trim();

if(!text){
return "";
}

const slashMatch =
text.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/);

if(slashMatch){
return `${slashMatch[1]}-${slashMatch[2].padStart(2,"0")}-${slashMatch[3].padStart(2,"0")}`;
}

const hyphenMatch =
text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

if(hyphenMatch){
return `${hyphenMatch[1]}-${hyphenMatch[2].padStart(2,"0")}-${hyphenMatch[3].padStart(2,"0")}`;
}

const japaneseMatch =
text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);

if(japaneseMatch){
return `${japaneseMatch[1]}-${japaneseMatch[2].padStart(2,"0")}-${japaneseMatch[3].padStart(2,"0")}`;
}

const parsedDate =
new Date(text);

return Number.isNaN(parsedDate.getTime())
? text
: getTokyoDateKey(parsedDate);

}

function getScheduleCastId(schedule){

return String(
schedule?.castId ||
schedule?.castID ||
schedule?.castDocId ||
schedule?.cast_id ||
schedule?.castRef?.id ||
""
).trim();

}

function getScheduleCastName(schedule){

return String(
schedule?.castName ||
schedule?.name ||
schedule?.cast ||
schedule?.cast_name ||
schedule?.girlName ||
""
).trim();

}

function getScheduleTime(schedule){

const start =
schedule?.start ||
schedule?.startTime ||
schedule?.from ||
"";

const end =
schedule?.end ||
schedule?.endTime ||
schedule?.to ||
"";

if(start && end){
return `${start}〜${end}`;
}

if(start || end){
return start || end;
}

const explicitTime =
schedule?.time ||
schedule?.workTime ||
schedule?.scheduleTime ||
schedule?.shift ||
"";

return explicitTime
? String(explicitTime)
: "";

}

function isScheduleForCast(schedule,cast){

const scheduleCastId =
getScheduleCastId(schedule);

const scheduleCastName =
getScheduleCastName(schedule);

const castId =
String(cast?.id || "").trim();

const castName =
String(cast?.name || "").trim();

return Boolean(
  (scheduleCastId && castId && scheduleCastId === castId) ||
  (scheduleCastId && castName && scheduleCastId === castName) ||
  (scheduleCastName && castName && scheduleCastName === castName) ||
  (scheduleCastName && castId && scheduleCastName === castId)
);

}

function isInactiveSchedule(schedule){

const status =
String(schedule?.status || schedule?.attendanceStatus || "").trim();

return status === "休み" ||
status === "欠勤" ||
status === "cancel" ||
status === "canceled" ||
status === "cancelled" ||
schedule?.isOff === true ||
schedule?.off === true;

}

function createScheduleFallbackCast(schedule){

return {
  id: schedule?.castId || schedule?.id || "",
  name: schedule?.castName || schedule?.castId || schedule?.name || "CAST",
  age: schedule?.age || "",
  height: schedule?.height || "",
  schedule: schedule?.time || ""
};

}

function getListLimit(list) {
  const rawValue =
    list?.dataset?.visibleCount ??
    list?.dataset?.limit;

  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0
    ? value
    : null;
}

function renderPrincessPickUp(casts){

const section =
document.querySelector("[data-princess-pickup]");

const content =
section?.querySelector("[data-princess-pickup-content]");

if(!section || !content) return;

const cast =
selectPrincessPickUpCast(casts,section);

if(!cast){
content.innerHTML = `
  <p class="princess-pickup-empty">
    おすすめキャストを準備中です
  </p>
`;
return;
}

const image =
getMainImage(cast);

const imageMarkup =
image
? `<img class="princess-pickup-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}" loading="lazy">`
: `<div class="princess-pickup-no-image">NO IMAGE</div>`;

const detailUrl =
createCastDetailUrl(cast);

const hobby =
String(cast?.hobby || "").trim();

const favoriteDrink =
String(cast?.favoriteDrink || cast?.drink || "").trim();

const optionalDetails = [
  hobby
  ? `<div><dt>趣味</dt><dd>${escapeHtml(hobby)}</dd></div>`
  : "",
  favoriteDrink
  ? `<div><dt>好きなお酒</dt><dd>${escapeHtml(favoriteDrink)}</dd></div>`
  : ""
].join("");

content.innerHTML = `
  <div class="princess-pickup-photo">
    ${imageMarkup}
    <span class="princess-pickup-photo-glow" aria-hidden="true"></span>
  </div>

  <div class="princess-pickup-profile">
    <h3>${escapeHtml(cast.name || "CAST")}</h3>
    <span class="princess-pickup-name-line" aria-hidden="true"></span>
    <p class="princess-pickup-comment">${escapeHtml(getPrincessPickUpComment(cast))}</p>
    <dl class="princess-pickup-details">
      <div><dt>年齢</dt><dd>${escapeHtml(formatAge(cast.age))}</dd></div>
      <div><dt>身長</dt><dd>${escapeHtml(formatHeight(cast.height))}</dd></div>
      ${optionalDetails}
    </dl>
    <a class="princess-pickup-button" href="${detailUrl}" aria-label="${escapeAttribute(cast.name || "キャスト")}のプロフィールを見る">
      プロフィールを見る
    </a>
  </div>
`;

initializePrincessPickUpReveal(section);

}

function initializePrincessPickUpReveal(section){

if(!section) return;

section.classList.add("is-princess-pickup-ready");

const reveal = ()=>{
section.classList.add("is-princess-pickup-visible");
};

if(
window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
!("IntersectionObserver" in window)
){
reveal();
return;
}

const observer =
new IntersectionObserver((entries)=>{

if(!entries.some((entry)=>entry.isIntersecting)) return;

reveal();
observer.disconnect();

},{
threshold:.18,
rootMargin:"0px 0px -8% 0px"
});

observer.observe(section);

}

function selectPrincessPickUpCast(casts,section){

if(!Array.isArray(casts) || casts.length === 0){
return null;
}

const configuredCastId =
String(section?.dataset?.castId || "").trim();

if(configuredCastId){
const configuredCast =
casts.find((cast)=>String(cast?.id || "") === configuredCastId);

if(configuredCast){
return configuredCast;
}
}

return casts.find((cast)=>
  isBadgeEnabled(cast?.isPrincessPickUp) ||
  isBadgeEnabled(cast?.isPrincessPickup) ||
  isBadgeEnabled(cast?.isPickup) ||
  isBadgeEnabled(cast?.isRecommended)
) || casts.find((cast)=>getMainImage(cast)) || casts[0];

}

function getPrincessPickUpComment(cast){

return String(
cast?.pickupComment ||
cast?.comment ||
cast?.message ||
cast?.introduction ||
cast?.catchCopy ||
"今夜を彩る、特別なプリンセスです。"
).trim();

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

function formatCup(cast){

const cup =
cast?.cup ||
cast?.cupSize ||
cast?.bust ||
cast?.bustCup ||
"";

return cup
? `${cup}カップ`.replace("カップカップ","カップ")
: "-";

}

function formatTodayProfile(cast){

return `${formatAge(cast?.age)} / ${formatCup(cast)} / ${formatHeight(cast?.height)}`;

}

function createV9TodayCastMarkup(cast, scheduleText, image = ""){

const name =
cast?.name || "";

const imageMarkup =
image
? `<img class="v9-cast-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(name)}">`
: `<div class="v9-cast-no-image">NO IMAGE</div>`;

return `
  <div class="v9-cast-photo">
    ${imageMarkup}

  </div>

  <div class="v9-cast-profile">
    <div class="v9-cast-name-row">
      <h3>${escapeHtml(name)}</h3>
      <span class="v9-cast-name-en">${escapeHtml(toDisplayRomaji(cast))}</span>
      <span class="v9-cast-status">本日出勤</span>
    </div>

    <dl class="v9-cast-meta">
      <div class="v9-cast-meta-row">
        <dt><span class="v9-meta-icon" aria-hidden="true">□</span><span>年齢</span></dt>
        <dd>${escapeHtml(formatAge(cast?.age))}</dd>
      </div>
      <div class="v9-cast-meta-row">
        <dt><span class="v9-meta-icon" aria-hidden="true">◇</span><span>身長</span></dt>
        <dd>${escapeHtml(formatHeight(cast?.height))}</dd>
      </div>
      <div class="v9-cast-meta-row">
        <dt><span class="v9-meta-icon" aria-hidden="true">○</span><span>出勤時間</span></dt>
        <dd>${escapeHtml(scheduleText || "未定")}</dd>
      </div>
    </dl>
  </div>
`;

}

function toDisplayRomaji(cast){

const value =
cast?.nameEn ||
cast?.englishName ||
cast?.romanName ||
cast?.romaji ||
"";

return value || "";

}

function makeTodayScheduleCardClickable(card, detailUrl){

if(!card || !detailUrl) return;

card.classList.add("today-schedule-link");
card.setAttribute("role","link");
card.setAttribute("tabindex","0");
card.addEventListener("click",()=>{
  window.location.href = detailUrl;
});
card.addEventListener("keydown",(event)=>{
  if(event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  window.location.href = detailUrl;
});

}

function makePublicCastCardClickable(card, detailUrl){

if(!card || !detailUrl) return;

card.classList.add("public-cast-card-link");
card.setAttribute("role","link");
card.setAttribute("tabindex","0");
card.addEventListener("click",(event)=>{
  if(event.target.closest("a,button,input,select,textarea,label")) return;
  window.location.href = detailUrl;
});
card.addEventListener("keydown",(event)=>{
  if(event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  window.location.href = detailUrl;
});

}

function formatSchedule(cast, time = ""){

return time ||
cast?.schedule ||
"未定";

}

function createCastBadgeMarkup(cast,options = {}){

const badges = [];

const textStyle =
options?.textStyle === true;

if(isBadgeEnabled(cast?.isNew)){
badges.push(textStyle ? createTextBadge("NEW","new") : createNewBadgeImage());
}

if(isBadgeEnabled(cast?.isRecommended)){
badges.push(textStyle ? createTextBadge("おすすめ","recommended") : createRecommendedBadgeImage());
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

function createTextBadge(label,type){

return `
<span class="premium-cast-badge premium-cast-badge-${escapeAttribute(type)} public-cast-text-badge">
  ${escapeHtml(label)}
</span>
`;

}


function isBadgeEnabled(value){

return value === true ||
value === "true" ||
value === 1 ||
value === "1" ||
value === "on" ||
value === "yes";

}

function createNewBadgeImage(){

return `
<span class="premium-cast-badge premium-cast-badge-new" aria-label="NEW 新人">
 <img class="premium-cast-badge-img premium-cast-badge-img-new"
src="assets/img/badges/badge-new.png"
alt="NEW 新人"
loading="lazy">
</span>
`;

}

function createRecommendedBadgeImage(label = "おすすめ"){

return `
<span class="premium-cast-badge premium-cast-badge-recommended" aria-label="${label}">
  <img class="premium-cast-badge-img premium-cast-badge-img-recommended"
src="assets/img/badges/badge-osusume.png"
alt="${label}"
loading="lazy">
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
