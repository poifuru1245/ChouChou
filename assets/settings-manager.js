import { optimizeImage } from "./admin.js";
import { getSiteSettings, saveSiteSettings as persistSiteSettings, uploadEventBanner } from "./services/siteService.js";

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
    const settings = await getSiteSettings({ force:true }) || {};

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
      settings.eventBannerImageUrl = (await uploadEventBanner(optimized)).url;
      const imageUrlInput = settingsForm.elements.eventBannerImageUrl;
      if (imageUrlInput) imageUrlInput.value = settings.eventBannerImageUrl;
      updateEventImagePreview(settings.eventBannerImageUrl);
    }

    await persistSiteSettings(settings);

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
