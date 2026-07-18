import { getCollection, subscribeCollection } from "./js/services/firestoreService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";
import { setBusy, showPageError } from "./js/ui/pageState.js";
import { bootstrapPage } from "./js/pages/bootstrapPage.js";
import { imageMarkup as createImageMarkup, skeletonMarkup } from "./js/components/uiComponents.js";
import { getCastImages, getCastTags as getTags, getMainCastImage as getMainImage, isEnabledFlag as isBadgeEnabled, sortCastsByDisplayOrder } from "./js/services/castService.js";

bootstrapPage({ pageName:"cast" });
const TOKYO_TIME_ZONE = "Asia/Tokyo";

async function loadCasts() {

const schedules = await getCollection("schedules", { force: true });

const today =
getTokyoDateKey();

const todayCasts = [];

schedules.forEach((schedule)=>{

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

  const casts = (await getCollection("casts", { force: true }))
    .filter((cast) => cast.isPublished !== false);

  sortCastsByDisplayOrder(casts);

  renderPrincessPickUp(casts);
  loadAllCasts(todayCasts, casts);

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

div.className = "v9-cast-item card-premium";
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

div.className = "v9-cast-item card-premium";
makeTodayScheduleCardClickable(div, createCastDetailUrl(cast));

const image =
getMainImage(cast);

div.innerHTML =
createV9TodayCastMarkup(cast, formatSchedule(cast, schedule.time), image, schedule);

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
const imageMarkup = createImageMarkup({ src:image, alt:cast.name || "", className:"public-cast-image", fallbackClassName:"cast-card-no-image public-cast-image" });
const badgeMarkup =
createCastBadgeMarkup(cast);
const tagsMarkup =
createPublicTagMarkup(cast);
const detailUrl =
createCastDetailUrl(cast);

if(isScheduleList){

div.className = "v9-cast-item card-premium";
makeTodayScheduleCardClickable(div, detailUrl);

div.innerHTML = `
    ${createV9TodayCastMarkup(cast, formatSchedule(cast, todayCast.time), image, todayCast)}
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

let realtimeRefreshTimer = null;

function queueRealtimeCastRefresh() {
  window.clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = window.setTimeout(() => {
    const roots = document.querySelectorAll(".v9-cast-list, .cast-grid, .all-cast-grid");
    roots.forEach((root) => {
      setBusy(root, true, "キャスト情報を読み込み中");
      if (!root.children.length || root.textContent.trim() === "読み込み中...") root.innerHTML = skeletonMarkup(3);
    });
    loadCasts()
      .catch(showCastLoadError)
      .finally(() => roots.forEach((root) => setBusy(root, false)));
  }, 80);
}

function showCastLoadError(error) {
  console.error("キャスト表示更新失敗", error);
  const target = document.querySelector(".v9-cast-list, .cast-grid, .all-cast-grid");
  showPageError(target, "キャスト情報を読み込めませんでした。通信状況をご確認ください。");
}

subscribeCollection("casts", queueRealtimeCastRefresh, showCastLoadError);
subscribeCollection("schedules", queueRealtimeCastRefresh, showCastLoadError);

async function loadAllCasts(todayCasts = [], suppliedCasts = null){

const casts = suppliedCasts ? [...suppliedCasts] : await getCollection("casts");

sortCastsByDisplayOrder(casts);

const list =
document.querySelector(".all-cast-grid");

if(!list) return;

const limit =
getListLimit(list);

list.innerHTML = "";

const favoriteKeys = readFavoriteKeys();
const visibleCasts = casts.filter((cast)=>cast?.isPublished !== false).filter((cast)=>{
  if(list.dataset.favoritesOnly !== "true") return true;
  return favoriteKeys.includes(String(cast?.id || cast?.name || ""));
});

visibleCasts
.slice(0, limit ?? visibleCasts.length)
.forEach((cast,castIndex)=>{

const div =
document.createElement("div");

div.className = "cast-card public-cast-card";

const image =
getMainImage(cast);
const imageMarkup = createImageMarkup({ src:image, alt:cast.name || "", className:"public-cast-image", fallbackClassName:"cast-card-no-image public-cast-image" });
const todaySchedule =
todayCasts.find((schedule)=>isScheduleForCast(schedule,cast));
const isToday = Boolean(todaySchedule || (!todayCasts.length && String(cast?.schedule || "").trim()));
const badgeMarkup =
createCastBadgeMarkup(cast);
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
  ${isToday ? '<span class="public-cast-today-label">TODAY</span>' : ""}
  <span class="public-cast-schedule-time">${escapeHtml(formatSchedule(cast,todaySchedule?.time))}</span>
</p>

<a
class="reserve-btn public-profile-link"
href="${detailUrl}"
aria-label="${escapeAttribute(cast.name || "キャスト")}のプロフィール">
<span>PROFILE</span>
</a>

${createCastEngagementActions(cast)}

</div>
`;

makePublicCastCardClickable(div, detailUrl);
applyCastSearchData(div, cast, isToday, castIndex);
list.appendChild(div);

});

if(!visibleCasts.length){
  list.innerHTML = `<p class="no-cast ${list.dataset.favoritesOnly === "true" ? "v7-favorite-empty" : ""}">${list.dataset.favoritesOnly === "true" ? "まだお気に入り登録されていません" : "キャスト情報を準備中です"}</p>`;
}

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

function readFavoriteKeys(){
  try{
    const value = JSON.parse(window.localStorage.getItem("chouchou-favorite-casts") || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  }catch{
    return [];
  }
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

const imageMarkup = createImageMarkup({ src:image, alt:cast.name || "", className:"princess-pickup-image", fallbackClassName:"princess-pickup-no-image" });

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
params.set("favoriteFood",cast.favoriteFood || "");
params.set("charmPoint",cast.charmPoint || "");
params.set("message",cast.message || "");
params.set("instagram",cast.instagram || "");
params.set("x",cast.x || "");
params.set("line",cast.line || "");
params.set("lineReservationEnabled",cast.lineReservationEnabled === false ? "false" : "true");
params.set("tiktok",cast.tiktok || "");
params.set("galleryImages",JSON.stringify(getCastImages(cast)));
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

function createV9TodayCastMarkup(cast, scheduleText, image = "", schedule = null){

const name =
cast?.name || "";

const imageMarkup = createImageMarkup({ src:image, alt:name, className:"v9-cast-image", fallbackClassName:"v9-cast-no-image" });

const attendance = getTodayAttendanceState(scheduleText, schedule);

return `
  <div class="v9-cast-media">
    <div class="v9-cast-photo image-premium">
      ${imageMarkup}
      ${createCastBadgeMarkup(cast)}
    </div>
    ${createCastEngagementActions(cast, true)}
  </div>

  <div class="v9-cast-profile">
    <div class="v9-cast-name-row">
      <h3>${escapeHtml(name)}</h3>
      <span class="v9-cast-name-en">${escapeHtml(toDisplayRomaji(cast))}</span>
      <span class="v9-cast-status badge-premium ${attendance.className}">${escapeHtml(attendance.label)}</span>
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
      ${attendance.remaining ? `<div class="v9-cast-meta-row v6-remaining-time"><dt><span class="v9-meta-icon" aria-hidden="true">◷</span><span>残り</span></dt><dd>${escapeHtml(attendance.remaining)}</dd></div>` : ""}
    </dl>
  </div>
`;

}

function getTodayAttendanceState(scheduleText, schedule = null){
  const time = String(schedule?.time || scheduleText || "").trim();
  const startText = String(schedule?.start || schedule?.startTime || time.split(/[〜~～-]/)[0] || "").trim();
  const endText = String(schedule?.end || schedule?.endTime || time.split(/[〜~～-]/)[1] || "").trim();
  const startMinutes = parseShiftMinutes(startText);
  const endMinutes = parseShiftMinutes(endText, true);
  const now = getTokyoMinutesNow();

  if(startMinutes === null) return { label:"本日出勤", className:"is-today", remaining:"" };
  if(now < startMinutes){
    const until = startMinutes - now;
    return until <= 30
      ? { label:"まもなく出勤", className:"is-soon", remaining:`あと${until}分` }
      : { label:"本日出勤", className:"is-today", remaining:"" };
  }
  if(endMinutes !== null && now >= endMinutes){
    return { label:"本日終了", className:"is-finished", remaining:"" };
  }
  if(endMinutes !== null){
    const remaining = Math.max(0,endMinutes-now);
    const hours = Math.floor(remaining/60);
    const minutes = remaining%60;
    const text = hours > 0 ? `あと${hours}時間${minutes ? `${minutes}分` : ""}` : `あと${minutes}分`;
    return { label:"出勤中", className:"is-working", remaining:text };
  }
  return { label:"出勤中", className:"is-working", remaining:"" };
}

function parseShiftMinutes(value, isEnd = false){
  const text = String(value || "").trim().toUpperCase();
  if(!text) return null;
  if(text === "LAST") return 29 * 60;
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if(!match) return null;
  let minutes = Number(match[1]) * 60 + Number(match[2]);
  if(isEnd && minutes < 12 * 60) minutes += 24 * 60;
  return minutes;
}

function getTokyoMinutesNow(){
  const parts = new Intl.DateTimeFormat("en-GB",{timeZone:TOKYO_TIME_ZONE,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const hour = Number(parts.find((part)=>part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part)=>part.type === "minute")?.value || 0);
  return (hour < 12 ? hour + 24 : hour) * 60 + minute;
}

function createCastEngagementActions(cast, compact = false){
  const id = String(cast?.id || cast?.name || "").trim();
  if(!id) return "";
  const name = String(cast?.name || "キャスト").trim();
  const lineEnabled = cast?.lineReservationEnabled !== false;
  const webUrl = createCastWebReservationUrl(cast);
  const lineMarkup = lineEnabled ? `<a class="button-premium v6-line-cast-button v71-cast-reservation-button" href="#" data-site-link="lineReservationUrl" data-line-cast-name="${escapeAttribute(name)}" target="_blank" rel="noopener" aria-label="${escapeAttribute(name)}ちゃんを指名してLINE予約"><span class="v6-line-content"><svg class="v6-line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.25c-5.11 0-9.25 3.45-9.25 7.7 0 2.64 1.63 5.09 4.28 6.49l-.72 3.31 3.63-2.23c.68.1 1.37.15 2.06.15 5.11 0 9.25-3.46 9.25-7.72S17.11 3.25 12 3.25Z"/><circle cx="8.25" cy="11" r="1"/><circle cx="12" cy="11" r="1"/><circle cx="15.75" cy="11" r="1"/></svg><span class="v6-line-label">${escapeHtml(name)}ちゃんを指名 LINE予約</span></span></a>` : "";
  const webMarkup = compact ? "" : `<a class="button-premium v71-web-cast-button v71-cast-reservation-button" href="${escapeAttribute(webUrl)}" aria-label="${escapeAttribute(name)}さんを指名してWEB予約">WEB予約</a>`;
  return `<div class="v6-cast-actions${compact ? " is-compact" : ""}${lineEnabled ? "" : " is-line-disabled"}">
    <button type="button" class="v6-favorite-button" data-favorite-cast="${escapeAttribute(id)}" data-favorite-cast-name="${escapeAttribute(cast?.name || "キャスト")}" aria-label="${escapeAttribute(cast?.name || "キャスト")}をお気に入りに登録" aria-pressed="false">♡</button>
    ${lineMarkup}
    ${webMarkup}
  </div>`;
}

function createCastWebReservationUrl(cast){
  const params = new URLSearchParams();
  if(cast?.id) params.set("castId",String(cast.id));
  if(cast?.name) params.set("castName",String(cast.name));
  return `reservation.html?${params.toString()}`;
}

function applyCastSearchData(card, cast, isToday, originalIndex = 0){
  const age = String(cast?.age || "").replace(/\D/g,"");
  const height = String(cast?.height || "").replace(/\D/g,"");
  const bloodType = String(cast?.bloodType || cast?.blood || "");
  const message = String(cast?.message || cast?.comment || cast?.profileMessage || cast?.catchphrase || "");
  const displayOrder = Number(cast?.displayOrder);

  card.dataset.castId = String(cast?.id || cast?.name || "");
  card.dataset.castName = normalizeCastSearchValue(cast?.name);
  card.dataset.castAge = age;
  card.dataset.castHeight = height;
  card.dataset.castBlood = normalizeCastSearchValue(bloodType);
  card.dataset.castHobby = normalizeCastSearchValue(cast?.hobby);
  card.dataset.castMessage = normalizeCastSearchValue(message);
  card.dataset.castRecommended = String(isBadgeEnabled(cast?.isRecommended));
  card.dataset.castNew = String(isBadgeEnabled(cast?.isNew));
  card.dataset.castToday = String(isToday);
  card.dataset.castOrder = String(Number.isFinite(displayOrder) ? displayOrder : originalIndex);
  card.dataset.castOriginalIndex = String(originalIndex);
  card.dataset.castSearchText = normalizeCastSearchValue([
    cast?.name,
    toDisplayRomaji(cast),
    age,
    age ? `${age}歳` : "",
    height,
    height ? `${height}cm` : "",
    bloodType,
    bloodType ? `${bloodType.replace(/型$/u,"")}型` : "",
    cast?.hobby,
    message
  ].filter(Boolean).join(" "));
}

function normalizeCastSearchValue(value){
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ja");
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
