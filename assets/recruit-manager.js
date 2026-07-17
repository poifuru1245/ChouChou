import { db, storage } from "./app.js";
import { optimizeImage, subscribeDocument } from "./admin.js";
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const form = document.getElementById("recruitAdminForm");
const message = document.getElementById("recruitMessage");
const preview = document.getElementById("recruitImagePreview");
let current = {};

subscribeDocument("content","recruit",(data)=>{ current=data||{}; fill(current); },()=>setMessage("求人情報の読み込みに失敗しました。","error"));
form?.addEventListener("submit", async (event) => {
  event.preventDefault(); const button=form.querySelector("button[type=submit]"); button.disabled=true; setMessage("保存中...");
  try {
    const data=new FormData(form); let imageUrl=current.imageUrl||""; let storagePath=current.storagePath||""; const file=form.elements.image.files?.[0];
    if(file){ const optimized=await optimizeImage(file,{maxWidth:1800,maxHeight:1400,quality:.86}); storagePath=`recruit/${Date.now()}_${optimized.name}`; const storageRef=ref(storage,storagePath); await uploadBytes(storageRef,optimized,{contentType:optimized.type}); imageUrl=await getDownloadURL(storageRef); }
    const payload={title:String(data.get("title")||"").trim(),lead:String(data.get("lead")||"").trim(),description:String(data.get("description")||"").trim(),benefits:String(data.get("benefits")||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean),applicationLineUrl:String(data.get("applicationLineUrl")||"").trim(),imageUrl,storagePath,isPublished:data.get("isPublished")==="on",updatedAt:serverTimestamp()};
    await setDoc(doc(db,"content","recruit"),payload,{merge:true}); setMessage("求人情報を保存しました。","success"); form.elements.image.value="";
  } catch(error){ console.error(error); setMessage("保存に失敗しました。","error"); } finally { button.disabled=false; }
});
function fill(data){ form.elements.title.value=data.title||"キャスト募集"; form.elements.lead.value=data.lead||"甘くとろける夢の時間を、一緒につくりませんか。"; form.elements.description.value=data.description||""; form.elements.benefits.value=Array.isArray(data.benefits)?data.benefits.join("\n"):""; form.elements.applicationLineUrl.value=data.applicationLineUrl||""; form.elements.isPublished.checked=data.isPublished!==false; if(data.imageUrl){preview.src=data.imageUrl;preview.hidden=false;} }
function setMessage(text,type=""){message.textContent=text;message.dataset.type=type;}
