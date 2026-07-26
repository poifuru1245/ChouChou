import { getSiteSettings, submitRecruitApplication as createRecruitApplication } from "./services/recruitService.js";

const form = document.getElementById("recruitApplicationForm");
const status = document.getElementById("recruitFormStatus");
const notifyActions = document.getElementById("recruitNotifyActions");
const notifyLine = document.getElementById("recruitNotifyLine");
const notifyMail = document.getElementById("recruitNotifyMail");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitRecruitApplication();
  });
}

async function submitRecruitApplication() {
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);

  const payload = {
    name: getValue(formData, "name"),
    age: getValue(formData, "age"),
    phone: getValue(formData, "phone"),
    lineId: getValue(formData, "lineId"),
    workDays: getValue(formData, "workDays"),
    experience: getValue(formData, "experience"),
    message: getValue(formData, "message"),
    status: "新規"
  };

  try {
    if (submitButton) submitButton.disabled = true;
    setStatus("送信中...", "");

    await createRecruitApplication(payload);

    form.reset();
    setStatus("送信しました。担当者よりご連絡いたします。", "success");
    await showNotifyActions(payload);
  } catch (error) {
    console.error("応募フォーム送信失敗", error);
    setStatus("送信に失敗しました。時間をおいて再度お試しください。", "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function showNotifyActions(payload) {
  const settings = await getSiteSettings();
  const body = createMessageBody(payload);
  let hasAction = false;

  if (settings.recruitNotifyLineUrl && notifyLine) {
    notifyLine.href = createLineUrl(settings.recruitNotifyLineUrl, body);
    notifyLine.hidden = false;
    hasAction = true;
  } else if (notifyLine) {
    notifyLine.hidden = true;
  }

  if (settings.recruitNotifyEmail && notifyMail) {
    notifyMail.href = createMailtoUrl(settings.recruitNotifyEmail, body);
    notifyMail.hidden = false;
    hasAction = true;
  } else if (notifyMail) {
    notifyMail.hidden = true;
  }

  if (notifyActions) {
    notifyActions.hidden = !hasAction;
  }
}

async function getSiteSettings() {
  try {
    return await getSiteSettings({ force:true }) || {};
  } catch (error) {
    console.error("応募通知設定読み込み失敗", error);
    return {};
  }
}

function createMessageBody(payload) {
  return [
    "Chou Chou 応募フォーム",
    `名前：${payload.name}`,
    `年齢：${payload.age}`,
    `電話番号：${payload.phone}`,
    `LINE ID：${payload.lineId || "-"}`,
    `希望勤務日：${payload.workDays || "-"}`,
    `経験有無：${payload.experience || "-"}`,
    `メッセージ：${payload.message || "-"}`
  ].join("\n");
}

function createLineUrl(baseUrl, body) {
  try {
    const url = new URL(baseUrl);
    const key = url.searchParams.has("text") ? "text" : "text";
    url.searchParams.set(key, body);
    return url.toString();
  } catch (error) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}text=${encodeURIComponent(body)}`;
  }
}

function createMailtoUrl(email, body) {
  const subject = encodeURIComponent("Chou Chou 応募フォーム");
  const encodedBody = encodeURIComponent(body);

  return `mailto:${email}?subject=${subject}&body=${encodedBody}`;
}

function getValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

function setStatus(message, type) {
  if (!status) return;

  status.textContent = message;
  status.dataset.type = type;
}
