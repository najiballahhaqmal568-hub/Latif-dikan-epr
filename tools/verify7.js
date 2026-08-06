// آزمایش اخطار نرخ وقت خرید
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

  const seed = () => page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments','custPayments','waste','expenses','stockCounts']
      .forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    // کیک نازگل: خرید ۳ فروش ۵ (فایده ۲) — موجودی ۰ تا اوسط دخالت نکند
    w.products.push({ id:'n1', name:'کیک نازگل', type:'unit', unit:'piece', buy:3, sell:5, qty:0, expiry:'' });
    // کیک انار: خرید ۲.۵ فروش ۵ (فایده ۲.۵)
    w.products.push({ id:'n2', name:'کیک انار', type:'unit', unit:'piece', buy:2.5, sell:5, qty:0, expiry:'' });
    w.__save0('dukan.products.v1', w.products);
  });

  const buy = (lines, paid) => page.evaluate(({lines, paid}) => {
    const w = window;
    w.draft = { supplierName:'تامین', phone:'', date:new Date().toISOString().slice(0,10), paid: paid||0, lines };
    w.__savePurchase();
    return true;
  }, {lines, paid});

  // ---------- ۱) فایده کم شد (ولی ضرر نی) ----------
  await seed();
  await buy([{ productId:'n1', name:'کیک نازگل', qty:100, buyPrice:3.5, sellPrice:5, unit:'piece' }]);
  await page.waitForTimeout(600);
  const a1 = await page.evaluate(() => {
    const s = document.getElementById('sheet');
    return {
      open: document.getElementById('overlay').classList.contains('open'),
      text: s.textContent,
      inputs: s.querySelectorAll('[data-newsell]').length,
      buy: window.products[0].buy,
    };
  });
  console.log('\n۱) کیک نازگل: خرید ۳ → ۳.۵ (فروش ۵):');
  check('اخطار باز شد', a1.open, true);
  check('پیغام «فایده کم شد»', a1.text.includes('فایده کم شد'), true);
  check('پیغام ضرر نیست', a1.text.includes('در ضرر می‌فروشید'), false);
  check('یک جنس در فهرست', a1.inputs, 1);
  check('قیمت خرید تازه شد', a1.buy, 3.5);

  // نرخ فروش را همان‌جا ۶ کنیم
  await page.fill('[data-newsell="n1"]', '6');
  await page.waitForTimeout(150);
  const marginText = await page.evaluate(() =>
    document.querySelector('[data-newmargin="n1"]').textContent);
  check('فایدهٔ نو حساب شد (۶−۳.۵=۲.۵)', marginText.includes('2.5'), true);
  await page.click('#savePrices');
  await page.waitForTimeout(250);
  const afterFix = await page.evaluate(() => window.products[0].sell);
  check('نرخ فروش ذخیره شد', afterFix, 6);

  // ---------- ۲) ضرر واقعی ----------
  await seed();
  await buy([{ productId:'n1', name:'کیک نازگل', qty:100, buyPrice:5.2, sellPrice:5, unit:'piece' }]);
  await page.waitForTimeout(600);
  const a2 = await page.evaluate(() => ({
    text: document.getElementById('sheet').textContent,
    open: document.getElementById('overlay').classList.contains('open'),
  }));
  console.log('\n۲) خرید ۵.۲ ولی فروش ۵:');
  check('اخطار باز شد', a2.open, true);
  check('پیغام «در ضرر می‌فروشید»', a2.text.includes('در ضرر می‌فروشید'), true);
  await page.click('#sheet [data-close]');
  await page.waitForTimeout(200);
  const notChanged = await page.evaluate(() => window.products[0].sell);
  check('با «فعلاً نی» نرخ تغییر نکرد', notChanged, 5);

  // ---------- ۳) خرید معمولی → هیچ اخطاری نباید بیاید ----------
  await seed();
  await buy([{ productId:'n2', name:'کیک انار', qty:100, buyPrice:2.5, sellPrice:5, unit:'piece' }]);
  await page.waitForTimeout(600);
  const a3 = await page.evaluate(() => document.getElementById('overlay').classList.contains('open'));
  console.log('\n۳) خرید به همان قیمت (بدون تغییر فایده):');
  check('هیچ اخطاری نیامد', a3, false);

  // ---------- ۴) بالارفتن خورد (کمتر از ۱۰٪ فایده) → اخطار ندهد ----------
  await seed();
  // فایده ۲ بود؛ خرید ۳ → ۳.۱ یعنی فایده ۲ → ۱.۹ (۵٪ کم) — نباید اخطار بدهد
  await buy([{ productId:'n1', name:'کیک نازگل', qty:100, buyPrice:3.1, sellPrice:5, unit:'piece' }]);
  await page.waitForTimeout(600);
  const a4 = await page.evaluate(() => document.getElementById('overlay').classList.contains('open'));
  console.log('\n۴) بالارفتن خورد قیمت (۵٪ کم‌شدن فایده):');
  check('اخطار بی‌جا نداد', a4, false);

  // ---------- ۵) چند جنس یکجا، فقط مشکل‌دارها ----------
  await seed();
  await buy([
    { productId:'n1', name:'کیک نازگل', qty:100, buyPrice:4.5, sellPrice:5, unit:'piece' }, // فایده ۲→۰.۵
    { productId:'n2', name:'کیک انار', qty:100, buyPrice:2.5, sellPrice:5, unit:'piece' },  // بدون تغییر
  ]);
  await page.waitForTimeout(600);
  const a5 = await page.evaluate(() => {
    const s = document.getElementById('sheet');
    return { count: s.querySelectorAll('[data-newsell]').length, text: s.textContent };
  });
  console.log('\n۵) فاکتور دو قلمه — فقط مشکل‌دار نشان داده شود:');
  check('فقط یک جنس در اخطار', a5.count, 1);
  check('نازگل هست', a5.text.includes('کیک نازگل'), true);
  check('انار نیست', a5.text.includes('کیک انار'), false);

  // ---------- ۶) جنس نو (اولین خرید) → اخطار «فایده کم شد» ندهد ----------
  await seed();
  await page.evaluate(() => {
    const w = window;
    w.draft = { supplierName:'تامین', phone:'', date:new Date().toISOString().slice(0,10), paid:0,
      lines:[{ productId:'new1', name:'چیپس', qty:50, buyPrice:8, sellPrice:10, unit:'piece', isNew:true, type:'unit' }] };
    w.__savePurchase();
  });
  await page.waitForTimeout(600);
  const a6 = await page.evaluate(() => ({
    open: document.getElementById('overlay').classList.contains('open'),
    count: window.products.length,
  }));
  console.log('\n۶) جنس کاملاً نو در فاکتور:');
  check('اخطار بی‌جا نداد', a6.open, false);
  check('جنس ساخته شد', a6.count, 3);

  // ---------- ۷) جنس نو ولی خرید بالاتر از فروش → باید اخطار بدهد ----------
  await seed();
  await page.evaluate(() => {
    const w = window;
    w.draft = { supplierName:'تامین', phone:'', date:new Date().toISOString().slice(0,10), paid:0,
      lines:[{ productId:'new2', name:'شکلات', qty:50, buyPrice:12, sellPrice:10, unit:'piece', isNew:true, type:'unit' }] };
    w.__savePurchase();
  });
  await page.waitForTimeout(600);
  const a7 = await page.evaluate(() => ({
    open: document.getElementById('overlay').classList.contains('open'),
    text: document.getElementById('sheet').textContent,
  }));
  console.log('\n۷) جنس نو با خرید بالاتر از فروش:');
  check('اخطار داد', a7.open, true);
  check('پیغام ضرر', a7.text.includes('در ضرر می‌فروشید'), true);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
