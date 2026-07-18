import { db, storage } from "./app.js";
import { optimizeImage } from "./admin.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const SITE_SETTINGS_FIELDS = [
  "heroImageUrl",
  "webReservationUrl",
  "lineReservationUrl",
  "recruitUrl",
  "recruitNotifyLineUrl",
  "recruitNotifyEmail",
  "phoneNumber",
  "contactFormUrl",
  "instagramUrl",
  "instagramSectionEnabled",
  "xUrl",
  "googleMapUrl",
  "businessHours",
  "closedDay",
  "eventBannerEnabled",
  "eventBannerTitle",
  "eventBannerLink",
  "eventBannerImageUrl",
  "eventBannerStartDate",
  "eventBannerEndDate"
];

const settingsForm = document.getElementById("siteSettingsForm");
const settingsStatus = document.getElementById("siteSettingsStatus");

if (settingsForm) {
  loadSiteSettings();

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSiteSettings();
  });
}

async function loadSiteSettings() {
  setStatus("読み込み中...", "");

  try {
    const snapshot = await getDoc(doc(db, "settings", "site"));
    const settings = snapshot.exists() ? snapshot.data() : {};

    SITE_SETTINGS_FIELDS.forEach((field) => {
      const input = settingsForm.elements[field];

      if (!input) return;

      if (input.type === "checkbox") {
        input.checked = field === "instagramSectionEnabled"
          ? settings[field] !== false
          : settings[field] === true;
      } else {
        input.value = settings[field] || "";
      }
    });

    updateEventImagePreview(settings.eventBannerImageUrl || "");

    setStatus("設定を読み込みました。", "success");
  } catch (error) {
    console.error("サイト設定読み込み失敗", error);
    setStatus("設定の読み込みに失敗しました。", "error");
  }
}

async function saveSiteSettings() {
  const saveButton = settingsForm.querySelector("button[type='submit']");
  const settings = {};

  SITE_SETTINGS_FIELDS.forEach((field) => {
    const input = settingsForm.elements[field];

    if (!input) return;

    settings[field] = input.type === "checkbox" ? input.checked : input.value.trim();
  });

  const eventImageFile = document.getElementById("eventBannerImageFile")?.files?.[0];
  if (settings.eventBannerStartDate && settings.eventBannerEndDate && settings.eventBannerStartDate > settings.eventBannerEndDate) {
    setStatus("イベントの掲載終了日は開始日以降に設定してください。", "error");
    return;
  }
  if (settings.eventBannerEnabled && (!settings.eventBannerTitle || (!settings.eventBannerImageUrl && !eventImageFile))) {
    setStatus("イベント公開時はタイトルと画像を設定してください。", "error");
    return;
  }

  try {
    if (saveButton) saveButton.disabled = true;
    setStatus("保存中...", "");

    if (eventImageFile) {
      const optimized = await optimizeImage(eventImageFile, { maxWidth: 1800, maxHeight: 900, quality: 0.86 });
      const storageRef = ref(storage, `event-banners/${Date.now()}_${optimized.name}`);
      await uploadBytes(storageRef, optimized, { contentType: optimized.type });
      settings.eventBannerImageUrl = await getDownloadURL(storageRef);
      const imageUrlInput = settingsForm.elements.eventBannerImageUrl;
      if (imageUrlInput) imageUrlInput.value = settings.eventBannerImageUrl;
      updateEventImagePreview(settings.eventBannerImageUrl);
    }

    await setDoc(
      doc(db, "settings", "site"),
      {
        ...settings,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    setStatus("サイト設定を保存しました。", "success");
  } catch (error) {
    console.error("サイト設定保存失敗", error);
    setStatus("保存に失敗しました。", "error");
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

function updateEventImagePreview(url) {
  const preview = document.getElementById("eventBannerImagePreview");
  if (!preview) return;
  preview.hidden = !url;
  if (url) preview.src = url;
}

function setStatus(message, type) {
  if (!settingsStatus) return;

  settingsStatus.textContent = message;
  settingsStatus.dataset.type = type;
}
