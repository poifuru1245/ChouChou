// =====================================
// Chou Chou Cast Manager
// Version 5.0.0
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
    doc
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

  const state = {
    editingId: null,
    currentImage: "",
    currentImages: []
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
    hobby: document.getElementById("cast-hobby"),
    favoriteDrink: document.getElementById("cast-drink"),
    message: document.getElementById("cast-message")
  };

  if (!elements.grid || !elements.popup) return;

  bindEvents();
  await loadCasts();

  function bindEvents() {
    elements.openButton?.addEventListener("click", () => openForm());
    elements.closeButton?.addEventListener("click", closeForm);
    elements.closeX?.addEventListener("click", closeForm);
    elements.saveButton?.addEventListener("click", handleSave);

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
  }

  async function loadCasts() {
    setBusy(true);
    elements.grid.innerHTML = "";

    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const casts = [];

      snapshot.forEach((docSnap) => {
        casts.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      casts.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));

      if (!casts.length) {
        elements.grid.innerHTML = "<p>登録されているキャストはありません。</p>";
        return;
      }

      const fragment = document.createDocumentFragment();

      casts.forEach((cast) => {
        fragment.appendChild(createCastCard(cast));
      });

      elements.grid.appendChild(fragment);
    } catch (error) {
      console.error("キャスト読み込み失敗", error);
      showError("キャスト情報の読み込みに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  function createCastCard(cast) {
    const card = document.createElement("div");
    card.className = "cast-card";

    const image = cast.image || "";
    const castJson = encodeURIComponent(JSON.stringify(normalizeCast(cast)));

    card.innerHTML = `
      <img src="${escapeAttribute(image)}" alt="">
      <h3>${escapeHtml(cast.name || "")}</h3>
      <p>${escapeHtml(cast.age || "-")}歳</p>
      <p>身長：${escapeHtml(cast.height || "-")}</p>
      <p>趣味：${escapeHtml(cast.hobby || "-")}</p>
      <p>好きなお酒：${escapeHtml(cast.favoriteDrink || "-")}</p>
      <p>メッセージ：${escapeHtml(cast.message || "-")}</p>
      <p>${escapeHtml(cast.schedule || "")}</p>
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

  function openForm(id = null, cast = null) {
    clearError();
    state.editingId = id;
    state.currentImage = cast?.image || "";
    state.currentImages = Array.isArray(cast?.images) ? cast.images : [];

    elements.popupTitle.textContent = id ? "キャスト編集" : "キャスト追加";
    elements.name.value = cast?.name || "";
    elements.age.value = cast?.age || "";
    elements.height.value = cast?.height || "";
    elements.hobby.value = cast?.hobby || "";
    elements.favoriteDrink.value = cast?.favoriteDrink || "";
    elements.message.value = cast?.message || "";

    resetImageInputs();
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
    elements.age.value = "";
    elements.height.value = "";
    elements.hobby.value = "";
    elements.favoriteDrink.value = "";
    elements.message.value = "";

    resetImageInputs();
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

      setBusy(true);

      const uploadedImages = await uploadSelectedImages();
      const image = uploadedImages[0] || state.currentImage || "";
      const images = uploadedImages.length ? uploadedImages : state.currentImages;

      if (!image) {
        showError("写真を1枚以上選択してください。");
        return;
      }

      const payload = {
        name: formData.name,
        age: formData.age,
        height: formData.height,
        hobby: formData.hobby,
        favoriteDrink: formData.favoriteDrink,
        message: formData.message,
        image,
        images,
        schedule: formData.schedule
      };

      await saveCast(payload);
      await loadCasts();
      closeForm();
    } catch (error) {
      console.error("キャスト保存失敗", error);
      showError("キャスト情報の保存に失敗しました。入力内容を確認して再度お試しください。");
    } finally {
      setBusy(false);
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

    setBusy(true);

    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      await loadCasts();
    } catch (error) {
      console.error("キャスト削除失敗", error);
      showError("キャスト情報の削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  function collectFormData() {
    return {
      name: elements.name.value.trim(),
      age: elements.age.value.trim(),
      height: elements.height.value.trim(),
      hobby: elements.hobby.value.trim(),
      favoriteDrink: elements.favoriteDrink.value.trim(),
      message: elements.message.value.trim(),
      schedule: ""
    };
  }

  function validateCast(data) {
    if (!data.name) {
      return { valid: false, message: "名前を入力してください。" };
    }

    if (data.name.length > 50) {
      return { valid: false, message: "名前は50文字以内で入力してください。" };
    }

    const age = Number(data.age);

    if (!data.age || !Number.isInteger(age) || age < 18 || age > 99) {
      return { valid: false, message: "年齢は18〜99の整数で入力してください。" };
    }

    if (data.height && data.height.length > 20) {
      return { valid: false, message: "身長は20文字以内で入力してください。" };
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

  async function uploadSelectedImages() {
    const files = getSelectedFiles();

    if (!files.length) return [];

    const uploads = files.map(async (file, index) => {
      const storageRef = ref(storage, createStoragePath(file, index));
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    });

    return Promise.all(uploads);
  }

  function createStoragePath(file, index) {
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const suffix = `${Date.now()}_${index}_${safeName}`;

    return `casts/${suffix}`;
  }

  function getSelectedFiles() {
    return IMAGE_INPUT_IDS
      .map((id) => document.getElementById(id)?.files?.[0])
      .filter(Boolean);
  }

  function resetImageInputs() {
    IMAGE_INPUT_IDS.forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });
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
      hobby: cast.hobby || "",
      favoriteDrink: cast.favoriteDrink || "",
      message: cast.message || "",
      image: cast.image || "",
      images: Array.isArray(cast.images) ? cast.images : [],
      schedule: cast.schedule || ""
    };
  }

  function setBusy(isBusy) {
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
