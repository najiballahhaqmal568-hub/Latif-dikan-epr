// آزمایش «دریافت به جنس» — مشتری به‌جای پول جنس می‌دهد
const { chromium } = require('playwright');
const { CHROME } = require('./browser');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'test-index.html');

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = (typeof actual === 'number' && typeof expected === 'number')
    ? Math.abs(actual - expected) < 0.001 : actual === expected;
  console.log((ok ? '  ✅' : '  ❌') + ' ' + name + '  → got ' + actual + ', expected ' + expected);
  ok ? pass++ : fail++;
}

async function reset(page) {
  await page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments','custPayments','waste','expenses','stockCounts','cashEntries']
      .forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    // بوره: جنس دوکان که مشتری قرضی می‌خرد
    w.products.push({ id:'su', name:'بوره', type:'unit', unit:'piece', buy:40, sell:50, qty:100, expiry:'' });
    // تخم مرغ: از قبل موجود، خرید ۵ فروش ۱۵
    w.products.push({ id:'eg', name:'تخم مرغ', type:'unit', unit:'piece', buy:5, sell:15, qty:0, expiry:'' });
    w.cashEntries.push({ id:'op', date:'2026-01-01T00:00:00.000Z', kind:'opening', amount: 2000 });
    w.customers.push({ id:'c1', name:'احمد', phone:'', opening: 0 });
    ['dukan.products.v1','dukan.customers.v1','dukan.cash.v1'].forEach(() => {});
    w.__save0('dukan.products.v1', w.products);
    w.__save0('dukan.customers.v1', w.customers);
    w.__save0('dukan.cash.v1', w.cashEntries);
    w.__invalidateDebts();
  });
}

// دریافت به جنس از راه خود دیالوگ
async function receiveGoods(page, prodId, qty, price) {
  await page.evaluate(() => window.__openCustomerGoods(window.customers[0]));
  await page.waitForTimeout(250);
  await page.click('#gPick');
  await page.waitForTimeout(200);
  await page.click('[data-gp="' + prodId + '"]');
  await page.waitForTimeout(250);
  await page.fill('#gQty', String(qty));
  await page.fill('#gPrice', String(price));
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ================= ۱) پرداخت قرض قبلی به جنس =================
  console.log('\n۱) قرض ۵۰۰، ۱۰۰ تخم مرغ به ۵ می‌دهد:');
  await reset(page);
  await page.evaluate(() => {
    window.customers[0].opening = 500;
    window.__save0('dukan.customers.v1', window.customers);
    window.__invalidateDebts();
  });
  const before = await page.evaluate(() => ({
    debt: window.__custDebt(window.customers[0]),
    cash: window.__cashBalance(),
  }));
  check('قرض اول ۵۰۰', before.debt, 500);
  check('صندوق اول ۲٬۰۰۰', before.cash, 2000);

  await receiveGoods(page, 'eg', 100, 5);
  let live = await page.evaluate(() => document.getElementById('gOut').textContent);
  check('ارزش ۵۰۰ زنده نشان داده شد', live.indexOf('500') >= 0, true);
  await page.click('#gOk');
  await page.waitForTimeout(400);

  let r = await page.evaluate(() => {
    const w = window;
    const eg = w.__findP('eg');
    return {
      debt: w.__custDebt(w.customers[0]),
      cash: w.__cashBalance(),
      qty: eg.qty, buy: eg.buy,
      payments: w.custPayments.length,
      kind: w.custPayments[0].kind,
      amount: w.custPayments[0].amount,
    };
  });
  check('قرض صفر شد', r.debt, 0);
  check('صندوق دست‌نخورده ۲٬۰۰۰', r.cash, 2000);
  check('موجودی تخم مرغ ۱۰۰', r.qty, 100);
  check('قیمت خریدش ۵', r.buy, 5);
  check('یک رسید ثبت شد', r.payments, 1);
  check('نوعش «به جنس»', r.kind, 'goods');
  check('ارزشش ۵۰۰', r.amount, 500);

  // ---------- گزارش: نه فایده ساخت، نه پول در صندوق ----------
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { cashIn: rep.cashIn, cashBox: rep.cashBox, profit: rep.profit, sales: rep.totalSales };
  });
  console.log('   گزارش پس از دریافت به جنس:');
  check('فروشی ثبت نشد', r.sales, 0);
  check('فایدهٔ ساختگی نساخت', r.profit, 0);
  check('پیسهٔ داخل‌شده فقط موجودی اول', r.cashIn, 2000);
  check('صندوق گزارش ۲٬۰۰۰', r.cashBox, 2000);

  // ---------- حالا در بازار به ۱۵ فروخته شود ----------
  r = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart('eg', 100);
    w.__finishSale('cash', null);
    const rep = w.__computeReport('all');
    return { profit: rep.profit, sales: rep.totalSales, cogs: rep.cogs,
             cash: w.__cashBalance(), qty: w.__findP('eg').qty };
  });
  console.log('\n۲) فروش بازار ۱۰۰ × ۱۵:');
  check('فروش ۱٬۵۰۰', r.sales, 1500);
  check('قیمت تمام‌شد ۵۰۰', r.cogs, 500);
  check('فایده ۱٬۰۰۰ (۱۵ − ۵)', r.profit, 1000);
  check('صندوق ۳٬۵۰۰', r.cash, 3500);
  check('موجودی تخم مرغ صفر', r.qty, 0);

  // ================= ۳) خرید از دوکان بدون پول نقد =================
  console.log('\n۳) مشتری ۳۰۰ بوره قرضی می‌خرد و ۶۰ تخم مرغ به ۵ می‌دهد:');
  await reset(page);
  await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart('su', 6);      // ۶ × ۵۰ = ۳۰۰
    w.__finishSale('credit', 'احمد');
  });
  await page.waitForTimeout(250);
  r = await page.evaluate(() => ({
    debt: window.__custDebt(window.customers[0]),
    cash: window.__cashBalance(),
    profit: window.__computeReport('all').profit,
  }));
  check('قرضش ۳۰۰ شد', r.debt, 300);
  check('صندوق دست‌نخورده', r.cash, 2000);
  check('فایدهٔ فروش بوره ۶۰', r.profit, 60);

  await receiveGoods(page, 'eg', 60, 5);
  await page.click('#gOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => {
    const w = window;
    const rep = w.__computeReport('all');
    return { debt: w.__custDebt(w.customers[0]), cash: w.__cashBalance(),
             eggQty: w.__findP('eg').qty, profit: rep.profit, cashIn: rep.cashIn };
  });
  check('قرضش صفر شد', r.debt, 0);
  check('صندوق باز هم ۲٬۰۰۰ — پول نگرفت', r.cash, 2000);
  check('۶۰ تخم مرغ داخل شد', r.eggQty, 60);
  check('فایده همان ۶۰ ماند (دوبار نشد)', r.profit, 60);
  check('پیسهٔ داخل‌شده زیاد نشد', r.cashIn, 2000);

  // ---------- بعد در بازار فروخته شود ----------
  r = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart('eg', 60);
    w.__finishSale('cash', null);
    const rep = w.__computeReport('all');
    return { profit: rep.profit, cash: w.__cashBalance() };
  });
  console.log('   بعد ۶۰ تخم مرغ به ۱۵ در بازار:');
  check('فایدهٔ کل ۶۶۰ (۶۰ بوره + ۶۰۰ تخم مرغ)', r.profit, 660);
  check('صندوق ۲٬۹۰۰', r.cash, 2900);

  // ================= ۴) بیشتر از قرض → پیش‌پرداخت =================
  console.log('\n۴) قرض ۲۰۰ ولی جنس به ارزش ۵۰۰ می‌دهد:');
  await reset(page);
  await page.evaluate(() => {
    window.customers[0].opening = 200;
    window.__save0('dukan.customers.v1', window.customers);
    window.__invalidateDebts();
  });
  await receiveGoods(page, 'eg', 100, 5);
  live = await page.evaluate(() => document.getElementById('gOut').textContent);
  check('«پیش‌پرداخت او می‌شود» نشان داد', live.indexOf('پیش‌پرداخت') >= 0, true);
  await page.click('#gOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => ({
    debt: window.__custDebt(window.customers[0]),
    cash: window.__cashBalance(),
  }));
  check('پیش‌پرداخت ۳۰۰−', r.debt, -300);
  check('صندوق دست‌نخورده', r.cash, 2000);

  // ================= ۵) اوسط وزنی قیمت خرید =================
  console.log('\n۵) دو بار تخم مرغ به نرخ فرق (۵ و ۷):');
  await reset(page);
  await receiveGoods(page, 'eg', 100, 5);
  await page.click('#gOk');
  await page.waitForTimeout(400);
  await receiveGoods(page, 'eg', 100, 7);
  await page.click('#gOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => ({
    qty: window.__findP('eg').qty, buy: window.__findP('eg').buy,
    debt: window.__custDebt(window.customers[0]),
  }));
  check('موجودی ۲۰۰', r.qty, 200);
  check('قیمت خرید اوسط ۶', r.buy, 6);
  check('پیش‌پرداختش ۱٬۲۰۰', r.debt, -1200);

  // ================= ۶) جنس نو از داخل همین دیالوگ =================
  console.log('\n۶) جنس نو «آرد» از داخل دیالوگ:');
  await reset(page);
  await page.evaluate(() => window.__openCustomerGoods(window.customers[0]));
  await page.waitForTimeout(250);
  await page.click('#gPick');
  await page.waitForTimeout(200);
  await page.click('#gNew');
  await page.waitForTimeout(250);
  await page.fill('#gnName', 'آرد');
  await page.click('#gnType [data-t="weighted"]');
  await page.fill('#gnSell', '15');
  await page.click('#gnOk');
  await page.waitForTimeout(250);
  r = await page.evaluate(() => document.getElementById('sheet').textContent);
  check('واحد کیلو شد', r.indexOf('کیلو') >= 0, true);
  await page.fill('#gQty', '50');
  await page.fill('#gPrice', '10');
  await page.waitForTimeout(200);
  await page.click('#gOk');
  await page.waitForTimeout(500);
  r = await page.evaluate(() => {
    const p = window.products.filter(x => x.name === 'آرد')[0];
    return { exists: !!p, unit: p && p.unit, type: p && p.type, qty: p && p.qty,
             buy: p && p.buy, sell: p && p.sell,
             debt: window.__custDebt(window.customers[0]),
             cash: window.__cashBalance() };
  });
  check('آرد در اجناس ساخته شد', r.exists, true);
  check('نوعش وزنی', r.type, 'weighted');
  check('واحدش کیلو', r.unit, 'kg');
  check('۵۰ کیلو موجود', r.qty, 50);
  check('قیمت خریدش ۱۰', r.buy, 10);
  check('قیمت فروشش ۱۵', r.sell, 15);
  check('پیش‌پرداختش ۵۰۰−', r.debt, -500);
  check('صندوق دست‌نخورده', r.cash, 2000);

  // ================= ۷) رد پول و اجزای قرض =================
  console.log('\n۷) رد پول و صفحهٔ مشتری:');
  r = await page.evaluate(() => {
    const moves = window.__cashMovements();
    const cb = window.__custBreakdown(window.customers[0]);
    return {
      goodsInTrail: moves.filter(m => (m.label || '').indexOf('دریافت از') >= 0).length,
      paid: cb.paid, paidGoods: cb.paidGoods, paidCash: cb.paidCash,
    };
  });
  check('در رد پول نیامد (پول نبود)', r.goodsInTrail, 0);
  check('مجموع دریافت ۵۰۰', r.paid, 500);
  check('از آن ۵۰۰ به جنس', r.paidGoods, 500);
  check('نقدی صفر', r.paidCash, 0);

  await page.evaluate(() => window.__openCustomerDetail(window.customers[0]));
  await page.waitForTimeout(300);
  r = await page.evaluate(() => document.getElementById('sheet').textContent);
  check('سطر «دریافت به جنس» آمد', r.indexOf('دریافت به جنس') >= 0, true);
  check('رسید «به جنس» نشان داده شد', r.indexOf('به جنس') >= 0, true);
  check('نام و نرخ در رسید', r.indexOf('آرد') >= 0, true);

  // ================= ۸) دریافت نقدی هنوز درست کار کند =================
  console.log('\n۸) دریافت نقدی (بدون تغییر):');
  await reset(page);
  await page.evaluate(() => {
    window.customers[0].opening = 400;
    window.__save0('dukan.customers.v1', window.customers);
    window.__invalidateDebts();
    window.__openCustomerPay(window.customers[0]);
  });
  await page.waitForTimeout(250);
  await page.fill('#cPayAmt', '400');
  await page.click('#cPayOk');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    debt: window.__custDebt(window.customers[0]),
    cash: window.__cashBalance(),
    kind: window.custPayments[0].kind,
    inTrail: window.__cashMovements().filter(m => (m.label || '').indexOf('دریافت از') >= 0).length,
  }));
  check('قرض صفر شد', r.debt, 0);
  check('صندوق ۲٬۴۰۰ شد (پول واقعی آمد)', r.cash, 2400);
  check('نوعش «به جنس» نیست', r.kind, undefined);
  check('در رد پول آمد', r.inTrail, 1);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
