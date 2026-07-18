import { addDocument, getCollection } from "./js/services/firestoreService.js";
import { announce } from "./js/utils/dom.js";

const castList = [];
const reservationParams = new URLSearchParams(window.location.search);

async function loadCasts(){

  const casts = await getCollection("casts");

  casts.forEach((cast)=>{

  if(cast.isPublished !== false) castList.push(cast);

});

sortCastsByDisplayOrder(castList);

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
        <option value="${escapeAttribute(cast.name || "")}" data-cast-id="${escapeAttribute(cast.id || "")}">
          ${cast.name}
        </option>
      `;

    });

  });

  applyRequestedCast();

}

function applyRequestedCast(){
  const requestedId = String(reservationParams.get("castId") || "").trim();
  const requestedName = String(reservationParams.get("castName") || reservationParams.get("cast") || "").trim();
  if(!requestedId && !requestedName) return;

  const cast = castList.find((item)=>requestedId && item.id === requestedId) ||
    castList.find((item)=>requestedName && item.name === requestedName);
  const select = document.getElementById("cast1");
  if(!cast || !select) return;

  select.value = cast.name || "";
  const notice = document.getElementById("selectedCastNotice");
  if(notice){
    notice.textContent = `${cast.name}さんを指名キャストに設定しました。`;
    notice.hidden = false;
  }
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

function escapeAttribute(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll('"',"&quot;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
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

loadCasts().catch((error) => {
  console.error("キャスト読み込み失敗", error);
  announce("キャスト情報を読み込めませんでした。指名なしで予約できます。", "error");
});

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

    await addDocument("reservations", reservationData);

    alert("予約を送信しました");
    announce("予約を送信しました。");

  }catch(error){

    console.error(error);

    alert("予約の送信に失敗しました。通信状況をご確認ください。");
    announce("予約の送信に失敗しました。通信状況をご確認ください。", "error");

  }

});
