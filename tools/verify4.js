// آزمایش دفتر قرض — رقم قرض از رویدادها حساب می‌شود، نه ذخیره
const { chromium } = require('playwright');
const { CHROME } = require('./browser');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'test-index.html');

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = (typeof actual === 'number' && typeof expected === 'number')
    ? Math.abs(actual - expected) < 0.01 : actual === expected;
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

  // ================= ۱) کوچ نباید هیچ رقمی را تغییر دهد =================
  // دیتای «کهنه» به سبک قدیم می‌سازیم: debt ذخیره‌شده + رویدادها،
  // درست مثل اپ پیش از این تغییر.
  const mig = await page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','waste','expenses',
     'supPayments','custPayments','stockCounts'].forEach(k => { w[k].length = 0; });
    w.cart.length = 0;

    // --- مشتری الف: قرض قبلی ۵۰۰ + فروش قرضی ۳۰۰ + دریافت ۲۰۰ = ۶۰۰
    w.customers.push({ id:'c1', name:'احمد', phone:'', debt:600 });
    w.sales.push({ id:'s1', date:new Date().toISOString(), total:300, paymentType:'credit',
      customerName:'احمد', customerId:'c1', items:[] });
    w.custPayments.push({ id:'cp1', customerId:'c1', date:new Date().toISOString(), amount:200 });

    // --- مشتری ب: فقط فروش قرضی ۱۵۰، بدون قرض قبلی
    w.customers.push({ id:'c2', name:'محمود', phone:'', debt:150 });
    w.sales.push({ id:'s2', date:new Date().toISOString(), total:150, paymentType:'credit',
      customerName:'محمود', customerId:'c2', items:[] });

    // --- مشتری ج: پیش‌پرداخت (منفی)
    w.customers.push({ id:'c3', name:'کریم', phone:'', debt:-50 });
    w.custPayments.push({ id:'cp3', customerId:'c3', date:new Date().toISOString(), amount:50 });

    // --- تامین‌کننده الف: قرض قبلی ۱۰۰۰ + فاکتور باقی ۴۰۰ + پرداخت ۳۰۰ = ۱۱۰۰
    w.suppliers.push({ id:'v1', name:'تامین یک', phone:'', debt:1100 });
    w.purchases.push({ id:'pu1', supplierId:'v1', supplierName:'تامین یک',
      date:new Date().toISOString(), total:500, paid:100, remaining:400, items:[] });
    w.supPayments.push({ id:'sp1', supplierId:'v1', date:new Date().toISOString(), amount:300 });

    const before = {
      c1: 600, c2: 150, c3: -50, v1: 1100,
      custTotal: 700, supTotal: 1100,
    };

    w.__invalidateDebts();   // در اپ واقعی، ذخیره‌شدن دیتا این کار را می‌کند
    w.__migrateDebtsToLedger();

    const after = {
      c1: w.__custDebt(w.customers[0]),
      c2: w.__custDebt(w.customers[1]),
      c3: w.__custDebt(w.customers[2]),
      v1: w.__supDebt(w.suppliers[0]),
      custTotal: w.__custDebtTotal(),
      supTotal: w.__supDebtTotal(),
      openings: [w.customers[0].opening, w.customers[1].opening,
                 w.customers[2].opening, w.suppliers[0].opening],
    };
    return { before, after };
  });
  console.log('\n۱) کوچ به دفتر — هیچ رقم نباید تغییر کند:');
  check('قرض احمد', mig.after.c1, mig.before.c1);
  check('قرض محمود', mig.after.c2, mig.before.c2);
  check('پیش‌پرداخت کریم', mig.after.c3, mig.before.c3);
  check('قرض تامین‌کننده', mig.after.v1, mig.before.v1);
  check('مجموع قرض مشتری‌ها', mig.after.custTotal, mig.before.custTotal);
  check('مجموع قرض تامین‌کننده', mig.after.supTotal, mig.before.supTotal);
  console.log('   «قرض قبلی» حساب‌شده: ' + JSON.stringify(mig.after.openings));
  check('قرض قبلی احمد = ۵۰۰', mig.after.openings[0], 500);
  check('قرض قبلی محمود = ۰', mig.after.openings[1], 0);
  check('قرض قبلی کریم = ۰', mig.after.openings[2], 0);
  check('قرض قبلی تامین‌کننده = ۱۰۰۰', mig.after.openings[3], 1000);

  // ================= ۲) رقم خودش را ترمیم می‌کند =================
  const heal = await page.evaluate(() => {
    const w = window;
    // فیلد ذخیره‌شده را عمداً خراب می‌کنیم
    w.customers[0].debt = 999999;
    w.suppliers[0].debt = -12345;
    w.__invalidateDebts();
    return { c: w.__custDebt(w.customers[0]), s: w.__supDebt(w.suppliers[0]) };
  });
  console.log('\n۲) خراب‌کردن عمدی رقم ذخیره‌شده:');
  check('قرض مشتری هنوز درست است', heal.c, 600);
  check('قرض تامین‌کننده هنوز درست است', heal.s, 1100);

  // ================= ۳) رویدادهای نو =================
  const ev = await page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','waste','expenses',
     'supPayments','custPayments'].forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    w.products.push({ id:'p1', name:'روغن', type:'unit', unit:'pcs', buy:50, sell:80, qty:20, expiry:'' });
    const out = {};

    // فروش قرضی ۱۶۰ به احمد نو
    w.__addToCart('p1', 2);
    w.__finishSale('credit', 'احمد');
    const c = w.customers[0];
    out.afterSale = w.__custDebt(c);

    // دریافت ۶۰
    w.custPayments.push({ id:'cp1', customerId:c.id, date:new Date().toISOString(), amount:60 });
    w.__save0('dukan.custpay', w.custPayments);
    out.afterPay = w.__custDebt(c);

    // برگشتی همان فروش → باید صفر شود
    w.__returnSale(w.sales[0]);
    out.afterReturn = w.__custDebt(c);   // 160 - 60 - 160 = -60 (پیش‌پرداخت)

    // اجزا باید با مجموع جور باشند
    const b = w.__custBreakdown(c);
    out.breakdownSum = +(b.opening + b.sales - b.paid).toFixed(2);
    out.total = w.__custDebt(c);
    return out;
  });
  console.log('\n۳) رویدادهای نو روی دفتر:');
  check('بعد از فروش قرضی ۱۶۰', ev.afterSale, 160);
  check('بعد از دریافت ۶۰', ev.afterPay, 100);
  check('بعد از برگشتی', ev.afterReturn, -60);
  check('جمع اجزا = مجموع', ev.breakdownSum, ev.total);

  // ================= ۴) تامین‌کننده =================
  const sup = await page.evaluate(() => {
    const w = window;
    ['sales','customers','suppliers','purchases','supPayments','custPayments'].forEach(k => { w[k].length = 0; });
    // موجودی اول صندوق — بدون آن محافظ صندوق جلوِ پرداخت نقدی را می‌گیرد
    w.cashEntries.length = 0;
    w.cashEntries.push({ id: 'op', date: '2020-01-01T00:00:00.000Z', kind: 'opening', amount: 100000 });
    const out = {};
    // فاکتور: مجموع ۱۰۰۰، پرداخت ۴۰۰ → باقی ۶۰۰
    w.draft = { supplierName:'تامین دو', phone:'', date:new Date().toISOString().slice(0,10),
      paid:400, lines:[{ productId:'p1', name:'روغن', qty:20, buyPrice:50, sellPrice:80, unit:'pcs' }] };
    w.__savePurchase();
    const s = w.suppliers[0];
    out.afterPurchase = w.__supDebt(s);
    // پرداخت ۲۰۰
    w.supPayments.push({ id:'sp1', supplierId:s.id, date:new Date().toISOString(), amount:200 });
    w.__save0('dukan.suppay', w.supPayments);
    out.afterPay = w.__supDebt(s);
    // پرداخت بیشتر از قرض → پیش‌پرداخت
    w.supPayments.push({ id:'sp2', supplierId:s.id, date:new Date().toISOString(), amount:500 });
    w.__save0('dukan.suppay', w.supPayments);
    out.afterOverpay = w.__supDebt(s);
    const b = w.__supBreakdown(s);
    out.breakdownSum = +(b.opening + b.buys - b.paid).toFixed(2);
    out.total = w.__supDebt(s);
    return out;
  });
  console.log('\n۴) تامین‌کننده:');
  check('بعد از فاکتور (باقی ۶۰۰)', sup.afterPurchase, 600);
  check('بعد از پرداخت ۲۰۰', sup.afterPay, 400);
  check('پرداخت اضافی → پیش‌پرداخت', sup.afterOverpay, -100);
  check('جمع اجزا = مجموع', sup.breakdownSum, sup.total);

  // ================= ۵) قرض قبلی از فورم =================
  const open = await page.evaluate(() => {
    const w = window;
    ['sales','customers','suppliers','purchases','supPayments','custPayments'].forEach(k => { w[k].length = 0; });
    // مثل زدن دکمهٔ «افزودن مشتری قرض‌دار»
    w.customers.push({ id:'cx', name:'نور', phone:'', opening: 250 });
    const c = w.customers[0];
    const first = w.__custDebt(c);
    // همان نام دوباره با ۱۵۰ → باید ۴۰۰ شود
    c.opening = +((c.opening || 0) + 150).toFixed(2);
    w.__save0('dukan.customers', w.customers);
    return { first, second: w.__custDebt(c) };
  });
  console.log('\n۵) قرض قبلی (پیش از اپ):');
  check('قرض قبلی ۲۵۰', open.first, 250);
  check('افزودن دوبارهٔ ۱۵۰ → ۴۰۰', open.second, 400);

  // ================= ۶) آینهٔ بک‌آپ تازه می‌شود =================
  const mirror = await page.evaluate(() => {
    const w = window;
    w.customers[0].debt = 0; // آینهٔ کهنه
    const d = w.__collectData();
    return { mirrored: d.customers[0].debt, real: w.__custDebt(w.customers[0]) };
  });
  console.log('\n۶) آینهٔ فیلد debt برای بک‌آپ:');
  check('هنگام بک‌آپ تازه شد', mirror.mirrored, mirror.real);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
