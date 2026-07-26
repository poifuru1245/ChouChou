import test from "node:test";
import assert from "node:assert/strict";
import { buildCastAnalytics, buildCastRankings, buildChargeBreakdown, buildCustomerAnalytics, buildHeatmap, buildKpiGoals, buildPaymentBreakdown, buildSalesSeries, calculateKpis } from "../../assets/services/analyticsCalculator.js";

const now = new Date("2026-07-19T12:00:00+09:00");
const data = {
  sales:[
    { id:"s1", date:"2026-07-19", visitTime:"20:00", castId:"c1", castName:"あい", customerId:"u1", customerCount:2, total:66000, honmeiCount:1, jounaiCount:1, douhanCount:1, setFee:12000, drinkSales:10000, champagneSales:20000, cashPayment:30000, cardPayment:36000 },
    { id:"s2", date:"2026-07-10", visitTime:"22:00", castId:"c2", castName:"りん", customerId:"u2", customerCount:1, total:44000, honmeiCount:1, drinkSales:5000, bottleSales:15000, qrPayment:44000 }
  ],
  payrolls:[{ month:"2026-07", grossPay:30000 }],
  reservations:[{ visitDate:"2026-07-19", status:"完了" }, { visitDate:"2026-07-20", status:"キャンセル" }],
  visits:[{ visitDate:"2026-07-19", status:"完了", assignedCastId:"c1", extensionCount:1, peopleCount:2 }, { visitDate:"2026-07-19", status:"着席", assignedCastId:"c2", peopleCount:1 }],
  customers:[{ id:"u1", name:"VIP顧客", rank:"VIP", visitCount:3, firstVisit:"2026-05-01", lastVisit:"2026-07-19", birthday:"07-25", bottleExpiry:"2026-08-10" }, { id:"u2", name:"新規顧客", visitCount:1, firstVisit:"2026-07-10", lastVisit:"2026-07-10" }],
  tables:[{ status:"空席" }, { status:"使用中" }],
  casts:[{ id:"c1", name:"あい", monthlySalesTarget:100000, honmeiTarget:3, douhanTarget:2 }, { id:"c2", name:"りん", monthlySalesTarget:50000, honmeiTarget:2, douhanTarget:1 }],
  schedules:[{ date:"2026-07-19", castId:"c1", status:"出勤" }, { date:"2026-07-18", castId:"c1", status:"欠勤" }]
};

test("経営KPIを売上・給与・予約・顧客から横断集計する", () => {
  const kpi = calculateKpis(data, { now });
  assert.equal(kpi.todaySales, 66000);
  assert.equal(kpi.monthSales, 110000);
  assert.equal(kpi.estimatedOperatingProfit, 80000);
  assert.equal(kpi.customerCount, 3);
  assert.equal(kpi.averageSpend, 36667);
  assert.equal(kpi.extensionRate, 100);
  assert.equal(kpi.cancellationRate, 50);
  assert.equal(kpi.vipRate, 50);
  assert.equal(kpi.vacantTables, 1);
  assert.equal(kpi.todayCancellations, 0);
});

test("売上を日別・キャスト別・決済方法別に集計する", () => {
  assert.deepEqual(buildSalesSeries(data.sales, "day", { period:"month", now }).map((row) => row.value), [44000, 66000]);
  assert.deepEqual(buildSalesSeries(data.sales, "cast", { period:"month", now }).map((row) => row.label), ["あい", "りん"]);
  assert.equal(buildPaymentBreakdown(data.sales, { period:"month", now }).reduce((sum, row) => sum + row.value, 0), 110000);
  assert.equal(buildChargeBreakdown(data.sales, { period:"month", now }).find((row) => row.field === "setFee").value, 12000);
});

test("曜日と時間帯のヒートマップを生成する", () => {
  const cells = buildHeatmap(data.sales, { period:"month", now });
  assert.equal(cells.flat().reduce((sum, cell) => sum + cell.value, 0), 110000);
  assert.equal(cells.flat().reduce((sum, cell) => sum + cell.count, 0), 2);
});

test("キャストKPIとランキングを計算する", () => {
  const cast = buildCastAnalytics(data, "c1", { period:"month", now });
  assert.equal(cast.total, 66000);
  assert.equal(cast.averageSpend, 33000);
  assert.equal(cast.attendanceRate, 50);
  assert.equal(cast.honmeiRate, 50);
  assert.equal(cast.extensionRate, 100);
  assert.equal(cast.targetRate, 66);
  assert.equal(buildCastRankings(data, { period:"month", now })[0].name, "あい");
});

test("顧客セグメント・誕生日・ボトル期限を計算する", () => {
  const customers = buildCustomerAnalytics(data, { now });
  assert.equal(customers.newCustomers.length, 1);
  assert.equal(customers.repeaters.length, 1);
  assert.equal(customers.vip.length, 1);
  assert.equal(customers.totalLtv, 110000);
  assert.equal(customers.averageLtv, 55000);
  assert.equal(customers.birthdays[0].name, "VIP顧客");
  assert.equal(customers.bottleExpirations[0].bottleExpiry, "2026-08-10");
});

test("既存キャスト目標から月間KPI達成率を生成する", () => {
  const goals = buildKpiGoals(data, { now });
  assert.equal(goals[0].target, 150000);
  assert.equal(goals[0].actual, 110000);
  assert.equal(goals[0].rate, 73.3);
  assert.equal(goals[2].target, 5);
  assert.equal(goals[3].target, 3);
});
