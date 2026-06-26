import { initializeApp }

from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsNdnnTSJUIS2eO7P_Ks8eAmtm8ManDhY",
  authDomain: "chouchou-susukino.firebaseapp.com",
  projectId: "chouchou-susukino",
  storageBucket: "chouchou-susukino.firebasestorage.app",
  messagingSenderId: "611059453310",
  appId: "1:611059453310:web:c693ea8a0ce465ac79b72f",
  measurementId: "G-PR6J8WFEWL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let currentFilter = "today";

let searchKeyword = "";

console.log("検索:", searchKeyword);

let editingId = null;
const popup = document.getElementById("castForm");

async function saveCastToFirebase(data){

  await addDoc(
    collection(db,"casts"),
    {
      name:data.name,
      age:data.age,
      image:data.image,
      schedule:data.schedule || ""
    }
  );

}

async function loadCasts() {

  const grid = document.querySelector(".cast-grid");

  if(!grid) return;

  grid.innerHTML = "";

  const snapshot = await getDocs(
    collection(db,"casts")
  );

  snapshot.forEach(async (item) => {
    console.log(item.data());

    const cast = item.data();

    // const stats =
// await getCastStats(cast.name);

const castId = item.id;

    const card = document.createElement("div");

    card.className = "cast-card";

   card.innerHTML = `
<img src="${cast.image}" alt="">
<h3>${cast.name}</h3>
<p>${cast.age}歳</p>
<p>${cast.schedule || ""}</p>

<div class="card-buttons">

<button class="edit-btn">
編集
</button>

<button class="delete-btn">
削除
</button>

</div>
`;

const editBtn = card.querySelector(".edit-btn");
const deleteBtn = card.querySelector(".delete-btn");

editBtn.addEventListener("click", () => {

editingId = item.id;

document.getElementById("castName").value =
cast.name;

document.getElementById("castAge").value =
cast.age;

popup.style.display = "flex";

});


deleteBtn.addEventListener("click", async () => {

  console.log("削除開始");
  console.log("castId=", castId);

  if(!confirm(`${cast.name}を削除しますか？`)){
    return;
  }

  try{

    await deleteDoc(
      doc(db,"casts",castId)
    );

    console.log("削除成功");

    await loadCasts();

  }catch(error){

    console.error("削除失敗", error);

  }

});

    grid.appendChild(card);

  });

}

loadCasts();
document.addEventListener("DOMContentLoaded", () => {

  const btn = document.getElementById("openForm");
const popup = document.getElementById("castForm");
const closeBtn = document.getElementById("closeForm");

const closeX = document.getElementById("closeX");

if(closeX && popup){

    closeX.addEventListener("click", () => {

        popup.style.display = "none";

    });

}

if(btn && popup){

  btn.addEventListener("click", () => {
    popup.style.display = "flex";
  });

}

if(closeBtn && popup){

  closeBtn.addEventListener("click", () => {
    popup.style.display = "none";
  });

}

if(popup){

  popup.addEventListener("click", (e) => {

    if(e.target === popup){
      popup.style.display = "none";
    }

  });

}

const saveBtn = document.getElementById("saveCast");

if(saveBtn){


   saveBtn.addEventListener("click", async () => { 
console.log("保存ボタン押された");
        const name = document.getElementById("castName").value;
        const age = document.getElementById("castAge").value;
 
        console.log("name=", name);
console.log("age=", age);

console.log(document.getElementById("castName"));
console.log(document.getElementById("castAge"));

        const time = "";

 let image = "";

const imageFile =
document.getElementById("castImage").files[0];

if(imageFile){

  const storageRef = ref(
    storage,
    "casts/" + Date.now() + "_" + imageFile.name
  );

  await uploadBytes(
    storageRef,
    imageFile
  );

  image = await getDownloadURL(
    storageRef
  );
}



        const grid = document.querySelector(".cast-grid");

        const card = document.createElement("div");

        card.className = "cast-card";

        card.innerHTML = `
            <img src="${image}">
            <h3>${name}</h3>
            <p>${age}歳</p>
            <p>${time}</p>
        `;

        grid.appendChild(card);
saveCastToFirebase({
  name:name,
  age:age,
  image:image,
  schedule:time
});


        document.getElementById("castForm").style.display="none";

    });

    }

    });

    async function loadReservations(){

 const reservationList =
document.getElementById("reservationList");

reservationList.innerHTML = "";

  if(!reservationList) return;

  const snapshot = await getDocs(
    collection(db,"reservations")
  );

  let pending = 0;
let confirmed = 0;
let visited = 0;
let canceled = 0;

snapshot.forEach((doc)=>{

  const data = doc.data();

  [data.cast1, data.cast2, data.cast3]
.forEach(cast => {

  if(!cast || cast === "なし") return;

  ranking[cast] =
  (ranking[cast] || 0) + 1;

});

  if(searchKeyword){

  const target =
  (
    (data.name || "") +
    (data.phone || "")
  ).toLowerCase();

  if(
    !target.includes(searchKeyword)
  ){
    return;
  }

}

  console.log("予約日", data.date);

  console.log("filter:", currentFilter);

  const today =
new Date().toISOString().split("T")[0];

if(
  currentFilter === "today" &&
  data.date !== today
){
  return;
}
  const status = data.status || "予約中";

  if(status === "予約中") pending++;
  if(status === "確定") confirmed++;
  if(status === "来店済") visited++;
  if(status === "キャンセル") canceled++;

});

document.getElementById("countPending").textContent =
pending + "件";

document.getElementById("countConfirmed").textContent =
confirmed + "件";

document.getElementById("countVisited").textContent =
visited + "件";

document.getElementById("countCanceled").textContent =
canceled + "件";

  const reservationCount =
document.getElementById("reservationCount");

if(reservationCount){
  reservationCount.textContent =
  snapshot.size + "件";
}

snapshot.forEach((doc)=>{

  const data = doc.data();

  console.log("予約データ", data);

});

  const sorted =
  Object.entries(ranking)
  .sort((a,b)=>b[1]-a[1])
  .slice(0,10);

  rankingList.innerHTML = "";

  if(sorted.length === 0){

    rankingList.innerHTML =
    "指名データなし";

  }else{

   /*
sorted.forEach((item,index)=>{

  rankingList.innerHTML += `
    <div>
      ${index + 1}位
      ${item[0]}
      (${item[1]}件)
    </div>
  `;

});
*/

  }

const today =
new Date()
.toLocaleDateString("sv-SE");

  snapshot.forEach((doc)=>{

    const data = doc.data();

    if(
 currentFilter === "today"
 && data.date !== today
){
  return;
}

    const status = data.status || "予約中";

let statusColor = "#f1c40f";

if(status === "確定"){
  statusColor = "#2ecc71";
}

if(status === "来店済"){
  statusColor = "#3498db";
}

if(status === "キャンセル"){
  statusColor = "#e74c3c";
}

    reservationList.innerHTML += `
      <div class="reservation-card">

        <h3>${data.name}</h3>

        <p>電話番号：${data.phone}</p>

        <p>日付：${data.date}</p>

        <p>時間：${data.time}</p>

        <p>人数：${data.people}名</p>

<p>
状態：
<span style="color:${statusColor};font-weight:bold;">
${status}
</span>
</p>

        <p>指名①：${data.cast1 || "なし"}</p>
        <p>指名②：${data.cast2 || "なし"}</p>
        <p>指名③：${data.cast3 || "なし"}</p>

        <p>要望：${data.request || ""}</p>


        <div class="reservation-actions">

  <button
class="confirm-btn"
data-id="${doc.id}">
確定
</button>

<button
class="visit-btn"
data-id="${doc.id}">
来店済
</button>

<button
class="cancel-btn"
data-id="${doc.id}">
キャンセル
</button>

  <button
    class="delete-btn"
    data-id="${doc.id}"
  >
    削除
  </button>

</div>

      </div>
    `;

  });

  }

console.log("予約読み込み開始");

async function getCastStats(castName){

  const snapshot = await getDocs(
    collection(db,"reservations")
  );

  let nominate = 0;
  let reserve = 0;
  let visit = 0;

  snapshot.forEach((doc)=>{

    const data = doc.data();

    if(
      data.cast1 === castName ||
      data.cast2 === castName ||
      data.cast3 === castName
    ){
      nominate++;

      if(data.status !== "キャンセル"){
        reserve++;
      }

      if(data.status === "来店済"){
        visit++;
      }
    }

  });

  return {
    nominate,
    reserve,
    visit
  };

}

loadReservations();

let ranking = {};

document.addEventListener("click", async(e)=>{

if(
e.target.classList.contains("delete-news")
){

  await deleteDoc(
    doc(
      db,
      "news",
      e.target.dataset.id
    )
  );

  loadNews();

}

  if(
    e.target.classList.contains("delete-btn")
  ){

    const id =
    e.target.dataset.id;

    if(confirm("削除しますか？")){

      await deleteDoc(
        doc(db,"reservations",id)
      );

      loadReservations();

    }

  }

});

document.addEventListener("click", async(e)=>{

  const id = e.target.dataset.id;

  if(!id) return;

  if(e.target.classList.contains("confirm-btn")){

   await updateDoc(
  doc(db,"reservations",id),
  {
    status:"確定"
  }
);

await loadReservations();

  }

  if(e.target.classList.contains("visit-btn")){

  await updateDoc(
    doc(db,"reservations",id),
    {
      status:"来店済"
    }
  );

  await loadReservations();

}

if(e.target.classList.contains("cancel-btn")){

  await updateDoc(
    doc(db,"reservations",id),
    {
      status:"キャンセル"
    }
  );

  await loadReservations();

}


});

document.getElementById("todayBtn")?.addEventListener("click", () => {
  currentFilter = "today";
  loadReservations();
});

document.getElementById("allBtn")?.addEventListener("click", () => {
  currentFilter = "all";
  loadReservations();
});

document
.getElementById("searchReservation")
?.addEventListener("input",(e)=>{

  searchKeyword =
  e.target.value.toLowerCase();

  loadReservations();

});

const rankingList =
document.getElementById("rankingList");

  loadRanking();

async function loadRanking(){

  if(!rankingList) return;

  rankingList.innerHTML = "";

  const snapshot = await getDocs(
    collection(db,"casts")
  );

  let casts = [];

  snapshot.forEach((doc)=>{

    casts.push({
      id:doc.id,
      ...doc.data()
    });

  });

  casts.sort((a,b)=>{

    const aCount =
    Number(a.nominate || 0);

    const bCount =
    Number(b.nominate || 0);

    return bCount - aCount;

  });

  casts.slice(0,10).forEach((cast,index)=>{

    let medal = "";

    if(index === 0) medal = "🥇";
    if(index === 1) medal = "🥈";
    if(index === 2) medal = "🥉";

    rankingList.innerHTML += `
      <div class="ranking-card">

        <img
          src="${cast.image}"
          style="
            width:80px;
            height:80px;
            border-radius:50%;
            object-fit:cover;
          "
        >

        <h3>
          ${medal}
          ${index+1}位
          ${cast.name}
        </h3>

        <p>
          本指名：
          ${cast.nominate || 0}本
        </p>

      </div>
    `;

  });

}

async function loadNews(){

  const newsList =
  document.getElementById("newsList");

  if(!newsList) return;

  newsList.innerHTML = "";

  const snapshot = await getDocs(
    collection(db,"news")
  );

  snapshot.forEach((docItem)=>{

    const data = docItem.data();

    newsList.innerHTML += `
      <div style="
      border-top:1px solid #eee;
      margin-top:10px;
      padding-top:10px;
      ">
        <strong>${data.title}</strong>
        <p>${data.text}</p>

        <button
          class="delete-news"
          data-id="${docItem.id}">
          削除
        </button>
      </div>
    `;
  });

}

document
.getElementById("saveNews")
?.addEventListener("click", async()=>{

  const title =
  document.getElementById("newsTitle").value;

  const text =
  document.getElementById("newsText").value;

  if(!title || !text) return;

  await addDoc(
    collection(db,"news"),
    {
      title,
      text,
      createdAt:new Date()
    }
  );

  document.getElementById("newsTitle").value = "";
  document.getElementById("newsText").value = "";

  loadNews();

});

loadNews();