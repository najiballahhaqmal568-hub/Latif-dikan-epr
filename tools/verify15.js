// آزمایش «باطل‌کردن» رکوردهای غلط — پنج نوع رکوردی که راه اصلاح نداشتند
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
    w.products.push({ id:'p1', name:'برنج', type:'unit', unit:'piece', buy:10, sell:20, qty:50, expiry:'' });
    w.cashEntries.push({ id:'op', date:'2026-01-01T00:00:00.000Z', kind:'opening', amount: 10000 });
    w.__save0('dukan.products.v1', w.products);
    w.__save0('dukan.cash.v1', w.cashEntries);
    w.__invalidateDebts();
  });
}
// بعد از فاکتور خرید ممکن است شیت «بازبینی نرخ» باز شود — بگذار بنشیند و ببندش
async function settle(page) {
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('overlay').classList.remove('open'));
}
// زدن «بلی، باطل کن» در شیت تأیید
async function confirmVoid(page) {
  await page.waitForTimeout(250);
  await page.click('#voidOk');
  await page.waitForTimeout(450);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ================= ۱) باطل‌کردن فاکتور خرید =================
  console.log('\n۱) فاکتور خرید ۲۰ × ۱۵ (پرداخت ۲۰۰، باقی ۱۰۰):');
  await reset(page);
  let r = await page.evaluate(() => {
    const w = window;
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-20', paid:200,
      lines:[{ productId:'p1', name:'برنج', unit:'piece', qty:20, buyPrice:15 }] };
    w.__savePurchase();
    return { qty: w.__findP('p1').qty, buy: w.__findP('p1').buy,
             debt: w.__supDebt(w.suppliers[0]), cash: w.__cashBalance(),
             prevBuy: w.purchases[0].items[0].prevBuy };
  });
  check('موجودی ۷۰ شد', r.qty, 70);
  check('قیمت خرید اوسط ۱۱.۴۳', r.buy, 11.43);
  check('قرض تامین‌کننده ۱۰۰', r.debt, 100);
  check('صندوق ۹٬۸۰۰', r.cash, 9800);
  check('عکس قیمت خرید قبلی گرفته شد (۱۰)', r.prevBuy, 10);

  await settle(page);
  await page.evaluate(() => window.__voidPurchase(window.purchases[0]));
  await confirmVoid(page);
  r = await page.evaluate(() => {
    const w = window;
    return { qty: w.__findP('p1').qty, buy: w.__findP('p1').buy,
             debt: w.__supDebt(w.suppliers[0]), cash: w.__cashBalance(),
             count: w.purchases.length, origVoided: !!w.purchases[0].reversed,
             revOf: w.purchases[1].reverseOf === w.purchases[0].id,
             cogsSafe: w.__computeReport('all').cogs };
  });
  console.log('   بعد از باطل‌کردن:');
  check('موجودی به ۵۰ برگشت', r.qty, 50);
  check('قیمت خرید به ۱۰ برگشت', r.buy, 10);
  check('قرض تامین‌کننده صفر شد', r.debt, 0);
  check('صندوق به ۱۰٬۰۰۰ برگشت', r.cash, 10000);
  check('رکورد پاک نشد — دو فاکتور', r.count, 2);
  check('اصل «باطل شد» نشان دارد', r.origVoided, true);
  check('رکورد نو به اصل بند است', r.revOf, true);

  // باطلِ باطل نشود
  r = await page.evaluate(() => {
    const w = window;
    const before = w.purchases.length;
    w.__voidPurchase(w.purchases[0]); // قبلاً باطل شده
    w.__voidPurchase(w.purchases[1]); // خودش رکورد باطل است
    return { after: w.purchases.length, sheetOpen: document.getElementById('overlay').classList.contains('open') };
  });
  check('باطلِ باطل نمی‌شود', r.after, 2);
  check('شیتی هم باز نشد', r.sheetOpen, false);

  // ================= ۲) اخطار وقتی قیمت خرید پس نمی‌آید =================
  console.log('\n۲) دو فاکتور پشت سر هم، اولی باطل شود:');
  await reset(page);
  r = await page.evaluate(async () => {
    const w = window;
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-10', paid:0,
      lines:[{ productId:'p1', name:'برنج', unit:'piece', qty:20, buyPrice:15 }] };
    w.__savePurchase();
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-20', paid:0,
      lines:[{ productId:'p1', name:'برنج', unit:'piece', qty:20, buyPrice:30 }] };
    w.__savePurchase();
    return { buy: w.__findP('p1').buy, qty: w.__findP('p1').qty };
  });
  check('قیمت خرید بعد از دو فاکتور', r.buy, 15.56);
  check('موجودی ۹۰', r.qty, 90);
  await settle(page);
  await page.evaluate(() => window.__voidPurchase(window.purchases[0]));
  await confirmVoid(page);
  await page.waitForTimeout(500);
  r = await page.evaluate(() => ({
    qty: window.__findP('p1').qty,
    buy: window.__findP('p1').buy,
    txt: document.getElementById('sheet').textContent,
    debt: window.__supDebt(window.suppliers[0]),
  }));
  check('موجودی درست پس آمد (۷۰)', r.qty, 70);
  check('قیمت خرید دست‌نخورده ماند', r.buy, 15.56);
  check('اخطار «قیمت خرید را خودتان ببینید»', r.txt.indexOf('قیمت خرید را خودتان ببینید') >= 0, true);
  check('نام جنس در اخطار', r.txt.indexOf('برنج') >= 0, true);
  check('قرض درست پس آمد (۶۰۰)', r.debt, 600);

  // ================= ۳) رسید پرداخت به تامین‌کننده =================
  console.log('\n۳) رسید پرداخت ۳۰۰ به تامین‌کننده:');
  await reset(page);
  r = await page.evaluate(() => {
    const w = window;
    w.suppliers.push({ id:'s1', name:'کریم', phone:'', opening:1000 });
    w.supPayments.push({ id:'sp1', supplierId:'s1', date:new Date().toISOString(), amount:300 });
    w.__invalidateDebts();
    return { debt: w.__supDebt(w.suppliers[0]), cash: w.__cashBalance() };
  });
  check('قرض ۷۰۰ شد', r.debt, 700);
  check('صندوق ۹٬۷۰۰', r.cash, 9700);
  await page.evaluate(() => window.__voidSupPayment(window.supPayments[0]));
  await confirmVoid(page);
  r = await page.evaluate(() => {
    const w = window;
    return { debt: w.__supDebt(w.suppliers[0]), cash: w.__cashBalance(),
             count: w.supPayments.length, voided: !!w.supPayments[0].reversed,
             bd: w.__supBreakdown(w.suppliers[0]).paid };
  });
  check('قرض به ۱٬۰۰۰ برگشت', r.debt, 1000);
  check('پول به صندوق برگشت', r.cash, 10000);
  check('دو رسید (اصل + باطل)', r.count, 2);
  check('اصل «باطل شد»', r.voided, true);
  check('جمع پرداخت‌ها صفر شد', r.bd, 0);

  // ================= ۴) رسید دریافت نقدی از مشتری =================
  console.log('\n۴) دریافت نقدی ۴۰۰ از مشتری:');
  await reset(page);
  r = await page.evaluate(() => {
    const w = window;
    w.customers.push({ id:'c1', name:'احمد', phone:'', opening:1000 });
    w.custPayments.push({ id:'cp1', customerId:'c1', date:new Date().toISOString(), amount:400 });
    w.__invalidateDebts();
    return { debt: w.__custDebt(w.customers[0]), cash: w.__cashBalance() };
  });
  check('قرض ۶۰۰ شد', r.debt, 600);
  check('صندوق ۱۰٬۴۰۰', r.cash, 10400);
  await page.evaluate(() => window.__voidCustPayment(window.custPayments[0]));
  await confirmVoid(page);
  r = await page.evaluate(() => {
    const w = window;
    return { debt: w.__custDebt(w.customers[0]), cash: w.__cashBalance(),
             count: w.custPayments.length,
             trail: w.__cashMovements().filter(m => (m.label||'').indexOf('دریافت از') >= 0).length };
  });
  check('قرض به ۱٬۰۰۰ برگشت', r.debt, 1000);
  check('پول از صندوق پس رفت', r.cash, 10000);
  check('دو رسید', r.count, 2);
  check('هر دو در رد پول دیده می‌شوند', r.trail, 2);

  // ================= ۵) رسید «به جنس» =================
  console.log('\n۵) دریافت به جنس (۱۰۰ تخم مرغ به ۵):');
  await reset(page);
  await page.evaluate(() => {
    const w = window;
    w.products.push({ id:'eg', name:'تخم مرغ', type:'unit', unit:'piece', buy:4, sell:15, qty:50, expiry:'' });
    w.customers.push({ id:'c1', name:'احمد', phone:'', opening:1000 });
    w.__invalidateDebts();
    w.__openCustomerGoods(w.customers[0]);
  });
  await page.waitForTimeout(250);
  await page.click('#gPick'); await page.waitForTimeout(200);
  await page.click('[data-gp="eg"]'); await page.waitForTimeout(250);
  await page.fill('#gQty', '100'); await page.fill('#gPrice', '5');
  await page.waitForTimeout(200);
  await page.click('#gOk'); await page.waitForTimeout(450);
  r = await page.evaluate(() => {
    const w = window;
    return { debt: w.__custDebt(w.customers[0]), cash: w.__cashBalance(),
             qty: w.__findP('eg').qty, buy: w.__findP('eg').buy,
             prevBuy: w.custPayments[0].prevBuy };
  });
  check('قرض ۵۰۰ شد', r.debt, 500);
  check('صندوق دست‌نخورده', r.cash, 10000);
  check('موجودی ۱۵۰', r.qty, 150);
  check('قیمت خرید اوسط ۴.۶۷', r.buy, 4.67);
  check('عکس قیمت خرید قبلی (۴)', r.prevBuy, 4);

  await page.evaluate(() => window.__voidCustPayment(window.custPayments[0]));
  await confirmVoid(page);
  r = await page.evaluate(() => {
    const w = window;
    return { debt: w.__custDebt(w.customers[0]), cash: w.__cashBalance(),
             qty: w.__findP('eg').qty, buy: w.__findP('eg').buy,
             revKind: w.custPayments[1].kind, revQty: w.custPayments[1].qty,
             paidGoods: w.__custBreakdown(w.customers[0]).paidGoods };
  });
  console.log('   بعد از باطل‌کردن:');
  check('قرض به ۱٬۰۰۰ برگشت', r.debt, 1000);
  check('صندوق باز هم دست‌نخورده', r.cash, 10000);
  check('موجودی به ۵۰ برگشت', r.qty, 50);
  check('قیمت خرید به ۴ برگشت', r.buy, 4);
  check('رکورد وارونه هم «به جنس»', r.revKind, 'goods');
  check('مقدارش منفی', r.revQty, -100);
  check('جمع «به جنس» صفر شد', r.paidGoods, 0);

  // ================= ۶) پول داخل / پول خارج صندوق =================
  console.log('\n۶) پول داخل ۵۰۰ و پول خارج ۲۰۰:');
  await reset(page);
  r = await page.evaluate(() => {
    const w = window;
    w.cashEntries.push({ id:'in1', date:new Date().toISOString(), kind:'in', amount:500, note:'از خانه' });
    w.cashEntries.push({ id:'out1', date:new Date().toISOString(), kind:'out', amount:200, note:'به بانک' });
    return { cash: w.__cashBalance() };
  });
  check('صندوق ۱۰٬۳۰۰', r.cash, 10300);
  await page.evaluate(() => window.__voidCashEntry(window.cashEntries[1]));
  await confirmVoid(page);
  r = await page.evaluate(() => window.__cashBalance());
  check('بعد از باطل «پول داخل» → ۹٬۸۰۰', r, 9800);
  await page.evaluate(() => window.__voidCashEntry(window.cashEntries[2]));
  await confirmVoid(page);
  r = await page.evaluate(() => ({
    cash: window.__cashBalance(),
    br: window.__cashBreakdown(),
  }));
  check('بعد از باطل «پول خارج» → ۱۰٬۰۰۰', r.cash, 10000);
  check('جمع پول داخل صفر', r.br.manualIn, 0);
  check('جمع پول خارج صفر', r.br.manualOut, 0);

  // ================= ۷) ضایعات =================
  console.log('\n۷) ضایعات ۵ برنج (۵ × ۱۰):');
  await reset(page);
  r = await page.evaluate(() => {
    const w = window;
    w.waste.push({ id:'w1', date:new Date().toISOString(), productId:'p1', productName:'برنج',
      unit:'piece', quantity:5, buyPrice:10, reason:'damaged' });
    w.__findP('p1').qty = 45;
    const rep = w.__computeReport('all');
    return { loss: rep.wasteLoss, profit: rep.profit, qty: w.__findP('p1').qty };
  });
  check('ضرر ضایعات ۵۰', r.loss, 50);
  check('فایده ۵۰−', r.profit, -50);
  check('موجودی ۴۵', r.qty, 45);
  await page.evaluate(() => window.__voidWaste(window.waste[0]));
  await confirmVoid(page);
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { loss: rep.wasteLoss, profit: rep.profit, qty: window.__findP('p1').qty,
             count: window.waste.length };
  });
  check('ضرر ضایعات صفر شد', r.loss, 0);
  check('فایده صفر شد', r.profit, 0);
  check('موجودی به ۵۰ برگشت', r.qty, 50);
  check('دو رکورد (اصل + باطل)', r.count, 2);

  // ================= ۸) دکمه‌های باطل در صفحه‌ها =================
  console.log('\n۸) دکمه‌ها در صفحه‌ها:');
  await reset(page);
  await page.evaluate(() => {
    const w = window;
    w.suppliers.push({ id:'s1', name:'کریم', phone:'', opening:1000 });
    w.supPayments.push({ id:'sp1', supplierId:'s1', date:new Date().toISOString(), amount:300 });
    w.__invalidateDebts();
    w.__openSupplierDetail(w.suppliers[0]);
  });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => !!document.querySelector('[data-voidsp="sp1"]'));
  check('دکمهٔ باطل روی رسید تامین‌کننده', r, true);
  // زدن دکمه از راه UI
  await page.click('[data-voidsp="sp1"]');
  await confirmVoid(page);
  r = await page.evaluate(() => ({
    debt: window.__supDebt(window.suppliers[0]),
    gone: !document.querySelector('[data-voidsp="sp1"]'),
  }));
  check('از راه UI هم کار کرد', r.debt, 1000);
  check('دکمه از رسید باطل‌شده برداشته شد', r.gone, true);

  // ضایعات: دکمه در صفحهٔ ضایعات
  await page.evaluate(() => document.getElementById('overlay').classList.remove('open'));
  await reset(page);
  await page.evaluate(() => {
    const w = window;
    w.waste.push({ id:'w1', date:new Date().toISOString(), productId:'p1', productName:'برنج',
      unit:'piece', quantity:5, buyPrice:10, reason:'damaged' });
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    w.moreView = 'waste'; w.__renderMore();
  });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => !!document.querySelector('[data-voidw="w1"]'));
  check('دکمهٔ باطل در صفحهٔ ضایعات', r, true);
  await page.click('[data-voidw="w1"]');
  await confirmVoid(page);
  r = await page.evaluate(() => window.__computeReport('all').wasteLoss);
  check('از راه UI ضایعات باطل شد', r, 0);

  // فاکتور: دکمه در جزئیات فاکتور
  await page.evaluate(() => document.getElementById('overlay').classList.remove('open'));
  await reset(page);
  await page.evaluate(() => {
    const w = window;
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-20', paid:100,
      lines:[{ productId:'p1', name:'برنج', unit:'piece', qty:10, buyPrice:10 }] };
    w.__savePurchase();
  });
  await settle(page);
  await page.evaluate(() => window.__openPurchaseDetail(window.purchases[0]));
  await page.waitForTimeout(300);
  r = await page.evaluate(() => !!document.getElementById('puVoid'));
  check('دکمهٔ باطل در جزئیات فاکتور', r, true);
  await page.click('#puVoid');
  await confirmVoid(page);
  r = await page.evaluate(() => ({ qty: window.__findP('p1').qty, cash: window.__cashBalance() }));
  check('از راه UI فاکتور باطل شد (موجودی)', r.qty, 50);
  check('از راه UI فاکتور باطل شد (صندوق)', r.cash, 10000);

  // ================= ۹) گزارش‌ها بعد از باطل‌کردن =================
  console.log('\n۹) گزارش کامل بعد از باطل‌کردن همه:');
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { sales: rep.totalSales, cogs: rep.cogs, waste: rep.wasteLoss,
             profit: rep.profit, cashIn: rep.cashIn, cashOut: rep.cashOut, box: rep.cashBox };
  });
  check('فروش صفر', r.sales, 0);
  check('قیمت تمام‌شد صفر', r.cogs, 0);
  check('ضایعات صفر', r.waste, 0);
  check('فایده صفر', r.profit, 0);
  check('پیسهٔ خارج‌شده صفر', r.cashOut, 0);
  check('صندوق همان موجودی اول', r.box, 10000);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
