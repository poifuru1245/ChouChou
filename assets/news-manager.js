// =====================================
// Chou Chou News Manager
// Version 5.4.0
// =====================================

(async () => {
  const { db, storage } = await import("./app.js");
  const firestore = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
  );
  const storageApi = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"
  );

  const {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch,
    serverTimestamp
  } = firestore;

  const {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
  } = storageApi;

  const COLLECTION_NAME = "news";
  const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
  const DEFAULT_CATEGORY = "お知らせ";

  const state = {
    editingId: null,
    currentImageUrl: "",
    currentStoragePath: "",
    items: [],
    draggedCard: null,
    dragPointerId: null,
    savedOrder: [],
    isOrderDirty: false,
    isOrderSaving: false,
    isSaving: false,
    statusTimer: null,
    messageTimer: null
  };

  const elements = {
    grid: document.getElementById("newsGrid"),
    title: document.getElementById("newsTitle"),
    body: document.getElementById("newsBody"),
    category: document.getElementById("newsCategory"),
    linkUrl: document.getElementById("newsLinkUrl"),
    image: document.getElementById("newsImage"),
    published: document.getElementById("newsPublished"),
    pinned: document.getElementById("newsPinned"),
    saveButton: document.getElementById("saveNewsPost"),
    resetButton: document.getElementById("resetNewsForm"),
    message: document.getElementById("newsFormMessage"),
    saveOrderButton: document.getElementById("saveNewsOrder"),
    orderStatus: document.getElementById("newsOrderStatus")
  };

  if (!elements.grid) return;

  bindEvents();
  await loadNews();

  function bindEvents() {
    elements.saveButton?.addEventListener("click", handleSave);
    elements.resetButton?.addEventListener("click", resetForm);
    elements.saveOrderButton?.addEventListener("click", saveCurrentOrder);
    elements.grid.addEventListener("click", handleGridClick);
    elements.grid.addEventListener("pointerdown", handleDragStart);

    window.addEventListener("beforeunload", (event) => {
      if (!state.isOrderDirty) return;

      event.preventDefault();
      event.returnValue = "";
    });
  }

  async function loadNews() {
    elements.grid.innerHTML = "<p>読み込み中...</p>";

    try {
      state.items = await fetchNewsItems();
      renderNews();
      state.savedOrder = getCurrentCardOrder();
      setOrderDirty(false);
    } catch (error) {
      console.error("お知らせ読み込み失敗", error);
      elements.grid.innerHTML = "<p>お知らせの読み込みに失敗しました。</p>";
    }
  }

  async function fetchNewsItems() {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const items = [];

    snapshot.forEach((docSnap) => {
      items.push(normalizeNews({
        id: docSnap.id,
        ...docSnap.data()
      }));
    });

    sortNewsItems(items);
    return items;
  }

  function renderNews() {
    elements.grid.innerHTML = "";

    if (!state.items.length) {
      elements.grid.innerHTML = "<p>登録されているお知らせはありません。</p>";
      return;
    }

    const fragment = document.createDocumentFragment();

    state.items.forEach((item) => {
      fragment.appendChild(createNewsCard(item));
    });

    elements.grid.appendChild(fragment);
  }

  function createNewsCard(item) {
    const card = document.createElement("article");
    card.className = "news-admin-card";
    card.dataset.id = item.id;

    const status = item.isPublished ? "公開中" : "非公開";
    const pinned = item.isPinned ? "固定中" : "通常";
    const bodyPreview = createPreview(item.body, 90);
    const imageMarkup = item.imageUrl
      ? `<img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.title)}">`
      : `<div class="news-admin-no-image">NO IMAGE</div>`;

    card.innerHTML = `
      <button type="button" class="drag-handle news-drag-handle" aria-label="並び替え" title="並び替え">
        ☰
      </button>
      ${imageMarkup}
      <div class="news-admin-card-body">
        <div class="news-admin-meta">
          <span>${escapeHtml(item.category || DEFAULT_CATEGORY)}</span>
          <span>${escapeHtml(status)}</span>
          <span>${escapeHtml(pinned)}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(bodyPreview || "本文なし")}</p>
        ${item.linkUrl ? `<a href="${escapeAttribute(item.linkUrl)}" target="_blank" rel="noopener">リンクを確認</a>` : ""}
        <div class="news-admin-actions">
          <button type="button" class="edit-btn" data-action="edit" data-id="${item.id}">
            編集
          </button>
          <button type="button" class="edit-btn" data-action="toggle-published" data-id="${item.id}">
            ${item.isPublished ? "非公開にする" : "公開する"}
          </button>
          <button type="button" class="edit-btn" data-action="toggle-pinned" data-id="${item.id}">
            ${item.isPinned ? "固定解除" : "固定する"}
          </button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${item.id}">
            削除
          </button>
        </div>
      </div>
    `;

    return card;
  }

  async function handleSave() {
    const formData = collectFormData();
    const validation = validateNews(formData);

    if (!validation.valid) {
      showMessage(validation.message, "error");
      return;
    }

    setSaving(true);

    try {
      const imageData = await resolveImageData();
      const payload = {
        title: formData.title,
        body: formData.body,
        text: formData.body,
        imageUrl: imageData.imageUrl,
        storagePath: imageData.storagePath,
        linkUrl: formData.linkUrl,
        category: formData.category || DEFAULT_CATEGORY,
        isPublished: formData.isPublished,
        isPinned: formData.isPinned,
        updatedAt: serverTimestamp()
      };

      if (state.editingId) {
        await updateDoc(doc(db, COLLECTION_NAME, state.editingId), payload);
      } else {
        payload.displayOrder = await getNextDisplayOrder();
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, COLLECTION_NAME), payload);
      }

      resetForm();
      showMessage("保存しました", "success");
      await loadNews();
    } catch (error) {
      console.error("お知らせ保存失敗", error);
      showMessage("保存に失敗しました。", "error");
    } finally {
      setSaving(false);
    }
  }

  function collectFormData() {
    return {
      title: elements.title.value.trim(),
      body: elements.body.value.trim(),
      category: elements.category.value.trim(),
      linkUrl: elements.linkUrl.value.trim(),
      isPublished: elements.published.checked,
      isPinned: elements.pinned.checked
    };
  }

  function validateNews(data) {
    if (!data.title) {
      return { valid: false, message: "タイトルを入力してください。" };
    }

    if (data.title.length > 120) {
      return { valid: false, message: "タイトルは120文字以内で入力してください。" };
    }

    if (data.body.length > 2000) {
      return { valid: false, message: "本文は2000文字以内で入力してください。" };
    }

    if (data.category.length > 40) {
      return { valid: false, message: "カテゴリは40文字以内で入力してください。" };
    }

    if (data.linkUrl.length > 500) {
      return { valid: false, message: "リンクURLは500文字以内で入力してください。" };
    }

    const file = elements.image.files?.[0] || null;

    if (file && (!file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE)) {
      return { valid: false, message: "画像は8MB以下の画像ファイルを選択してください。" };
    }

    return { valid: true, message: "" };
  }

  async function resolveImageData() {
    const file = elements.image.files?.[0] || null;

    if (!file) {
      return {
        imageUrl: state.currentImageUrl,
        storagePath: state.currentStoragePath
      };
    }

    const storagePath = createStoragePath(file);
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const imageUrl = await getDownloadURL(storageRef);

    if (state.currentStoragePath) {
      try {
        await deleteObject(ref(storage, state.currentStoragePath));
      } catch (error) {
        console.warn("古いニュース画像削除をスキップしました", error);
      }
    }

    return { imageUrl, storagePath };
  }

  async function handleGridClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    if (!id) return;

    if (button.dataset.action === "edit") {
      openEditForm(id);
    }

    if (button.dataset.action === "toggle-published") {
      await toggleField(id, "isPublished");
    }

    if (button.dataset.action === "toggle-pinned") {
      await toggleField(id, "isPinned");
    }

    if (button.dataset.action === "delete") {
      await deleteNews(id);
    }
  }

  function openEditForm(id) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;

    state.editingId = item.id;
    state.currentImageUrl = item.imageUrl || "";
    state.currentStoragePath = item.storagePath || "";
    elements.title.value = item.title || "";
    elements.body.value = item.body || "";
    ensureCategoryOption(item.category || DEFAULT_CATEGORY);
    elements.category.value = item.category || DEFAULT_CATEGORY;
    elements.linkUrl.value = item.linkUrl || "";
    elements.published.checked = item.isPublished;
    elements.pinned.checked = item.isPinned;
    elements.image.value = "";
    elements.saveButton.textContent = "更新";
    showMessage("編集中です", "");
    elements.title.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleField(id, fieldName) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;

    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        [fieldName]: !item[fieldName],
        updatedAt: serverTimestamp()
      });
      showMessage("更新しました", "success");
      await loadNews();
    } catch (error) {
      console.error("お知らせ更新失敗", error);
      showMessage("更新に失敗しました。", "error");
    }
  }

  async function deleteNews(id) {
    const item = state.items.find((entry) => entry.id === id);
    const title = item?.title || "このお知らせ";

    if (!confirm(`${title}を削除しますか？`)) return;

    try {
      if (item?.storagePath) {
        try {
          await deleteObject(ref(storage, item.storagePath));
        } catch (error) {
          console.warn("ニュース画像削除をスキップしました", error);
        }
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
      await renumberNews();
      resetForm();
      showMessage("削除しました", "success");
      await loadNews();
    } catch (error) {
      console.error("お知らせ削除失敗", error);
      showMessage("削除に失敗しました。", "error");
    }
  }

  async function getNextDisplayOrder() {
    const items = await fetchNewsItems();
    const maxOrder = items.reduce((max, item) => {
      const order = getNumericDisplayOrder(item);
      return order === null ? max : Math.max(max, order);
    }, 0);

    return maxOrder + 1;
  }

  async function renumberNews(ids = null) {
    const items = await fetchNewsItems();
    const orderedIds = ids || items.map((item) => item.id);
    await updateDisplayOrders(orderedIds, items);
  }

  async function updateDisplayOrders(orderedIds, items = null) {
    const sourceItems = items || await fetchNewsItems();
    const itemById = new Map(sourceItems.map((item) => [item.id, item]));
    const batch = writeBatch(db);
    let hasChanges = false;

    orderedIds.forEach((id, index) => {
      const nextOrder = index + 1;
      const currentOrder = getNumericDisplayOrder(itemById.get(id));

      if (currentOrder === nextOrder) return;

      hasChanges = true;
      batch.update(doc(db, COLLECTION_NAME, id), {
        displayOrder: nextOrder,
        updatedAt: serverTimestamp()
      });
    });

    if (hasChanges) {
      await batch.commit();
    }

    return hasChanges;
  }

  async function saveCurrentOrder() {
    if (!state.isOrderDirty || state.isOrderSaving) return;

    const orderedIds = getCurrentCardOrder();

    if (!hasOrderChanged(orderedIds, state.savedOrder)) {
      setOrderDirty(false);
      return;
    }

    setOrderSaving(true);
    setOrderStatus("");

    try {
      await updateDisplayOrders(orderedIds);
      state.savedOrder = [...orderedIds];
      setOrderDirty(false);
      showTemporaryOrderStatus("保存しました");
    } catch (error) {
      console.error("お知らせ並び順保存失敗", error);
      restoreSavedOrder();
      setOrderStatus("保存に失敗しました", "error");
      state.isOrderDirty = false;
      elements.saveOrderButton.disabled = true;
    } finally {
      setOrderSaving(false);
    }
  }

  function handleDragStart(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const handle = target.closest(".news-drag-handle");
    if (!handle || !elements.grid.contains(handle)) return;

    const card = target.closest(".news-admin-card");
    if (!card || !elements.grid.contains(card)) return;

    event.preventDefault();

    state.draggedCard = card;
    state.dragPointerId = event.pointerId;
    card.classList.add("is-dragging");
    elements.grid.classList.add("is-sorting");
    handle.setPointerCapture(event.pointerId);

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("pointercancel", handleDragEnd);
  }

  function handleDragMove(event) {
    if (!state.draggedCard || state.dragPointerId !== event.pointerId) return;

    event.preventDefault();

    const targetCard = getCardAtPoint(event.clientX, event.clientY);

    if (!targetCard) {
      moveDraggedCardToGridEdge(event.clientY);
      return;
    }

    if (targetCard === state.draggedCard) return;

    const rect = targetCard.getBoundingClientRect();
    const insertAfter =
      event.clientY > rect.top + rect.height / 2 ||
      (event.clientY >= rect.top && event.clientX > rect.left + rect.width / 2);

    elements.grid.insertBefore(
      state.draggedCard,
      insertAfter ? targetCard.nextSibling : targetCard
    );
  }

  function handleDragEnd(event) {
    if (!state.draggedCard || state.dragPointerId !== event.pointerId) return;

    state.draggedCard.classList.remove("is-dragging");
    elements.grid.classList.remove("is-sorting");
    state.draggedCard = null;
    state.dragPointerId = null;

    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", handleDragEnd);
    window.removeEventListener("pointercancel", handleDragEnd);

    setOrderDirty(hasOrderChanged(getCurrentCardOrder(), state.savedOrder));
  }

  function getCardAtPoint(x, y) {
    const draggedCard = state.draggedCard;

    if (!draggedCard) return null;

    draggedCard.style.visibility = "hidden";
    const element = document.elementFromPoint(x, y);
    draggedCard.style.visibility = "";

    const card = element?.closest?.(".news-admin-card") || null;

    return card && elements.grid.contains(card) ? card : null;
  }

  function moveDraggedCardToGridEdge(pointerY) {
    const gridRect = elements.grid.getBoundingClientRect();

    if (pointerY < gridRect.top) {
      elements.grid.insertBefore(state.draggedCard, elements.grid.firstElementChild);
      return;
    }

    if (pointerY > gridRect.bottom) {
      elements.grid.appendChild(state.draggedCard);
    }
  }

  function getCurrentCardOrder() {
    return [...elements.grid.querySelectorAll(".news-admin-card")]
      .map((card) => card.dataset.id)
      .filter(Boolean);
  }

  function restoreSavedOrder() {
    const cardsById = new Map(
      [...elements.grid.querySelectorAll(".news-admin-card")].map((card) => [card.dataset.id, card])
    );

    state.savedOrder.forEach((id) => {
      const card = cardsById.get(id);
      if (card) elements.grid.appendChild(card);
    });
  }

  function resetForm() {
    state.editingId = null;
    state.currentImageUrl = "";
    state.currentStoragePath = "";
    elements.title.value = "";
    elements.body.value = "";
    elements.category.value = "";
    elements.linkUrl.value = "";
    elements.image.value = "";
    elements.published.checked = true;
    elements.pinned.checked = false;
    elements.saveButton.textContent = "保存";
    showMessage("");
  }

  function setSaving(isSaving) {
    state.isSaving = isSaving;
    elements.saveButton.disabled = isSaving;
    elements.saveButton.textContent = isSaving
      ? "保存中..."
      : state.editingId ? "更新" : "保存";
  }

  function setOrderDirty(isDirty) {
    state.isOrderDirty = isDirty;
    elements.saveOrderButton.disabled = !isDirty || state.isOrderSaving;

    if (isDirty) {
      setOrderStatus("並び順が変更されています");
    } else if (elements.orderStatus?.textContent === "並び順が変更されています") {
      setOrderStatus("");
    }
  }

  function setOrderSaving(isSaving) {
    state.isOrderSaving = isSaving;
    elements.saveOrderButton.disabled = isSaving || !state.isOrderDirty;
    elements.saveOrderButton.textContent = isSaving ? "保存中..." : "並び順を保存";
  }

  function setOrderStatus(message, type = "") {
    if (state.statusTimer) {
      clearTimeout(state.statusTimer);
      state.statusTimer = null;
    }

    elements.orderStatus.textContent = message;
    elements.orderStatus.dataset.type = type;
  }

  function showTemporaryOrderStatus(message) {
    setOrderStatus(message, "success");

    state.statusTimer = setTimeout(() => {
      setOrderStatus("");
      state.statusTimer = null;
    }, 2000);
  }

  function showMessage(message, type = "") {
    if (state.messageTimer) {
      clearTimeout(state.messageTimer);
      state.messageTimer = null;
    }

    elements.message.textContent = message;
    elements.message.dataset.type = type;

    if (message && type === "success") {
      state.messageTimer = setTimeout(() => {
        elements.message.textContent = "";
        elements.message.dataset.type = "";
        state.messageTimer = null;
      }, 2200);
    }
  }

  function normalizeNews(item) {
    return {
      ...item,
      title: item.title || "",
      body: item.body || item.text || "",
      imageUrl: item.imageUrl || "",
      storagePath: item.storagePath || "",
      linkUrl: item.linkUrl || "",
      category: item.category || DEFAULT_CATEGORY,
      isPublished: item.isPublished !== false,
      isPinned: item.isPinned === true
    };
  }

  function sortNewsItems(items) {
    items.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      const aOrder = getNumericDisplayOrder(a);
      const bOrder = getNumericDisplayOrder(b);

      if (aOrder !== null && bOrder !== null) {
        return aOrder - bOrder;
      }

      if (aOrder !== null) return -1;
      if (bOrder !== null) return 1;

      return getCreatedAtTime(b) - getCreatedAtTime(a);
    });
  }

  function getNumericDisplayOrder(item) {
    if (
      item?.displayOrder === undefined ||
      item?.displayOrder === null ||
      item?.displayOrder === ""
    ) {
      return null;
    }

    const order = Number(item.displayOrder);
    return Number.isFinite(order) ? order : null;
  }

  function getCreatedAtTime(item) {
    if (typeof item?.createdAt?.toMillis === "function") {
      return item.createdAt.toMillis();
    }

    if (typeof item?.createdAt === "number") {
      return item.createdAt;
    }

    return 0;
  }

  function hasOrderChanged(nextOrder, currentOrder) {
    if (nextOrder.length !== currentOrder.length) return true;

    return nextOrder.some((id, index) => id !== currentOrder[index]);
  }

  function createStoragePath(file) {
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    return `news/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  }

  function createPreview(value, maxLength) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();

    if (normalized.length <= maxLength) return normalized;

    return `${normalized.slice(0, maxLength)}...`;
  }

  function ensureCategoryOption(category) {
    if (!category || [...elements.category.options].some((option) => option.value === category)) {
      return;
    }

    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.category.appendChild(option);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }
})();
