const { chromium } = require('playwright');
const { CHROME } = require('./browser');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'test-index.html');

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = Math.abs(actual - expected) < 0.01;
  console.log((ok ? '  ✅' : '  ❌') + ' ' + name + '  → got ' + actual + ', expected ' + expected);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ---- Scenario ----
  // Buy 10 units @ 10 (all cash), then buy 10 more @ 20 (all credit).
  // Weighted avg buy price should become 15.
  const r = await page.evaluate(() => {
    const w = window;
    // seed a product with 0 qty via the purchase path
    w.products.length = 0; w.sales.length = 0; w.suppliers.length = 0; w.purchases.length = 0;
    w.customers.length = 0; w.waste.length = 0; w.expenses.length = 0;
    w.supPayments.length = 0; w.custPayments.length = 0; w.stockCounts.length = 0;
    // موجودی اول صندوق — بدون آن محافظ صندوق جلوِ خرید نقدی را می‌گیرد
    w.cashEntries.length = 0;
    w.cashEntries.push({ id: 'op', date: '2020-01-01T00:00:00.000Z', kind: 'opening', amount: 1000 });

    const pid = 'p1';
    w.products.push({ id: pid, name: 'برنج', type: 'unit', unit: 'pcs', buy: 0, sell: 30, qty: 0, expiry: '' });

    const out = {};

    // --- Purchase 1: 10 @ 10, paid in full (cash 100)
    w.draft = { supplierName: 'تامین ۱', phone: '', date: w.__todayISO ? w.__todayISO() : new Date().toISOString().slice(0,10),
                paid: 100, lines: [{ productId: pid, name: 'برنج', qty: 10, buyPrice: 10, sellPrice: 30, unit: 'pcs' }] };
    w.__savePurchase();
    out.buyAfter1 = w.products[0].buy;
    out.qtyAfter1 = w.products[0].qty;

    // --- Purchase 2: 10 @ 20, paid 0 (all credit → supplier debt 200)
    w.draft = { supplierName: 'تامین ۱', phone: '', date: new Date().toISOString().slice(0,10),
                paid: 0, lines: [{ productId: pid, name: 'برنج', qty: 10, buyPrice: 20, sellPrice: 30, unit: 'pcs' }] };
    w.__savePurchase();
    out.buyAfter2 = w.products[0].buy;   // expect weighted avg 15
    out.qtyAfter2 = w.products[0].qty;   // expect 20
    out.supDebt = w.__supDebt(w.suppliers[0]);   // expect 200 (از دفتر)

    // --- Sale: 5 units cash @ 30 = 150 (cost 5*15=75, profit 75)
    w.cart.length = 0; w.cart.push({ productId: pid, qty: 5 });
    w.__finishSale('cash', null);

    // --- Credit sale WITHOUT name → must be REFUSED
    const salesBefore = w.sales.length;
    w.cart.length = 0; w.cart.push({ productId: pid, qty: 5 });
    w.__finishSale('credit', '');
    out.creditNoNameBlocked = (w.sales.length === salesBefore) ? 1 : 0;

    // --- Credit sale WITH name: 5 @ 30 = 150 → customer debt 150
    w.__finishSale('credit', 'احمد');
    out.custDebt = w.__custDebt(w.customers[0]);
    out.qtyAfterSales = w.products[0].qty; // 20 - 5 - 5 = 10

    // --- Customer overpays: pays 200 against 150 debt → -50 prepayment (not lost)
    // حالا فقط رسید ثبت می‌شود؛ رقم قرض خودش از دفتر حساب می‌گردد
    w.custPayments.push({ id: 'cp1', customerId: w.customers[0].id, date: new Date().toISOString(), amount: 200 });
    w.__invalidateDebts();
    out.custDebtAfterOverpay = w.__custDebt(w.customers[0]); // expect -50

    // --- Home expense 40
    w.expenses.push({ id: 'e1', date: new Date().toISOString(), amount: 40, note: 'نان' });

    w.__save0('dukan.products', w.products);
    return out;
  });

  console.log('\n۱) قیمت خرید اوسط وزنی:');
  check('بعد از خرید اول buy', r.buyAfter1, 10);
  check('بعد از خرید دوم buy (اوسط)', r.buyAfter2, 15);
  check('موجودی بعد از دو خرید', r.qtyAfter2, 20);
  check('قرض تامین‌کننده', r.supDebt, 200);

  console.log('\n۲) فروش قرضی بدون نام:');
  check('مسدود شد', r.creditNoNameBlocked, 1);

  console.log('\n۳) قرض مشتری و پیش‌پرداخت:');
  check('قرض مشتری بعد از فروش قرضی', r.custDebt, 150);
  check('پیش‌پرداخت بعد از پرداخت ۲۰۰', r.custDebtAfterOverpay, -50);
  check('موجودی بعد از فروش‌ها', r.qtyAfterSales, 10);

  // ---- Report before stock count ----
  const rep1 = await page.evaluate(() => window.__computeReport('all'));
  console.log('\n۴) گزارش (پیش از شمارش):');
  check('مجموع فروش', rep1.totalSales, 300);
  check('فروش نقد', rep1.cash, 150);
  check('فروش قرض', rep1.credit, 150);
  check('قیمت تمام‌شد (COGS)', rep1.cogs, 150);   // 10 sold * 15
  check('فایدهٔ دوکان', rep1.profit, 150);        // 300 - 150 - 0
  check('مصارف خانه', rep1.expenses, 40);
  check('فایدهٔ نهایی', rep1.netProfit, 110);     // 150 - 40
  // cash in = cash sales 150 + custPayment 200 = 350
  // cash out = purchase paid 100 + supPayments 0 + expenses 40 = 140
  check('پیسهٔ داخل‌شده (با موجودی اول ۱٬۰۰۰)', rep1.cashIn, 1350);
  check('پیسهٔ خارج‌شده', rep1.cashOut, 140);
  check('صندوق نقد', rep1.cashBox, 1210);

  // ---- Stock count with a shortage of 2 units ----
  const sc = await page.evaluate(() => {
    const w = window;
    w.moreView = 'count';
    w.__renderMore();
    const inp = document.querySelector('[data-cnt="p1"]');
    inp.value = '8';          // book says 10 → shortage of 2
    w.__saveCount();
    return { qty: w.products[0].qty, wasteLen: w.waste.length, reason: w.waste[0] && w.waste[0].reason,
             wasteQty: w.waste[0] && w.waste[0].quantity, wasteBuy: w.waste[0] && w.waste[0].buyPrice };
  });
  console.log('\n۵) شمارش ماهانه — کسری ۲ دانه:');
  check('موجودی اصلاح شد', sc.qty, 8);
  check('یک ضایعات ثبت شد', sc.wasteLen, 1);
  check('مقدار ضایعات', sc.wasteQty, 2);
  check('قیمت خرید ضایعات', sc.wasteBuy, 15);
  console.log('  ' + (sc.reason === 'shortage' ? '✅' : '❌') + ' دلیل = shortage → got ' + sc.reason);
  sc.reason === 'shortage' ? pass++ : fail++;

  const rep2 = await page.evaluate(() => window.__computeReport('all'));
  console.log('\n۶) گزارش (بعد از شمارش):');
  check('ضرر ضایعات (۲×۱۵)', rep2.wasteLoss, 30);
  check('فایدهٔ دوکان', rep2.profit, 120);   // 300 - 150 - 30
  check('فایدهٔ نهایی', rep2.netProfit, 80);  // 120 - 40

  // ---- Re-save the same month's count: must NOT double-count the loss ----
  const sc2 = await page.evaluate(() => {
    const w = window;
    w.products[0].qty = 10;   // pretend book is back to 10
    w.moreView = 'count'; w.__renderMore();
    document.querySelector('[data-cnt="p1"]').value = '8';
    w.__saveCount();
    const rep = w.__computeReport('all');
    return { wasteLen: w.waste.length, wasteLoss: rep.wasteLoss };
  });
  console.log('\n۷) شمارش دوبارهٔ همان ماه (نباید دوبار حساب شود):');
  check('تعداد ضایعات', sc2.wasteLen, 1);
  check('ضرر ضایعات', sc2.wasteLoss, 30);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
