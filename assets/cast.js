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

div.innerHTML = `
  <img src="${cast.image}" alt="">

  <div class="cast-info">

    <h3>${cast.name}</h3>

    <p class="cast-age">
      ${cast.age}歳
    </p>

    <p class="cast-time">
      ${cast.schedule || "20:00〜LAST"}
    </p>

   <a
class="reserve-btn"
href="cast.html?name=${encodeURIComponent(cast.name)}&age=${cast.age}&image=${encodeURIComponent(cast.image)}&height=${encodeURIComponent(cast.height || '')}&hobby=${encodeURIComponent(cast.hobby || '')}&favoriteDrink=${encodeURIComponent(cast.favoriteDrink || '')}&message=${encodeURIComponent(cast.message || '')}">
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

div.innerHTML = `
<img src="${cast.image}" alt="">

<div class="cast-info">

<h3>${cast.name}</h3>

<p class="cast-age">
${cast.age}歳
</p>

<a
class="reserve-btn"
href="cast.html?name=${encodeURIComponent(cast.name)}&age=${cast.age}&image=${encodeURIComponent(cast.image)}&height=${encodeURIComponent(cast.height || '')}&hobby=${encodeURIComponent(cast.hobby || '')}&favoriteDrink=${encodeURIComponent(cast.favoriteDrink || '')}&message=${encodeURIComponent(cast.message || '')}">
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
