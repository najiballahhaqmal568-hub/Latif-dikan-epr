// آزمایش حسابگر کارتن و نشان «قیمت خرید تخمینی»
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

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments','custPayments','waste','expenses','stockCounts']
      .forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    w.__save0('dukan.products.v1', w.products);
  });

  // ---------- ۱) حسابگر کارتن ----------
  await page.evaluate(() => {
    document.querySelector('nav.tabs button[data-scr="products"]').click();
    document.getElementById('btnAdd').click();
  });
  await page.waitForTimeout(200);
  const cartonHidden = await page.evaluate(() => document.getElementById('cartonBox').style.display);
  console.log('\n۱) حسابگر کارتن:');
  check('در آغاز پنهان است', cartonHidden, 'none');

  await page.click('#cartonToggle');
  await page.fill('#cPrice', '400');
  await page.fill('#cCount', '100');
  await page.waitForTimeout(150);
  const carton = await page.evaluate(() => ({
    buy: document.getElementById('fBuy').value,
    out: document.getElementById('cOut').textContent,
  }));
  check('۴۰۰ ÷ ۱۰۰ = ۴ در قیمت خرید', parseFloat(carton.buy), 4);
  check('پیغام درست', carton.out.includes('4'), true);

  // عدد اعشاری
  await page.fill('#cPrice', '380');
  await page.fill('#cCount', '100');
  await page.waitForTimeout(150);
  const carton2 = await page.evaluate(() => parseFloat(document.getElementById('fBuy').value));
  check('۳۸۰ ÷ ۱۰۰ = ۳.۸', carton2, 3.8);

  // تعداد صفر نباید خطا بدهد
  await page.fill('#cCount', '0');
  await page.waitForTimeout(150);
  const carton3 = await page.evaluate(() => document.getElementById('cOut').textContent);
  check('تعداد صفر → بدون خطا', carton3.includes('—'), true);

  // ---------- ۲) ثبت جنس با نشان تخمینی ----------
  await page.fill('#cCount', '100');
  await page.fill('#fName', 'بسکیت');
  await page.fill('#fSell', '5');
  await page.fill('#fQty', '20');
  await page.check('#fEst');
  await page.click('#fSave');
  await page.waitForTimeout(250);
  const prod = await page.evaluate(() => {
    const p = window.products[0];
    return { name: p.name, buy: p.buy, sell: p.sell, est: p.buyEstimated };
  });
  console.log('\n۲) ثبت جنس تخمینی:');
  check('نام', prod.name, 'بسکیت');
  check('قیمت خرید از کارتن', prod.buy, 3.8);
  check('نشان تخمینی ثبت شد', prod.est, true);
  const badge = await page.evaluate(() => document.querySelector('#prodList .estbadge') !== null);
  check('نشان در فهرست اجناس دیده می‌شود', badge, true);

  // ---------- ۳) ستاره هنگام ویرایش گم نشود ----------
  const starKept = await page.evaluate(async () => {
    const w = window;
    w.products[0].star = true;
    w.__save0('dukan.products.v1', w.products);
    w.__renderProducts();
    document.querySelector('#prodList [data-edit]').click();
    return true;
  });
  await page.waitForTimeout(200);
  await page.click('#fSave');
  await page.waitForTimeout(200);
  const afterEdit = await page.evaluate(() => window.products[0].star);
  console.log('\n۳) ویرایش جنس:');
  check('ستاره بعد از ویرایش ماند', afterEdit, true);

  // ---------- ۴) فروش، نشان تخمینی را در خود ثبت کند ----------
  const sale = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart(w.products[0].id, 10);
    w.__finishSale('cash', null);
    const r = w.__computeReport('all');
    return {
      itemEst: w.sales[0].items[0].buyEst,
      cogs: r.cogs, estCogs: r.estCogs,
      profit: r.profit,
      names: Object.keys(r.estNames),
    };
  });
  console.log('\n۴) فروش با قیمت تخمینی:');
  check('نشان در قلم فروش ثبت شد', sale.itemEst, true);
  check('قیمت تمام‌شد (۱۰ × ۳.۸)', sale.cogs, 38);
  check('قیمت تمام‌شد تخمینی هم ۳۸', sale.estCogs, 38);
  check('فایده (۱۰ × ۱.۲)', sale.profit, 12);
  check('نام جنس در اخطار', sale.names[0], 'بسکیت');

  // اخطار در گزارش‌ها دیده شود
  await page.evaluate(() => {
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    window.moreView = 'reports'; window.__renderMore();
  });
  await page.waitForTimeout(250);
  const noteShown = await page.evaluate(() =>
    document.body.textContent.includes('فایدهٔ این دوره کمی تخمینی است'));
  check('اخطار «تخمینی» در گزارش‌ها', noteShown, true);

  // ---------- ۵) خرید واقعی نشان را بردارد و قیمت را درست کند ----------
  const afterBuy = await page.evaluate(() => {
    const w = window;
    const pid = w.products[0].id;
    w.draft = { supplierName:'تامین', phone:'', date:new Date().toISOString().slice(0,10),
      paid:0, lines:[{ productId: pid, name:'بسکیت', qty:100, buyPrice:3.5, sellPrice:5, unit:'piece' }] };
    w.__savePurchase();
    const p = w.products[0];
    return { buy: p.buy, est: p.buyEstimated, qty: p.qty };
  });
  console.log('\n۵) بعد از اولین خرید واقعی:');
  check('نشان تخمینی برداشته شد', afterBuy.est, false);
  check('قیمت خرید = قیمت واقعی (اوسط نگرفت)', afterBuy.buy, 3.5);
  check('موجودی زیاد شد (۱۰ + ۱۰۰)', afterBuy.qty, 110);

  // ---------- ۶) فروش نو دیگر تخمینی نیست ----------
  const after2 = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart(w.products[0].id, 5);
    w.__finishSale('cash', null);
    const last = w.sales[w.sales.length - 1];
    return { est: last.items[0].buyEst, buy: last.items[0].buyPrice };
  });
  console.log('\n۶) فروش بعد از خرید واقعی:');
  check('دیگر تخمینی نیست', after2.est, false);
  check('قیمت خرید واقعی ثبت شد', after2.buy, 3.5);

  // ---------- ۷) خرید دوم اوسط وزنی بگیرد (نه جای‌گزینی) ----------
  const wavg = await page.evaluate(() => {
    const w = window;
    const pid = w.products[0].id;
    // موجودی حالا ۱۰۵ به قیمت ۳.۵ — ۱۰۵ دانه به ۴.۵ بخریم
    w.draft = { supplierName:'تامین', phone:'', date:new Date().toISOString().slice(0,10),
      paid:0, lines:[{ productId: pid, name:'بسکیت', qty:105, buyPrice:4.5, sellPrice:5, unit:'piece' }] };
    w.__savePurchase();
    return { buy: w.products[0].buy, qty: w.products[0].qty };
  });
  console.log('\n۷) خرید دوم (قیمت دیگر تخمینی نیست):');
  check('اوسط وزنی گرفته شد', wavg.buy, 4);
  check('موجودی', wavg.qty, 210);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
