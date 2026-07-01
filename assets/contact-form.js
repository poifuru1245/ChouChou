import { db } from "./app.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("contactForm");
const status = document.getElementById("contactFormStatus");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitContact();
  });
}

async function submitContact() {
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const payload = {
    name: getValue(formData, "name"),
    email: getValue(formData, "email"),
    phone: getValue(formData, "phone"),
    type: getValue(formData, "type"),
    message: getValue(formData, "message"),
    status: "新規",
    createdAt: serverTimestamp()
  };

  try {
    if (submitButton) submitButton.disabled = true;
    setStatus("送信中...", "");

    await addDoc(collection(db, "contacts"), payload);

    form.reset();
    setStatus("送信しました。内容を確認のうえご連絡いたします。", "success");
  } catch (error) {
    console.error("お問い合わせ送信失敗", error);
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
