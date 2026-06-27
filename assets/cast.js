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

    div.className = "cast-card";

const image =
getMainImage(cast);
const imageMarkup =
image
? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">`
: `<div class="cast-card-no-image">NO IMAGE</div>`;

div.innerHTML = `
  ${imageMarkup}

  <div class="cast-info">

    <h3>${escapeHtml(cast.name || "")}</h3>

    <p class="cast-age">
      年齢：${formatAge(cast.age)}
    </p>

    <p class="cast-height">
      身長：${formatHeight(cast.height)}
    </p>

    <p class="cast-time">
      出勤：${escapeHtml(formatSchedule(cast, todayCast.time))}
    </p>

   <a
class="reserve-btn"
href="${createCastDetailUrl(cast)}">
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

div.className = "cast-card";

const image =
getMainImage(cast);
const imageMarkup =
image
? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(cast.name || "")}">`
: `<div class="cast-card-no-image">NO IMAGE</div>`;

div.innerHTML = `
${imageMarkup}

<div class="cast-info">

<h3>${escapeHtml(cast.name || "")}</h3>

<p class="cast-age">
年齢：${formatAge(cast.age)}
</p>

<p class="cast-height">
身長：${formatHeight(cast.height)}
</p>

<p class="cast-time">
出勤：${escapeHtml(formatSchedule(cast))}
</p>

<a
class="reserve-btn"
href="${createCastDetailUrl(cast)}">
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

if(Array.isArray(cast.tags)){
params.set("tags",cast.tags.join(","));
}

return `cast.html?${params.toString()}`;

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
