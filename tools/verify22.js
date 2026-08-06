// آزمایش گدام: موجودی هرگز **خاموش** منفی نشود.
//
// شش راه برای خارج‌شدن جنس از گدام هست. چهارتایش از محافظ موجودی
// می‌گذشت و دوتایش نی — و همان دو تا این باگ‌ها را می‌ساختند:
//   • باطل‌کردن «دریافت به جنس» پس از فروش همان جنس → موجودی منفی خاموش
//   • ثبت ضایعات بیشتر از موجودی → موجودی منفی **و** ضرر ساختگی در فایده
//
// منفی‌شدن موجودی خودش جرم نیست؛ **خاموش** منفی‌شدن جرم است. اگر
// دوکان‌دار خودش «به‌هرحال ثبت کن» را بزند، درست است.
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

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { if (!/reading 'focus'/.test(e.message)) { console.log('  ⚠️', e.message); fail++; } });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const clear = () => page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments',
     'custPayments','waste','expenses','stockCounts','cashEntries'].forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    w.cashEntries.push({ id:'op', date:'2020-01-01T00:00:00.000Z', kind:'opening', amount:50000 });
    w.__stockOverrides = 0;
    w.__invalidateDebts();
    document.getElementById('overlay').classList.remove('open');
  });

  // ===== ۱) باطل‌کردن «دریافت به جنس» پس از فروش همان جنس =====
  // مشتری ۵۰ تخم مرغ به‌جای پول داد؛ ۴۵ دانه‌اش فروخته شد؛ حالا رسید
  // باطل می‌شود. جنس برای پس‌دادن نیست.
  console.log('\n۱) باطل‌کردن دریافت به جنس، وقتی جنس فروخته شده:');
  await clear();
  await page.evaluate(() => {
    const w = window;
    w.customers.push({ id:'C1', name:'کریم', phone:'', opening:0 });
    w.products.push({ id:'P1', name:'تخم مرغ', type:'unit', unit:'piece', buy:5, sell:8, qty:5, expiry:'' });
    w.custPayments.push({ id:'cp1', date:'2026-07-01T01:00:00.000Z', ts:'2026-07-01T01:00:00.000Z',
      customerId:'C1', amount:250, kind:'goods', productId:'P1', productName:'تخم مرغ',
      unit:'piece', qty:50, unitPrice:5, prevBuy:5, prevEst:false });
    w.__invalidateDebts();
  });
  await page.evaluate(() => window.__voidCustPayment(window.custPayments[0]));
  await page.waitForTimeout(250);
  await page.evaluate(() => { const b = document.getElementById('voidOk'); if (b) b.click(); });
  await page.waitForTimeout(300);
  let r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    qty: window.__findP('P1').qty,
    n: window.custPayments.length,
    voided: !!window.custPayments[0].reversed,
  }));
  check('اخطار موجودی آمد', r.txt.indexOf('موجودی کم است') >= 0, true);
  check('موجودی دست‌نخورده ماند', r.qty, 5);
  check('رکورد باطل‌کردن ساخته نشد', r.n, 1);
  check('رسید هنوز باطل نشده', r.voided, false);

  // «به‌هرحال ثبت کن» → تصمیم خودِ دوکان‌دار، پس باید بگذرد
  await page.evaluate(() => { const b = document.getElementById('stAnyway'); if (b) b.click(); });
  await page.waitForTimeout(350);
  r = await page.evaluate(() => ({ qty: window.__findP('P1').qty, n: window.custPayments.length,
    voided: !!window.custPayments[0].reversed, ov: window.__stockOverrides }));
  check('با «به‌هرحال» کار انجام شد', r.n, 2);
  check('رسید باطل شد', r.voided, true);
  check('موجودی ۵ − ۵۰ = −۴۵ (تصمیم خودش)', r.qty, -45);
  check('تصمیم آگاهانه شمرده شد', r.ov, 1);

  // ===== ۲) ضایعات بیشتر از موجودی =====
  // بدترینش این بود: تایپ ۹۹۹ به‌جای ۹ نه‌تنها موجودی را منفی می‌کرد،
  // بلکه ۹۸۹ × ۵۵ = ۵۴٬۳۹۵ افغانی ضرر ساختگی به فایده می‌زد.
  console.log('\n۲) ثبت ضایعات بیشتر از موجودی (تایپ ۹۹۹ به‌جای ۹):');
  await page.evaluate(() => { document.getElementById('overlay').classList.remove('open'); });
  await clear();
  await page.evaluate(() => {
    window.products.push({ id:'P2', name:'بوره', type:'weighted', unit:'kg', buy:55, sell:70, qty:10, expiry:'' });
    window.__invalidateDebts();
  });
  const profitBefore = await page.evaluate(() => window.__computeReport('all').profit);
  await page.evaluate(() => window.__openWasteForm(window.__findP('P2'), 'spoiled'));
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.getElementById('wQty').value = '999';
    document.getElementById('wOk').click();
  });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    qty: window.__findP('P2').qty,
    n: window.waste.length,
    profit: window.__computeReport('all').profit,
    loss: window.__computeReport('all').wasteLoss,
  }));
  check('اخطار موجودی آمد', r.txt.indexOf('موجودی کم است') >= 0, true);
  check('موجودی دست‌نخورده ماند', r.qty, 10);
  check('رکورد ضایعات ساخته نشد', r.n, 0);
  check('ضرر ساختگی نساخت', r.loss, 0);
  check('فایده تکان نخورد', r.profit, profitBefore);

  // مقدار درست (۹) باید بدون اخطار بگذرد
  await page.evaluate(() => { const b = document.getElementById('stBack'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const i = document.getElementById('wQty');
    if (i) { i.value = '9'; document.getElementById('wOk').click(); }
  });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({ qty: window.__findP('P2').qty, n: window.waste.length,
    loss: window.__computeReport('all').wasteLoss, ov: window.__stockOverrides }));
  check('مقدار درست بی‌اخطار ثبت شد', r.n, 1);
  check('موجودی ۱۰ − ۹ = ۱', r.qty, 1);
  check('ضرر واقعی ۴۹۵ (۹ × ۵۵)', r.loss, 495);
  check('هیچ «به‌هرحال»ی لازم نشد', r.ov, 0);

  // ===== ۳) چهار راه دیگر هنوز محافظ دارند (پس‌رفت نکرده باشند) =====
  console.log('\n۳) چهار راه دیگرِ خروج جنس هنوز محافظ دارند:');
  await page.evaluate(() => { document.getElementById('overlay').classList.remove('open'); });
  await clear();
  await page.evaluate(() => {
    window.products.push({ id:'P3', name:'برنج', type:'weighted', unit:'kg', buy:80, sell:100, qty:3, expiry:'' });
    window.__invalidateDebts();
  });
  // فروش دوکان
  await page.evaluate(() => { window.cart.length = 0; window.__addToCart('P3', 99); window.__finishSale('cash', null); });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({ t: document.getElementById('sheet').textContent.indexOf('موجودی کم است') >= 0,
                                   n: window.sales.length }));
  check('فروش دوکان محافظ دارد', r.t, true);
  check('فروشی ثبت نشد', r.n, 0);

  // برداشت جنس از گدام (مصرف خانه)
  await page.evaluate(() => { document.getElementById('stBack').click(); });
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.cart.length = 0; document.getElementById('overlay').classList.remove('open'); });
  await page.evaluate(() => window.__openExpenseGoods());
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const el = document.querySelector('#sheet [data-xp]') || document.getElementById('xPick');
    if (el) el.click();
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const el = document.querySelector('#sheet [data-xp]');
    if (el) el.click();
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const i = document.getElementById('xQty');
    if (i) { i.value = '77'; document.getElementById('xOk').click(); }
  });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({ t: document.getElementById('sheet').textContent.indexOf('موجودی کم است') >= 0,
                                   qty: window.__findP('P3').qty, n: window.expenses.length }));
  check('برداشت جنس محافظ دارد', r.t, true);
  check('موجودی دست‌نخورده', r.qty, 3);
  check('مصرفی ثبت نشد', r.n, 0);

  // فروش بازار — تا این آزمایش نوشته شد، **هیچ** آزمایشی محافظ موجودی را
  // روی فروش بازار نمی‌سنجید (نوشتهٔ قبلی من در tools/README.md غلط بود).
  await page.evaluate(() => { document.getElementById('overlay').classList.remove('open'); });
  await page.evaluate(() => window.__openBazaarSale());
  await page.waitForTimeout(250);
  await page.evaluate(() => { const b = document.getElementById('bPick'); if (b) b.click(); });
  await page.waitForTimeout(250);
  await page.evaluate(() => { const el = document.querySelector('#sheet [data-bp]'); if (el) el.click(); });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    document.getElementById('bQty').value = '88';
    document.getElementById('bPrice').value = '120';
    document.getElementById('bOk').click();
  });
  await page.waitForTimeout(350);
  r = await page.evaluate(() => ({ t: document.getElementById('sheet').textContent.indexOf('موجودی کم است') >= 0,
                                   qty: window.__findP('P3').qty, n: window.sales.length }));
  check('فروش بازار محافظ دارد', r.t, true);
  check('موجودی دست‌نخورده', r.qty, 3);
  check('فروش بازاری ثبت نشد', r.n, 0);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
