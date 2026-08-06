// آزمایش ویژگی‌های نو: برگشتی فروش، کم/زیاد سبد، باقی، ستاره، مشتریان اخیر
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
  const page = await browser.newPage();
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const seed = () => page.evaluate(() => {
    const w = window;
    ['products','sales','suppliers','purchases','customers','waste','expenses','supPayments','custPayments','stockCounts']
      .forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    w.products.push({ id:'p1', name:'برنج', type:'unit', unit:'pcs', buy:15, sell:30, qty:20, expiry:'' });
    w.products.push({ id:'p2', name:'روغن', type:'unit', unit:'pcs', buy:50, sell:80, qty:10, expiry:'' });
  });

  // ---------- برگشتی فروش نقد ----------
  await seed();
  const r1 = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0; w.__addToCart('p1', 5);        // 5 × 30 = 150
    w.__finishSale('cash', null);
    const before = w.__computeReport('all');
    const sale = w.sales[0];
    w.__returnSale(sale);
    const after = w.__computeReport('all');
    return {
      qtyBefore: 15, qtyAfter: w.products[0].qty,
      salesBefore: before.totalSales, salesAfter: after.totalSales,
      cogsAfter: after.cogs, profitBefore: before.profit, profitAfter: after.profit,
      cashAfter: after.cash, cashBoxAfter: after.cashBox,
      records: w.sales.length, origFlag: w.sales[0].returned === true,
      revLinked: w.sales[1].returnOf === sale.id,
    };
  });
  console.log('\n۱) برگشتی فروش نقد (۵ دانه × ۳۰ = ۱۵۰):');
  check('موجودی پس آمد', r1.qtyAfter, 20);
  check('فروش پیش از برگشتی', r1.salesBefore, 150);
  check('فروش بعد از برگشتی = صفر', r1.salesAfter, 0);
  check('قیمت تمام‌شد = صفر', r1.cogsAfter, 0);
  check('فایده پیش از برگشتی', r1.profitBefore, 75);
  check('فایده بعد از برگشتی = صفر', r1.profitAfter, 0);
  check('فروش نقد = صفر', r1.cashAfter, 0);
  check('صندوق نقد = صفر', r1.cashBoxAfter, 0);
  check('دو رکورد ماند (پاک نشد)', r1.records, 2);
  check('فروش اصلی نشانی شد', r1.origFlag, true);
  check('رکورد برگشتی به اصلی وصل است', r1.revLinked, true);

  // ---------- برگشتی فروش قرضی ----------
  await seed();
  const r2 = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0; w.__addToCart('p2', 2);        // 2 × 80 = 160
    w.__finishSale('credit', 'احمد');
    const debtBefore = w.__custDebt(w.customers[0]);
    w.__returnSale(w.sales[0]);
    const rep = w.__computeReport('all');
    return { debtBefore, debtAfter: w.__custDebt(w.customers[0]), qty: w.products[1].qty,
             creditAfter: rep.credit, profitAfter: rep.profit };
  });
  console.log('\n۲) برگشتی فروش قرضی (۲ × ۸۰ = ۱۶۰):');
  check('قرض پیش از برگشتی', r2.debtBefore, 160);
  check('قرض بعد از برگشتی = صفر', r2.debtAfter, 0);
  check('موجودی پس آمد', r2.qty, 10);
  check('فروش قرض = صفر', r2.creditAfter, 0);
  check('فایده = صفر', r2.profitAfter, 0);

  // ---------- برگشتی دوباره نباید ممکن باشد ----------
  const r3 = await page.evaluate(() => {
    const w = window;
    const n = w.sales.length;
    w.__returnSale(w.sales[0]);   // already returned
    w.__returnSale(w.sales[1]);   // this IS a return record
    return { n, after: w.sales.length, debt: w.__custDebt(w.customers[0]), qty: w.products[1].qty };
  });
  console.log('\n۳) برگشتی دوباره (نباید تکرار شود):');
  check('رکورد نو ساخته نشد', r3.after, r3.n);
  check('قرض دست‌نخورده', r3.debt, 0);
  check('موجودی دست‌نخورده', r3.qty, 10);

  // ---------- برگشتی جزئی از یک فروش چندقلمه ----------
  await seed();
  const r4 = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0; w.__addToCart('p1', 2); w.__addToCart('p2', 1);  // 60 + 80 = 140
    w.__finishSale('cash', null);
    w.__returnSale(w.sales[0]);
    const rep = w.__computeReport('all');
    return { q1: w.products[0].qty, q2: w.products[1].qty, sales: rep.totalSales,
             perProd: rep.perProduct['p1'] ? rep.perProduct['p1'].profit : null };
  });
  console.log('\n۴) برگشتی فروش چندقلمه (برنج ۲ + روغن ۱):');
  check('موجودی برنج پس آمد', r4.q1, 20);
  check('موجودی روغن پس آمد', r4.q2, 10);
  check('مجموع فروش = صفر', r4.sales, 0);
  check('فایدهٔ هر جنس = صفر', r4.perProd, 0);

  // ---------- کم/زیادکردن سبد ----------
  await seed();
  const r5 = await page.evaluate(() => {
    const w = window;
    w.products.push({ id:'p3', name:'بوره', type:'weighted', unit:'kg', buy:40, sell:60, qty:50, expiry:'' });
    w.cart.length = 0;
    w.__addToCart('p1', 1);
    w.__bumpLine('p1', +1); w.__bumpLine('p1', +1);      // 3
    const afterInc = w.cart[0].qty;
    w.__bumpLine('p1', -1);                              // 2
    const afterDec = w.cart[0].qty;
    w.__addToCart('p3', 1);                              // kg → step 0.5
    w.__bumpLine('p3', +1);
    const kgQty = w.cart[1].qty;
    w.__bumpLine('p1', -1); w.__bumpLine('p1', -1);      // → 0 → removed
    return { afterInc, afterDec, kgQty, lines: w.cart.length, firstId: w.cart[0].productId };
  });
  console.log('\n۵) کم/زیادکردن تعداد در سبد:');
  check('دو بار + روی دانه‌ای', r5.afterInc, 3);
  check('یک بار − ', r5.afterDec, 2);
  check('+ روی وزنی گام نیم کیلو', r5.kgQty, 1.5);
  check('رسیدن به صفر سطر را برداشت', r5.lines, 1);
  check('سطر مانده بوره است', r5.firstId, 'p3');

  // ---------- حساب باقی ----------
  await seed();
  const r6 = await page.evaluate(async () => {
    const w = window;
    w.cart.length = 0; w.__addToCart('p1', 4);   // 4 × 30 = 120
    w.__renderCart();
    const inp = document.getElementById('paidAmt');
    inp.value = '500'; inp.dispatchEvent(new Event('input'));
    const over = document.getElementById('changeRes').textContent;
    inp.value = '100'; inp.dispatchEvent(new Event('input'));
    const under = document.getElementById('changeRes').textContent;
    const shortCls = document.getElementById('changeRes').classList.contains('short');
    // دکمهٔ «دقیق»
    document.querySelector('#paidChips [data-exact]').click();
    const exact = document.getElementById('changeRes').textContent;
    // چیپ ۵۰۰ جمع می‌کند
    inp.value = ''; inp.dispatchEvent(new Event('input'));
    document.querySelector('#paidChips [data-add="500"]').click();
    document.querySelector('#paidChips [data-add="100"]').click();
    const chipVal = inp.value;
    return { over, under, shortCls, exact, chipVal, count: document.getElementById('cartCount').textContent };
  });
  console.log('\n۶) حساب باقی (مجموع ۱۲۰):');
  check('۵۰۰ داد → باقی ۳۸۰', r6.over.includes('380'), true);
  check('۱۰۰ داد → کم است ۲۰', r6.under.includes('کم است') && r6.under.includes('20'), true);
  check('رنگ سرخ برای کمبود', r6.shortCls, true);
  check('دکمهٔ دقیق → باقی صفر', r6.exact.includes('باقی: 0'), true);
  check('چیپ ۵۰۰+۱۰۰ = ۶۰۰', r6.chipVal, '600');
  check('شمارندهٔ سبد', r6.count, '1 قلم');

  // ---------- ستاره و ترتیب ----------
  await seed();
  const r7 = await page.evaluate(() => {
    const w = window;
    w.products.push({ id:'p4', name:'آب', type:'unit', unit:'pcs', buy:5, sell:10, qty:0, expiry:'' });
    w.products[1].star = true;   // روغن ستاره‌دار
    document.getElementById('search').value = '';
    w.__renderSaleGrid();
    // renderSaleGrid از طریق tab یا مستقیم
    const ids = [...document.querySelectorAll('#saleGrid .tile')].map(t => t.dataset.id);
    return { ids };
  });
  // ترتیب را پس از رندر دوباره بگیریم
  const r7b = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#saleGrid .tile')].map(t => t.dataset.id);
    const dimmed = [...document.querySelectorAll('#saleGrid .tile')].map(t => t.className.includes('oosdim'));
    return { ids, dimmed };
  });
  console.log('\n۷) ترتیب تایل‌ها (ستاره‌دار اول، تمام‌شده آخر):');
  check('اولی ستاره‌دار (روغن)', r7b.ids[0], 'p2');
  check('آخری تمام‌شده (آب)', r7b.ids[r7b.ids.length - 1], 'p4');
  check('تمام‌شده کم‌رنگ است', r7b.dimmed[r7b.dimmed.length - 1], true);

  // ---------- مشتریان اخیر ----------
  await seed();
  const r8 = await page.evaluate(() => {
    const w = window;
    w.cart.length = 0; w.__addToCart('p1', 1); w.__finishSale('credit', 'احمد');
    w.cart.length = 0; w.__addToCart('p1', 1); w.__finishSale('credit', 'محمود');
    const rec = w.__recentCustomers(6).map(c => c.name);
    return { rec, first: rec[0] };
  });
  console.log('\n۸) مشتریان اخیر:');
  check('تازه‌ترین اول است', r8.first, 'محمود');
  check('هر دو مشتری آمد', r8.rec.length, 2);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
