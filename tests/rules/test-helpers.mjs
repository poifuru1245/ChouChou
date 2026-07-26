import { doc, setDoc } from "firebase/firestore";

// Storage RulesからFirestoreを参照するため、CLIで起動したEmulatorと同じprojectIdを使う。
// 接続先はEmulator環境変数で固定され、本番データへは接続しない。
export const PROJECT_ID = "chouchou-susukino";

export const USERS = Object.freeze({
  owner:{ uid:"owner-uid", role:"owner", displayName:"Owner", status:"active", castId:"" },
  manager:{ uid:"manager-uid", role:"manager", displayName:"Manager", status:"active", castId:"" },
  staff:{ uid:"staff-uid", role:"staff", displayName:"Staff", status:"active", castId:"" },
  cast:{ uid:"cast-uid", role:"cast", displayName:"Cast", status:"active", castId:"cast-a" },
  otherCast:{ uid:"other-cast-uid", role:"cast", displayName:"Other Cast", status:"active", castId:"cast-b" },
  inactive:{ uid:"inactive-uid", role:"manager", displayName:"Inactive", status:"inactive", castId:"" }
});

export async function seedBaseData(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(Object.values(USERS).map((user) => setDoc(doc(db, "users", user.uid), user)));
    await setDoc(doc(db, "casts", "cast-a"), { name:"A", authUid:USERS.cast.uid, isPublished:true, viewCount:0 });
    await setDoc(doc(db, "casts", "cast-b"), { name:"B", authUid:USERS.otherCast.uid, isPublished:true, viewCount:0 });
    await setDoc(doc(db, "sales", "sale-a"), { castId:"cast-a", sales:10000, total:10000, date:"2026-07-19", month:"2026-07" });
    await setDoc(doc(db, "sales", "sale-b"), { castId:"cast-b", sales:20000, total:20000, date:"2026-07-19", month:"2026-07" });
    await setDoc(doc(db, "schedules", "schedule-a"), { castId:"cast-a", date:"2026-07-20", start:"20:00" });
    await setDoc(doc(db, "payrollSettings", "default"), { baseHourlyRate:3000 });
    await setDoc(doc(db, "payrollHistory", "payroll-a"), { castId:"cast-a", month:"2026-07", netPay:50000 });
    await setDoc(doc(db, "payrollHistory", "payroll-b"), { castId:"cast-b", month:"2026-07", netPay:60000 });
    await setDoc(doc(db, "castRankings", "rank-a"), { castId:"cast-a", salesRank:1 });
    await setDoc(doc(db, "shiftRequests", "shift-a"), { uid:USERS.cast.uid, castId:"cast-a", status:"pending" });
    await setDoc(doc(db, "castAnnouncements", "all"), { audience:"all", title:"全員連絡" });
    await setDoc(doc(db, "castAnnouncements", "target-a"), { audience:"targeted", castIds:["cast-a"], title:"Aのみ" });
    await setDoc(doc(db, "castAnnouncements", "target-b"), { audience:"targeted", castIds:["cast-b"], title:"Bのみ" });
    await setDoc(doc(db, "reservations", "reservation-a"), { customerName:"Guest", status:"受付" });
    await setDoc(doc(db, "customers", "customer-a"), { customerId:"customer-a", name:"Guest", phone:"0110000000" });
    await setDoc(doc(db, "news", "news-a"), { title:"NEWS", isPublished:true });
    await setDoc(doc(db, "gallery", "gallery-a"), { title:"Gallery", isPublished:true });
  });
}

export function contextFor(testEnv, user) {
  return testEnv.authenticatedContext(user.uid, { email:`${user.uid}@example.com` });
}
