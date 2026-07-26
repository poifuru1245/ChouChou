import { optimizeImage } from "./admin.js";
import { createEvent, deleteEvent, subscribeEvents, updateEvent, uploadEventImage } from "./services/eventService.js";

const form = document.getElementById("eventAdminForm");
const list = document.getElementById("eventList");
const message = document.getElementById("eventMessage");
const preview = document.getElementById("eventImagePreview");
let items = [];
let editingId = "";
let currentImageUrl = "";
let currentStoragePath = "";

subscribeEvents((rows) => {
  items = rows.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
  render();
}, (error) => { console.error(error); setMessage("イベントの読み込みに失敗しました。", "error"); });

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  setMessage("保存中...");
  try {
    const data = new FormData(form);
    const publishStart = String(data.get("publishStart") || "");
    const publishEnd = String(data.get("publishEnd") || "");
    if (publishStart && publishEnd && publishEnd < publishStart) throw new Error("掲載終了は掲載開始より後に設定してください。");
    let imageUrl = currentImageUrl;
    let storagePath = currentStoragePath;
    const file = form.elements.image.files?.[0];
    if (file) {
      const optimized = await optimizeImage(file, { maxWidth: 1800, maxHeight: 1200, quality: 0.86 });
      storagePath = `events/${Date.now()}_${optimized.name}`;
      const uploaded = await uploadEventImage(optimized);
      storagePath = uploaded.path;
      imageUrl = uploaded.url;
    }
    if (!imageUrl) throw new Error("イベント画像を選択してください。");
    const payload = { title: String(data.get("title") || "").trim(), description: String(data.get("description") || "").trim(), linkUrl: String(data.get("linkUrl") || "").trim(), publishStart, publishEnd, imageUrl, storagePath, isPublished: data.get("isPublished") === "on" };
    if (editingId) await updateEvent(editingId, payload);
    else await createEvent(payload);
    reset();
    setMessage("イベントを保存しました。", "success");
  } catch (error) { console.error(error); setMessage(error.message || "保存に失敗しました。", "error"); }
  finally { button.disabled = false; }
});

document.getElementById("resetEvent")?.addEventListener("click", reset);
list?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = items.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit") fill(item);
  if (button.dataset.action === "toggle") await updateEvent(item.id, { isPublished: item.isPublished === false });
  if (button.dataset.action === "delete" && confirm(`${item.title || "イベント"}を削除しますか？`)) await deleteEvent(item.id);
});

function render() {
  list.innerHTML = items.map((item) => `<article class="admin-item-card admin-premium-card"><img class="admin-card-thumb" src="${escapeHtml(item.imageUrl || "")}" alt=""><span class="admin-category-badge">${item.isPublished === false ? "非公開" : "公開中"}</span><h3>${escapeHtml(item.title || "")}</h3><p>${escapeHtml(item.description || "説明なし")}</p><small>${escapeHtml(formatPeriod(item))}</small><div class="admin-item-actions"><button data-action="edit" data-id="${item.id}">編集</button><button data-action="toggle" data-id="${item.id}">${item.isPublished === false ? "公開" : "非公開"}</button><button data-action="delete" data-id="${item.id}">削除</button></div></article>`).join("") || "<p>イベントはまだ登録されていません。</p>";
}
function fill(item) { editingId = item.id; currentImageUrl = item.imageUrl || ""; currentStoragePath = item.storagePath || ""; form.elements.title.value = item.title || ""; form.elements.description.value = item.description || ""; form.elements.linkUrl.value = item.linkUrl || ""; form.elements.publishStart.value = normalizeLocal(item.publishStart); form.elements.publishEnd.value = normalizeLocal(item.publishEnd); form.elements.isPublished.checked = item.isPublished !== false; if (currentImageUrl) { preview.src = currentImageUrl; preview.hidden = false; } form.scrollIntoView({ behavior: "smooth" }); }
function reset() { editingId = ""; currentImageUrl = ""; currentStoragePath = ""; form.reset(); form.elements.isPublished.checked = true; preview.hidden = true; preview.removeAttribute("src"); }
function normalizeLocal(value) { return String(value || "").slice(0, 16); }
function formatPeriod(item) { return `${item.publishStart || "開始指定なし"} 〜 ${item.publishEnd || "終了指定なし"}`; }
function getTime(value) { if (!value) return 0; if (typeof value.toMillis === "function") return value.toMillis(); return Date.parse(value) || 0; }
function setMessage(text, type = "") { message.textContent = text; message.dataset.type = type; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
