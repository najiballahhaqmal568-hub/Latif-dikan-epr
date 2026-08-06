// آزمایش «فروش بازار» — کانال جدا از فروش دوکان
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
    w.products.push({ id:'su', name:'بوره', type:'unit', unit:'piece', buy:40, sell:50, qty:100, expiry:'' });
    w.products.push({ id:'eg', name:'تخم مرغ', type:'unit', unit:'piece', buy:5, sell:15, qty:200, expiry:'' });
    w.cashEntries.push({ id:'op', date:'2026-01-01T00:00:00.000Z', kind:'opening', amount:2000 });
    w.__save0('dukan.products.v1', w.products);
    w.__save0('dukan.cash.v1', w.cashEntries);
    w.__invalidateDebts();
  });
}

async function bazaarSale(page, prodId, qty, price) {
  await page.evaluate(() => window.__openBazaarSale());
  await page.waitForTimeout(250);
  await page.click('#bPick');
  await page.waitForTimeout(200);
  await page.click('[data-bp="' + prodId + '"]');
  await page.waitForTimeout(250);
  await page.fill('#bQty', String(qty));
  await page.fill('#bPrice', String(price));
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ================= ۱) فروش بازار ثبت شود =================
  console.log('\n۱) ۱۰۰ تخم مرغ به ۱۵ در بازار (خرید ۵):');
  await reset(page);
  await bazaarSale(page, 'eg', 100, 15);
  let live = await page.evaluate(() => document.getElementById('bOut').textContent);
  check('فایدهٔ زندهٔ ۱٬۰۰۰ نشان داده شد', live.indexOf('1,000') >= 0, true);
  check('قیمت خرید ۵ نشان داده شد', live.indexOf('5 ') >= 0, true);
  await page.click('#bOk');
  await page.waitForTimeout(400);

  let r = await page.evaluate(() => {
    const w = window;
    const s = w.sales[0];
    return { sales: w.sales.length, channel: s.channel, total: s.total,
             pay: s.paymentType, qty: w.__findP('eg').qty,
             buySnap: s.items[0].buyPrice, sellSnap: s.items[0].sellPrice,
             cash: w.__cashBalance() };
  });
  check('یک فروش ثبت شد', r.sales, 1);
  check('کانالش «بازار»', r.channel, 'bazaar');
  check('مجموعش ۱٬۵۰۰', r.total, 1500);
  check('نقد است', r.pay, 'cash');
  check('موجودی ۱۰۰ ماند', r.qty, 100);
  check('قیمت خرید عکس گرفته شد (۵)', r.buySnap, 5);
  check('نرخ بازار عکس گرفته شد (۱۵)', r.sellSnap, 15);
  check('پول در صندوق آمد ۳٬۵۰۰', r.cash, 3500);

  // ================= ۲) گزارش: جدا شمرده شود =================
  console.log('\n۲) گزارش پس از فروش بازار تنها:');
  r = await page.evaluate(() => window.__computeReport('all'));
  check('مجموع فروش ۱٬۵۰۰', r.totalSales, 1500);
  check('فروش بازار ۱٬۵۰۰', r.bazaarSales, 1500);
  check('فروش دوکان صفر', r.shopSales, 0);
  check('فایدهٔ بازار ۱٬۰۰۰', r.bazaarProfit, 1000);
  check('فایدهٔ دوکان صفر', r.shopProfit, 0);
  check('فایدهٔ کل ۱٬۰۰۰', r.profit, 1000);

  // ================= ۳) فروش دوکان + بازار با هم =================
  console.log('\n۳) بعلاوهٔ ۱۰ بوره در دوکان (خرید ۴۰ فروش ۵۰):');
  await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart('su', 10);
    w.__finishSale('cash', null);
  });
  await page.waitForTimeout(250);
  r = await page.evaluate(() => window.__computeReport('all'));
  check('مجموع فروش ۲٬۰۰۰', r.totalSales, 2000);
  check('فروش دوکان ۵۰۰', r.shopSales, 500);
  check('فروش بازار ۱٬۵۰۰', r.bazaarSales, 1500);
  check('فایدهٔ دوکان ۱۰۰', r.shopProfit, 100);
  check('فایدهٔ بازار ۱٬۰۰۰', r.bazaarProfit, 1000);
  check('جمع دو کانال = فایدهٔ کل', r.shopProfit + r.bazaarProfit, r.profit);
  check('جمع دو کانال = مجموع فروش', r.shopSales + r.bazaarSales, r.totalSales);

  // ================= ۴) ضایعات فقط از فایدهٔ کل کم شود =================
  console.log('\n۴) ۵ بوره ضایعات (۵ × ۴۰ = ۲۰۰):');
  await page.evaluate(() => {
    const w = window;
    w.waste.push({ id:'w1', date:new Date().toISOString(), productId:'su', productName:'بوره',
      quantity:5, buyPrice:40, reason:'damaged' });
    w.__save0('dukan.waste.v1', w.waste);
  });
  r = await page.evaluate(() => window.__computeReport('all'));
  check('فایدهٔ کل ۹۰۰ شد', r.profit, 900);
  check('فایدهٔ دوکان دست‌نخورده ۱۰۰', r.shopProfit, 100);
  check('فایدهٔ بازار دست‌نخورده ۱٬۰۰۰', r.bazaarProfit, 1000);

  // ================= ۵) برگشتی همان کانال را بگیرد =================
  console.log('\n۵) برگشتی فروش بازار:');
  await reset(page);
  await bazaarSale(page, 'eg', 100, 15);
  await page.click('#bOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => {
    const w = window;
    w.__returnSale(w.sales[0]);
    const rep = w.__computeReport('all');
    return { salesCount: w.sales.length, retChannel: w.sales[1].channel,
             bazaar: rep.bazaarSales, shop: rep.shopSales, total: rep.totalSales,
             bazaarProfit: rep.bazaarProfit, qty: w.__findP('eg').qty,
             cash: w.__cashBalance() };
  });
  check('دو رکورد (فروش + برگشتی)', r.salesCount, 2);
  check('برگشتی هم کانال بازار', r.retChannel, 'bazaar');
  check('فروش بازار صفر شد', r.bazaar, 0);
  check('به فروش دوکان نچسبید', r.shop, 0);
  check('فایدهٔ بازار صفر شد', r.bazaarProfit, 0);
  check('موجودی پس آمد ۲۰۰', r.qty, 200);
  check('پول از صندوق پس رفت', r.cash, 2000);

  // ================= ۶) فروش کهنه (بدون channel) دوکان بماند =================
  console.log('\n۶) فروش کهنه بدون channel:');
  await reset(page);
  r = await page.evaluate(() => {
    const w = window;
    // رکورد کهنه — هیچ channel ندارد
    w.sales.push({ id:'old', date:new Date().toISOString(), total:500, paymentType:'cash',
      items:[{ productId:'su', productName:'بوره', quantity:10, sellPrice:50, buyPrice:40 }] });
    const rep = w.__computeReport('all');
    return { ch: w.__saleChannel(w.sales[0]), shop: rep.shopSales, bazaar: rep.bazaarSales,
             shopProfit: rep.shopProfit };
  });
  check('کانالش «دوکان» حساب شد', r.ch, 'shop');
  check('در فروش دوکان آمد', r.shop, 500);
  check('در فروش بازار نیامد', r.bazaar, 0);
  check('فایده‌اش هم دوکان', r.shopProfit, 100);

  // ================= ۷) اخطار موجودی کم =================
  console.log('\n۷) فروش بیشتر از موجودی:');
  await reset(page);
  await bazaarSale(page, 'eg', 300, 15); // موجود ۲۰۰
  r = await page.evaluate(() => document.getElementById('bOut').textContent);
  check('اخطار موجودی داده شد', r.indexOf('موجودی فقط') >= 0, true);

  // ================= ۸) ضرر در بازار =================
  console.log('\n۸) فروش بازار پایین‌تر از قیمت خرید:');
  await reset(page);
  await bazaarSale(page, 'eg', 100, 3); // خرید ۵
  r = await page.evaluate(() => document.getElementById('bOut').textContent);
  check('«ضرر این معامله» نشان داد', r.indexOf('ضرر این معامله') >= 0, true);
  await page.click('#bOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => window.__computeReport('all'));
  check('فایدهٔ بازار ۲۰۰− شد', r.bazaarProfit, -200);
  check('فایدهٔ کل هم ۲۰۰−', r.profit, -200);

  // ================= ۹) صفحهٔ فروش بازار =================
  console.log('\n۹) صفحهٔ «فروش بازار»:');
  await reset(page);
  await bazaarSale(page, 'eg', 100, 15);
  await page.click('#bOk');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    window.moreView = 'bazaar';
    window.__renderMore();
  });
  await page.waitForTimeout(350);
  r = await page.evaluate(() => document.getElementById('moreArea').textContent);
  check('عنوان صفحه', r.indexOf('فروش بازار') >= 0, true);
  check('مجموع فروش بازار آمد', r.indexOf('1,500') >= 0, true);
  check('فایدهٔ فروش بازار آمد', r.indexOf('1,000') >= 0, true);
  check('نام جنس در فهرست', r.indexOf('تخم مرغ') >= 0, true);

  // منوی «بیشتر» قلم فروش بازار داشته باشد
  await page.evaluate(() => { window.moreView = null; window.__renderMore(); });
  await page.waitForTimeout(250);
  r = await page.evaluate(() => !!document.querySelector('[data-more="bazaar"]'));
  check('قلم منو در «بیشتر» هست', r, true);

  // ================= ۱۰) فروش‌های امروز نشان بازار بدهد =================
  console.log('\n۱۰) فهرست فروش‌های امروز:');
  await page.evaluate(() => window.__openTodaySales());
  await page.waitForTimeout(300);
  r = await page.evaluate(() => document.getElementById('sheet').textContent);
  check('نشان «بازار» در فهرست', r.indexOf('بازار') >= 0, true);

  // ================= ۱۱) چرخهٔ کامل: به جنس → بازار =================
  console.log('\n۱۱) چرخهٔ کامل (قرض → به جنس → فروش بازار):');
  await reset(page);
  r = await page.evaluate(() => {
    const w = window;
    w.customers.push({ id:'c1', name:'احمد', phone:'', opening:500 });
    w.__invalidateDebts();
    // ۱۰۰ تخم مرغ به ۵ به‌جای پول
    w.products.filter(p => p.id === 'eg')[0].qty = 0;
    w.custPayments.push({ id:'g1', customerId:'c1', date:new Date().toISOString(), amount:500,
      kind:'goods', productId:'eg', productName:'تخم مرغ', unit:'piece', qty:100, unitPrice:5 });
    w.products.filter(p => p.id === 'eg')[0].qty = 100;
    w.__invalidateDebts();
    const rep = w.__computeReport('all');
    return { debt: w.__custDebt(w.customers[0]), cash: w.__cashBalance(),
             profit: rep.profit, bazaar: rep.bazaarSales };
  });
  check('قرضش صفر', r.debt, 0);
  check('صندوق دست‌نخورده ۲٬۰۰۰', r.cash, 2000);
  check('هنوز فایده‌ای نیست', r.profit, 0);
  check('هنوز فروش بازاری نیست', r.bazaar, 0);

  await bazaarSale(page, 'eg', 100, 15);
  await page.click('#bOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => {
    const rep = window.__computeReport('all');
    return { bazaar: rep.bazaarSales, bazaarProfit: rep.bazaarProfit, shop: rep.shopSales,
             profit: rep.profit, cash: window.__cashBalance(), qty: window.__findP('eg').qty };
  });
  check('فروش بازار ۱٬۵۰۰', r.bazaar, 1500);
  check('فایدهٔ بازار ۱٬۰۰۰', r.bazaarProfit, 1000);
  check('فروش دوکان صفر ماند', r.shop, 0);
  check('فایدهٔ کل ۱٬۰۰۰', r.profit, 1000);
  check('صندوق ۳٬۵۰۰ شد', r.cash, 3500);
  check('تخم مرغ تمام شد', r.qty, 0);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
