// =====================================
// Chou Chou Gallery Manager
// Version 5.3.0
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

  const COLLECTION_NAME = "gallery";
  const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

  const state = {
    items: [],
    draggedCard: null,
    dragPointerId: null,
    savedOrder: [],
    isOrderDirty: false,
    isOrderSaving: false,
    isUploading: false,
    statusTimer: null
  };

  const elements = {
    grid: document.getElementById("galleryGrid"),
    title: document.getElementById("galleryTitle"),
    files: document.getElementById("galleryImages"),
    uploadButton: document.getElementById("uploadGallery"),
    message: document.getElementById("galleryMessage"),
    saveOrderButton: document.getElementById("saveGalleryOrder"),
    orderStatus: document.getElementById("galleryOrderStatus")
  };

  if (!elements.grid) return;

  bindEvents();
  await loadGallery();

  function bindEvents() {
    elements.uploadButton?.addEventListener("click", handleUpload);
    elements.saveOrderButton?.addEventListener("click", saveCurrentOrder);
    elements.grid.addEventListener("click", handleGridClick);
    elements.grid.addEventListener("change", handleGridChange);
    elements.grid.addEventListener("pointerdown", handleDragStart);

    window.addEventListener("beforeunload", (event) => {
      if (!state.isOrderDirty) return;

      event.preventDefault();
      event.returnValue = "";
    });
  }

  async function loadGallery() {
    setMessage("");
    elements.grid.innerHTML = "<p>読み込み中...</p>";

    try {
      state.items = await fetchGalleryItems();
      renderGallery();
      state.savedOrder = getCurrentCardOrder();
      setOrderDirty(false);
    } catch (error) {
      console.error("ギャラリー読み込み失敗", error);
      elements.grid.innerHTML = "<p>ギャラリーの読み込みに失敗しました。</p>";
    }
  }

  async function fetchGalleryItems() {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const items = [];

    snapshot.forEach((docSnap) => {
      items.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    sortGalleryItems(items);
    return items;
  }

  function renderGallery() {
    elements.grid.innerHTML = "";

    if (!state.items.length) {
      elements.grid.innerHTML = "<p>登録されている画像はありません。</p>";
      return;
    }

    const fragment = document.createDocumentFragment();

    state.items.forEach((item) => {
      try {
        fragment.appendChild(createGalleryCard(item));
      } catch (error) {
        console.error("ギャラリーカード生成失敗", item?.id, error);
      }
    });

    elements.grid.appendChild(fragment);
  }

  function createGalleryCard(item) {
    const card = document.createElement("div");
    card.className = "gallery-admin-card";
    card.dataset.id = item.id;
    card.dataset.storagePath = item.storagePath || "";

    card.innerHTML = `
      <button type="button" class="drag-handle gallery-drag-handle" aria-label="並び替え" title="並び替え">
        ☰
      </button>
      <img src="${escapeAttribute(item.imageUrl || "")}" alt="${escapeAttribute(item.title || "")}">
      <div class="gallery-admin-card-body">
        <input
          type="text"
          class="gallery-title-input"
          value="${escapeAttribute(item.title || "")}"
          placeholder="タイトル（任意）"
          data-id="${item.id}"
        >
        <div class="gallery-card-buttons">
          <button type="button" class="edit-btn" data-action="save-title" data-id="${item.id}">
            タイトル保存
          </button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${item.id}">
            削除
          </button>
        </div>
      </div>
    `;

    return card;
  }

  async function handleUpload() {
    if (state.isUploading) return;

    const files = [...elements.files?.files || []];
    const title = elements.title?.value.trim() || "";
    const validation = validateFiles(files);

    if (!validation.valid) {
      setMessage(validation.message, "error");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      let nextOrder = await getNextDisplayOrder();

      for (const file of files) {
        const storagePath = createStoragePath(file);
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, COLLECTION_NAME), {
          title,
          imageUrl,
          storagePath,
          displayOrder: nextOrder,
          createdAt: serverTimestamp()
        });

        nextOrder += 1;
      }

      if (elements.files) elements.files.value = "";
      if (elements.title) elements.title.value = "";

      setMessage("アップロードしました", "success");
      await loadGallery();
    } catch (error) {
      console.error("ギャラリーアップロード失敗", error);
      setMessage("アップロードに失敗しました。", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleGridClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    if (!id) return;

    if (button.dataset.action === "save-title") {
      await saveTitle(id);
    }

    if (button.dataset.action === "delete") {
      await deleteGalleryItem(id);
    }
  }

  function handleGridChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.classList.contains("gallery-title-input")) {
      target.dataset.dirty = "true";
    }
  }

  async function saveTitle(id) {
    const input = elements.grid.querySelector(`.gallery-title-input[data-id="${cssEscape(id)}"]`);
    const nextTitle = input?.value.trim() || "";
    const item = state.items.find((entry) => entry.id === id);

    if (!item || (item.title || "") === nextTitle) {
      setMessage("変更はありません。");
      return;
    }

    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        title: nextTitle
      });

      item.title = nextTitle;
      if (input) input.dataset.dirty = "false";
      setMessage("タイトルを保存しました", "success");
    } catch (error) {
      console.error("ギャラリータイトル保存失敗", error);
      setMessage("タイトルの保存に失敗しました。", "error");
    }
  }

  async function deleteGalleryItem(id) {
    const item = state.items.find((entry) => entry.id === id);
    const title = item?.title || "この画像";

    if (!confirm(`${title}を削除しますか？`)) return;

    try {
      if (item?.storagePath) {
        try {
          await deleteObject(ref(storage, item.storagePath));
        } catch (storageError) {
          console.warn("Storage画像削除をスキップしました", storageError);
        }
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
      await renumberGallery();
      setMessage("削除しました", "success");
      await loadGallery();
    } catch (error) {
      console.error("ギャラリー削除失敗", error);
      setMessage("削除に失敗しました。", "error");
    }
  }

  async function getNextDisplayOrder() {
    const items = await fetchGalleryItems();
    const maxOrder = items.reduce((max, item) => {
      const order = getNumericDisplayOrder(item);
      return order === null ? max : Math.max(max, order);
    }, 0);

    return maxOrder + 1;
  }

  async function renumberGallery(ids = null) {
    const items = await fetchGalleryItems();
    const orderedIds = ids || items.map((item) => item.id);

    await updateDisplayOrders(orderedIds, items);
  }

  async function updateDisplayOrders(orderedIds, items = null) {
    const sourceItems = items || await fetchGalleryItems();
    const itemById = new Map(sourceItems.map((item) => [item.id, item]));
    const batch = writeBatch(db);
    let hasChanges = false;

    orderedIds.forEach((id, index) => {
      const nextOrder = index + 1;
      const currentOrder = getNumericDisplayOrder(itemById.get(id));

      if (currentOrder === nextOrder) return;

      hasChanges = true;
      batch.update(doc(db, COLLECTION_NAME, id), {
        displayOrder: nextOrder
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
      console.error("ギャラリー並び順保存失敗", error);
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

    const handle = target.closest(".gallery-drag-handle");
    if (!handle || !elements.grid.contains(handle)) return;

    const card = target.closest(".gallery-admin-card");
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

    const card = element?.closest?.(".gallery-admin-card") || null;

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
    return [...elements.grid.querySelectorAll(".gallery-admin-card")]
      .map((card) => card.dataset.id)
      .filter(Boolean);
  }

  function restoreSavedOrder() {
    const cardsById = new Map(
      [...elements.grid.querySelectorAll(".gallery-admin-card")].map((card) => [card.dataset.id, card])
    );

    state.savedOrder.forEach((id) => {
      const card = cardsById.get(id);
      if (card) elements.grid.appendChild(card);
    });
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

  function setUploading(isUploading) {
    state.isUploading = isUploading;

    if (elements.uploadButton) {
      elements.uploadButton.disabled = isUploading;
      elements.uploadButton.textContent = isUploading ? "アップロード中..." : "画像アップロード";
    }
  }

  function setMessage(message, type = "") {
    if (!elements.message) return;

    elements.message.textContent = message;
    elements.message.dataset.type = type;
  }

  function validateFiles(files) {
    if (!files.length) {
      return { valid: false, message: "画像を選択してください。" };
    }

    const invalidFile = files.find((file) => {
      return !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE;
    });

    if (invalidFile) {
      return { valid: false, message: "画像は8MB以下の画像ファイルを選択してください。" };
    }

    return { valid: true, message: "" };
  }

  function createStoragePath(file) {
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    return `gallery/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  }

  function sortGalleryItems(items) {
    items.sort((a, b) => {
      const aOrder = getNumericDisplayOrder(a);
      const bOrder = getNumericDisplayOrder(b);

      if (aOrder !== null && bOrder !== null) {
        return aOrder - bOrder;
      }

      if (aOrder !== null) return -1;
      if (bOrder !== null) return 1;

      return getCreatedAtTime(a) - getCreatedAtTime(b);
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

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
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
