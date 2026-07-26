import {
  getAuthErrorMessage,
  requestPasswordReset,
  signInCast,
  signOutCast,
  subscribeAuth
} from "./services/authService.js";
import {
  findCastForAuthenticatedUser,
  markAnnouncementRead,
  submitShiftRequest,
  subscribeCastPortalData,
  updateOwnCastProfile,
  uploadOwnProfilePhoto
} from "./services/castPortalService.js";
import { calculateMonthlyPayroll } from "./services/payrollService.js";
import { getUserAccessProfile, hasPermission, isActiveUser } from "./services/roleService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";

const PLACEHOLDER_IMAGE = "assets/images/cast-portal-placeholder.svg";
const REQUIRED_DATA = ["cast", "sales", "schedules", "shiftRequests", "rankings", "payrollHistory", "payrollSettings", "announcementReads", "announcements-all", "announcements-targeted"];
const state = { user:null, cast:null, data:null, unsubscribeData:null, profileInitialized:false };
const loading = document.getElementById("castPortalLoading");
const login = document.getElementById("castPortalLogin");
const app = document.getElementById("castPortalApp");
const loginMessage = document.getElementById("castPortalLoginMessage");

initialize();

function initialize() {
  initializeMonthInputs();
  bindEvents();
  registerPortalServiceWorker();
  subscribeAuth(handleAuthState, (error) => showLogin(getAuthErrorMessage(error)));
}

function bindEvents() {
  document.getElementById("castPortalLoginForm")?.addEventListener("submit", handleLogin);
  document.getElementById("castPortalPasswordReset")?.addEventListener("click", handlePasswordReset);
  document.getElementById("castPortalLogout")?.addEventListener("click", () => signOutCast());
  document.querySelectorAll("[data-portal-tab]").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.portalTab)));
  document.querySelectorAll("[data-open-tab]").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.openTab)));
  ["portalShiftMonth", "portalSalesMonth", "portalRankingMonth", "portalPayrollMonth"].forEach((id) => document.getElementById(id)?.addEventListener("change", renderPortal));
  document.getElementById("portalShiftRequestForm")?.addEventListener("submit", handleShiftRequest);
  document.getElementById("portalProfileForm")?.addEventListener("submit", handleProfileSave);
  document.getElementById("portalProfilePhoto")?.addEventListener("change", handlePhotoChange);
  document.getElementById("portalAnnouncementList")?.addEventListener("click", handleAnnouncementClick);
}

async function handleAuthState(user) {
  state.unsubscribeData?.();
  state.unsubscribeData = null;
  state.user = user;
  state.cast = null;
  state.data = null;
  state.profileInitialized = false;
  if (!user) return showLogin();
  showLoading("キャスト情報を確認しています...");
  try {
    const accessProfile = await getUserAccessProfile(user, { force:true });
    if (!isActiveUser(accessProfile) || accessProfile.role !== "cast" || !hasPermission(accessProfile, "cast-portal:own")) {
      await signOutCast();
      return showLogin("このアカウントにはキャストマイページの利用権限がありません。管理者へusersロールの確認をご依頼ください。", "error");
    }
    const cast = await findCastForAuthenticatedUser(user);
    if (!cast) {
      await signOutCast();
      return showLogin("このアカウントにキャスト情報が紐付けられていません。管理者へauthUidの登録をご依頼ください。", "error");
    }
    state.cast = cast;
    state.unsubscribeData = subscribeCastPortalData({ user, cast }, (data) => {
      state.data = data;
      if (REQUIRED_DATA.every((name) => data.loaded[name])) {
        showApp();
        renderPortal();
      }
    }, handleDataError);
  } catch (error) {
    console.error("キャスト情報確認失敗", error);
    await signOutCast();
    showLogin("キャスト情報を確認できませんでした。Firestoreの権限とアカウント設定をご確認ください。", "error");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  if (!email || !password) return setLoginMessage("メールアドレスとパスワードを入力してください。", "error");
  const button = document.getElementById("castPortalLoginButton");
  button.disabled = true;
  setLoginMessage("ログイン中...");
  try { await signInCast(email, password); }
  catch (error) { console.error("キャストログイン失敗", error); setLoginMessage(getAuthErrorMessage(error), "error"); button.disabled = false; }
}

async function handlePasswordReset() {
  const email = document.getElementById("castPortalLoginForm").elements.email.value.trim();
  if (!email) return setLoginMessage("パスワード再設定メールの送信先を入力してください。", "error");
  try { await requestPasswordReset(email); setLoginMessage("パスワード再設定メールを送信しました。", "success"); }
  catch (error) { console.error("パスワード再設定失敗", error); setLoginMessage(getAuthErrorMessage(error), "error"); }
}

function renderPortal() {
  if (!state.data || !state.cast) return;
  renderIdentity();
  renderHome();
  renderShift();
  renderSales();
  renderRankings();
  renderPayroll();
  renderAnnouncements();
  renderProfile();
}

function renderIdentity() {
  const cast = state.data.cast || state.cast;
  const image = cast.image || cast.images?.[0] || PLACEHOLDER_IMAGE;
  ["castPortalAvatar", "portalProfilePreview"].forEach((id) => { const element = document.getElementById(id); element.src = image; element.onerror = () => { element.src = PLACEHOLDER_IMAGE; }; });
  setText("castPortalHeaderName", cast.name || "キャスト");
  setText("castPortalWelcomeName", cast.name || "キャスト");
}

function renderHome() {
  const today = getTokyoDateKey();
  const month = today.slice(0, 7);
  const schedules = activeSchedules().sort(compareScheduleDate);
  const todaySchedule = schedules.find((item) => scheduleDate(item) === today);
  const nextSchedule = schedules.find((item) => scheduleDate(item) > today);
  const payroll = calculatePortalPayroll(month);
  setText("castPortalTodayLabel", formatLongDate(today));
  setText("portalTodaySchedule", todaySchedule ? scheduleTime(todaySchedule) : "お休み");
  setText("portalNextSchedule", nextSchedule ? `${formatShortDate(scheduleDate(nextSchedule))} ${scheduleTime(nextSchedule)}` : "未定");
  setText("portalMonthWorkDays", `${payroll?.workDays || 0}日`);
  setText("portalMonthSales", yen(sum(monthSales(month), "sales")));
  setText("portalEstimatedPayroll", yen(payroll?.netPay || 0));
  const upcoming = schedules.filter((item) => scheduleDate(item) >= today).slice(0, 5);
  document.getElementById("portalUpcomingSchedule").innerHTML = upcoming.length ? upcoming.map((item) => `<li><time>${escapeHtml(formatShortDate(scheduleDate(item)))}</time><strong>${escapeHtml(scheduleTime(item))}</strong><span>出勤予定</span></li>`).join("") : emptyList("直近の出勤予定はありません。");
  const announcements = state.data.announcements.slice(0, 3);
  document.getElementById("portalHomeNews").innerHTML = announcements.length ? announcements.map((item) => `<li><time>${escapeHtml(formatTimestamp(item.publishStart || item.createdAt))}</time><strong>${escapeHtml(item.title || "お知らせ")}</strong>${isUnread(item.id) ? "<span>NEW</span>" : ""}</li>`).join("") : emptyList("新しいお知らせはありません。");
}

function renderShift() {
  const month = document.getElementById("portalShiftMonth").value;
  const schedules = activeSchedules().filter((item) => scheduleDate(item).startsWith(month));
  const requests = state.data.shiftRequests.filter((item) => String(item.date || "").startsWith(month));
  renderCalendar(month, schedules, requests);
  const requestList = document.getElementById("portalShiftRequests");
  const sorted = [...state.data.shiftRequests].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  requestList.innerHTML = sorted.length ? sorted.map((item) => `<li><div><strong>${escapeHtml(formatShortDate(item.date))} ${escapeHtml(`${item.start || ""}〜${item.end || ""}`)}</strong><small>${escapeHtml(item.memo || "")}</small></div><span class="is-${escapeAttribute(item.status || "pending")}">${requestStatus(item.status)}</span></li>`).join("") : emptyList("提出済みのシフト希望はありません。");
}

function renderCalendar(month, schedules, requests) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const scheduleMap = new Map(schedules.map((item) => [scheduleDate(item), item]));
  const requestMap = new Map(requests.filter((item) => item.status === "pending").map((item) => [item.date, item]));
  const blanks = Array.from({ length:firstDay }, () => "<i></i>").join("");
  const cells = Array.from({ length:days }, (_, index) => { const day = index + 1; const key = `${month}-${String(day).padStart(2, "0")}`; const schedule = scheduleMap.get(key); const request = requestMap.get(key); return `<div class="${schedule ? "has-shift" : ""}${request ? " has-request" : ""}"><strong>${day}</strong>${schedule ? `<small>${escapeHtml(scheduleTime(schedule))}</small>` : request ? "<small>承認待ち</small>" : ""}</div>`; }).join("");
  document.getElementById("portalShiftCalendar").innerHTML = `<div class="portal-calendar-weekdays"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div><div class="portal-calendar-days">${blanks}${cells}</div>`;
}

async function handleShiftRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = { date:String(data.get("date") || ""), start:String(data.get("start") || ""), end:String(data.get("end") || ""), memo:String(data.get("memo") || "") };
  if (!payload.date || !payload.start || !payload.end) return setMessage("portalShiftMessage", "希望日・開始・終了を入力してください。", "error");
  if (payload.end === payload.start) return setMessage("portalShiftMessage", "開始と終了には異なる時刻を指定してください。", "error");
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try { await submitShiftRequest({ ...payload, user:state.user, castId:state.cast.id }); form.reset(); setMessage("portalShiftMessage", "シフト希望を提出しました。承認までお待ちください。", "success"); }
  catch (error) { console.error("シフト希望提出失敗", error); setMessage("portalShiftMessage", "提出できませんでした。通信状況と権限をご確認ください。", "error"); }
  finally { button.disabled = false; }
}

function renderSales() {
  const month = document.getElementById("portalSalesMonth").value;
  const rows = [...monthSales(month)].sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById("portalSalesList").innerHTML = rows.length ? `<table><thead><tr><th>営業日</th><th>売上</th><th>本指名</th><th>場内</th><th>同伴</th><th>ドリンク</th><th>ボトル</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${escapeHtml(formatShortDate(item.date))}</td><td>${yen(item.sales)}</td><td>${item.honmeiCount}</td><td>${item.jounaiCount}</td><td>${item.douhanCount}</td><td>${yen(item.drinkSales)}</td><td>${yen(item.bottleSales)}</td></tr>`).join("")}</tbody></table>` : emptyPanel("選択した月の売上データはありません。");
}

function renderRankings() {
  const month = document.getElementById("portalRankingMonth").value;
  const record = state.data.rankings.find((item) => String(item.month || item.date || "").startsWith(month));
  const ownSales = monthSales(month);
  const metrics = [
    { key:"sales", label:"売上順位", value:sum(ownSales, "sales"), rank:record?.salesRank },
    { key:"honmei", label:"本指名順位", value:sum(ownSales, "honmeiCount"), rank:record?.honmeiRank },
    { key:"jounai", label:"場内順位", value:sum(ownSales, "jounaiCount"), rank:record?.jounaiRank },
    { key:"douhan", label:"同伴順位", value:sum(ownSales, "douhanCount"), rank:record?.douhanRank },
    { key:"drink", label:"ドリンク順位", value:sum(ownSales, "drinkSales"), rank:record?.drinkRank }
  ];
  document.getElementById("portalRankingGrid").innerHTML = metrics.map((item) => { const trend = Array.isArray(record?.[`${item.key}Trend`]) ? record[`${item.key}Trend`] : []; return `<article class="portal-ranking-card portal-glass-card"><span>${escapeHtml(item.label)}</span><strong>${item.rank ? `${item.rank}位` : "集計待ち"}</strong><small>${["sales", "drink"].includes(item.key) ? yen(item.value) : `${item.value}件`}</small>${createSparkline(trend)}</article>`; }).join("");
}

function createSparkline(values) {
  if (values.length < 2) return '<div class="portal-sparkline is-empty">順位推移データ待ち</div>';
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length < 2) return '<div class="portal-sparkline is-empty">順位推移データ待ち</div>';
  const max = Math.max(...numbers, 1); const min = Math.min(...numbers); const range = Math.max(1, max - min); const points = numbers.map((value, index) => `${index / (numbers.length - 1) * 100},${8 + (value - min) / range * 30}`).join(" ");
  return `<svg class="portal-sparkline" viewBox="0 0 100 46" role="img" aria-label="順位推移"><polyline points="${points}"/></svg>`;
}

function renderPayroll() {
  const month = document.getElementById("portalPayrollMonth").value;
  const payroll = calculatePortalPayroll(month);
  document.getElementById("portalPayrollSummary").innerHTML = payroll ? `<article class="portal-glass-card"><span>基本給</span><strong>${yen(payroll.basePay)}</strong></article><article class="portal-glass-card"><span>各種バック</span><strong>${yen(payroll.backTotal)}</strong></article><article class="portal-glass-card"><span>控除</span><strong>-${yen(payroll.deductionTotal)}</strong></article><article class="portal-glass-card is-total"><span>支給予定額</span><strong>${yen(payroll.netPay)}</strong></article>` : emptyPanel("給与計算に必要なデータがありません。");
  const history = [...state.data.payrollHistory].sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));
  document.getElementById("portalPayrollHistory").innerHTML = history.length ? `<table><thead><tr><th>対象月</th><th>基本給</th><th>バック</th><th>控除</th><th>支給額</th></tr></thead><tbody>${history.map((item) => `<tr><td>${escapeHtml(formatMonth(item.month))}</td><td>${yen(item.basePay)}</td><td>${yen(item.backTotal)}</td><td>${yen(item.deductionTotal)}</td><td><strong>${yen(item.netPay)}</strong></td></tr>`).join("")}</tbody></table>` : emptyPanel("過去の給与履歴はありません。");
}

function calculatePortalPayroll(month) {
  return calculateMonthlyPayroll({ month, sales:state.data.sales, schedules:state.data.schedules, casts:[state.data.cast || state.cast], settings:state.data.payrollSettings }).find((item) => item.castId === state.cast.id) || null;
}

function renderAnnouncements() {
  const reads = new Set(state.data.announcementReads.map((item) => item.announcementId || item.id));
  const list = document.getElementById("portalAnnouncementList");
  list.innerHTML = state.data.announcements.length ? state.data.announcements.map((item) => `<article class="portal-announcement portal-glass-card ${reads.has(item.id) ? "is-read" : "is-unread"}"><button type="button" data-announcement-id="${escapeAttribute(item.id)}"><span>${reads.has(item.id) ? "既読" : "未読"}</span><time>${escapeHtml(formatTimestamp(item.publishStart || item.createdAt))}</time><h2>${escapeHtml(item.title || "お知らせ")}</h2><p>${escapeHtml(item.body || item.content || "")}</p></button></article>`).join("") : emptyPanel("キャスト向けのお知らせはありません。");
  const unread = state.data.announcements.filter((item) => !reads.has(item.id)).length;
  const badge = document.getElementById("castPortalUnreadBadge");
  badge.textContent = String(unread);
  badge.hidden = unread === 0;
}

async function handleAnnouncementClick(event) {
  const button = event.target.closest("button[data-announcement-id]");
  if (!button || button.closest(".portal-announcement").classList.contains("is-read")) return;
  try { await markAnnouncementRead(state.user, button.dataset.announcementId); }
  catch (error) { console.error("お知らせ既読更新失敗", error); }
}

function renderProfile() {
  if (state.profileInitialized) return;
  const cast = state.data.cast || state.cast;
  const form = document.getElementById("portalProfileForm");
  ["message", "hobby", "favoriteDrink", "instagram", "x", "line"].forEach((field) => { form.elements[field].value = cast[field] || ""; });
  state.profileInitialized = true;
}

async function handleProfileSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const profile = Object.fromEntries(new FormData(form).entries());
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try { await updateOwnCastProfile({ castId:state.cast.id, user:state.user, profile }); setMessage("portalProfileMessage", "プロフィールを保存しました。", "success"); }
  catch (error) { console.error("プロフィール保存失敗", error); setMessage("portalProfileMessage", "保存できませんでした。Firestoreの権限をご確認ください。", "error"); }
  finally { button.disabled = false; }
}

async function handlePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const preview = document.getElementById("portalProfilePreview");
  preview.src = URL.createObjectURL(file);
  setMessage("portalProfileMessage", "写真をアップロード中...");
  try { const image = await uploadOwnProfilePhoto({ castId:state.cast.id, user:state.user, file }); preview.src = image; document.getElementById("castPortalAvatar").src = image; setMessage("portalProfileMessage", "プロフィール写真を変更しました。", "success"); }
  catch (error) { console.error("プロフィール写真変更失敗", error); setMessage("portalProfileMessage", error.message || "写真を変更できませんでした。", "error"); }
  finally { event.target.value = ""; }
}

function openTab(name) {
  document.querySelectorAll("[data-portal-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.portalTab === name));
  document.querySelectorAll("[data-portal-section]").forEach((section) => { const active = section.dataset.portalSection === name; section.classList.toggle("is-active", active); section.hidden = !active; });
  window.scrollTo({ top:0, behavior:"smooth" });
}

function activeSchedules() { return state.data.schedules.filter((item) => !isInactiveSchedule(item)); }
function monthSales(month) { return state.data.sales.filter((item) => item.date.startsWith(month)); }
function scheduleDate(item) { return String(item.date || item.dateKey || item.workDate || "").slice(0, 10); }
function scheduleTime(item) { const start = item.start || item.startTime || ""; const end = item.end || item.endTime || ""; return String(item.time || (start && end ? `${start}〜${end}` : start || "未定")); }
function isInactiveSchedule(item) { const status = String(item.status || "").toLowerCase(); return item.isOff === true || item.start === "__OFF__" || ["休み", "欠勤", "off", "cancel", "canceled", "cancelled"].includes(status); }
function compareScheduleDate(a, b) { return scheduleDate(a).localeCompare(scheduleDate(b)); }
function sum(rows, field) { return rows.reduce((total, item) => total + (Number(item[field]) || 0), 0); }
function requestStatus(status) { return ({ pending:"承認待ち", approved:"承認済み", rejected:"差戻し" })[status] || "承認待ち"; }
function isUnread(id) { return !state.data.announcementReads.some((item) => (item.announcementId || item.id) === id); }
function getTokyoDateKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
function initializeMonthInputs() { const month = getTokyoDateKey().slice(0, 7); ["portalShiftMonth", "portalSalesMonth", "portalRankingMonth", "portalPayrollMonth"].forEach((id) => { document.getElementById(id).value = month; }); }
function formatLongDate(value) { const date = new Date(`${value}T00:00:00+09:00`); return new Intl.DateTimeFormat("ja-JP", { year:"numeric", month:"long", day:"numeric", weekday:"long" }).format(date); }
function formatShortDate(value) { const [, month, day] = String(value || "").split("-"); return month && day ? `${Number(month)}/${Number(day)}` : value; }
function formatMonth(value) { const [year, month] = String(value || "").split("-"); return year && month ? `${year}年${Number(month)}月` : value; }
function formatTimestamp(value) { const time = toMillis(value); return time ? new Intl.DateTimeFormat("ja-JP", { year:"numeric", month:"numeric", day:"numeric" }).format(new Date(time)) : "日付未設定"; }
function toMillis(value) { if (typeof value?.toMillis === "function") return value.toMillis(); if (typeof value?.toDate === "function") return value.toDate().getTime(); return Date.parse(value) || Number(value) || 0; }
function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(Number(value) || 0); }
function emptyList(text) { return `<li class="portal-empty">${escapeHtml(text)}</li>`; }
function emptyPanel(text) { return `<p class="portal-empty">${escapeHtml(text)}</p>`; }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function setMessage(id, text, type = "") { const element = document.getElementById(id); element.textContent = text; element.dataset.type = type; }
function setLoginMessage(text, type = "") { loginMessage.textContent = text; loginMessage.dataset.type = type; }
function showLoading(text) { loading.hidden = false; loading.querySelector("p").textContent = text; login.hidden = true; app.hidden = true; }
function showLogin(text = "", type = "") { loading.hidden = true; login.hidden = false; app.hidden = true; document.getElementById("castPortalLoginButton").disabled = false; setLoginMessage(text, type); }
function showApp() { loading.hidden = true; login.hidden = true; app.hidden = false; }
function handleDataError(error, source) { console.error(`キャストポータル ${source} 読み込み失敗`, error); }
function registerPortalServiceWorker() { if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch((error) => console.warn("Service Worker登録失敗", error))); }
