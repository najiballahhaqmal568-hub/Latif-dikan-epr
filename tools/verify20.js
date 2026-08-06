// آزمایش وای‌فای — تنها بخش اپ که هیچ آزمایشی نداشت.
// وای‌فای دو شرط ختم دارد: خلاص‌شدن جی‌بی، یا تیرشدن تاریخ.
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
// تاریخ نسبی به امروز، تا آزمایش با گذشت وقت نشکند
function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { if (!/reading 'focus'/.test(e.message)) { console.log('  ⚠️', e.message); fail++; } });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.evaluate(() => {
    window.__W = {
      reset: function (wifiSpecs) {
        const w = window;
        ['products','sales','customers','suppliers','purchases','supPayments',
         'custPayments','waste','expenses','stockCounts','cashEntries']
          .forEach(k => { w[k].length = 0; });
        w.cart.length = 0;
        w.cashEntries.push({ id:'op', date:'2020-01-01T00:00:00.000Z', kind:'opening', amount:50000 });
        wifiSpecs.forEach(function (s) {
          w.products.push({ id: s.id, name: s.name, type: 'wifi', unit: 'gb',
            buy: s.buy, sell: s.sell, qty: s.qty, expiry: s.expiry || '' });
        });
        w.__invalidateDebts();
        document.getElementById('overlay').classList.remove('open');
      },
      wifiScreen: function () {
        document.querySelector('nav.tabs button[data-scr="more"]').click();
        window.moreView = 'wifi'; window.__renderMore();
        return document.getElementById('moreArea').textContent;
      }
    };
  });

  // ===== ۱) فروش جی‌بی =====
  console.log('\n۱) فروش ۲۰ جی‌بی (خرید ۱۰، فروش ۲۰):');
  await page.evaluate(d => window.__W.reset([{ id:'W', name:'وای‌فای ماهانه', buy:10, sell:20, qty:250, expiry:d }]), daysFromNow(60));
  let r = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart('W', 20);
    w.__finishSale('cash', null);
    const rep = w.__computeReport('all');
    return { qty: w.__findP('W').qty, sales: rep.totalSales, cogs: rep.cogs,
             profit: rep.profit, cash: w.__cashBalance(),
             unit: w.sales[0].items[0].quantity, snap: w.sales[0].items[0].buyPrice };
  });
  check('جی‌بی مانده ۲۳۰', r.qty, 230);
  check('فروش ۴۰۰ (۲۰ × ۲۰)', r.sales, 400);
  check('قیمت تمام‌شد ۲۰۰', r.cogs, 200);
  check('فایده ۲۰۰ (فی جی‌بی ۱۰)', r.profit, 200);
  check('پول در صندوق آمد', r.cash, 50400);
  check('قیمت خرید لحظهٔ فروش عکس گرفته شد', r.snap, 10);

  // ===== ۲) نشان «جی‌بی کم» در ۲۰ =====
  console.log('\n۲) نشان‌های صفحهٔ وای‌فای:');
  await page.evaluate(d => window.__W.reset([
    { id:'A', name:'وای‌فای پرجی‌بی', buy:10, sell:20, qty:250, expiry:d },
    { id:'B', name:'وای‌فای کم‌جی‌بی', buy:10, sell:20, qty:15, expiry:d },
    { id:'C', name:'وای‌فای خلاص', buy:10, sell:20, qty:0, expiry:d },
  ]), daysFromNow(60));
  r = await page.evaluate(() => window.__W.wifiScreen());
  check('«جی‌بی کم» برای ۱۵ آمد', r.indexOf('جی‌بی کم') >= 0, true);
  check('«خلاص شده» برای صفر آمد', r.indexOf('خلاص شده') >= 0, true);
  check('برای ۲۵۰ اخطاری نیست', (r.match(/جی‌بی کم/g) || []).length, 1);

  // مرز دقیق ۲۰: باید اخطار بدهد؛ ۲۱ نباید
  await page.evaluate(d => window.__W.reset([
    { id:'A', name:'دقیقاً بیست', buy:10, sell:20, qty:20, expiry:d },
    { id:'B', name:'بیست‌ویک', buy:10, sell:20, qty:21, expiry:d },
  ]), daysFromNow(60));
  r = await page.evaluate(() => window.__W.wifiScreen());
  check('مرز ۲۰ اخطار می‌دهد (فقط یکی)', (r.match(/جی‌بی کم/g) || []).length, 1);

  // ===== ۳) اخطار تاریخ =====
  console.log('\n۳) اخطار تاریخ ختم:');
  await page.evaluate(d => window.__W.reset([{ id:'A', name:'نزدیک ختم', buy:10, sell:20, qty:100, expiry:d }]), daysFromNow(5));
  r = await page.evaluate(() => window.__W.wifiScreen());
  check('«۵ روز تا خرابی» آمد', r.indexOf('5 روز') >= 0 || r.indexOf('۵ روز') >= 0, true);

  await page.evaluate(d => window.__W.reset([{ id:'A', name:'دور از ختم', buy:10, sell:20, qty:100, expiry:d }]), daysFromNow(60));
  r = await page.evaluate(() => window.__W.wifiScreen());
  check('برای ۶۰ روز اخطاری نیست', r.indexOf('روز تا خرابی') >= 0, false);

  // ===== ۴) انتقال باقی‌ماندهٔ تیرشده به ضایعات =====
  console.log('\n۴) تاریخ تیر شده با ۸۰ جی‌بی مانده:');
  await page.evaluate(d => window.__W.reset([{ id:'A', name:'تیرشده', buy:10, sell:20, qty:80, expiry:d }]), daysFromNow(-3));
  r = await page.evaluate(() => {
    const txt = window.__W.wifiScreen();
    return { txt: txt, hasBtn: !!document.querySelector('[data-wifiwaste="A"]') };
  });
  check('«تاریخ تیر شده» نشان داده شد', r.txt.indexOf('تاریخ تیر شده') >= 0, true);
  check('دکمهٔ انتقال به ضایعات هست', r.hasBtn, true);
  check('مقدار در متن دکمه', r.txt.indexOf('80') >= 0, true);

  await page.click('[data-wifiwaste="A"]');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => {
    const w = window, rep = w.__computeReport('all');
    return { qty: w.__findP('A').qty, wasteCount: w.waste.length,
             wasteQty: w.waste[0] && w.waste[0].quantity,
             reason: w.waste[0] && w.waste[0].reason,
             buyPrice: w.waste[0] && w.waste[0].buyPrice,
             loss: rep.wasteLoss, profit: rep.profit, cash: w.__cashBalance() };
  });
  console.log('   بعد از انتقال:');
  check('جی‌بی صفر شد', r.qty, 0);
  check('یک رکورد ضایعات', r.wasteCount, 1);
  check('مقدارش ۸۰', r.wasteQty, 80);
  check('دلیلش «تاریخ‌تیر»', r.reason, 'expired');
  check('به قیمت خرید ۱۰', r.buyPrice, 10);
  check('ضرر ۸۰۰ (۸۰ × ۱۰)', r.loss, 800);
  check('از فایده کم شد', r.profit, -800);
  check('صندوق دست‌نخورده (پولی جابه‌جا نشد)', r.cash, 50000);

  // دکمه دیگر نباید باشد (جی‌بی صفر شده)
  r = await page.evaluate(() => {
    window.__W.wifiScreen();
    return !!document.querySelector('[data-wifiwaste="A"]');
  });
  check('دکمه پس از انتقال برداشته شد', r, false);

  // تیرشده ولی صفر جی‌بی → دکمه نباشد
  await page.evaluate(d => window.__W.reset([{ id:'A', name:'تیرشدهٔ خالی', buy:10, sell:20, qty:0, expiry:d }]), daysFromNow(-3));
  r = await page.evaluate(() => { window.__W.wifiScreen(); return !!document.querySelector('[data-wifiwaste="A"]'); });
  check('تیرشدهٔ بی‌جی‌بی دکمه ندارد', r, false);

  // ===== ۵) خرید جی‌بی از فاکتور =====
  console.log('\n۵) خرید ۵۰۰ جی‌بی به ۸ (اوسط وزنی):');
  await page.evaluate(d => window.__W.reset([{ id:'W', name:'وای‌فای', buy:10, sell:20, qty:100, expiry:d }]), daysFromNow(60));
  r = await page.evaluate(() => {
    const w = window;
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-20', paid:2000,
      lines:[{ productId:'W', name:'وای‌فای', unit:'gb', qty:500, buyPrice:8 }] };
    w.__savePurchase();
    return { qty: w.__findP('W').qty, buy: w.__findP('W').buy,
             debt: w.__supDebt(w.suppliers[0]), cash: w.__cashBalance() };
  });
  check('جی‌بی ۶۰۰ شد', r.qty, 600);
  check('اوسط وزنی ۸.۳۳', r.buy, 8.33);
  check('قرض تامین‌کننده ۲٬۰۰۰', r.debt, 2000);
  check('صندوق ۴۸٬۰۰۰', r.cash, 48000);

  // ===== ۶) محافظ موجودی روی جی‌بی هم کار کند =====
  console.log('\n۶) فروش بیشتر از جی‌بی مانده:');
  await page.evaluate(() => { document.getElementById('overlay').classList.remove('open'); });
  await page.evaluate(d => window.__W.reset([{ id:'W', name:'وای‌فای', buy:10, sell:20, qty:30, expiry:d }]), daysFromNow(60));
  await page.evaluate(() => {
    window.cart.length = 0; window.__addToCart('W', 200);
    window.__finishSale('cash', null);
  });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    sales: window.sales.length, qty: window.__findP('W').qty,
  }));
  check('اخطار موجودی آمد', r.txt.indexOf('موجودی کم است') >= 0, true);
  check('جی‌بی نوشته شد', r.txt.indexOf('جی‌بی') >= 0, true);
  check('فروشی ثبت نشد', r.sales, 0);
  check('جی‌بی دست‌نخورده', r.qty, 30);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
