import { db } from "./app.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("recruitApplicationForm");
const status = document.getElementById("recruitFormStatus");

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
    status: "新規",
    createdAt: serverTimestamp()
  };

  try {
    if (submitButton) submitButton.disabled = true;
    setStatus("送信中...", "");

    await addDoc(collection(db, "recruitApplications"), payload);

    form.reset();
    setStatus("送信しました。担当者よりご連絡いたします。", "success");
  } catch (error) {
    console.error("応募フォーム送信失敗", error);
    setStatus("送信に失敗しました。時間をおいて再度お試しください。", "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function getValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

function setStatus(message, type) {
  if (!status) return;

  status.textContent = message;
  status.dataset.type = type;
}
