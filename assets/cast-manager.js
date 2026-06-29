// =====================================
// Chou Chou Cast Manager
// Version 5.2.1
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
    writeBatch
  } = firestore;

  const {
    ref,
    uploadBytes,
    getDownloadURL
  } = storageApi;

  const COLLECTION_NAME = "casts";
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const IMAGE_INPUT_IDS = [
    "castImage1",
    "castImage2",
    "castImage3",
    "castImage4",
    "castImage5"
  ];
  const DEFAULT_TAGS = [
    "かわいい",
    "綺麗",
    "清楚",
    "ギャル",
    "高身長",
    "小柄",
    "お酒好き",
    "癒し系",
    "明るい",
    "聞き上手",
    "新人",
    "人気",
    "レア出勤"
  ];

  const state = {
    editingId: null,
    currentImage: "",
    currentImages: [],
    allCasts: [],
    searchQuery: "",
    selectedFilterTags: new Set(),
    selectedCastIds: new Set(),
    sortMode: "displayOrder",
    draggedCard: null,
    dragPointerId: null,
    dragStartOrder: [],
    savedOrder: [],
    isOrderDirty: false,
    isOrderSaving: false,
    statusTimer: null
  };

  const elements = {
    grid: document.getElementById("castGrid") || document.querySelector(".cast-grid"),
    popup: document.getElementById("castForm"),
    popupTitle: document.querySelector("#castForm h2"),
    openButton: document.getElementById("openForm"),
    closeButton: document.getElementById("closeForm"),
    closeX: document.getElementById("closeX"),
    saveButton: document.getElementById("saveCast"),
    name: document.getElementById("castName"),
    age: document.getElementById("castAge"),
    height: document.getElementById("cast-height"),
    birthdayMonth: document.getElementById("cast-birthday-month"),
    birthdayDay: document.getElementById("cast-birthday-day"),
    bloodType: document.getElementById("cast-blood-type"),
    hobby: document.getElementById("cast-hobby"),
    favoriteDrink: document.getElementById("cast-drink"),
    message: document.getElementById("cast-message"),
    instagram: document.getElementById("cast-instagram"),
    x: document.getElementById("cast-x"),
    tiktok: document.getElementById("cast-tiktok"),
    tags: document.getElementById("cast-tags"),
    isNew: document.getElementById("cast-is-new"),
    isRecommended: document.getElementById("cast-is-recommended"),
    tagOptions: document.getElementById("castTagOptions")
  };

  if (!elements.grid || !elements.popup) return;

  setupDashboardControls();
  setupOrderControls();
  setupTagOptions();
  bindEvents();
  await loadCasts();

  function bindEvents() {
    elements.openButton?.addEventListener("click", () => openForm());
    elements.closeButton?.addEventListener("click", closeForm);
    elements.closeX?.addEventListener("click", closeForm);
    elements.saveButton?.addEventListener("click", handleSave);
    elements.orderSaveButton?.addEventListener("click", saveCurrentOrder);
    elements.tags?.addEventListener("input", syncTagOptionsFromInput);
    elements.searchInput?.addEventListener("input", handleSearchInput);
    elements.searchInput?.addEventListener("search", handleSearchInput);
    elements.sortSelect?.addEventListener("change", () => {
      state.sortMode = elements.sortSelect.value || "displayOrder";
      renderDashboard();
    });
    elements.selectAll?.addEventListener("change", () => {
      toggleSelectAllVisible(elements.selectAll.checked);
    });
    elements.bulkPublish?.addEventListener("click", () => bulkUpdatePublished(true));
    elements.bulkPrivate?.addEventListener("click", () => bulkUpdatePublished(false));
    elements.bulkDelete?.addEventListener("click", bulkDeleteSelected);

    IMAGE_INPUT_IDS.forEach((id, index) => {
      document.getElementById(id)?.addEventListener("change", () => {
        renderImagePreviewSlot(index);
      });
    });

    elements.popup.addEventListener("click", (event) => {
      if (event.target === elements.popup) closeForm();
    });

    elements.grid.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const button = target.closest("button[data-action]");
      if (!button) return;

      const id = button.dataset.id;
      if (!id) return;

      if (button.dataset.action === "edit") {
        const cast = getCastFromButton(button);
        openForm(id, cast);
      }

      if (button.dataset.action === "delete") {
        await handleDelete(id, button.dataset.name || "キャスト");
      }
    });

    elements.grid.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches(".cast-select-checkbox")) return;

      updateSelectedCast(target.dataset.id, target.checked);
    });

    elements.grid.addEventListener("pointerdown", handleDragStart);

    window.addEventListener("beforeunload", (event) => {
      if (!state.isOrderDirty) return;

      event.preventDefault();
      event.returnValue = "";
    });
  }

  async function loadCasts() {
    setFormBusy(true);
    elements.grid.innerHTML = "";
    removeDragHandlesOutsideCastGrid();

    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const casts = [];

      snapshot.forEach((docSnap) => {
        casts.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      sortCastsByDisplayOrder(casts);
      state.allCasts = casts;

      renderDashboard();
      removeDragHandlesOutsideCastGrid();
      state.savedOrder = state.allCasts.map((cast) => cast.id).filter(Boolean);
      setOrderDirty(false);
    } catch (error) {
      console.error("キャスト読み込み失敗", error);
      showError("キャスト情報の読み込みに失敗しました。");
    } finally {
      setFormBusy(false);
    }
  }

  function createCastCard(cast) {
    const card = document.createElement("div");
    card.className = "cast-card";
    card.dataset.id = cast.id;

    const images = getCastImages(cast);
    const image = getMainImage(cast);
    const tags = getTags(cast);
    const badgeMarkup = createAdminBadgeMarkup(cast);
    const isPublished = isCastPublished(cast);
    const castJson = encodeURIComponent(JSON.stringify(normalizeCast(cast)));
    const imageMarkup = image
      ? `<img src="${escapeAttribute(image)}" alt="">`
      : `<div class="cast-card-no-image">NO IMAGE</div>`;

    card.innerHTML = `
      <button type="button" class="drag-handle" aria-label="並び替え" title="並び替え">
        ☰
      </button>
      <label class="cast-select">
        <input type="checkbox" class="cast-select-checkbox" data-id="${cast.id}" ${state.selectedCastIds.has(cast.id) ? "checked" : ""}>
        <span>選択</span>
      </label>
      <div class="admin-cast-image-wrap">
        ${imageMarkup}
        ${badgeMarkup}
      </div>
      <div class="cast-card-body">
        <div class="cast-card-heading">
          <h3>${escapeHtml(cast.name || "")}</h3>
          <span class="cast-status-badge ${isPublished ? "is-public" : "is-private"}">
            ${isPublished ? "● 公開" : "○ 非公開"}
          </span>
        </div>
        ${cast.nickname ? `<p class="cast-nickname">${escapeHtml(cast.nickname)}</p>` : ""}
        <div class="cast-card-meta">
          <span>年齢：${escapeHtml(cast.age || "-")}</span>
          <span>身長：${escapeHtml(cast.height || "-")}</span>
          <span>写真：${images.length}枚</span>
        </div>
        <div class="cast-card-tags">
          ${tags.length ? tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") : "<span>タグなし</span>"}
        </div>
        <p class="cast-card-message">メッセージ：${escapeHtml(cast.message || "-")}</p>
      </div>
      <div class="card-buttons">
        <button type="button" class="edit-btn" data-action="edit" data-id="${cast.id}" data-cast="${castJson}">
          編集
        </button>
        <button type="button" class="delete-btn" data-action="delete" data-id="${cast.id}" data-name="${escapeAttribute(cast.name || "")}">
          削除
        </button>
      </div>
    `;

    return card;
  }

  function createFallbackCastCard(cast = {}) {
    const card = document.createElement("div");
    card.className = "cast-card";

    if (cast.id) {
      card.dataset.id = cast.id;
    }

    card.innerHTML = `
      <button type="button" class="drag-handle" aria-label="並び替え" title="並び替え">
        ☰
      </button>
      <label class="cast-select">
        <input type="checkbox" class="cast-select-checkbox" data-id="${escapeAttribute(cast.id || "")}" ${cast.id && state.selectedCastIds.has(cast.id) ? "checked" : ""}>
        <span>選択</span>
      </label>
      <div class="admin-cast-image-wrap">
        <div class="cast-card-no-image">NO IMAGE</div>
        ${createAdminBadgeMarkup(cast)}
      </div>
      <div class="cast-card-body">
        <div class="cast-card-heading">
          <h3>${escapeHtml(cast.name || "名称未設定")}</h3>
          <span class="cast-status-badge ${isCastPublished(cast) ? "is-public" : "is-private"}">
            ${isCastPublished(cast) ? "● 公開" : "○ 非公開"}
          </span>
        </div>
        <p>写真：0枚</p>
        <p>このキャスト情報の一部を表示できませんでした。</p>
      </div>
      <div class="card-buttons">
        ${cast.id ? `
          <button type="button" class="edit-btn" data-action="edit" data-id="${cast.id}" data-cast="${safeEncodeCast(cast)}">
            編集
          </button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${cast.id}" data-name="${escapeAttribute(cast.name || "")}">
            削除
          </button>
        ` : ""}
      </div>
    `;

    return card;
  }

  function safeEncodeCast(cast) {
    try {
      return encodeURIComponent(JSON.stringify(normalizeCast(cast)));
    } catch (error) {
      console.error("キャストデータフォールバック生成失敗", cast?.id, error);
      return encodeURIComponent(JSON.stringify({
        name: cast?.name || "",
        image: cast?.image || "",
        images: [],
        tags: []
      }));
    }
  }

  function openForm(id = null, cast = null) {
    clearError();
    state.editingId = id;
    state.currentImages = getCastImages(cast);
    state.currentImage = getMainImage(cast);
    elements.popupTitle.textContent = id ? "キャスト編集" : "キャスト追加";
    elements.name.value = cast?.name || "";
    setSelectValue(elements.age, normalizeAgeValue(cast?.age || ""));
    setSelectValue(elements.height, normalizeHeightValue(cast?.height || ""));
    setBirthdaySelects(cast?.birthday || "");
    setSelectValue(elements.bloodType, cast?.bloodType || "");
    elements.hobby.value = cast?.hobby || "";
    elements.favoriteDrink.value = cast?.favoriteDrink || "";
    elements.message.value = cast?.message || "";
    elements.instagram.value = cast?.instagram || "";
    elements.x.value = cast?.x || "";
    elements.tiktok.value = cast?.tiktok || "";
    if (elements.isNew) elements.isNew.checked = isBadgeEnabled(cast?.isNew);
    if (elements.isRecommended) {
      elements.isRecommended.checked = isBadgeEnabled(cast?.isRecommended);
    }
    setSelectedTags(getTags(cast));

    resetImageInputs();
    renderImagePreviews();
    removeDragHandlesOutsideCastGrid();
    elements.popup.style.display = "flex";
    elements.name.focus();
  }

  function closeForm() {
    elements.popup.style.display = "none";
    resetForm();
  }

  function resetForm() {
    clearError();
    state.editingId = null;
    state.currentImage = "";
    state.currentImages = [];
    elements.name.value = "";
    setSelectValue(elements.age, "");
    setSelectValue(elements.height, "");
    setBirthdaySelects("");
    setSelectValue(elements.bloodType, "");
    elements.hobby.value = "";
    elements.favoriteDrink.value = "";
    elements.message.value = "";
    elements.instagram.value = "";
    elements.x.value = "";
    elements.tiktok.value = "";
    elements.tags.value = "";
    if (elements.isNew) elements.isNew.checked = false;
    if (elements.isRecommended) elements.isRecommended.checked = false;
    setSelectedTags([]);

    resetImageInputs();
    renderImagePreviews();
    elements.popupTitle.textContent = "キャスト追加";
  }

  async function handleSave() {
    clearError();

    try {
      const formData = collectFormData();
      const validation = validateCast(formData);

      if (!validation.valid) {
        showError(validation.message);
        return;
      }

      setFormBusy(true);

      const images = await uploadImageSlots();
      const image = images[0] || "";

      const payload = {
        name: formData.name,
        age: formData.age,
        height: formData.height,
        birthday: formData.birthday,
        bloodType: formData.bloodType,
        hobby: formData.hobby,
        favoriteDrink: formData.favoriteDrink,
        message: formData.message,
        image,
        images,
        instagram: formData.instagram,
        x: formData.x,
        tiktok: formData.tiktok,
        tags: formData.tags,
        isNew: formData.isNew,
        isRecommended: formData.isRecommended,
        schedule: formData.schedule
      };

      if (!state.editingId) {
        payload.displayOrder = await getNextDisplayOrder();
        payload.isPublished = true;
      }

      await saveCast(payload);
      await loadCasts();
      closeForm();
    } catch (error) {
      console.error("キャスト保存失敗", error);
      showError("キャスト情報の保存に失敗しました。入力内容を確認して再度お試しください。");
    } finally {
      setFormBusy(false);
    }
  }

  async function saveCast(payload) {
    if (state.editingId) {
      await updateDoc(doc(db, COLLECTION_NAME, state.editingId), payload);
      return;
    }

    await addDoc(collection(db, COLLECTION_NAME), payload);
  }

  async function handleDelete(id, name) {
    if (!confirm(`${name}を削除しますか？`)) return;

    setFormBusy(true);

    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      await renumberCasts();
      await loadCasts();
    } catch (error) {
      console.error("キャスト削除失敗", error);
      showError("キャスト情報の削除に失敗しました。");
    } finally {
      setFormBusy(false);
    }
  }

  async function getNextDisplayOrder() {
    const casts = await fetchCasts();
    const maxOrder = casts.reduce((max, cast) => {
      const order = getNumericDisplayOrder(cast);
      return order === null ? max : Math.max(max, order);
    }, 0);

    return maxOrder + 1;
  }

  async function fetchCasts() {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const casts = [];

    snapshot.forEach((docSnap) => {
      casts.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    return casts;
  }

  async function renumberCasts(ids = null) {
    const casts = await fetchCasts();
    sortCastsByDisplayOrder(casts);

    const orderedIds = ids || casts.map((cast) => cast.id);
    await updateDisplayOrders(orderedIds, casts);
  }

  async function updateDisplayOrders(orderedIds, casts = null) {
    const sourceCasts = casts || await fetchCasts();
    const castById = new Map(sourceCasts.map((cast) => [cast.id, cast]));
    const batch = writeBatch(db);
    let hasChanges = false;

    orderedIds.forEach((id, index) => {
      const nextOrder = index + 1;
      const currentOrder = getNumericDisplayOrder(castById.get(id));

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
    if (!state.isOrderDirty || state.isOrderSaving || !isOrderEditable()) return;

    const orderedIds = getCurrentCardOrder();

    if (!hasOrderChanged(orderedIds, state.savedOrder)) {
      setOrderDirty(false);
      return;
    }

    setOrderSaving(true);
    setOrderStatus("");

    try {
      await updateDisplayOrders(orderedIds);

      applyDisplayOrderToState(orderedIds);
      state.savedOrder = [...orderedIds];
      setOrderDirty(false);
      showTemporaryOrderStatus("保存しました");
    } catch (error) {
      console.error("キャスト並び順保存失敗", error);
      restoreSavedOrder();
      setOrderStatus("保存に失敗しました", "error");
      state.isOrderDirty = false;

      if (elements.orderSaveButton) {
        elements.orderSaveButton.disabled = true;
      }
    } finally {
      setOrderSaving(false);
    }
  }

  function setupDashboardControls() {
    const dashboard = document.createElement("div");
    dashboard.className = "cast-admin-pro";
    dashboard.innerHTML = `
      <div class="cast-stats" aria-label="キャスト統計">
        <div class="cast-stat-card">
          <span class="cast-stat-label">公開中キャスト</span>
          <strong id="publicCastCount">0</strong>
        </div>
        <div class="cast-stat-card">
          <span class="cast-stat-label">非公開キャスト</span>
          <strong id="privateCastCount">0</strong>
        </div>
        <div class="cast-stat-card">
          <span class="cast-stat-label">合計キャスト</span>
          <strong id="totalCastCount">0</strong>
        </div>
      </div>

      <div class="cast-admin-toolbar">
        <label class="cast-search">
          <span>検索</span>
          <input type="search" id="castSearchInput" placeholder="名前・ニックネーム・タグで検索">
        </label>
        <label class="cast-sort">
          <span>並び順</span>
          <select id="castSortSelect">
            <option value="displayOrder">表示順</option>
            <option value="name">名前順</option>
            <option value="age">年齢順</option>
            <option value="createdAt">登録順</option>
          </select>
        </label>
      </div>

      <div class="cast-filter-chips" id="castFilterChips" aria-label="タグフィルター"></div>

      <div class="cast-bulk-toolbar">
        <label class="cast-select-all">
          <input type="checkbox" id="castSelectAll">
          <span>Select All</span>
        </label>
        <div class="cast-bulk-actions">
          <button type="button" id="bulkPublish" disabled>公開</button>
          <button type="button" id="bulkPrivate" disabled>非公開</button>
          <button type="button" id="bulkDelete" disabled>削除</button>
        </div>
        <span id="bulkStatus" class="bulk-status">0件選択中</span>
      </div>
    `;

    elements.openButton?.insertAdjacentElement("beforebegin", dashboard);
    elements.searchInput = document.getElementById("castSearchInput");
    elements.sortSelect = document.getElementById("castSortSelect");
    elements.filterChips = document.getElementById("castFilterChips");
    elements.publicCount = document.getElementById("publicCastCount");
    elements.privateCount = document.getElementById("privateCastCount");
    elements.totalCount = document.getElementById("totalCastCount");
    elements.selectAll = document.getElementById("castSelectAll");
    elements.bulkPublish = document.getElementById("bulkPublish");
    elements.bulkPrivate = document.getElementById("bulkPrivate");
    elements.bulkDelete = document.getElementById("bulkDelete");
    elements.bulkStatus = document.getElementById("bulkStatus");

    renderFilterChips();
  }

  function renderDashboard() {
    pruneSelectedIds();
    renderStats();
    renderFilterChips();
    renderCasts();
    updateBulkControls();
    updateOrderControlsForView();
  }

  function handleSearchInput() {
    state.searchQuery = elements.searchInput?.value.trim().toLowerCase() || "";
    renderDashboard();
  }

  function renderStats() {
    const publicCount = state.allCasts.filter(isCastPublished).length;
    const totalCount = state.allCasts.length;
    const privateCount = totalCount - publicCount;

    if (elements.publicCount) elements.publicCount.textContent = String(publicCount);
    if (elements.privateCount) elements.privateCount.textContent = String(privateCount);
    if (elements.totalCount) elements.totalCount.textContent = String(totalCount);
  }

  function renderFilterChips() {
    if (!elements.filterChips) return;

    const tags = getAvailableFilterTags();
    const chips = ["All", ...tags];

    elements.filterChips.innerHTML = chips.map((tag) => {
      const isAll = tag === "All";
      const selected = isAll
        ? state.selectedFilterTags.size === 0
        : state.selectedFilterTags.has(tag);

      return `
        <button type="button" class="cast-filter-chip ${selected ? "is-selected" : ""}" data-tag="${escapeAttribute(tag)}">
          ${escapeHtml(isAll ? "All" : tag)}
        </button>
      `;
    }).join("");

    elements.filterChips.querySelectorAll(".cast-filter-chip").forEach((button) => {
      button.addEventListener("click", () => {
        const tag = button.dataset.tag || "";

        if (tag === "All") {
          state.selectedFilterTags.clear();
        } else if (state.selectedFilterTags.has(tag)) {
          state.selectedFilterTags.delete(tag);
        } else {
          state.selectedFilterTags.add(tag);
        }

        renderDashboard();
      });
    });
  }

  function renderCasts() {
    const casts = getVisibleCasts();
    elements.grid.innerHTML = "";

    if (!state.allCasts.length) {
      elements.grid.innerHTML = `
        <div class="cast-empty-state">
          <span aria-hidden="true">♡</span>
          <strong>登録されているキャストはありません。</strong>
        </div>
      `;
      state.savedOrder = [];
      setOrderDirty(false);
      return;
    }

    if (!casts.length) {
      elements.grid.innerHTML = `
        <div class="cast-empty-state">
          <span aria-hidden="true">⌕</span>
          <strong>No matching cast</strong>
          <p>検索条件に合うキャストが見つかりません。</p>
        </div>
      `;
      setOrderDirty(false);
      return;
    }

    const fragment = document.createDocumentFragment();

    casts.forEach((cast) => {
      try {
        fragment.appendChild(createCastCard(cast));
      } catch (error) {
        console.error("キャストカード生成失敗", cast?.id, error);
        fragment.appendChild(createFallbackCastCard(cast));
      }
    });

    elements.grid.appendChild(fragment);
    removeDragHandlesOutsideCastGrid();
  }

  function getVisibleCasts() {
    const filtered = state.allCasts.filter((cast) => {
      return matchesSearch(cast) && matchesTagFilters(cast);
    });

    return sortCastsForView(filtered);
  }

  function matchesSearch(cast) {
    if (!state.searchQuery) return true;

    const haystack = [
      cast.name,
      cast.nickname,
      ...getTags(cast)
    ].join(" ").toLowerCase();

    return haystack.includes(state.searchQuery);
  }

  function matchesTagFilters(cast) {
    if (!state.selectedFilterTags.size) return true;

    const tags = getTags(cast);
    return [...state.selectedFilterTags].every((tag) => tags.includes(tag));
  }

  function sortCastsForView(casts) {
    const sorted = [...casts];

    if (state.sortMode === "name") {
      sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));
      return sorted;
    }

    if (state.sortMode === "age") {
      sorted.sort((a, b) => compareOptionalNumber(a.age, b.age));
      return sorted;
    }

    if (state.sortMode === "createdAt") {
      sorted.sort((a, b) => compareCreatedAt(a, b));
      return sorted;
    }

    sortCastsByDisplayOrder(sorted);
    return sorted;
  }

  function getAvailableFilterTags() {
    const tags = new Set(DEFAULT_TAGS);

    state.allCasts.forEach((cast) => {
      getTags(cast).forEach((tag) => tags.add(tag));
    });

    return [...tags].filter(Boolean).sort((a, b) => {
      const aDefault = DEFAULT_TAGS.indexOf(a);
      const bDefault = DEFAULT_TAGS.indexOf(b);

      if (aDefault !== -1 || bDefault !== -1) {
        if (aDefault === -1) return 1;
        if (bDefault === -1) return -1;
        return aDefault - bDefault;
      }

      return a.localeCompare(b, "ja");
    });
  }

  function toggleSelectAllVisible(checked) {
    getVisibleCasts().forEach((cast) => {
      updateSelectedCast(cast.id, checked, false);
    });

    renderCasts();
    updateBulkControls();
  }

  function updateSelectedCast(id, checked, updateControls = true) {
    if (!id) return;

    if (checked) {
      state.selectedCastIds.add(id);
    } else {
      state.selectedCastIds.delete(id);
    }

    if (updateControls) updateBulkControls();
  }

  function updateBulkControls() {
    const selectedCount = state.selectedCastIds.size;
    const visibleIds = getVisibleCasts().map((cast) => cast.id).filter(Boolean);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => state.selectedCastIds.has(id));

    if (elements.selectAll) {
      elements.selectAll.checked = allVisibleSelected;
      elements.selectAll.indeterminate =
        !allVisibleSelected && visibleIds.some((id) => state.selectedCastIds.has(id));
    }

    [elements.bulkPublish, elements.bulkPrivate, elements.bulkDelete].forEach((button) => {
      if (button) button.disabled = selectedCount === 0;
    });

    if (elements.bulkStatus) {
      elements.bulkStatus.textContent = `${selectedCount}件選択中`;
    }
  }

  async function bulkUpdatePublished(isPublished) {
    const ids = [...state.selectedCastIds];
    if (!ids.length) return;

    setBulkBusy(true);

    try {
      const batch = writeBatch(db);
      ids.forEach((id) => {
        batch.update(doc(db, COLLECTION_NAME, id), { isPublished });
      });
      await batch.commit();

      state.allCasts = state.allCasts.map((cast) => {
        return ids.includes(cast.id) ? { ...cast, isPublished } : cast;
      });
      state.selectedCastIds.clear();
      renderDashboard();
    } catch (error) {
      console.error("一括公開設定失敗", error);
      showError("一括更新に失敗しました。");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDeleteSelected() {
    const ids = [...state.selectedCastIds];
    if (!ids.length) return;
    if (!confirm(`${ids.length}件のキャストを削除しますか？`)) return;

    setBulkBusy(true);

    try {
      const batch = writeBatch(db);
      ids.forEach((id) => {
        batch.delete(doc(db, COLLECTION_NAME, id));
      });
      await batch.commit();

      state.selectedCastIds.clear();
      await renumberCasts();
      await loadCasts();
    } catch (error) {
      console.error("一括削除失敗", error);
      showError("一括削除に失敗しました。");
    } finally {
      setBulkBusy(false);
    }
  }

  function setBulkBusy(isBusy) {
    [elements.bulkPublish, elements.bulkPrivate, elements.bulkDelete].forEach((button) => {
      if (button) button.disabled = isBusy || state.selectedCastIds.size === 0;
    });
  }

  function pruneSelectedIds() {
    const validIds = new Set(state.allCasts.map((cast) => cast.id));

    [...state.selectedCastIds].forEach((id) => {
      if (!validIds.has(id)) state.selectedCastIds.delete(id);
    });
  }

  function isOrderEditable() {
    return (
      state.sortMode === "displayOrder" &&
      !state.searchQuery &&
      state.selectedFilterTags.size === 0
    );
  }

  function updateOrderControlsForView() {
    const editable = isOrderEditable();

    if (elements.orderSaveButton) {
      elements.orderSaveButton.disabled = !editable || !state.isOrderDirty || state.isOrderSaving;
      elements.orderSaveButton.title = editable
        ? ""
        : "検索・フィルター・並び替え中は表示順を保存できません。";
    }

    if (!editable && state.isOrderDirty) {
      setOrderDirty(false);
    }
  }

  function setupOrderControls() {
    const controls = document.createElement("div");
    controls.className = "order-controls";
    controls.innerHTML = `
      <button type="button" id="saveOrder" class="order-save-btn" disabled>
        並び順を保存
      </button>
      <span id="orderStatus" class="order-status"></span>
    `;

    elements.openButton?.insertAdjacentElement("afterend", controls);
    elements.orderSaveButton = document.getElementById("saveOrder");
    elements.orderStatus = document.getElementById("orderStatus");
  }

  function setOrderDirty(isDirty) {
    state.isOrderDirty = isDirty;

    if (elements.orderSaveButton) {
      elements.orderSaveButton.disabled = !isDirty || state.isOrderSaving;
    }

    if (isDirty) {
      setOrderStatus("並び順が変更されています");
    } else if (elements.orderStatus?.textContent === "並び順が変更されています") {
      setOrderStatus("");
    }
  }

  function setOrderSaving(isSaving) {
    state.isOrderSaving = isSaving;

    if (elements.orderSaveButton) {
      elements.orderSaveButton.disabled = isSaving || !state.isOrderDirty;
      elements.orderSaveButton.textContent = isSaving ? "保存中..." : "並び順を保存";
    }
  }

  function setOrderStatus(message, type = "") {
    if (!elements.orderStatus) return;

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

  function restoreSavedOrder() {
    const cardsById = new Map(
      [...elements.grid.querySelectorAll(".cast-card")].map((card) => [card.dataset.id, card])
    );

    state.savedOrder.forEach((id) => {
      const card = cardsById.get(id);
      if (card) elements.grid.appendChild(card);
    });
  }

  function hasOrderChanged(nextOrder, currentOrder) {
    if (nextOrder.length !== currentOrder.length) return true;

    return nextOrder.some((id, index) => {
      return id !== currentOrder[index];
    });
  }

  function applyDisplayOrderToState(orderedIds) {
    const orderById = new Map(
      orderedIds.map((id, index) => [id, index + 1])
    );

    state.allCasts = state.allCasts.map((cast) => {
      if (!orderById.has(cast.id)) return cast;

      return {
        ...cast,
        displayOrder: orderById.get(cast.id)
      };
    });
  }

  function handleDragStart(event) {
    if (!isOrderEditable()) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const handle = target.closest(".drag-handle");
    if (!handle || !elements.grid.contains(handle)) return;

    const card = target.closest(".cast-card");
    if (!card || !elements.grid.contains(card)) return;

    event.preventDefault();

    state.draggedCard = card;
    state.dragPointerId = event.pointerId;
    state.dragStartOrder = getCurrentCardOrder();
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

  async function handleDragEnd(event) {
    if (!state.draggedCard || state.dragPointerId !== event.pointerId) return;

    const draggedCard = state.draggedCard;

    draggedCard.classList.remove("is-dragging");
    elements.grid.classList.remove("is-sorting");

    state.draggedCard = null;
    state.dragPointerId = null;

    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", handleDragEnd);
    window.removeEventListener("pointercancel", handleDragEnd);

    const currentOrder = getCurrentCardOrder();
    state.dragStartOrder = [];
    setOrderDirty(hasOrderChanged(currentOrder, state.savedOrder));
  }

  function getCardAtPoint(x, y) {
    const draggedCard = state.draggedCard;

    if (!draggedCard) return null;

    draggedCard.style.visibility = "hidden";
    const element = document.elementFromPoint(x, y);
    draggedCard.style.visibility = "";

    const card = element?.closest?.(".cast-card") || null;

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
    return [...elements.grid.querySelectorAll(".cast-card")]
      .map((card) => card.dataset.id)
      .filter(Boolean);
  }

  function removeDragHandlesOutsideCastGrid() {
    document.querySelectorAll(".drag-handle").forEach((handle) => {
      if (!elements.grid.contains(handle)) {
        handle.remove();
      }
    });
  }

  function collectFormData() {
    return {
      name: elements.name.value.trim(),
      age: elements.age.value.trim(),
      height: elements.height.value.trim(),
      birthday: collectBirthday(),
      birthdayMonth: elements.birthdayMonth?.value || "",
      birthdayDay: elements.birthdayDay?.value || "",
      bloodType: elements.bloodType.value.trim(),
      hobby: elements.hobby.value.trim(),
      favoriteDrink: elements.favoriteDrink.value.trim(),
      message: elements.message.value.trim(),
      instagram: elements.instagram.value.trim(),
      x: elements.x.value.trim(),
      tiktok: elements.tiktok.value.trim(),
      tags: collectTags(),
      isNew: Boolean(elements.isNew?.checked),
      isRecommended: Boolean(elements.isRecommended?.checked),
      schedule: ""
    };
  }

  function collectBirthday() {
    const month = elements.birthdayMonth?.value || "";
    const day = elements.birthdayDay?.value || "";

    if (!month && !day) return "";
    if (!month || !day) return "";

    return `${month}月${day}日`;
  }

  function setBirthdaySelects(value = "") {
    const match = String(value).match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    const month = match ? match[1] : "";
    const day = match ? match[2] : "";

    if (elements.birthdayMonth) {
      elements.birthdayMonth.value = month;
    }

    if (elements.birthdayDay) {
      elements.birthdayDay.value = day;
    }
  }

  function setSelectValue(select, value) {
    if (!select) return;

    const normalizedValue = String(value || "");
    const hasOption = Array.from(select.options).some((option) => {
      return option.value === normalizedValue;
    });

    select.value = hasOption ? normalizedValue : "";
  }

  function normalizeHeightValue(value) {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) return "";
    if (/^\d{3}$/.test(normalizedValue)) return `${normalizedValue}cm`;

    return normalizedValue;
  }

  function normalizeAgeValue(value) {
    return String(value || "").replace("歳", "").trim();
  }

  function validateCast(data) {
    if (!data.name) {
      return { valid: false, message: "名前を入力してください。" };
    }

    if (data.name.length > 50) {
      return { valid: false, message: "名前は50文字以内で入力してください。" };
    }

    const age = Number(data.age);

    if (data.age && (!Number.isInteger(age) || age < 18 || age > 40)) {
      return { valid: false, message: "年齢は18〜40歳から選択してください。" };
    }

    const height = Number(String(data.height).replace("cm", ""));

    if (data.height && (!Number.isInteger(height) || height < 140 || height > 180)) {
      return { valid: false, message: "身長は140cm〜180cmから選択してください。" };
    }

    if ((data.birthdayMonth && !data.birthdayDay) || (!data.birthdayMonth && data.birthdayDay)) {
      return { valid: false, message: "誕生日は月と日を両方選択してください。" };
    }

    if (data.birthday.length > 40) {
      return { valid: false, message: "誕生日は40文字以内で入力してください。" };
    }

    if (data.bloodType.length > 20) {
      return { valid: false, message: "血液型は20文字以内で入力してください。" };
    }

    if (data.hobby.length > 80) {
      return { valid: false, message: "趣味は80文字以内で入力してください。" };
    }

    if (data.favoriteDrink.length > 80) {
      return { valid: false, message: "好きなお酒は80文字以内で入力してください。" };
    }

    if (data.message.length > 500) {
      return { valid: false, message: "メッセージは500文字以内で入力してください。" };
    }

    if (
      data.instagram.length > 300 ||
      data.x.length > 300 ||
      data.tiktok.length > 300
    ) {
      return { valid: false, message: "SNS URLは300文字以内で入力してください。" };
    }

    if (data.tags.length > 20) {
      return { valid: false, message: "タグは20個以内で入力してください。" };
    }

    const invalidFile = getSelectedFiles().find((file) => {
      return !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE;
    });

    if (invalidFile) {
      return {
        valid: false,
        message: "写真は5MB以下の画像ファイルを選択してください。"
      };
    }

    return { valid: true, message: "" };
  }

  async function uploadImageSlots() {
    const currentImages = [...state.currentImages].slice(0, 5);
    const files = getImageInputFiles();
    const uploads = files.map(async (file, index) => {
      if (!file) return currentImages[index] || "";

      const storageRef = ref(storage, createStoragePath(file, index));
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    });

    return (await Promise.all(uploads)).filter(Boolean).slice(0, 5);
  }

  function createStoragePath(file, index) {
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const suffix = `${Date.now()}_${index}_${safeName}`;

    return `casts/${suffix}`;
  }

  function getSelectedFiles() {
    return getImageInputFiles().filter(Boolean);
  }

  function getImageInputFiles() {
    return IMAGE_INPUT_IDS
      .map((id) => document.getElementById(id)?.files?.[0] || null);
  }

  function resetImageInputs() {
    IMAGE_INPUT_IDS.forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });
  }

  function renderImagePreviews() {
    IMAGE_INPUT_IDS.forEach((id, index) => {
      renderImagePreviewSlot(index);
    });
  }

  function renderImagePreviewSlot(index) {
    const inputId = IMAGE_INPUT_IDS[index];
    const preview = document.querySelector(`[data-preview-for="${inputId}"]`);

    if (!preview) return;

    const file = document.getElementById(inputId)?.files?.[0] || null;
    const currentImage = state.currentImages[index] || "";

    if (file) {
      const previewUrl = URL.createObjectURL(file);
      preview.innerHTML = `
        <img src="${escapeAttribute(previewUrl)}" alt="">
        <span>選択中：${escapeHtml(file.name)}</span>
      `;
      return;
    }

    if (currentImage) {
      preview.innerHTML = `
        <img src="${escapeAttribute(currentImage)}" alt="">
        <span>現在の写真${index + 1}</span>
      `;
      return;
    }

    preview.innerHTML = "<span>未設定</span>";
  }

  function getCastFromButton(button) {
    try {
      return JSON.parse(decodeURIComponent(button.dataset.cast || ""));
    } catch (error) {
      console.error("キャストデータ解析失敗", error);
      return null;
    }
  }

  function normalizeCast(cast) {
    return {
      name: cast.name || "",
      age: cast.age || "",
      height: cast.height || "",
      birthday: cast.birthday || "",
      bloodType: cast.bloodType || "",
      hobby: cast.hobby || "",
      favoriteDrink: cast.favoriteDrink || "",
      message: cast.message || "",
      image: getMainImage(cast),
      images: getCastImages(cast),
      instagram: cast.instagram || "",
      x: cast.x || "",
      tiktok: cast.tiktok || "",
      tags: getTags(cast),
      schedule: cast.schedule || "",
      displayOrder: getNumericDisplayOrder(cast),
      isPublished: isCastPublished(cast),
      isNew: isBadgeEnabled(cast.isNew),
      isRecommended: isBadgeEnabled(cast.isRecommended),
      badgeText: cast.badgeText || "",
      nickname: cast.nickname || ""
    };
  }

  function getCastImages(cast) {
    const images = Array.isArray(cast?.images)
      ? cast.images.filter(Boolean)
      : [];

    if (!images.length && cast?.image) {
      return [cast.image];
    }

    return images.slice(0, 5);
  }

  function getMainImage(cast) {
    return cast?.image || getCastImages(cast)[0] || "";
  }

  function parseTags(value) {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  function setupTagOptions() {
    if (!elements.tagOptions) return;

    elements.tagOptions.innerHTML = "";

    DEFAULT_TAGS.forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-option";
      button.dataset.tag = tag;
      button.textContent = tag;
      button.addEventListener("click", () => {
        button.classList.toggle("is-selected");
        syncTagsInputFromOptions();
      });
      elements.tagOptions.appendChild(button);
    });
  }

  function setSelectedTags(tags) {
    const normalizedTags = normalizeTags(tags);

    if (elements.tags) {
      elements.tags.value = normalizedTags.join(", ");
    }

    syncTagOptionsFromInput();
  }

  function syncTagsInputFromOptions() {
    const selectedDefaultTags = getSelectedDefaultTags();
    const customTags = parseTags(elements.tags?.value || "")
      .filter((tag) => !DEFAULT_TAGS.includes(tag));

    if (elements.tags) {
      elements.tags.value = normalizeTags([...selectedDefaultTags, ...customTags]).join(", ");
    }
  }

  function syncTagOptionsFromInput() {
    const inputTags = parseTags(elements.tags?.value || "");

    elements.tagOptions?.querySelectorAll(".tag-option").forEach((button) => {
      button.classList.toggle("is-selected", inputTags.includes(button.dataset.tag));
    });
  }

  function collectTags() {
    return normalizeTags([
      ...parseTags(elements.tags?.value || ""),
      ...getSelectedDefaultTags()
    ]).slice(0, 20);
  }

  function getSelectedDefaultTags() {
    return [...elements.tagOptions?.querySelectorAll(".tag-option.is-selected") || []]
      .map((button) => button.dataset.tag)
      .filter(Boolean);
  }

  function normalizeTags(tags) {
    return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20);
  }

  function getTags(cast) {
    if (Array.isArray(cast?.tags)) {
      return cast.tags.filter(Boolean);
    }

    if (typeof cast?.tags === "string") {
      return parseTags(cast.tags);
    }

    return [];
  }

  function sortCastsByDisplayOrder(casts) {
    casts.sort((a, b) => {
      const aOrder = getNumericDisplayOrder(a);
      const bOrder = getNumericDisplayOrder(b);

      if (aOrder !== null && bOrder !== null) {
        return aOrder - bOrder;
      }

      if (aOrder !== null) return -1;
      if (bOrder !== null) return 1;

      return String(a.name || "").localeCompare(String(b.name || ""), "ja");
    });
  }

  function getNumericDisplayOrder(cast) {
    if (
      cast?.displayOrder === undefined ||
      cast?.displayOrder === null ||
      cast?.displayOrder === ""
    ) {
      return null;
    }

    const order = Number(cast?.displayOrder);
    return Number.isFinite(order) ? order : null;
  }

  function isCastPublished(cast) {
    return cast?.isPublished !== false;
  }

  function createAdminBadgeMarkup(cast) {
    const badges = [];

    if (isBadgeEnabled(cast?.isNew)) {
      badges.push(createNewBadgeImage());
    }

    if (isBadgeEnabled(cast?.isRecommended)) {
      badges.push(createRecommendedBadgeImage());
    }

    if (!badges.length) return "";

    return `<div class="admin-cast-badges">${badges.join("")}</div>`;
  }

  function createNewBadgeImage() {
    return `
      <span class="premium-cast-badge premium-cast-badge-new" aria-label="NEW 新人">
        <img class="premium-cast-badge-img premium-cast-badge-img-new" src="../assets/img/badges/badge-new.png" alt="NEW 新人" loading="lazy" decoding="async" onerror="this.parentElement.remove()">
      </span>
    `;
  }

  function createRecommendedBadgeImage() {
    return `
      <span class="premium-cast-badge premium-cast-badge-recommended" aria-label="おすすめ">
        <img class="premium-cast-badge-img premium-cast-badge-img-recommended" src="../assets/img/badges/badge-osusume.png" alt="おすすめ" loading="lazy" decoding="async" onerror="this.parentElement.remove()">
      </span>
    `;
  }

  function isBadgeEnabled(value) {
    return value === true ||
      value === 1 ||
      ["true", "1", "on"].includes(String(value).toLowerCase());
  }

  function compareOptionalNumber(a, b) {
    const aNumber = Number(a);
    const bNumber = Number(b);
    const aValid = Number.isFinite(aNumber);
    const bValid = Number.isFinite(bNumber);

    if (aValid && bValid) return aNumber - bNumber;
    if (aValid) return -1;
    if (bValid) return 1;

    return 0;
  }

  function compareCreatedAt(a, b) {
    const aTime = getTimestampValue(a?.createdAt);
    const bTime = getTimestampValue(b?.createdAt);

    if (aTime !== null && bTime !== null) return bTime - aTime;
    if (aTime !== null) return -1;
    if (bTime !== null) return 1;

    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
  }

  function getTimestampValue(value) {
    if (!value) return null;

    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }

    if (value.seconds !== undefined) {
      return Number(value.seconds) * 1000;
    }

    const date = new Date(value);
    const time = date.getTime();

    return Number.isFinite(time) ? time : null;
  }

  function setFormBusy(isBusy) {
    if (elements.saveButton) {
      elements.saveButton.disabled = isBusy;
      elements.saveButton.textContent = isBusy ? "保存中..." : "保存";
    }
  }

  function showError(message) {
    const errorElement = getErrorElement();
    errorElement.textContent = message;
  }

  function clearError() {
    const errorElement = getErrorElement();
    errorElement.textContent = "";
  }

  function getErrorElement() {
    let errorElement = document.getElementById("castFormError");

    if (!errorElement) {
      errorElement = document.createElement("p");
      errorElement.id = "castFormError";
      errorElement.style.color = "#c0392b";
      errorElement.style.margin = "0 0 12px";
      elements.popupTitle.insertAdjacentElement("afterend", errorElement);
    }

    return errorElement;
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
