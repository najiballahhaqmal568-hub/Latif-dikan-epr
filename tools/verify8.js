// آزمایش صفحهٔ بازبینی نرخ‌ها و تغییر نرخ گروهی با انتخاب
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

  const seed = () => page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments','custPayments','waste','expenses','stockCounts']
      .forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    // همه ۵ می‌فروشند ولی خریدشان فرق دارد — دقیقاً مثال کاربر
    w.products.push({ id:'n1', name:'کیک نازگل', type:'unit', unit:'piece', buy:3,   sell:5, qty:10, expiry:'' });
    w.products.push({ id:'n2', name:'کیک انار',  type:'unit', unit:'piece', buy:2.5, sell:5, qty:10, expiry:'' });
    w.products.push({ id:'n3', name:'صابون',     type:'unit', unit:'piece', buy:5.5, sell:5, qty:10, expiry:'' }); // در ضرر
    w.products.push({ id:'n4', name:'روغن',      type:'unit', unit:'piece', buy:4.8, sell:5, qty:10, expiry:'' }); // فایدهٔ خیلی کم (۴٪)
    w.__save0('dukan.products.v1', w.products);
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    w.moreView = 'margins'; w.__renderMore();
  });

  await seed();
  await page.waitForTimeout(250);

  // ---------- ۱) ترتیب: کم‌فایده‌ترین اول ----------
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('#moreArea .iline .in b')].map(b => b.textContent.replace(/\s*(در ضرر|فایدهٔ خیلی کم)\s*/,'').trim()));
  console.log('\n۱) ترتیب (کم‌فایده‌ترین اول):');
  console.log('   ' + order.join('  ←  '));
  check('صابون (ضرر) اول', order[0], 'صابون');
  check('روغن (۴٪) دوم', order[1], 'روغن');
  check('نازگل (۴۰٪) سوم', order[2], 'کیک نازگل');
  check('انار (۵۰٪) آخر', order[3], 'کیک انار');

  // ---------- ۲) نشان‌ها و اخطار ----------
  const marks = await page.evaluate(() => {
    const t = document.getElementById('moreArea').textContent;
    return { loss: t.includes('در ضرر'), thin: t.includes('فایدهٔ خیلی کم'),
             warn: t.includes('جنس در ضرر فروخته می‌شود') };
  });
  console.log('\n۲) نشان‌ها:');
  check('نشان «در ضرر»', marks.loss, true);
  check('نشان «فایدهٔ خیلی کم»', marks.thin, true);
  check('اخطار بالای صفحه', marks.warn, true);

  // ---------- ۳) فایدهٔ نشان‌داده‌شده درست است ----------
  const shown = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#moreArea .iline')];
    const find = n => rows.find(r => r.textContent.includes(n));
    const num = r => r.querySelector('.lt').textContent;
    return { soap: num(find('صابون')), nazgol: num(find('کیک نازگل')) };
  });
  console.log('\n۳) رقم فایده:');
  check('صابون: ۵ − ۵.۵ = −۰.۵', shown.soap.includes('-0.5'), true);
  check('نازگل: ۵ − ۳ = ۲ (۴۰٪)', shown.nazgol.includes('2') && shown.nazgol.includes('40'), true);

  // ---------- ۴) تغییر نرخ یک جنس ----------
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#moreArea .iline')];
    rows.find(r => r.textContent.includes('صابون')).querySelector('[data-medit]').click();
  });
  await page.waitForTimeout(250);
  await page.fill('#meSell', '7');
  await page.waitForTimeout(150);
  const meOut = await page.evaluate(() => document.getElementById('meOut').textContent);
  check('فایدهٔ نو نشان داده شد (۷−۵.۵=۱.۵)', meOut.includes('1.5'), true);
  await page.click('#meOk');
  await page.waitForTimeout(250);
  const soapSell = await page.evaluate(() => window.products.find(p => p.name === 'صابون').sell);
  console.log('\n۴) تغییر نرخ یک جنس:');
  check('نرخ صابون ذخیره شد', soapSell, 7);

  // ---------- ۵) تغییر گروهی — انتخاب نرخ ----------
  await seed();
  await page.waitForTimeout(200);
  await page.click('#groupPriceBtn');
  await page.waitForTimeout(250);
  const groups = await page.evaluate(() =>
    [...document.querySelectorAll('#grpPrices [data-gp]')].map(b => b.dataset.gp));
  console.log('\n۵) تغییر نرخ گروهی:');
  check('یک گروه نرخ (همه ۵)', groups.length, 1);
  check('گروه = ۵', groups[0], '5');

  // ---------- ۶) انتخاب جداگانه — انار نباید تغییر کند ----------
  await page.click('#grpPrices [data-gp="5"]');
  await page.waitForTimeout(250);
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-gpp]')].length);
  check('همهٔ ۴ جنس در فهرست', boxes, 4);
  const allChecked = await page.evaluate(() =>
    [...document.querySelectorAll('[data-gpp]')].every(c => c.checked));
  check('همه از اول تیک‌خورده', allChecked, true);

  // تیک انار را برمی‌داریم
  await page.evaluate(() => {
    const w = window;
    const anar = w.products.find(p => p.name === 'کیک انار');
    document.querySelector('[data-gpp="' + anar.id + '"]').checked = false;
  });
  await page.fill('#gpNew', '6');
  await page.click('#gpApply');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const g = n => window.products.find(p => p.name === n).sell;
    return { nazgol: g('کیک نازگل'), anar: g('کیک انار'), soap: g('صابون'), oil: g('روغن') };
  });
  console.log('\n۶) بعد از تغییر گروهی (انار تیک نداشت):');
  check('نازگل ۶ شد', after.nazgol, 6);
  check('انار ۵ ماند ✓', after.anar, 5);
  check('صابون ۶ شد', after.soap, 6);
  check('روغن ۶ شد', after.oil, 6);

  // ---------- ۷) بدون نرخ نو → تغییر نکند ----------
  await seed();
  await page.waitForTimeout(200);
  await page.click('#groupPriceBtn');
  await page.waitForTimeout(200);
  await page.click('#grpPrices [data-gp="5"]');
  await page.waitForTimeout(200);
  await page.click('#gpApply');
  await page.waitForTimeout(200);
  const noChange = await page.evaluate(() => window.products.find(p => p.name === 'کیک نازگل').sell);
  console.log('\n۷) بدون نوشتن نرخ نو:');
  check('هیچ نرخی تغییر نکرد', noChange, 5);

  // ---------- ۸) فروش‌های گذشته دست‌نخورده ----------
  const past = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart('n1', 2);          // فروش به نرخ ۵
    w.__finishSale('cash', null);
    const beforeProfit = w.__computeReport('all').profit;
    // حالا نرخ را ۶ می‌کنیم
    w.products.find(p => p.id === 'n1').sell = 6;
    w.__save0('dukan.products.v1', w.products);
    return { beforeProfit, afterProfit: w.__computeReport('all').profit,
             saleTotal: w.sales[0].total };
  });
  console.log('\n۸) تغییر نرخ نباید گذشته را خراب کند:');
  check('فروش ثبت‌شده ۱۰ ماند', past.saleTotal, 10);
  check('فایدهٔ گذشته تغییر نکرد', past.afterProfit, past.beforeProfit);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
