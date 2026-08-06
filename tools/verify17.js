// آزمایش سه مورد آخر: فروش بازار قرضی، سنک عکس‌ها، جستجوی دفتر قرض
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
async function reset(page, custCount) {
  await page.evaluate((n) => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments','custPayments','waste','expenses','stockCounts','cashEntries']
      .forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    w.products.push({ id:'eg', name:'تخم مرغ', type:'unit', unit:'piece', buy:5, sell:15, qty:200, expiry:'' });
    w.cashEntries.push({ id:'op', date:'2026-01-01T00:00:00.000Z', kind:'opening', amount:10000 });
    const names = ['احمد','محمود','کریم','نجیب','لطیف','رحیم','سلیم','وحید','قاسم','بشیر'];
    for (let i = 0; i < (n || 0); i++) w.customers.push({ id:'c'+i, name:names[i], phone:'', opening: 100*(i+1) });
    w.__invalidateDebts();
    document.getElementById('overlay').classList.remove('open');
  }, custCount);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ================= ۱) فروش بازار قرضی =================
  console.log('\n۱) فروش بازار قرضی (۱۰۰ × ۱۵ به کریم):');
  await reset(page, 0);
  await page.evaluate(() => window.__openBazaarSale());
  await page.waitForTimeout(250);
  await page.click('#bPick'); await page.waitForTimeout(200);
  await page.click('[data-bp="eg"]'); await page.waitForTimeout(250);
  await page.fill('#bQty', '100');
  await page.fill('#bPrice', '15');
  await page.waitForTimeout(150);
  let r = await page.evaluate(() => ({ hasPay: !!document.getElementById('bPay'),
                                       btn: document.getElementById('bOk').textContent }));
  check('انتخاب نقد/قرض هست', r.hasPay, true);
  check('دکمه «نقد» است', r.btn.indexOf('نقد') >= 0, true);

  await page.click('#bPay [data-b="credit"]');
  await page.waitForTimeout(250);
  r = await page.evaluate(() => ({
    qty: document.getElementById('bQty').value,
    price: document.getElementById('bPrice').value,
    hasCust: !!document.getElementById('bCust'),
    btn: document.getElementById('bOk').textContent,
    out: document.getElementById('bOut').textContent,
  }));
  check('مقدار تایپ‌شده گم نشد', r.qty, '100');
  check('نرخ تایپ‌شده گم نشد', r.price, '15');
  check('خانهٔ نام خریدار آمد', r.hasCust, true);
  check('دکمه «قرض» شد', r.btn.indexOf('قرض') >= 0, true);
  check('فایده هنوز درست ۱٬۰۰۰', r.out.indexOf('1,000') >= 0, true);

  // بدون نام ثبت نشود
  await page.click('#bOk');
  await page.waitForTimeout(250);
  r = await page.evaluate(() => ({ sales: window.sales.length,
    errShown: document.getElementById('eBCust').classList.contains('show') }));
  check('بدون نام ثبت نشد', r.sales, 0);
  check('پیام خطا نشان داده شد', r.errShown, true);

  await page.fill('#bCust', 'کریم');
  await page.click('#bOk');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => {
    const w = window, s = w.sales[0], rep = w.__computeReport('all');
    return { sales: w.sales.length, pay: s.paymentType, ch: s.channel, name: s.customerName,
             debt: w.__custDebt(w.customers[0]), cash: w.__cashBalance(),
             bazaar: rep.bazaarSales, bazaarProfit: rep.bazaarProfit,
             credit: rep.credit, qty: w.__findP('eg').qty };
  });
  console.log('   بعد از ثبت:');
  check('فروش ثبت شد', r.sales, 1);
  check('نوعش قرض', r.pay, 'credit');
  check('کانالش بازار', r.ch, 'bazaar');
  check('نام خریدار ماند', r.name, 'کریم');
  check('مشتری ساخته شد و قرضش ۱٬۵۰۰', r.debt, 1500);
  check('صندوق دست‌نخورده (پول نگرفت)', r.cash, 10000);
  check('در فروش بازار آمد', r.bazaar, 1500);
  check('فایدهٔ بازار ۱٬۰۰۰', r.bazaarProfit, 1000);
  check('در «فروش قرض» گزارش آمد', r.credit, 1500);
  check('موجودی کم شد', r.qty, 100);

  // دریافت پول از او صندوق را زیاد کند
  r = await page.evaluate(() => {
    const w = window;
    w.custPayments.push({ id:'cp', customerId: w.customers[0].id, date:new Date().toISOString(), amount:1500 });
    w.__invalidateDebts();
    return { debt: w.__custDebt(w.customers[0]), cash: w.__cashBalance() };
  });
  check('بعد از دریافت، قرضش صفر', r.debt, 0);
  check('پول در صندوق آمد', r.cash, 11500);

  // فروش بازار نقدی هنوز درست کار کند
  await reset(page, 0);
  await page.evaluate(() => window.__openBazaarSale());
  await page.waitForTimeout(250);
  await page.click('#bPick'); await page.waitForTimeout(200);
  await page.click('[data-bp="eg"]'); await page.waitForTimeout(250);
  await page.fill('#bQty', '50'); await page.fill('#bPrice', '15');
  await page.waitForTimeout(150);
  await page.click('#bOk');
  await page.waitForTimeout(400);
  r = await page.evaluate(() => ({
    pay: window.sales[0].paymentType, cash: window.__cashBalance(),
    customers: window.customers.length,
  }));
  console.log('   فروش بازار نقدی:');
  check('نوعش نقد', r.pay, 'cash');
  check('پول در صندوق آمد', r.cash, 10750);
  check('مشتری‌ای ساخته نشد', r.customers, 0);

  // ================= ۲) سنک عکس‌ها =================
  console.log('\n۲) سنک عکس‌ها (سند جدا):');
  r = await page.evaluate(() => {
    const cfg = { shop: 'dukan-abc123' };
    return { key: window.__photosShop(cfg) };
  });
  check('کلید سند عکس‌ها جدا است', r.key, 'dukan-abc123__photos');

  // عکس‌ها نباید در سند اصلی باشند
  r = await page.evaluate(() => {
    const d = window.__collectData();
    return Object.prototype.hasOwnProperty.call(d, 'photos');
  });
  check('سند اصلی هنوز عکس ندارد (سبک می‌ماند)', r, false);

  // فرستادن و گرفتن با سرور ساختگی
  r = await page.evaluate(async () => {
    const w = window;
    // تنظیمات سنک ساختگی
    localStorage.setItem('dukan.sync.enabled', '1');
    localStorage.setItem('dukan.sync.role', 'owner');
    localStorage.setItem('dukan.sync.shop', 'dukan-test');
    localStorage.setItem('dukan.sync.url', 'https://fake.local');
    localStorage.setItem('dukan.sync.key', 'k');
    const store = {};
    const calls = [];
    window.fetch = function (url, opt) {
      calls.push({ url: String(url), method: (opt && opt.method) || 'GET' });
      if (opt && opt.method === 'POST') {
        JSON.parse(opt.body).forEach(row => { store[row.shop] = row; });
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      const m = /shop=eq\.([^&]+)/.exec(String(url));
      const key = m ? decodeURIComponent(m[1]) : '';
      const row = store[key];
      return Promise.resolve({ ok: true, json: () => Promise.resolve(row ? [row] : []) });
    };
    await w.__photoSave('eg', 'data:image/jpeg;base64,AAA');
    await w.__syncPushPhotos();
    const pushedTo = Object.keys(store);
    // حالا کش محلی پاک شود و از سرور گرفته شود
    await w.__photoClear();
    const emptyNow = w.__photoCount();
    w.__SYNCPHOTOTS = 0;
    await w.__syncPullPhotos(true);
    await new Promise(r => setTimeout(r, 300));
    return { pushedTo: pushedTo, emptyNow: emptyNow, back: w.__photoCount(),
             val: w.__photoOf({ id: 'eg' }),
             mainUntouched: !store['dukan-test'] };
  });
  check('فقط به سند عکس‌ها فرستاده شد', r.pushedTo.join(','), 'dukan-test__photos');
  check('سند اصلی دست‌نخورده ماند', r.mainUntouched, true);
  check('کش پاک شده بود', r.emptyNow, 0);
  check('عکس از سرور برگشت', r.back, 1);
  check('محتوایش درست', r.val, 'data:image/jpeg;base64,AAA');

  // ================= ۳) جستجوی دفتر قرض =================
  console.log('\n۳) جستجو در قرض‌ها:');
  await page.evaluate(() => { window.fetch = null; localStorage.setItem('dukan.sync.enabled', '0'); });
  await reset(page, 3);
  await page.evaluate(() => {
    document.querySelector('nav.tabs button[data-scr="debts"]').click();
    window.__renderDebts();
  });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => document.getElementById('debtSearchBar').style.display);
  check('با ۳ مشتری نوار جستجو پنهان است', r, 'none');

  await reset(page, 10);
  await page.evaluate(() => { document.querySelector('nav.tabs button[data-scr="debts"]').click();
                              window.__renderDebts(); });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    bar: document.getElementById('debtSearchBar').style.display,
    rows: document.querySelectorAll('#customerList .prow').length,
  }));
  check('با ۱۰ مشتری نوار جستجو آمد', r.bar !== 'none', true);
  check('همهٔ ۱۰ مشتری', r.rows, 10);

  await page.fill('#debtSearch', 'کریم');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('#customerList .prow .info b')].map(b => b.textContent),
    clr: document.getElementById('debtSearchClr').style.display,
    focused: document.activeElement && document.activeElement.id,
  }));
  check('فقط کریم ماند', r.rows.join(','), 'کریم');
  check('دکمهٔ پاک آمد', r.clr, 'block');
  check('انگشت از خانهٔ جستجو نپرید', r.focused, 'debtSearch');

  // نام بی‌ربط
  await page.fill('#debtSearch', 'زززز');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => document.getElementById('customerList').textContent);
  check('پیام «پیدا نشد»', r.indexOf('پیدا نشد') >= 0, true);

  // پاک‌کردن
  await page.click('#debtSearchClr');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    rows: document.querySelectorAll('#customerList .prow').length,
    val: document.getElementById('debtSearch').value,
  }));
  check('همه برگشتند', r.rows, 10);
  check('خانه خالی شد', r.val, '');

  // جستجو در تامین‌کننده‌ها هم کار کند
  await page.evaluate(() => {
    const w = window;
    const names = ['کریم','رحیم','سلیم','وحید','قاسم','بشیر','نجیب','لطیف'];
    names.forEach((n, i) => w.suppliers.push({ id:'s'+i, name:n, phone:'', opening:100 }));
    w.__invalidateDebts();
    w.debtView = 'suppliers';
  });
  await page.evaluate(() => {
    document.querySelector('#debtToggle [data-d="suppliers"]').click();
  });
  await page.waitForTimeout(300);
  await page.fill('#debtSearch', 'رحیم');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => [...document.querySelectorAll('#supplierList .prow .info b')].map(b => b.textContent));
  check('تامین‌کننده هم فلتر شد', r.join(','), 'رحیم');

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
