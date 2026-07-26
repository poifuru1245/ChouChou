import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { contextFor, PROJECT_ID, seedBaseData, USERS } from "./test-helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId:PROJECT_ID,
    firestore:{ rules:await readFile(resolve(here, "../../firestore.rules"), "utf8") },
    storage:{ rules:await readFile(resolve(here, "../../storage.rules"), "utf8") }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedBaseData(env);
});

after(async () => {
  await env?.cleanup();
});

describe("public access", () => {
  test("公開コンテンツは読めるが、顧客・予約一覧は読めない", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "casts", "cast-a")));
    await assertSucceeds(getDoc(doc(db, "news", "news-a")));
    await assertSucceeds(getDoc(doc(db, "gallery", "gallery-a")));
    await assertFails(getDocs(collection(db, "reservations")));
    await assertFails(getDoc(doc(db, "customers", "customer-a")));
    await assertFails(getDoc(doc(db, "sales", "sale-a")));
  });

  test("公開WEB予約は受付データだけ作成でき、任意更新はできない", async () => {
    const db = env.unauthenticatedContext().firestore();
    const reference = doc(collection(db, "reservations"));
    const payload = {
      customerId:"", customerName:"Guest", phone:"0110000000", lineId:"",
      visitDate:"2026-07-20", visitTime:"20:00", peopleCount:2, course:"",
      nominationCastId:"cast-a", nominationCastName:"A", status:"受付", memo:"",
      source:"WEB", name:"Guest", date:"2026-07-20", time:"20:00", people:"2",
      cast1:"A", request:"", createdAt:serverTimestamp(), updatedAt:serverTimestamp()
    };
    await assertSucceeds(setDoc(reference, payload));
    await assertSucceeds(updateDoc(reference, { reservationId:reference.id }));
    await assertFails(updateDoc(reference, { status:"確認済" }));
    await assertFails(setDoc(doc(collection(db, "reservations")), { ...payload, status:"完了" }));
  });

  test("問い合わせ・求人応募は検証済みcreateのみ許可する", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(addDoc(collection(db, "contacts"), {
      name:"Guest", email:"guest@example.com", phone:"", type:"予約", message:"質問です", status:"新規", createdAt:serverTimestamp()
    }));
    await assertFails(addDoc(collection(db, "contacts"), {
      name:"Guest", message:"", status:"新規", createdAt:serverTimestamp()
    }));
    await assertSucceeds(addDoc(collection(db, "recruitApplications"), {
      name:"Applicant", age:"22", phone:"09000000000", lineId:"", workDays:"週3日",
      experience:"未経験", message:"応募します", status:"新規", createdAt:serverTimestamp()
    }));
  });

  test("公開閲覧カウンターは+1以外の変更を拒否する", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(updateDoc(doc(db, "casts", "cast-a"), { viewCount:increment(1), lastViewedAt:serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "casts", "cast-a"), { name:"改ざん" }));
    await assertSucceeds(setDoc(doc(db, "castViews", "cast-a_week"), {
      castId:"cast-a", castName:"A", weekKey:"2026-W29", count:increment(1), updatedAt:serverTimestamp()
    }, { merge:true }));
    await assertFails(updateDoc(doc(db, "castViews", "cast-a_week"), { count:increment(10), updatedAt:serverTimestamp() }));
  });
});

describe("owner and manager", () => {
  test("ownerは既知の業務コレクションをすべて管理できる", async () => {
    const db = contextFor(env, USERS.owner).firestore();
    await assertSucceeds(setDoc(doc(db, "payrollSettings", "default"), { baseHourlyRate:4000 }));
    await assertSucceeds(setDoc(doc(db, "settings", "site"), { phone:"000" }));
    await assertSucceeds(setDoc(doc(db, "gallery", "owner-gallery"), { title:"Owner" }));
    // users・auditLogsはownerでもAdmin SDK経由。未定義コレクションは明示追加まで拒否する。
    await assertFails(setDoc(doc(db, "users", "owner-created"), { role:"staff" }));
    await assertFails(setDoc(doc(db, "auditLogs", "tampered"), { action:"tamper" }));
    await assertFails(setDoc(doc(db, "futureCollection", "future"), { enabled:true }));
  });

  test("managerは業務データを編集できるが給与・設定・usersは禁止", async () => {
    const db = contextFor(env, USERS.manager).firestore();
    await assertSucceeds(updateDoc(doc(db, "casts", "cast-a"), { name:"A updated" }));
    await assertSucceeds(setDoc(doc(db, "schedules", "schedule-new"), { castId:"cast-a", date:"2026-07-21" }));
    await assertSucceeds(updateDoc(doc(db, "reservations", "reservation-a"), { status:"確認済" }));
    await assertSucceeds(setDoc(doc(db, "sales", "sale-new"), { castId:"cast-a", sales:1, date:"2026-07-20", month:"2026-07" }));
    await assertSucceeds(setDoc(doc(db, "tables", "vip-a"), { name:"VIP A", type:"VIP", status:"空席" }));
    await assertSucceeds(setDoc(doc(db, "visits", "visit-a"), { reservationId:"reservation-a", customerName:"Guest", status:"受付" }));
    await assertFails(getDoc(doc(db, "payrollSettings", "default")));
    await assertFails(setDoc(doc(db, "settings", "site"), { phone:"000" }));
    await assertFails(getDocs(collection(db, "users")));
  });

  test("締め後は売上をロックし、解除はownerだけ許可する", async () => {
    const managerDb = contextFor(env, USERS.manager).firestore();
    const ownerDb = contextFor(env, USERS.owner).firestore();
    await assertSucceeds(setDoc(doc(managerDb, "dailyClosings", "2026-07-19"), { date:"2026-07-19", status:"closed" }));
    await assertFails(updateDoc(doc(managerDb, "sales", "sale-a"), { total:11000 }));
    await assertFails(updateDoc(doc(managerDb, "dailyClosings", "2026-07-19"), { status:"open" }));
    await assertSucceeds(updateDoc(doc(ownerDb, "dailyClosings", "2026-07-19"), { status:"open" }));
    await assertSucceeds(updateDoc(doc(managerDb, "sales", "sale-a"), { total:11000 }));
  });

  test("給与・コミッションはowner専用、業務監査は追記専用", async () => {
    const ownerDb = contextFor(env, USERS.owner).firestore();
    const managerDb = contextFor(env, USERS.manager).firestore();
    await assertSucceeds(setDoc(doc(ownerDb, "commissionRules", "default"), { honmeiBack:1000 }));
    await assertFails(getDoc(doc(managerDb, "commissionRules", "default")));
    await assertSucceeds(setDoc(doc(ownerDb, "payrolls", "2026-07_cast-a"), { month:"2026-07", castId:"cast-a", netPay:50000 }));
    await assertFails(setDoc(doc(managerDb, "payrolls", "2026-07_cast-a"), { month:"2026-07", castId:"cast-a", netPay:1 }));
    await assertSucceeds(setDoc(doc(managerDb, "businessAuditLogs", "manager-log"), { actorUid:USERS.manager.uid, actorRole:"manager", action:"sales.update", createdAt:serverTimestamp() }));
    await assertFails(updateDoc(doc(managerDb, "businessAuditLogs", "manager-log"), { action:"tampered" }));
  });

  test("予約から締め解除までの店舗運用フローを一貫して制御する", async () => {
    const managerDb = contextFor(env, USERS.manager).firestore();
    const ownerDb = contextFor(env, USERS.owner).firestore();
    const reservationRef = doc(managerDb, "reservations", "reservation-a");
    const visitRef = doc(managerDb, "visits", "reservation-a");
    const tableRef = doc(managerDb, "tables", "vip-flow");
    const saleRef = doc(managerDb, "sales", "sale-flow");
    const payrollRef = doc(ownerDb, "payrolls", "2026-07_cast-a-flow");

    await assertSucceeds(setDoc(tableRef, { name:"VIP FLOW", type:"VIP", status:"予約済" }));
    await assertSucceeds(updateDoc(reservationRef, { status:"受付", tableId:"vip-flow", customerId:"customer-a" }));
    await assertSucceeds(setDoc(visitRef, { reservationId:"reservation-a", customerId:"customer-a", customerName:"Guest", visitDate:"2026-07-21", visitTime:"20:00", status:"受付", tableId:"vip-flow", extensionCount:0 }));
    await assertSucceeds(updateDoc(reservationRef, { status:"着席", visitId:"reservation-a" }));
    await assertSucceeds(updateDoc(visitRef, { status:"着席" }));
    await assertSucceeds(updateDoc(tableRef, { status:"使用中", currentVisitId:"reservation-a" }));
    await assertSucceeds(updateDoc(reservationRef, { status:"延長" }));
    await assertSucceeds(updateDoc(visitRef, { status:"延長", extensionCount:1 }));
    await assertSucceeds(updateDoc(reservationRef, { status:"会計" }));
    await assertSucceeds(updateDoc(visitRef, { status:"会計" }));
    await assertSucceeds(setDoc(saleRef, { saleId:"sale-flow", visitId:"reservation-a", reservationId:"reservation-a", customerId:"customer-a", castId:"cast-a", date:"2026-07-21", month:"2026-07", total:55000, sales:55000 }));
    await assertSucceeds(updateDoc(reservationRef, { status:"完了", saleId:"sale-flow" }));
    await assertSucceeds(updateDoc(visitRef, { status:"完了", saleId:"sale-flow" }));
    await assertSucceeds(updateDoc(tableRef, { status:"清掃中", currentVisitId:"" }));
    await assertSucceeds(setDoc(payrollRef, { month:"2026-07", castId:"cast-a", grossPay:18000, netPay:16000, status:"draft" }));

    await assertSucceeds(setDoc(doc(managerDb, "dailyClosings", "2026-07-21"), { date:"2026-07-21", status:"closed", total:55000 }));
    await assertSucceeds(setDoc(doc(ownerDb, "monthlyClosings", "2026-07"), { month:"2026-07", status:"closed", total:55000 }));
    await assertFails(updateDoc(saleRef, { total:1 }));
    await assertFails(updateDoc(payrollRef, { netPay:1 }));
    await assertFails(updateDoc(doc(managerDb, "dailyClosings", "2026-07-21"), { status:"open" }));
    await assertSucceeds(updateDoc(doc(ownerDb, "dailyClosings", "2026-07-21"), { status:"open" }));
    await assertSucceeds(updateDoc(doc(ownerDb, "monthlyClosings", "2026-07"), { status:"open" }));
    await assertSucceeds(updateDoc(saleRef, { total:56000 }));
    await assertSucceeds(updateDoc(payrollRef, { netPay:17000 }));

    const [reservation, visit, sale, payroll] = await Promise.all([getDoc(reservationRef), getDoc(visitRef), getDoc(saleRef), getDoc(payrollRef)]);
    assert.equal(reservation.data().status, "完了");
    assert.equal(visit.data().extensionCount, 1);
    assert.equal(sale.data().total, 56000);
    assert.equal(payroll.data().netPay, 17000);
  });
});

describe("staff", () => {
  test("予約・受付・NEWSを編集できる", async () => {
    const db = contextFor(env, USERS.staff).firestore();
    await assertSucceeds(getDocs(collection(db, "reservations")));
    await assertSucceeds(updateDoc(doc(db, "reservations", "reservation-a"), { status:"来店" }));
    await assertSucceeds(getDocs(collection(db, "customers")));
    await assertSucceeds(setDoc(doc(db, "customers", "customer-new"), {
      name:"New", kana:"", nickname:"", phone:"011", lineId:"", birthday:"",
      occupation:"", memo:"", rank:"Regular", firstVisit:"", lastVisit:"", visitCount:0,
      favoriteCastIds:[], assignedCastId:"", createdAt:serverTimestamp(), updatedAt:serverTimestamp()
    }));
    await assertSucceeds(updateDoc(doc(db, "customers", "customer-new"), { customerId:"customer-new" }));
    await assertFails(updateDoc(doc(db, "customers", "customer-new"), { rank:"VIP" }));
    await assertSucceeds(updateDoc(doc(db, "news", "news-a"), { title:"更新" }));
    await assertSucceeds(setDoc(doc(db, "tables", "box-a"), { name:"BOX A", type:"ボックス", status:"空席" }));
    await assertSucceeds(updateDoc(doc(db, "tables", "box-a"), { status:"使用中" }));
    await assertSucceeds(setDoc(doc(db, "visits", "visit-a"), { reservationId:"reservation-a", customerName:"Guest", status:"着席" }));
  });

  test("売上・給与・設定・キャスト編集は禁止", async () => {
    const db = contextFor(env, USERS.staff).firestore();
    await assertFails(getDocs(collection(db, "sales")));
    await assertFails(getDoc(doc(db, "payrollSettings", "default")));
    await assertFails(updateDoc(doc(db, "casts", "cast-a"), { name:"改ざん" }));
    await assertFails(setDoc(doc(db, "settings", "site"), { phone:"000" }));
  });
});

describe("cast portal", () => {
  test("キャストは自分のデータだけ読める", async () => {
    const db = contextFor(env, USERS.cast).firestore();
    await assertSucceeds(getDoc(doc(db, "users", USERS.cast.uid)));
    await assertFails(getDoc(doc(db, "users", USERS.otherCast.uid)));
    await assertSucceeds(getDocs(query(collection(db, "sales"), where("castId", "==", "cast-a"))));
    await assertSucceeds(getDocs(query(collection(db, "shiftRequests"), where("castId", "==", "cast-a"))));
    await assertSucceeds(getDocs(query(collection(db, "payrollHistory"), where("castId", "==", "cast-a"))));
    await assertSucceeds(getDocs(query(collection(db, "castRankings"), where("castId", "==", "cast-a"))));
    await assertSucceeds(getDocs(query(collection(db, "castAnnouncements"), where("audience", "==", "all"))));
    await assertSucceeds(getDocs(query(collection(db, "castAnnouncements"), where("castIds", "array-contains", "cast-a"))));
    await assertFails(getDoc(doc(db, "sales", "sale-b")));
    await assertSucceeds(getDoc(doc(db, "payrollHistory", "payroll-a")));
    await assertFails(getDoc(doc(db, "payrollHistory", "payroll-b")));
    await assertSucceeds(getDoc(doc(db, "payrollSettings", "default")));
    await assertFails(getDocs(collection(db, "tables")));
    await assertFails(getDocs(collection(db, "visits")));
  });

  test("キャストは許可されたプロフィール項目だけ更新できる", async () => {
    const db = contextFor(env, USERS.cast).firestore();
    await assertSucceeds(updateDoc(doc(db, "casts", "cast-a"), {
      hobby:"読書", message:"よろしくお願いします", profileUpdatedBy:USERS.cast.uid, profileUpdatedAt:serverTimestamp()
    }));
    await assertFails(updateDoc(doc(db, "casts", "cast-a"), {
      name:"変更不可", profileUpdatedBy:USERS.cast.uid, profileUpdatedAt:serverTimestamp()
    }));
    await assertFails(updateDoc(doc(db, "casts", "cast-b"), {
      hobby:"不正", profileUpdatedBy:USERS.cast.uid, profileUpdatedAt:serverTimestamp()
    }));
  });

  test("シフト申請・既読・対象お知らせを本人範囲で利用できる", async () => {
    const db = contextFor(env, USERS.cast).firestore();
    await assertSucceeds(addDoc(collection(db, "shiftRequests"), {
      uid:USERS.cast.uid, castId:"cast-a", date:"2026-07-22", start:"20:00", end:"LAST",
      memo:"希望", status:"pending", createdAt:serverTimestamp(), updatedAt:serverTimestamp()
    }));
    await assertFails(addDoc(collection(db, "shiftRequests"), {
      uid:USERS.cast.uid, castId:"cast-b", date:"2026-07-22", start:"20:00", end:"LAST",
      memo:"不正", status:"pending", createdAt:serverTimestamp(), updatedAt:serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(db, "castPortalUsers", USERS.cast.uid, "announcementReads", "all"), {
      announcementId:"all", readAt:serverTimestamp()
    }));
    await assertFails(setDoc(doc(db, "castPortalUsers", USERS.otherCast.uid, "announcementReads", "all"), {
      announcementId:"all", readAt:serverTimestamp()
    }));
    await assertSucceeds(getDoc(doc(db, "castAnnouncements", "all")));
    await assertSucceeds(getDoc(doc(db, "castAnnouncements", "target-a")));
    await assertFails(getDoc(doc(db, "castAnnouncements", "target-b")));
  });
});

test("inactiveユーザーはロール権限を持たない", async () => {
  const db = contextFor(env, USERS.inactive).firestore();
  await assertSucceeds(getDoc(doc(db, "users", USERS.inactive.uid)));
  await assertFails(getDocs(collection(db, "reservations")));
  await assertFails(updateDoc(doc(db, "casts", "cast-a"), { name:"不可" }));
  await assertFails(getDocs(collection(db, "tables")));
  await assertFails(getDocs(collection(db, "visits")));
});
