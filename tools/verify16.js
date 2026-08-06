// آزمایش پنج باگی که در بازبینی خط‌به‌خط پیدا شدند
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
    w.cashEntries.push({ id:'op', date:'2026-01-01T00:00:00.000Z', kind:'opening', amount:100000 });
    w.__invalidateDebts();
  });
  await page.evaluate(() => document.getElementById('overlay').classList.remove('open'));
}
const settle = p => p.waitForTimeout(500).then(() =>
  p.evaluate(() => document.getElementById('overlay').classList.remove('open')));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ===== ۱) فایدهٔ ساختگی: باطل ضایعات + شمارش دوبارهٔ همان ماه =====
  console.log('\n۱) باطل‌کردن ضایعات شمارش + شمارش دوباره:');
  await reset(page);
  await page.evaluate(() => {
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    window.moreView = 'count'; window.__renderMore();
  });
  await page.waitForTimeout(300);
  await page.fill('[data-cnt="p1"]', '45');   // کسری ۵
  await page.click('#saveCountBtn');
  await page.waitForTimeout(400);
  let r = await page.evaluate(() => ({
    loss: window.__computeReport('all').wasteLoss,
    cm: window.waste[0] && window.waste[0].countMonth,
  }));
  check('ضرر کسری ۵۰', r.loss, 50);
  check('نشان ماه روی ضایعات', !!r.cm, true);

  await page.evaluate(() => { document.getElementById('overlay').classList.remove('open');
                              window.__voidWaste(window.waste[0]); });
  await page.waitForTimeout(300);
  await page.click('#voidOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => ({
    loss: window.__computeReport('all').wasteLoss,
    revCm: window.waste[1] && window.waste[1].countMonth,
    qty: window.__findP('p1').qty,
  }));
  check('ضرر صفر شد', r.loss, 0);
  check('رکورد وارونه هم نشان ماه دارد', !!r.revCm, true);
  check('موجودی پس آمد', r.qty, 50);

  await page.evaluate(() => { document.getElementById('overlay').classList.remove('open');
                              window.moreView = 'count'; window.__renderMore(); });
  await page.waitForTimeout(350);
  await page.fill('[data-cnt="p1"]', '48');   // کسری ۲
  await page.click('#saveCountBtn');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { loss: rep.wasteLoss, profit: rep.profit, qty: window.__findP('p1').qty,
             wasteCount: window.waste.length };
  });
  console.log('   شمارش دوباره (شمرده ۴۸ = کسری ۲):');
  check('ضرر ۲۰ (نه منفی)', r.loss, 20);
  check('فایده ۲۰− (نه فایدهٔ ساختگی)', r.profit, -20);
  check('فقط یک رکورد ضایعات ماند', r.wasteCount, 1);
  check('موجودی ۴۸', r.qty, 48);

  // ===== ۲) فروش بیشتر از موجودی =====
  console.log('\n۲) فروش ۵۰۰ از موجودی ۵۰:');
  await reset(page);
  await page.evaluate(() => {
    window.cart.length = 0; window.__addToCart('p1', 500);
    window.__finishSale('cash', null);
  });
  await page.waitForTimeout(350);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    open: document.getElementById('overlay').classList.contains('open'),
    sales: window.sales.length, qty: window.__findP('p1').qty,
    profit: window.__computeReport('all').profit,
  }));
  check('شیت اخطار باز شد', r.open, true);
  check('عنوان «موجودی کم است»', r.txt.indexOf('موجودی کم است') >= 0, true);
  check('موجود و لازم نوشته شد', r.txt.indexOf('50') >= 0 && r.txt.indexOf('500') >= 0, true);
  check('هیچ فروشی ثبت نشد', r.sales, 0);
  check('موجودی دست‌نخورده', r.qty, 50);
  check('فایدهٔ ساختگی نساخت', r.profit, 0);

  // «رقم را اصلاح می‌کنم» → سبد سالم بماند
  await page.click('#stBack');
  await page.waitForTimeout(250);
  r = await page.evaluate(() => ({ cart: window.cart.length, sales: window.sales.length }));
  check('سبد سالم ماند', r.cart, 1);
  check('باز هم فروشی نیست', r.sales, 0);

  // «به‌هرحال» → آگاهانه ثبت شود
  await page.evaluate(() => window.__finishSale('cash', null));
  await page.waitForTimeout(300);
  await page.click('#stAnyway');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => ({
    sales: window.sales.length, qty: window.__findP('p1').qty,
    profit: window.__computeReport('all').profit,
  }));
  console.log('   زدن «به‌هرحال ثبت کن»:');
  check('فروش ثبت شد', r.sales, 1);
  check('موجودی منفی شد (آگاهانه)', r.qty, -450);
  check('فایده ۵٬۰۰۰', r.profit, 5000);

  // فروش داخل موجودی هیچ اخطاری ندهد
  await reset(page);
  r = await page.evaluate(() => {
    window.cart.length = 0; window.__addToCart('p1', 10);
    window.__finishSale('cash', null);
    return { sales: window.sales.length, qty: window.__findP('p1').qty,
             open: document.getElementById('overlay').classList.contains('open') };
  });
  console.log('   فروش عادی ۱۰ از ۵۰:');
  check('بدون اخطار ثبت شد', r.sales, 1);
  check('موجودی ۴۰', r.qty, 40);
  check('شیتی باز نشد', r.open, false);

  // ===== ۳) تغییر دستی تعداد =====
  console.log('\n۳) ویرایش جنس: تعداد ۵۰ → ۵:');
  await reset(page);
  await page.evaluate(() => window.__openProductForm(window.__findP('p1')));
  await page.waitForTimeout(300);
  await page.fill('#fQty', '5');
  await page.click('#fSave');
  await page.waitForTimeout(350);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    qty: window.__findP('p1').qty,
  }));
  check('شیت تأیید آمد', r.txt.indexOf('تعداد «برنج» عوض می‌شود') >= 0, true);
  check('کسری و ضررش نوشته شد', r.txt.indexOf('450') >= 0, true);
  check('هنوز عوض نشده', r.qty, 50);
  await page.click('#qcOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { qty: window.__findP('p1').qty, waste: window.waste.length,
             loss: rep.wasteLoss, profit: rep.profit,
             counts: window.stockCounts.length, manual: window.stockCounts[0] && window.stockCounts[0].manual };
  });
  console.log('   بعد از تأیید:');
  check('موجودی ۵ شد', r.qty, 5);
  check('ضایعات ثبت شد', r.waste, 1);
  check('ضرر ۴۵۰', r.loss, 450);
  check('از فایده کم شد', r.profit, -450);
  check('رکورد شمارش برای رد ماند', r.counts, 1);
  check('نشان «دستی» دارد', r.manual, true);

  // زیادشدن تعداد فایدهٔ ساختگی نسازد
  await reset(page);
  await page.evaluate(() => window.__openProductForm(window.__findP('p1')));
  await page.waitForTimeout(300);
  await page.fill('#fQty', '80');
  await page.click('#fSave');
  await page.waitForTimeout(300);
  await page.click('#qcOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { qty: window.__findP('p1').qty, waste: window.waste.length,
             profit: rep.profit, counts: window.stockCounts.length };
  });
  console.log('   زیادشدن ۵۰ → ۸۰:');
  check('موجودی ۸۰', r.qty, 80);
  check('ضایعاتی ثبت نشد', r.waste, 0);
  check('فایدهٔ ساختگی نساخت', r.profit, 0);
  check('ولی رد شمارش ماند', r.counts, 1);

  // تغییر نام بدون تغییر تعداد، شیت نخواهد
  await reset(page);
  await page.evaluate(() => window.__openProductForm(window.__findP('p1')));
  await page.waitForTimeout(300);
  await page.fill('#fName', 'برنج سیله');
  await page.click('#fSave');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => ({
    name: window.products[0].name, qty: window.products[0].qty,
    counts: window.stockCounts.length,
    open: document.getElementById('overlay').classList.contains('open'),
  }));
  console.log('   فقط تغییر نام:');
  check('نام عوض شد', r.name, 'برنج سیله');
  check('تعداد دست‌نخورده', r.qty, 50);
  check('رکورد اضافی نساخت', r.counts, 0);
  check('شیت بسته شد', r.open, false);

  // ===== ۴) باطل فاکتور بعد از فروش اجناسش =====
  console.log('\n۴) باطل فاکتور که اجناسش فروخته شده:');
  await reset(page);
  await page.evaluate(() => {
    const w = window;
    w.products[0].qty = 0;
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-20', paid:0,
      lines:[{ productId:'p1', name:'برنج', unit:'piece', qty:20, buyPrice:10 }] };
    w.__savePurchase();
    w.cart.length = 0; w.__addToCart('p1', 20); w.__finishSale('cash', null);
  });
  await settle(page);
  await page.evaluate(() => window.__voidPurchase(window.purchases[0]));
  await page.waitForTimeout(300);
  await page.click('#voidOk');
  await page.waitForTimeout(350);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    qty: window.__findP('p1').qty, purchases: window.purchases.length,
  }));
  check('اخطار موجودی آمد', r.txt.indexOf('موجودی کم است') >= 0, true);
  check('هنوز باطل نشده', r.purchases, 1);
  check('موجودی دست‌نخورده', r.qty, 0);
  await page.click('#stAnyway');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => ({ qty: window.__findP('p1').qty, purchases: window.purchases.length }));
  console.log('   زدن «به‌هرحال»:');
  check('باطل شد', r.purchases, 2);
  check('موجودی منفی (آگاهانه)', r.qty, -20);

  // ===== ۵) دو فاکتور در یک روز =====
  console.log('\n۵) دو فاکتور همان روز، اولی باطل شود:');
  await reset(page);
  await page.evaluate(() => {
    const w = window, D = '2026-07-20';
    w.draft = { supplierName:'کریم', phone:'', date:D, paid:0,
      lines:[{ productId:'p1', name:'برنج', unit:'piece', qty:20, buyPrice:15 }] };
    w.__savePurchase();
  });
  await settle(page);
  await page.evaluate(() => {
    const w = window, D = '2026-07-20';
    w.draft = { supplierName:'کریم', phone:'', date:D, paid:0,
      lines:[{ productId:'p1', name:'برنج', unit:'piece', qty:20, buyPrice:30 }] };
    w.__savePurchase();
  });
  await settle(page);
  r = await page.evaluate(() => ({
    buy: window.__findP('p1').buy,
    later: window.__hasLaterBuyEvent('p1', window.purchases[0]),
    ts0: !!window.purchases[0].ts, ts1: !!window.purchases[1].ts,
  }));
  check('قیمت خرید اوسط ۱۵.۵۶', r.buy, 15.56);
  check('مهر زمانی روی هر دو فاکتور', r.ts0 && r.ts1, true);
  check('خرید بعدی «بعدی» شناخته شد', r.later, true);

  await page.evaluate(() => window.__voidPurchase(window.purchases[0]));
  await page.waitForTimeout(300);
  await page.click('#voidOk');
  await page.waitForTimeout(600);
  r = await page.evaluate(() => ({
    buy: window.__findP('p1').buy,
    txt: document.getElementById('sheet').textContent,
    qty: window.__findP('p1').qty,
  }));
  check('قیمت خرید خاموش عوض نشد', r.buy, 15.56);
  check('اخطار داده شد', r.txt.indexOf('قیمت خرید را خودتان ببینید') >= 0, true);
  check('موجودی درست پس آمد', r.qty, 70);

  // ولی اگر خرید بعدی نبود، باید پس بیاید
  await reset(page);
  await page.evaluate(() => {
    const w = window;
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-20', paid:0,
      lines:[{ productId:'p1', name:'برنج', unit:'piece', qty:20, buyPrice:15 }] };
    w.__savePurchase();
  });
  await settle(page);
  await page.evaluate(() => window.__voidPurchase(window.purchases[0]));
  await page.waitForTimeout(300);
  await page.click('#voidOk');
  await page.waitForTimeout(500);
  r = await page.evaluate(() => window.__findP('p1').buy);
  console.log('   یک فاکتور تنها:');
  check('قیمت خرید درست پس آمد (۱۰)', r, 10);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
