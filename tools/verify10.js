// آزمایش صندوق نقد: موجودی اول، شمارش شبانه، پول دستی، رد پول
const { chromium } = require('playwright');
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
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const seed = () => page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments',
     'custPayments','waste','expenses','stockCounts','cashEntries'].forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    w.products.push({ id:'p1', name:'روغن', type:'unit', unit:'piece', buy:50, sell:80, qty:100, expiry:'' });
    w.__save0('dukan.products.v1', w.products);
  });

  // ---------- ۱) صندوق خالی ----------
  await seed();
  const empty = await page.evaluate(() => window.__cashBalance());
  console.log('\n۱) صندوق در آغاز:');
  check('صفر است', empty, 0);

  // ---------- ۲) موجودی اول ----------
  const withOpening = await page.evaluate(() => {
    const w = window;
    w.cashEntries.push({ id:'o1', date:new Date().toISOString(), kind:'opening', amount:5000 });
    w.__save0('dukan.cash.v1', w.cashEntries);
    return w.__cashBalance();
  });
  console.log('\n۲) موجودی اول ۵۰۰۰:');
  check('صندوق ۵۰۰۰', withOpening, 5000);

  // ---------- ۳) هر حرکت پول ----------
  const flows = await page.evaluate(() => {
    const w = window;
    const out = {};
    // فروش نقد ۲ × ۸۰ = ۱۶۰
    w.cart.length = 0; w.__addToCart('p1', 2); w.__finishSale('cash', null);
    out.afterCashSale = w.__cashBalance();
    // فروش قرضی ۱ × ۸۰ — نباید به صندوق اثر کند
    w.cart.length = 0; w.__addToCart('p1', 1); w.__finishSale('credit', 'احمد');
    out.afterCreditSale = w.__cashBalance();
    // دریافت ۵۰ از مشتری
    w.custPayments.push({ id:'cp1', customerId:w.customers[0].id, date:new Date().toISOString(), amount:50 });
    w.__save0('dukan.custPayments.v1', w.custPayments);
    out.afterCustPay = w.__cashBalance();
    // فاکتور خرید: مجموع ۱۰۰۰، پرداخت نقد ۴۰۰
    w.draft = { supplierName:'تامین', phone:'', date:new Date().toISOString().slice(0,10),
      paid:400, lines:[{ productId:'p1', name:'روغن', qty:20, buyPrice:50, sellPrice:80, unit:'piece' }] };
    w.__savePurchase();
    out.afterPurchase = w.__cashBalance();
    // پرداخت ۲۰۰ به تامین‌کننده
    w.supPayments.push({ id:'sp1', supplierId:w.suppliers[0].id, date:new Date().toISOString(), amount:200 });
    w.__save0('dukan.supPayments.v1', w.supPayments);
    out.afterSupPay = w.__cashBalance();
    // مصرف خانه ۱۰۰
    w.expenses.push({ id:'e1', date:new Date().toISOString(), amount:100, note:'نان' });
    w.__save0('dukan.expenses.v1', w.expenses);
    out.afterExpense = w.__cashBalance();
    return out;
  });
  console.log('\n۳) هر حرکت پول:');
  check('فروش نقد ۱۶۰ → ۵۱۶۰', flows.afterCashSale, 5160);
  check('فروش قرضی اثر نکرد', flows.afterCreditSale, 5160);
  check('دریافت ۵۰ → ۵۲۱۰', flows.afterCustPay, 5210);
  check('خرید نقد ۴۰۰ → ۴۸۱۰', flows.afterPurchase, 4810);
  check('پرداخت ۲۰۰ → ۴۶۱۰', flows.afterSupPay, 4610);
  check('مصرف ۱۰۰ → ۴۵۱۰', flows.afterExpense, 4510);

  // ---------- ۴) اجزا با مجموع جور باشد ----------
  const bd = await page.evaluate(() => {
    const b = window.__cashBreakdown();
    const sum = +(b.opening + b.sales + b.custPaid + b.manualIn + b.adjust
                  - b.purchasePaid - b.supPaid - b.expenses - b.manualOut).toFixed(2);
    return { sum, bal: window.__cashBalance(), b };
  });
  console.log('\n۴) جمع اجزا:');
  check('جمع اجزا = مانده', bd.sum, bd.bal);
  check('فروش نقد در اجزا', bd.b.sales, 160);
  check('خرید نقد در اجزا', bd.b.purchasePaid, 400);

  // ---------- ۵) پول دستی ----------
  const manual = await page.evaluate(() => {
    const w = window;
    w.cashEntries.push({ id:'m1', date:new Date().toISOString(), kind:'in', amount:1000, note:'از خانه' });
    w.__save0('dukan.cash.v1', w.cashEntries);
    const afterIn = w.__cashBalance();
    w.cashEntries.push({ id:'m2', date:new Date().toISOString(), kind:'out', amount:300, note:'به بانک' });
    w.__save0('dukan.cash.v1', w.cashEntries);
    return { afterIn, afterOut: w.__cashBalance() };
  });
  console.log('\n۵) پول دستی:');
  check('داخل ۱۰۰۰ → ۵۵۱۰', manual.afterIn, 5510);
  check('خارج ۳۰۰ → ۵۲۱۰', manual.afterOut, 5210);

  // ---------- ۶) شمارش شبانه — کسری ----------
  await page.evaluate(() => {
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    window.moreView = 'cash'; window.__renderMore();
  });
  await page.waitForTimeout(250);
  await page.click('#cashCountBtn');
  await page.waitForTimeout(250);
  const expectedShown = await page.evaluate(() => document.getElementById('sheet').textContent);
  console.log('\n۶) شمارش شبانه (باید ۵۲۱۰):');
  check('رقم انتظاری نشان داده شد', expectedShown.includes('5,210'), true);
  await page.fill('#ccAmt', '5150');
  await page.waitForTimeout(150);
  const diffMsg = await page.evaluate(() => document.getElementById('ccOut').textContent);
  check('«۶۰ کم است»', diffMsg.includes('60') && diffMsg.includes('کم است'), true);
  await page.click('#ccOk');
  await page.waitForTimeout(300);
  const afterCount = await page.evaluate(() => ({
    bal: window.__cashBalance(),
    entries: window.cashEntries.filter(e => e.kind === 'count').length,
    amount: (window.cashEntries.find(e => e.kind === 'count') || {}).amount,
  }));
  check('صندوق = شمرده‌شده', afterCount.bal, 5150);
  check('یک رکورد تعدیل', afterCount.entries, 1);
  check('تعدیل = −۶۰', afterCount.amount, -60);

  // ---------- ۷) کسری از فایده کم شود ----------
  const rep = await page.evaluate(() => {
    const r = window.__computeReport('all');
    return { short: r.cashShort, profit: r.profit, cashBox: r.cashBox };
  });
  console.log('\n۷) کسری در گزارش‌ها:');
  check('کسری صندوق ۶۰', rep.short, 60);
  // فروش نقد ۱۶۰ (۲×۸۰) + قرضی ۸۰ = ۲۴۰ ؛ COGS = ۳×۵۰ = ۱۵۰ ؛ فایده = ۹۰ − ۶۰ کسری = ۳۰
  check('فایده بعد از کسری', rep.profit, 30);
  check('صندوق گزارش = صندوق واقعی', rep.cashBox, 5150);

  // ---------- ۸) شمارش دوبارهٔ همان شب — نباید دوبار حساب شود ----------
  await page.evaluate(() => { window.moreView = 'cash'; window.__renderMore(); });
  await page.waitForTimeout(200);
  await page.click('#cashCountBtn');
  await page.waitForTimeout(250);
  await page.fill('#ccAmt', '5100');
  await page.click('#ccOk');
  await page.waitForTimeout(300);
  const twice = await page.evaluate(() => ({
    bal: window.__cashBalance(),
    counts: window.cashEntries.filter(e => e.kind === 'count').length,
    short: window.__computeReport('all').cashShort,
  }));
  console.log('\n۸) شمارش دوبارهٔ همان شب:');
  check('فقط یک رکورد تعدیل', twice.counts, 1);
  check('صندوق = آخرین شمارش', twice.bal, 5100);
  check('کسری = ۱۱۰ (نه ۱۷۰)', twice.short, 110);

  // ---------- ۹) زیادت فایدهٔ ساختگی نسازد ----------
  const surplus = await page.evaluate(() => {
    const w = window;
    const dk = w.__dayKeyOf(new Date());
    w.cashEntries = w.cashEntries.filter(e => !(e.kind === 'count' && e.dayKey === dk));
    w.__save0('dukan.cash.v1', w.cashEntries);
    const before = w.__computeReport('all').profit;
    const expected = w.__cashBalance();
    w.cashEntries.push({ id:'c9', date:new Date().toISOString(), kind:'count',
      amount: 200, dayKey: dk });   // ۲۰۰ زیاد
    w.__save0('dukan.cash.v1', w.cashEntries);
    const r = w.__computeReport('all');
    return { before, after: r.profit, short: r.cashShort, bal: w.__cashBalance(), expected };
  });
  console.log('\n۹) زیادت صندوق ۲۰۰:');
  check('فایده تغییر نکرد', surplus.after, surplus.before);
  check('کسری صفر', surplus.short, 0);
  check('صندوق ۲۰۰ زیاد شد', surplus.bal, surplus.expected + 200);

  // ---------- ۱۰) رد پول ----------
  const trail = await page.evaluate(() => {
    const m = window.__cashMovements();
    return { count: m.length, topBalance: m[0].balance, bal: window.__cashBalance(),
             labels: m.map(x => x.label) };
  });
  console.log('\n۱۰) رد پول:');
  check('مانده آخرین حرکت = صندوق', trail.topBalance, trail.bal);
  check('فروش نقد در فهرست', trail.labels.some(l => l.includes('فروش نقد')), true);
  check('خرید نقد در فهرست', trail.labels.some(l => l.includes('خرید نقد')), true);
  check('مصرف خانه در فهرست', trail.labels.some(l => l.includes('مصرف خانه')), true);
  check('موجودی اول در فهرست', trail.labels.some(l => l.includes('موجودی اول')), true);

  // ---------- ۱۱) برگشتی فروش نقد، پول را پس بدهد ----------
  const ret = await page.evaluate(() => {
    const w = window;
    const before = w.__cashBalance();
    const cashSale = w.sales.find(s => s.paymentType === 'cash' && !s.returnOf && !s.returned);
    w.__returnSale(cashSale);
    return { before, after: w.__cashBalance(), amount: cashSale.total };
  });
  console.log('\n۱۱) برگشتی فروش نقد:');
  check('پول از صندوق کم شد', ret.after, ret.before - ret.amount);

  // ---------- ۱۲) موجودی اول یکی بماند ----------
  const openOnce = await page.evaluate(() => {
    const w = window;
    w.cashEntries = w.cashEntries.filter(e => e.kind !== 'opening');
    w.cashEntries.push({ id:'x1', date:new Date().toISOString(), kind:'opening', amount:7000 });
    w.__save0('dukan.cash.v1', w.cashEntries);
    return w.cashEntries.filter(e => e.kind === 'opening').length;
  });
  console.log('\n۱۲) موجودی اول:');
  check('فقط یکی', openOnce, 1);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
