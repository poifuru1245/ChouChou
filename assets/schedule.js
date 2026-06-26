import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getFirestore,
collection,
getDocs,
doc,
updateDoc
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {

apiKey:"AIzaSyCsNdnnTSJUIS2eO7P_Ks8eAmtm8ManDhY",
authDomain:"chouchou-susukino.firebaseapp.com",
projectId:"chouchou-susukino",
storageBucket:"chouchou-susukino.firebasestorage.app",
messagingSenderId:"611059453310",
appId:"1:611059453310:web:c693ea8a0ce465ac79b72f"

};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadSchedule(){

const wrap =
document.getElementById("scheduleList");

wrap.innerHTML="";

const snapshot =
await getDocs(collection(db,"casts"));

const casts = [];

snapshot.forEach((item)=>{

casts.push({
id:item.id,
...item.data()
});

});

sortCastsByDisplayOrder(casts);

casts.forEach((cast)=>{

const card =
document.createElement("div");

card.className="cast-card";

card.innerHTML=`

<h3>${cast.name}</h3>

<input
type="text"
placeholder="20:00〜LAST"
value="${cast.schedule || ""}"
class="schedule-input"
>

<button class="save-btn">
保存
</button>

`;

const btn =
card.querySelector(".save-btn");

btn.addEventListener("click",async()=>{

const value =
card.querySelector(".schedule-input").value;

await updateDoc(
doc(db,"casts",cast.id),
{
schedule:value
}
);

alert("保存しました");

});

wrap.appendChild(card);

});

}

loadSchedule();

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
