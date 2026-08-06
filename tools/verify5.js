// آزمایش «شروع نو» و بک‌آپ
const { chromium } = require('playwright');
const { CHROME } = require('./browser');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'test-index.html');

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = (typeof actual === 'number' && typeof expected === 'number')
    ? Math.abs(actual - expected) < 0.01 : actual === expected;
  console.log((ok ? '  ✅' : '  ❌') + ' ' + name + '  → got ' + actual + ', expected ' + expected);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ---------- ۱) اپ در آغاز نمونه‌های آزمایشی می‌سازد ----------
  const seeded = await page.evaluate(() => window.products.length);
  console.log('\n۱) وضعیت آغازین:');
  console.log('   نمونه‌های آزمایشی: ' + seeded + ' جنس');
  check('نمونه‌ها ساخته شدند', seeded > 0, true);

  // دیتای آزمایشی بسازیم
  await page.evaluate(() => {
    const w = window;
    w.cart.length = 0;
    w.__addToCart(w.products[0].id, 1);
    w.__finishSale('credit', 'احمد آزمایشی');
    w.expenses.push({ id:'e1', date:new Date().toISOString(), amount:100, note:'آزمایشی' });
    w.__save0('dukan.expenses.v1', w.expenses);
  });
  const before = await page.evaluate(() => ({
    products: window.products.length, sales: window.sales.length,
    customers: window.customers.length, expenses: window.expenses.length,
  }));
  console.log('   پیش از پاک‌کردن: ' + JSON.stringify(before));

  // ---------- ۲) بک‌آپ ----------
  await page.evaluate(() => {
    window.moreView = 'sync';
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    window.moreView = 'sync';
    window.__renderMore();
  });
  await page.waitForTimeout(200);
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.click('#dlBackup');
  const download = await dl;
  console.log('\n۲) فایل بک‌آپ:');
  check('فایل دانلود شد', !!download, true);
  if (download) {
    const name = download.suggestedFilename();
    console.log('   نام فایل: ' + name);
    check('نام فایل درست است', /^dukan-latif-\d{4}-\d{1,2}-\d{1,2}\.json$/.test(name), true);
    const p = await download.path();
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    check('بک‌آپ اجناس دارد', j.products.length, before.products);
    check('بک‌آپ فروش‌ها دارد', j.sales.length, before.sales);
    check('بک‌آپ تاریخ دارد', !!j.__backupDate, true);
  }

  // ---------- ۳) کلمهٔ تأیید غلط → پاک نشود ----------
  await page.fill('#wipeWord', 'چیز دیگر');
  await page.click('#wipeBtn');
  await page.waitForTimeout(200);
  const afterWrongWord = await page.evaluate(() => window.products.length);
  console.log('\n۳) محافظت:');
  check('با کلمهٔ غلط پاک نشد', afterWrongWord, before.products);
  const sheetOpen = await page.evaluate(() => document.getElementById('overlay').classList.contains('open'));
  check('دیالوگ تأیید باز نشد', sheetOpen, false);

  // ---------- ۴) کلمهٔ درست → دیالوگ باز شود، لغو کار کند ----------
  await page.fill('#wipeWord', 'پاک');
  await page.click('#wipeBtn');
  await page.waitForTimeout(200);
  const dialogOpen = await page.evaluate(() => document.getElementById('overlay').classList.contains('open'));
  check('با کلمهٔ درست دیالوگ باز شد', dialogOpen, true);
  await page.click('#sheet [data-close]');
  await page.waitForTimeout(200);
  const afterCancel = await page.evaluate(() => window.products.length);
  check('بعد از لغو، دیتا سالم است', afterCancel, before.products);

  // ---------- ۵) تأیید نهایی → همه پاک شود ----------
  await page.fill('#wipeWord', 'پاک');
  await page.click('#wipeBtn');
  await page.waitForTimeout(200);
  await page.click('#wipeOk');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    products: window.products.length, sales: window.sales.length,
    customers: window.customers.length, expenses: window.expenses.length,
    purchases: window.purchases.length, waste: window.waste.length,
    stockCounts: window.stockCounts.length, cart: window.cart.length,
  }));
  console.log('\n۴) بعد از پاک‌کردن:');
  check('اجناس صفر', after.products, 0);
  check('فروش‌ها صفر', after.sales, 0);
  check('مشتری‌ها صفر', after.customers, 0);
  check('مصارف صفر', after.expenses, 0);
  check('فاکتورها صفر', after.purchases, 0);
  check('ضایعات صفر', after.waste, 0);
  check('شمارش‌ها صفر', after.stockCounts, 0);
  check('سبد خالی', after.cart, 0);

  // ---------- ۶) بعد از refresh، نمونه‌های آزمایشی پس نیایند ----------
  await page.reload();
  await page.waitForTimeout(300);
  const afterReload = await page.evaluate(() => ({
    products: window.products.length,
    sales: window.sales.length,
    err: null,
  }));
  console.log('\n۵) بعد از باز کردن دوبارهٔ اپ:');
  check('نمونه‌های آزمایشی پس نیامدند', afterReload.products, 0);
  check('فروش‌ها هنوز صفر', afterReload.sales, 0);

  // ---------- ۷) گزارش‌ها بعد از پاک‌کردن نمی‌شکنند ----------
  const rep = await page.evaluate(() => {
    const r = window.__computeReport('all');
    return { sales: r.totalSales, profit: r.profit, cashBox: r.cashBox,
             custTotal: window.__custDebtTotal(), supTotal: window.__supDebtTotal() };
  });
  console.log('\n۶) گزارش‌ها با دیتای خالی:');
  check('مجموع فروش صفر', rep.sales, 0);
  check('فایده صفر', rep.profit, 0);
  check('صندوق نقد صفر', rep.cashBox, 0);
  check('قرض مشتری صفر', rep.custTotal, 0);
  check('قرض تامین‌کننده صفر', rep.supTotal, 0);

  // ---------- ۸) بعد از پاک‌کردن، وارد کردن دیتای واقعی کار کند ----------
  const fresh = await page.evaluate(() => {
    const w = window;
    w.products.push({ id:'r1', name:'برنج واقعی', type:'weighted', unit:'kg', buy:90, sell:120, qty:50, expiry:'' });
    w.__save0('dukan.products.v1', w.products);
    w.cart.length = 0; w.__addToCart('r1', 2);
    w.__finishSale('cash', null);
    const r = w.__computeReport('all');
    return { qty: w.products[0].qty, sales: r.totalSales, profit: r.profit };
  });
  console.log('\n۷) وارد کردن دیتای واقعی بعد از پاک‌کردن:');
  check('موجودی کم شد', fresh.qty, 48);
  check('فروش ثبت شد (۲ × ۱۲۰)', fresh.sales, 240);
  check('فایده درست (۲ × ۳۰)', fresh.profit, 60);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
