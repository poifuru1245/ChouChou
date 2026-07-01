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

console.log("cast.js 起動");
console.log(document.querySelector(".cast-grid"));

  const list =
document.querySelector(".cast-grid");

  if(!list) return;

  const limit =
getListLimit(list);

  const isScheduleList =
list?.dataset?.view === "schedule";

  list.innerHTML = "";

  const schedulesForDisplay =
todayCasts;

  if(isScheduleList){

  if(schedulesForDisplay.length === 0){

  const legacyScheduleCasts =
  casts
  .filter((cast)=>String(cast?.schedule || "").trim())
  .slice(0, limit ?? casts.length);

  if(legacyScheduleCasts.length){

  legacyScheduleCasts.forEach((cast)=>{

const div =
document.createElement("div");

div.className = "today-schedule-item";

const image =
getMainImage(cast);

const imageMarkup =
image
? `<img class="public-cast-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">`
: `<div class="cast-card-no-image public-cast-image">NO IMAGE</div>`;

div.innerHTML = `
  <div class="today-schedule-photo">
    ${imageMarkup}
  </div>

  <div class="today-schedule-info">
    <h3>${escapeHtml(cast.name || "")}</h3>

    <p>
      ${escapeHtml(formatAge(cast.age))}
    </p>

    <p class="cast-time public-cast-schedule">
      ${escapeHtml(formatSchedule(cast))}
    </p>
  </div>
`;

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

div.className = "today-schedule-item";

const image =
getMainImage(cast);

const imageMarkup =
image
? `<img class="public-cast-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">`
: `<div class="cast-card-no-image public-cast-image">NO IMAGE</div>`;

div.innerHTML = `
  <div class="today-schedule-photo">
    ${imageMarkup}
  </div>

  <div class="today-schedule-info">
    <h3>${escapeHtml(cast.name || "")}</h3>

    <p>
      ${escapeHtml(formatAge(cast.age))}
    </p>

    <p class="cast-time public-cast-schedule">
      ${escapeHtml(formatSchedule(cast, schedule.time))}
    </p>
  </div>
`;

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

div.className = "today-schedule-item";

div.innerHTML = `
  <div class="today-schedule-photo">
    ${imageMarkup}
  </div>

  <div class="today-schedule-info">
    <h3>${escapeHtml(cast.name || "")}</h3>

    <p>
      ${escapeHtml(formatAge(cast.age))}
    </p>

    <p class="cast-time public-cast-schedule">
      ${escapeHtml(formatSchedule(cast, todayCast.time))}
    </p>
  </div>
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
const badgeMarkup =
createCastBadgeMarkup(cast);
const tagsMarkup =
createPublicTagMarkup(cast);
const detailUrl =
createCastDetailUrl(cast);
const isLimitedList =
limit !== null;
const detailLabel =
isLimitedList
? "詳細"
: "プロフィール";

div.innerHTML = `
<div class="public-cast-photo">
${imageMarkup}
${badgeMarkup}
</div>

<div class="cast-info public-cast-info">

<h3>${escapeHtml(cast.name || "")}</h3>

<p class="public-cast-profile-line">
${escapeHtml(formatAge(cast.age))} / ${escapeHtml(formatCup(cast))} / ${escapeHtml(formatHeight(cast.height))}
</p>

<p class="cast-time public-cast-schedule">
<span data-i18n="cast.schedule.label">出勤</span>：${escapeHtml(formatSchedule(cast))}
</p>

${tagsMarkup}

<a
class="reserve-btn public-profile-link"
href="${detailUrl}"
aria-label="${escapeAttribute(cast.name || "キャスト")}のプロフィール">
<span data-i18n="${isLimitedList ? "button.detail" : "button.profile"}">${detailLabel}</span>
</a>

</div>
`;

list.appendChild(div);

});

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

function getListLimit(list){

const value =
Number(list?.dataset?.limit);

return Number.isInteger(value) &&
value > 0
? value
: null;

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
<div class="public-cast-badges cast-badge-layer">
${badges.join("")}
</div>
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
