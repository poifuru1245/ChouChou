import { db } from "./app.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SITE_SETTINGS_FIELDS = [
  "webReservationUrl",
  "lineReservationUrl",
  "recruitUrl",
  "phoneNumber",
  "contactFormUrl",
  "instagramUrl",
  "xUrl",
  "googleMapUrl"
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

      input.value = settings[field] || "";
    });

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

    settings[field] = input.value.trim();
  });

  try {
    if (saveButton) saveButton.disabled = true;
    setStatus("保存中...", "");

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

function setStatus(message, type) {
  if (!settingsStatus) return;

  settingsStatus.textContent = message;
  settingsStatus.dataset.type = type;
}
