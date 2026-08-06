// آزمایش «مصرف خانه به جنس» — برداشتن جنس از گدام برای خانه
const { chromium } = require('playwright');
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
    // برنج: خرید ۸۰، فروش ۱۰۰، موجود ۵۰ کیلو
    w.products.push({ id:'p1', name:'برنج', type:'weighted', unit:'kg', buy:80, sell:100, qty:50, expiry:'' });
    w.cashEntries.push({ id:'op', date:'2026-01-01T00:00:00.000Z', kind:'opening', amount:10000 });
    w.__invalidateDebts();
    document.getElementById('overlay').classList.remove('open');
  });
}
async function takeGoods(page, qty) {
  await page.evaluate(() => window.__openExpenseGoods());
  await page.waitForTimeout(250);
  await page.click('#xPick'); await page.waitForTimeout(200);
  await page.click('[data-xp="p1"]'); await page.waitForTimeout(250);
  await page.fill('#xQty', String(qty));
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ===== ۱) برداشتن ۵ کیلو برنج =====
  console.log('\n۱) برداشتن ۵ کیلو برنج (خرید ۸۰، فروش ۱۰۰):');
  await reset(page);
  await takeGoods(page, 5);
  let r = await page.evaluate(() => document.getElementById('xOut').textContent);
  check('ارزش خرید ۴۰۰ نشان داده شد', r.indexOf('400') >= 0, true);
  check('نرخ فروش ۵۰۰ هم نشان داده شد', r.indexOf('500') >= 0, true);
  check('توضیح «قیمت خرید» آمد', r.indexOf('قیمت خرید') >= 0, true);

  await page.fill('#xNote', 'برای خانه');
  await page.click('#xOk');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => {
    const w = window, rep = w.__computeReport('all'), e = w.expenses[0];
    return {
      qty: w.__findP('p1').qty,
      cash: w.__cashBalance(),
      expenses: rep.expenses, expensesGoods: rep.expensesGoods,
      cashOut: rep.cashOut, cashBox: rep.cashBox,
      profit: rep.profit, netProfit: rep.netProfit,
      kind: e.kind, amount: e.amount, unitPrice: e.unitPrice, note: e.note,
      breakExp: w.__cashBreakdown().expenses,
    };
  });
  console.log('   بعد از ثبت:');
  check('موجودی ۴۵ کیلو شد', r.qty, 45);
  check('صندوق دست‌نخورده ۱۰٬۰۰۰', r.cash, 10000);
  check('نوعش «به جنس»', r.kind, 'goods');
  check('مبلغش ۴۰۰ (قیمت خرید)', r.amount, 400);
  check('قیمت خرید عکس گرفته شد', r.unitPrice, 80);
  check('توضیحش ماند', r.note, 'برای خانه');
  check('مصارف خانه ۴۰۰', r.expenses, 400);
  check('از آن، به جنس ۴۰۰', r.expensesGoods, 400);
  check('در «پیسهٔ خارج‌شده» نیامد', r.cashOut, 0);
  check('صندوق گزارش ۱۰٬۰۰۰', r.cashBox, 10000);
  check('اجزای صندوق: مصارف صفر', r.breakExp, 0);
  check('فایدهٔ دوکان دست‌نخورده', r.profit, 0);
  check('فایدهٔ نهایی ۴۰۰−', r.netProfit, -400);

  // در رد پول نیاید
  r = await page.evaluate(() => window.__cashMovements().filter(m => (m.label||'').indexOf('مصرف') >= 0).length);
  check('در رد پول نیامد', r, 0);

  // ===== ۲) مصرف نقدی هنوز درست کار کند =====
  console.log('\n۲) مصرف نقدی ۳۰۰ (بدون تغییر):');
  await reset(page);
  await page.evaluate(() => window.__openExpenseForm());
  await page.waitForTimeout(250);
  await page.fill('#expAmt', '300');
  await page.fill('#expNote', 'نان');
  await page.click('#expOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { cash: window.__cashBalance(), expenses: rep.expenses,
             goods: rep.expensesGoods, cashOut: rep.cashOut,
             trail: window.__cashMovements().filter(m => (m.label||'').indexOf('مصرف') >= 0).length };
  });
  check('صندوق ۹٬۷۰۰', r.cash, 9700);
  check('مصارف ۳۰۰', r.expenses, 300);
  check('به جنس صفر', r.goods, 0);
  check('در پیسهٔ خارج‌شده آمد', r.cashOut, 300);
  check('در رد پول آمد', r.trail, 1);

  // ===== ۳) هر دو با هم =====
  console.log('\n۳) نقدی ۳۰۰ + جنس ۵ کیلو:');
  await takeGoods(page, 5);
  await page.click('#xOk');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { cash: window.__cashBalance(), expenses: rep.expenses,
             goods: rep.expensesGoods, cashOut: rep.cashOut,
             netProfit: rep.netProfit, qty: window.__findP('p1').qty };
  });
  check('مصارف خانه ۷۰۰', r.expenses, 700);
  check('از آن به جنس ۴۰۰', r.goods, 400);
  check('پیسهٔ خارج‌شده فقط ۳۰۰', r.cashOut, 300);
  check('صندوق ۹٬۷۰۰ (جنس پول نبرد)', r.cash, 9700);
  check('فایدهٔ نهایی ۷۰۰−', r.netProfit, -700);
  check('موجودی ۴۵', r.qty, 45);

  // ===== ۴) محافظ موجودی =====
  console.log('\n۴) برداشتن بیشتر از موجودی:');
  await reset(page);
  await takeGoods(page, 500);
  await page.click('#xOk');
  await page.waitForTimeout(350);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    expenses: window.expenses.length, qty: window.__findP('p1').qty,
  }));
  check('اخطار موجودی آمد', r.txt.indexOf('موجودی کم است') >= 0, true);
  check('ثبت نشد', r.expenses, 0);
  check('موجودی دست‌نخورده', r.qty, 50);
  await page.click('#stAnyway');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => ({ expenses: window.expenses.length, qty: window.__findP('p1').qty }));
  check('«به‌هرحال» ثبت کرد', r.expenses, 1);
  check('موجودی منفی (آگاهانه)', r.qty, -450);

  // ===== ۵) باطل‌کردن برداشت =====
  console.log('\n۵) باطل‌کردن برداشت جنس:');
  await reset(page);
  await takeGoods(page, 5);
  await page.click('#xOk');
  await page.waitForTimeout(450);
  await page.evaluate(() => {
    document.getElementById('overlay').classList.remove('open');
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    window.moreView = 'expenses'; window.__renderMore();
  });
  await page.waitForTimeout(350);
  r = await page.evaluate(() => {
    const e = window.expenses[0];
    return { hasVoid: !!document.querySelector('[data-voidx="' + e.id + '"]'),
             hasCorrect: !!document.querySelector('[data-correct="' + e.id + '"]'),
             txt: document.getElementById('moreArea').textContent };
  });
  check('دکمهٔ «باطل» روی برداشت هست', r.hasVoid, true);
  check('دکمهٔ «اصلاح» ندارد (مقدار جنس است)', r.hasCorrect, false);
  check('نشان «به جنس» در فهرست', r.txt.indexOf('به جنس') >= 0, true);
  check('جمع «از آن به جنس» نوشته شد', r.txt.indexOf('از آن به جنس') >= 0, true);

  await page.evaluate(() => window.__voidGoodsExpense(window.expenses[0]));
  await page.waitForTimeout(300);
  await page.click('#voidOk');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { qty: window.__findP('p1').qty, expenses: rep.expenses,
             goods: rep.expensesGoods, cash: window.__cashBalance(),
             count: window.expenses.length, netProfit: rep.netProfit };
  });
  console.log('   بعد از باطل‌کردن:');
  check('موجودی به ۵۰ برگشت', r.qty, 50);
  check('مصارف خانه صفر شد', r.expenses, 0);
  check('«به جنس» صفر شد', r.goods, 0);
  check('صندوق دست‌نخورده', r.cash, 10000);
  check('فایدهٔ نهایی صفر', r.netProfit, 0);
  check('رکورد پاک نشد (اصل + باطل)', r.count, 2);

  // ===== ۶) بعد از برداشت، فروش همان جنس درست بماند =====
  console.log('\n۶) بعد از برداشت، فروش همان جنس:');
  await reset(page);
  await takeGoods(page, 10);
  await page.click('#xOk');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => {
    const w = window;
    document.getElementById('overlay').classList.remove('open');
    w.cart.length = 0; w.__addToCart('p1', 10); w.__finishSale('cash', null);
    const rep = w.__computeReport('all');
    return { qty: w.__findP('p1').qty, sales: rep.totalSales, cogs: rep.cogs,
             profit: rep.profit, expenses: rep.expenses, netProfit: rep.netProfit,
             cash: w.__cashBalance() };
  });
  check('موجودی ۳۰ (۵۰ − ۱۰ − ۱۰)', r.qty, 30);
  check('فروش ۱٬۰۰۰', r.sales, 1000);
  check('قیمت تمام‌شد ۸۰۰', r.cogs, 800);
  check('فایدهٔ دوکان ۲۰۰', r.profit, 200);
  check('مصارف خانه ۸۰۰ (۱۰ × ۸۰)', r.expenses, 800);
  check('فایدهٔ نهایی ۶۰۰−', r.netProfit, -600);
  check('صندوق ۱۱٬۰۰۰ (فقط فروش)', r.cash, 11000);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
