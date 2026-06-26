import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("reservation.js 読み込み成功");

const castList = [];

const firebaseConfig = {
  apiKey: "AIzaSyCsNdnnTSJUIS2eO7P_Ks8eAmtm8ManDhY",
  authDomain: "chouchou-susukino.firebaseapp.com",
  projectId: "chouchou-susukino",
  storageBucket: "chouchou-susukino.firebasestorage.app",
  messagingSenderId: "611059453310",
  appId: "1:611059453310:web:c693ea8a0ce465ac79b72f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadCasts(){

  const snapshot = await getDocs(
    collection(db,"casts")
  );

  console.log(snapshot.size);

  snapshot.forEach((docSnap)=>{

  const cast = docSnap.data();

  console.log(cast);

  castList.push(cast);

});

console.log("取得キャスト", castList);

const selects = [
  document.getElementById("cast1"),
  document.getElementById("cast2"),
  document.getElementById("cast3")
];

console.log("select確認", selects);

  selects.forEach((select)=>{

    select.innerHTML =
    '<option value="">指名なし</option>';

    castList.forEach((cast)=>{

      select.innerHTML += `
        <option value="${cast.name}">
          ${cast.name}
        </option>
      `;

    });

  });

}

document
.getElementById("people")
.addEventListener("change",(e)=>{

  const count = Number(e.target.value);

  document.getElementById("cast2").style.display =
  count >= 2 ? "block" : "none";

  document.getElementById("cast3").style.display =
  count >= 3 ? "block" : "none";

});

loadCasts();

console.log("END");

document
.getElementById("reserveBtn")
.addEventListener("click", async ()=>{

  const reservationData = {

    name:
    document.getElementById("name").value,

    phone:
    document.getElementById("phone").value,

    date:
    document.getElementById("date").value,

    time:
    document.getElementById("time").value,

    people:
    document.getElementById("people").value,

    cast1:
    document.getElementById("cast1").value,

    cast2:
    document.getElementById("cast2").value,

    cast3:
    document.getElementById("cast3").value,

    request:
    document.getElementById("request").value,

    createdAt:
    new Date().toISOString()

  };

  try{

    await addDoc(
      collection(db,"reservations"),
      reservationData
    );

    alert("予約を送信しました");

  }catch(error){

    console.error(error);

    alert("送信失敗");

  }

});