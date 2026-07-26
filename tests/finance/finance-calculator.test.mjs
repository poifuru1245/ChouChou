import test from "node:test";
import assert from "node:assert/strict";
import { assertPeriodOpen, calculateMonthlyPayroll, calculatePayrollStatement, calculateSaleTotals, summarizeSales, validateSaleCalculation } from "../../assets/services/financeCalculator.js";

test("料金内訳から小計・サービス料・消費税・決済差額を計算する", () => {
  const input = { setFee:10000, drinkSales:5000, discount:1000, serviceRate:20, taxRate:10, cashPayment:8480, cardPayment:10000, qrPayment:0, accountsReceivable:0 };
  const result = calculateSaleTotals(input);
  assert.deepEqual({ subtotal:result.subtotal, serviceCharge:result.serviceCharge, taxAmount:result.taxAmount, total:result.total, paymentTotal:result.paymentTotal, difference:result.paymentDifference }, { subtotal:14000, serviceCharge:2800, taxAmount:1680, total:18480, paymentTotal:18480, difference:0 });
  assert.deepEqual(validateSaleCalculation(input), []);
});

test("決済合計が請求額と一致しない場合は検証エラーになる", () => {
  assert.match(validateSaleCalculation({ setFee:10000, serviceRate:0, taxRate:0, cashPayment:9000 })[0], /差額/);
});

test("時給・バック・歩合・手当・控除から給与を計算する", () => {
  const result = calculatePayrollStatement({
    castId:"cast-a", castName:"A", month:"2026-07",
    sales:[{ id:"sale-a", date:"2026-07-19", castId:"cast-a", total:100000, customerCount:2, honmeiCount:2, jounaiCount:1, douhanCount:1, drinkSales:10000, bottleSales:20000, champagneSales:30000 }],
    schedules:[{ date:"2026-07-19", castId:"cast-a", start:"20:00", end:"LAST" }],
    rules:{ baseHourlyRate:3000, honmeiBack:1000, jounaiBack:500, douhanBack:1500, drinkBack:10, bottleBack:5, champagneBack:10, salesCommissionRate:10, attendanceBonus:2000, transportation:1000, deductions:[{ name:"共通控除", type:"percent", value:10 }] },
    adjustments:{ specialAllowance:3000, penalty:500, advance:1000, withholding:2000, otherDeduction:500 }
  });
  assert.equal(result.workHours, 5);
  assert.equal(result.basePay, 15000);
  assert.equal(result.backTotal, 19000);
  assert.equal(result.grossPay, 40000);
  assert.equal(result.deductionTotal, 8000);
  assert.equal(result.netPay, 32000);
});

test("月次給与は保存済み個別調整を反映して順位順に返す", () => {
  const rows = calculateMonthlyPayroll({ month:"2026-07", casts:[{id:"a",name:"A"},{id:"b",name:"B"}], sales:[{date:"2026-07-01",castId:"a",total:100000},{date:"2026-07-01",castId:"b",total:200000}], schedules:[], payrolls:[{month:"2026-07",castId:"a",specialAllowance:5000}], rules:{salesCommissionRate:10} });
  assert.deepEqual(rows.map((row) => row.castId), ["b", "a"]);
  assert.equal(rows.find((row) => row.castId === "a").specialAllowance, 5000);
});

test("日締め・月締め用に決済別売上と客単価を集計する", () => {
  const result = summarizeSales([{ total:10000, customerCount:2, cashPayment:6000, cardPayment:4000 }, { total:20000, customerCount:1, qrPayment:20000 }]);
  assert.deepEqual({ total:result.total, customers:result.customerCount, average:result.averageSpend, cash:result.cashPayment, card:result.cardPayment, qr:result.qrPayment }, { total:30000, customers:3, average:10000, cash:6000, card:4000, qr:20000 });
});

test("日締めまたは月締め済みの場合は編集ロックする", () => {
  assert.equal(assertPeriodOpen({ status:"open" }, null), true);
  assert.throws(() => assertPeriodOpen({ status:"closed" }, null), /period-closed/);
  assert.throws(() => assertPeriodOpen(null, { status:"closed" }), /period-closed/);
});
