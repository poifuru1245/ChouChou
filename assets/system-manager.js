import { db } from "./app.js";
import "./admin.js";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("systemItemForm");
const list = document.getElementById("systemItemList");
const message = document.getElementById("systemMessage");
let items = [];
let editingId = "";
let draggedId = "";

onSnapshot(collection(db, "systemItems"), (snapshot) => {
  items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b) => Number(a.displayOrder ?? 9999) - Number(b.displayOrder ?? 9999));
  render();
}, () => setMessage("料金情報の読み込みに失敗しました。", "error"));

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = { type: data.get("type"), label: String(data.get("label") || "").trim(), price: String(data.get("price") || "").trim(), isPublished: data.get("isPublished") === "on", updatedAt: serverTimestamp() };
  if (!payload.label || !payload.price) return setMessage("項目名と金額を入力してください。", "error");
  if (editingId) await updateDoc(doc(db,"systemItems",editingId),payload);
  else await addDoc(collection(db,"systemItems"),{...payload,displayOrder:items.length + 1,createdAt:serverTimestamp()});
  reset(); setMessage("保存しました。", "success");
});
document.getElementById("resetSystemItem")?.addEventListener("click", reset);

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const item = items.find((entry) => entry.id === button.dataset.id); if (!item) return;
  if (button.dataset.action === "edit") { editingId=item.id; form.elements.type.value=item.type; form.elements.label.value=item.label; form.elements.price.value=item.price; form.elements.isPublished.checked=item.isPublished!==false; form.scrollIntoView({behavior:"smooth"}); }
  if (button.dataset.action === "toggle") await updateDoc(doc(db,"systemItems",item.id),{isPublished:item.isPublished===false,updatedAt:serverTimestamp()});
  if (button.dataset.action === "delete" && confirm(`${item.label}を削除しますか？`)) await deleteDoc(doc(db,"systemItems",item.id));
});
list?.addEventListener("dragstart", (event) => { const card=event.target.closest("[data-id]"); draggedId=card?.dataset.id||""; });
list?.addEventListener("dragover", (event) => event.preventDefault());
list?.addEventListener("drop", async (event) => { event.preventDefault(); const target=event.target.closest("[data-id]"); if(!target||!draggedId||target.dataset.id===draggedId)return; const ids=items.map(i=>i.id); const from=ids.indexOf(draggedId); const to=ids.indexOf(target.dataset.id); ids.splice(to,0,ids.splice(from,1)[0]); const batch=writeBatch(db); ids.forEach((id,index)=>batch.update(doc(db,"systemItems",id),{displayOrder:index+1})); await batch.commit(); draggedId=""; setMessage("表示順を保存しました。","success"); });

function render(){ list.innerHTML=items.map(item=>`<article class="admin-item-card admin-premium-card" draggable="true" data-id="${escapeAttr(item.id)}"><span class="admin-category-badge">${typeLabel(item.type)}</span><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.price)}</p><p>${item.isPublished===false?"非公開":"公開中"}</p><div class="admin-item-actions"><button class="admin-drag-handle" type="button">☰ 並び替え</button><button data-action="edit" data-id="${escapeAttr(item.id)}">編集</button><button data-action="toggle" data-id="${escapeAttr(item.id)}">${item.isPublished===false?"公開":"非公開"}</button><button data-action="delete" data-id="${escapeAttr(item.id)}">削除</button></div></article>`).join("") || "<p>料金・メニューはまだ登録されていません。</p>"; }
function reset(){ editingId=""; form.reset(); form.elements.isPublished.checked=true; }
function setMessage(text,type=""){ message.textContent=text; message.dataset.type=type; }
function typeLabel(type){ return ({fee:"料金",drink:"ドリンク",champagne:"シャンパン"})[type]||type; }
function escapeHtml(value){ const e=document.createElement("div");e.textContent=String(value??"");return e.innerHTML; }
function escapeAttr(value){ return escapeHtml(value).replaceAll('"',"&quot;"); }
