// آزمایش نوار نرخ در فروش و نرخ‌های آمادهٔ فورم جنس
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

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
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
    const add = (id,n,buy,sell) => w.products.push({ id, name:n, type:'unit', unit:'piece', buy, sell, qty:20, expiry:'' });
    add('a1','کیک نازگل',3,5); add('a2','کیک انار',2.5,5); add('a3','آدامس',0.6,1);
    add('a4','بسکیت',7,10); add('a5','شامپو',14,20); add('a6','صابون',3.6,5);
    w.__save0('dukan.products.v1', w.products);
    document.querySelector('nav.tabs button[data-scr="sales"]').click();
    w.__renderSaleGrid();
  });
  await page.waitForTimeout(250);

  // ---------- ۱) نوار نرخ خودکار ساخته شود ----------
  const bar = await page.evaluate(() =>
    [...document.querySelectorAll('#priceBar button')].map(b => b.textContent));
  console.log('\n۱) نوار نرخ‌ها:');
  console.log('   ' + bar.join('  '));
  check('اولی «همه»', bar[0], 'همه');
  check('نرخ‌ها به ترتیب: ۱،۵،۱۰،۲۰', bar.slice(1).join(','), '1,5,10,20');

  // ---------- ۲) فلتر کار کند ----------
  await page.click('#priceBar [data-pf="5"]');
  await page.waitForTimeout(250);
  const filtered = await page.evaluate(() =>
    [...document.querySelectorAll('#saleGrid .tile .nm')].map(n => n.textContent));
  console.log('\n۲) زدن دکمهٔ ۵:');
  console.log('   ' + filtered.join('، '));
  check('۳ جنس ۵ افغانی', filtered.length, 3);
  check('نازگل هست', filtered.includes('کیک نازگل'), true);
  check('انار هست', filtered.includes('کیک انار'), true);
  check('صابون هست', filtered.includes('صابون'), true);
  check('بسکیت نیست', filtered.includes('بسکیت'), false);

  // ---------- ۳) «همه» برگردد ----------
  await page.click('#priceBar [data-pf="all"]');
  await page.waitForTimeout(250);
  const allBack = await page.evaluate(() => document.querySelectorAll('#saleGrid .tile').length);
  console.log('\n۳) برگشت به «همه»:');
  check('همهٔ ۶ جنس', allBack, 6);

  // ---------- ۴) فلتر با جستجو یکجا کار کند ----------
  await page.click('#priceBar [data-pf="5"]');
  await page.fill('#search', 'کیک');
  await page.waitForTimeout(250);
  const both = await page.evaluate(() =>
    [...document.querySelectorAll('#saleGrid .tile .nm')].map(n => n.textContent));
  console.log('\n۴) نرخ ۵ + جستجوی «کیک»:');
  check('فقط دو کیک', both.length, 2);
  check('صابون فلتر شد', both.includes('صابون'), false);
  await page.fill('#search', '');
  await page.click('#priceBar [data-pf="all"]');
  await page.waitForTimeout(200);

  // ---------- ۵) فروش با فلتر روشن درست ثبت شود ----------
  const saleOk = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart('a1', 2);
    w.__finishSale('cash', null);
    const r = w.__computeReport('all');
    return { total: r.totalSales, profit: r.profit, qty: w.products[0].qty };
  });
  console.log('\n۵) فروش (۲ × ۵):');
  check('مجموع فروش', saleOk.total, 10);
  check('فایده (۲ × ۲)', saleOk.profit, 4);
  check('موجودی کم شد', saleOk.qty, 18);

  // ---------- ۶) نرخ‌های آمادهٔ فورم جنس ----------
  await page.evaluate(() => {
    document.querySelector('nav.tabs button[data-scr="products"]').click();
    document.getElementById('btnAdd').click();
  });
  await page.waitForTimeout(250);
  const presets = await page.evaluate(() =>
    [...document.querySelectorAll('#sellPresets [data-sp]')].map(b => parseFloat(b.dataset.sp)));
  console.log('\n۶) نرخ‌های آماده در فورم جنس:');
  console.log('   ' + presets.join('، '));
  check('حداکثر ۸ دکمه', presets.length <= 8, true);
  check('نرخ‌های خود دوکان هست (۵)', presets.includes(5), true);
  check('نرخ‌های خود دوکان هست (۲۰)', presets.includes(20), true);
  check('مرتب‌شده', JSON.stringify(presets) === JSON.stringify([...presets].sort((a,b)=>a-b)), true);

  // ---------- ۷) زدن دکمهٔ نرخ + نشان‌دادن فایده ----------
  await page.fill('#fBuy', '3');
  await page.click('#sellPresets [data-sp="5"]');
  await page.waitForTimeout(200);
  const marginShown = await page.evaluate(() => ({
    sell: document.getElementById('fSell').value,
    margin: document.getElementById('fMargin').textContent,
  }));
  console.log('\n۷) زدن دکمهٔ ۵ با خرید ۳:');
  check('نرخ فروش ۵ شد', parseFloat(marginShown.sell), 5);
  check('فایده ۲ (۴۰٪) نشان داده شد', marginShown.margin.includes('2') && marginShown.margin.includes('40'), true);

  // ---------- ۸) اخطار ضرر در خود فورم ----------
  await page.fill('#fBuy', '6');
  await page.waitForTimeout(200);
  const lossWarn = await page.evaluate(() => document.getElementById('fMargin').textContent);
  console.log('\n۸) خرید ۶ و فروش ۵:');
  check('اخطار «در ضرر!»', lossWarn.includes('در ضرر'), true);

  // ---------- ۹) حسابگر کارتن فایده را هم تازه کند ----------
  await page.click('#cartonToggle');
  await page.fill('#cPrice', '250');
  await page.fill('#cCount', '100');
  await page.waitForTimeout(200);
  const afterCarton = await page.evaluate(() => ({
    buy: document.getElementById('fBuy').value,
    margin: document.getElementById('fMargin').textContent,
  }));
  console.log('\n۹) کارتن ۲۵۰ ÷ ۱۰۰ = ۲.۵ (فروش ۵):');
  check('قیمت خرید ۲.۵', parseFloat(afterCarton.buy), 2.5);
  check('فایده ۲.۵ (۵۰٪)', afterCarton.margin.includes('2.5') && afterCarton.margin.includes('50'), true);
  check('دیگر اخطار ضرر نیست', afterCarton.margin.includes('در ضرر'), false);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
