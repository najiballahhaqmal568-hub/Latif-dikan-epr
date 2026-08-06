// آزمایش محافظ صندوق: منفی‌نشدن، رفتن باقی به قرض تامین‌کننده، و موجودی اول
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

async function reset(page, opening) {
  await page.evaluate((op) => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments','custPayments','waste','expenses','stockCounts','cashEntries']
      .forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    w.products.push({ id:'a1', name:'کیک', type:'unit', unit:'piece', buy:300, sell:1000, qty:10, expiry:'' });
    if (op !== null) w.cashEntries.push({ id:'op1', date:'2026-01-01T00:00:00.000Z', kind:'opening', amount: op });
    w.__save0('dukan.cash.v1', w.cashEntries);
    w.__save0('dukan.products.v1', w.products);
    w.__invalidateDebts();
  }, opening);
}

// ثبت یک فاکتور خرید با مبلغ پرداخت‌شدهٔ دلخواه
async function makePurchase(page, supName, qty, buyPrice, paid) {
  await page.evaluate((a) => {
    const w = window;
    w.draft = { supplierName: a.supName, phone: '', date: '2026-07-20', paid: a.paid,
      lines: [{ productId: 'a1', name: 'کیک', unit: 'piece', qty: a.qty, buyPrice: a.buyPrice }] };
    w.__savePurchase();
  }, { supName, qty, buyPrice, paid });
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ---------- ۱) پول کافی → بدون اخطار ثبت شود ----------
  console.log('\n۱) صندوق ۵٬۰۰۰ و خرید نقدی ۳٬۰۰۰:');
  await reset(page, 5000);
  await makePurchase(page, 'کریم', 10, 300, 3000);
  let r = await page.evaluate(() => ({
    sheetOpen: document.getElementById('overlay').classList.contains('open'),
    purchases: window.purchases.length,
    paid: window.purchases[0] && window.purchases[0].paid,
    remaining: window.purchases[0] && window.purchases[0].remaining,
    bal: window.__cashBalance(),
  }));
  check('اخطار باز نشد', r.sheetOpen, false);
  check('فاکتور ثبت شد', r.purchases, 1);
  check('پرداخت ۳٬۰۰۰', r.paid, 3000);
  check('باقی صفر', r.remaining, 0);
  check('صندوق ۲٬۰۰۰', r.bal, 2000);

  // ---------- ۲) پول کم → شیت اخطار باز شود ----------
  console.log('\n۲) صندوق ۳٬۰۰۰ و خرید نقدی ۵٬۰۰۰:');
  await reset(page, 3000);
  await makePurchase(page, 'کریم', 10, 500, 5000);
  r = await page.evaluate(() => ({
    sheetOpen: document.getElementById('overlay').classList.contains('open'),
    txt: document.getElementById('sheet').textContent,
    purchases: window.purchases.length,
    hasCredit: !!document.getElementById('lcCredit'),
    hasFund: !!document.getElementById('lcFund'),
    hasBack: !!document.getElementById('lcBack'),
  }));
  check('شیت اخطار باز شد', r.sheetOpen, true);
  check('عنوان «پول صندوق کم است»', r.txt.indexOf('پول صندوق کم است') >= 0, true);
  check('هیچ فاکتوری هنوز ثبت نشده', r.purchases, 0);
  check('دکمهٔ «باقی به قرض» هست', r.hasCredit, true);
  check('دکمهٔ «پول از جای دیگر» هست', r.hasFund, true);
  check('دکمهٔ «رقم را اصلاح می‌کنم» هست', r.hasBack, true);
  check('کمبود ۲٬۰۰۰ نوشته شده', r.txt.indexOf('2,000') >= 0 || r.txt.indexOf('۲٬۰۰۰') >= 0, true);

  // ---------- ۳) راه اول: باقی به قرض تامین‌کننده ----------
  await page.click('#lcCredit');
  await page.waitForTimeout(350);
  r = await page.evaluate(() => {
    const pu = window.purchases[0];
    const s = window.suppliers[0];
    return { purchases: window.purchases.length, total: pu.total, paid: pu.paid,
             remaining: pu.remaining, debt: window.__supDebt(s), bal: window.__cashBalance(),
             qty: window.products[0].qty };
  });
  console.log('\n۳) زدن «فقط ۳٬۰۰۰ پرداخت شد — ۲٬۰۰۰ قرض»:');
  check('فاکتور ثبت شد', r.purchases, 1);
  check('مجموع فاکتور ۵٬۰۰۰', r.total, 5000);
  check('پرداخت ۳٬۰۰۰ (نه ۵٬۰۰۰)', r.paid, 3000);
  check('باقی ۲٬۰۰۰', r.remaining, 2000);
  check('قرض تامین‌کننده ۲٬۰۰۰', r.debt, 2000);
  check('صندوق دقیقاً صفر — نه منفی', r.bal, 0);
  check('موجودی جنس زیاد شد', r.qty, 20);

  // ---------- ۴) راه دوم: پول از جای دیگر آمد ----------
  console.log('\n۴) همان حالت، ولی «پول از جای دیگر آمد»:');
  await reset(page, 3000);
  await makePurchase(page, 'کریم', 10, 500, 5000);
  await page.click('#lcFund');
  await page.waitForTimeout(350);
  r = await page.evaluate(() => {
    const pu = window.purchases[0];
    const ins = window.cashEntries.filter(e => e.kind === 'in');
    return { paid: pu.paid, remaining: pu.remaining, debt: window.__supDebt(window.suppliers[0]),
             bal: window.__cashBalance(), inCount: ins.length, inAmt: ins[0] && ins[0].amount,
             note: ins[0] && ins[0].note };
  });
  check('پرداخت کامل ۵٬۰۰۰ ماند', r.paid, 5000);
  check('باقی صفر — قرضی نساخت', r.remaining, 0);
  check('قرض تامین‌کننده صفر', r.debt, 0);
  check('یک رکورد «پول داخل»', r.inCount, 1);
  check('مبلغش ۲٬۰۰۰', r.inAmt, 2000);
  check('توضیحش نام تامین‌کننده دارد', (r.note || '').indexOf('کریم') >= 0, true);
  check('صندوق صفر — نه منفی', r.bal, 0);

  // ---------- ۵) راه سوم: برگشت به فورم، هیچ چیز ثبت نشود ----------
  console.log('\n۵) همان حالت، ولی «رقم را اصلاح می‌کنم»:');
  await reset(page, 3000);
  await makePurchase(page, 'کریم', 10, 500, 5000);
  await page.click('#lcBack');
  await page.waitForTimeout(350);
  r = await page.evaluate(() => ({
    purchases: window.purchases.length,
    suppliers: window.suppliers.length,
    qty: window.products[0].qty,
    bal: window.__cashBalance(),
    formBack: document.getElementById('sheet').textContent.indexOf('فاکتور خرید') >= 0,
    linesKept: window.draft && window.draft.lines.length,
  }));
  check('هیچ فاکتوری ثبت نشد', r.purchases, 0);
  check('هیچ تامین‌کننده‌ای ساخته نشد', r.suppliers, 0);
  check('موجودی جنس دست‌نخورده', r.qty, 10);
  check('صندوق دست‌نخورده', r.bal, 3000);
  check('فورم خرید دوباره باز شد', r.formBack, true);
  check('اجناس فاکتور گم نشدند', r.linesKept, 1);

  // ---------- ۶) تلهٔ موجودی اول: تبدیل به قرض نشود ----------
  console.log('\n۶) بدون موجودی اول (تلهٔ قرض ساختگی):');
  await reset(page, null);
  await makePurchase(page, 'کریم', 10, 500, 5000);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    hasCredit: !!document.getElementById('lcCredit'),
    hasOpeningBtn: !!document.getElementById('lcOpening'),
    hasAnyway: !!document.getElementById('lcAnyway'),
    purchases: window.purchases.length,
  }));
  check('اخطار «موجودی اول ثبت نشده»', r.txt.indexOf('موجودی اول صندوق ثبت نشده') >= 0, true);
  check('دکمهٔ قرض داده نشد (قرض ساختگی نسازد)', r.hasCredit, false);
  check('دکمهٔ ثبت موجودی اول هست', r.hasOpeningBtn, true);
  check('راه «به‌هرحال ثبت کن» هست', r.hasAnyway, true);
  check('هنوز ثبت نشده', r.purchases, 0);

  await page.click('#lcAnyway');
  await page.waitForTimeout(350);
  r = await page.evaluate(() => ({
    paid: window.purchases[0].paid, remaining: window.purchases[0].remaining,
    debt: window.__supDebt(window.suppliers[0]), bal: window.__cashBalance(),
  }));
  console.log('   زدن «به‌هرحال ثبت کن»:');
  check('پرداخت همان ۵٬۰۰۰ ماند', r.paid, 5000);
  check('قرض ساختگی ساخته نشد', r.debt, 0);
  check('صندوق منفی شد (چون کاربر خودش خواست)', r.bal, -5000);

  // ---------- ۷) پرداخت به تامین‌کننده ----------
  console.log('\n۷) رسید پرداخت به تامین‌کننده:');
  await reset(page, 1000);
  await page.evaluate(() => {
    window.suppliers.push({ id:'s1', name:'کریم', phone:'', opening: 4000 });
    window.__save0('dukan.suppliers.v1', window.suppliers);
    window.__invalidateDebts();
    window.__openPayDialog(window.suppliers[0]);
  });
  await page.waitForTimeout(250);
  await page.fill('#payAmt', '3000');
  await page.click('#payOk');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    payments: window.supPayments.length,
    hasCredit: !!document.getElementById('lcCredit'),
  }));
  check('اخطار پول کم باز شد', r.txt.indexOf('پول صندوق کم است') >= 0, true);
  check('رسید هنوز ثبت نشده', r.payments, 0);
  check('راه «فقط این‌قدر پرداخت شد» هست', r.hasCredit, true);
  await page.click('#lcCredit');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    payments: window.supPayments.length, amt: window.supPayments[0].amount,
    debt: window.__supDebt(window.suppliers[0]), bal: window.__cashBalance(),
  }));
  check('یک رسید ثبت شد', r.payments, 1);
  check('مبلغش ۱٬۰۰۰ (همان پول صندوق)', r.amt, 1000);
  check('قرض ۳٬۰۰۰ ماند', r.debt, 3000);
  check('صندوق صفر — نه منفی', r.bal, 0);

  // ---------- ۸) مصرف خانه ----------
  console.log('\n۸) مصرف خانه بیشتر از پول صندوق:');
  await reset(page, 500);
  await page.evaluate(() => window.__openExpenseForm());
  await page.waitForTimeout(250);
  await page.fill('#expAmt', '900');
  await page.fill('#expNote', 'نان');
  await page.click('#expOk');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    expenses: window.expenses.length,
    hasCredit: !!document.getElementById('lcCredit'),
    hasFund: !!document.getElementById('lcFund'),
  }));
  check('اخطار باز شد', r.txt.indexOf('پول صندوق کم است') >= 0, true);
  check('مصرف هنوز ثبت نشده', r.expenses, 0);
  check('راه «قرض» اینجا داده نشود', r.hasCredit, false);
  check('راه «پول از جای دیگر» هست', r.hasFund, true);
  await page.click('#lcFund');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    expenses: window.expenses.length, amt: window.expenses[0].amount,
    note: window.expenses[0].note, bal: window.__cashBalance(),
    inAmt: window.cashEntries.filter(e => e.kind === 'in')[0].amount,
  }));
  check('مصرف کامل ۹۰۰ ثبت شد', r.amt, 900);
  check('توضیحش نگه داشته شد', r.note, 'نان');
  check('۴۰۰ «پول داخل» ثبت شد', r.inAmt, 400);
  check('صندوق صفر — نه منفی', r.bal, 0);

  // ---------- ۹) پول خارج دستی ----------
  console.log('\n۹) پول خارج دستی بیشتر از صندوق:');
  await reset(page, 200);
  await page.evaluate(() => window.__openCashEntry('out'));
  await page.waitForTimeout(250);
  await page.fill('#ceAmt', '500');
  await page.click('#ceOk');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    txt: document.getElementById('sheet').textContent,
    outs: window.cashEntries.filter(e => e.kind === 'out').length,
  }));
  check('اخطار باز شد', r.txt.indexOf('پول صندوق کم است') >= 0, true);
  check('هنوز ثبت نشده', r.outs, 0);

  // ---------- ۱۰) فروش نقد صندوق را زیاد کند (بدون اخطار) ----------
  console.log('\n۱۰) فروش نقد محافظ را فعال نکند (۲ × ۱٬۰۰۰):');
  await page.evaluate(() => document.getElementById('overlay').classList.remove('open')); // شیت آزمایش ۹ بسته شود
  await reset(page, 0);
  r = await page.evaluate(() => {
    window.cart.length = 0;
    window.__addToCart('a1', 2);
    window.__finishSale('cash', null);
    return { bal: window.__cashBalance(), sheetOpen: document.getElementById('overlay').classList.contains('open') };
  });
  check('صندوق ۲٬۰۰۰ شد', r.bal, 2000);
  check('هیچ اخطاری نیامد', r.sheetOpen, false);

  // ---------- ۱۱) موجودی اول: حالت «پول امشب را می‌شمارم» ----------
  console.log('\n۱۱) موجودی اول از روی پول شمرده‌شدهٔ امشب:');
  await reset(page, null);
  await page.evaluate(() => {
    // ۸٬۰۰۰ فروش نقد و ۴٬۰۰۰ خرید نقد ثبت شود → جمع حرکت‌ها = +۴٬۰۰۰
    window.sales.push({ id:'s1', date:'2026-07-10T09:00:00.000Z', paymentType:'cash', total:8000, items:[] });
    window.purchases.push({ id:'p1', supplierId:'x', supplierName:'کریم', date:'2026-07-11',
      total:4000, paid:4000, remaining:0, items:[] });
    window.__save0('dukan.sales.v1', window.sales);
    window.__save0('dukan.purchases.v1', window.purchases);
    window.__openCashOpening();
  });
  await page.waitForTimeout(250);
  r = await page.evaluate(() => ({
    net: window.__cashNetWithoutOpening(),
    lbl: document.getElementById('obLbl').textContent,
    defaultMode: document.querySelector('#obMode button.on').dataset.m,
  }));
  check('جمع حرکت‌ها ۴٬۰۰۰', r.net, 4000);
  check('حالت پیش‌فرض «شمردن»', r.defaultMode, 'count');
  check('برچسب «همین حالا در جعبه»', r.lbl.indexOf('همین حالا') >= 0, true);

  await page.fill('#obAmt', '9000');
  await page.waitForTimeout(200);
  r = await page.evaluate(() => document.getElementById('obOut').textContent);
  check('موجودی اول ۵٬۰۰۰ حساب شد', r.indexOf('5,000') >= 0 || r.indexOf('۵٬۰۰۰') >= 0, true);
  await page.click('#obOk');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    opening: window.__cashOpeningEntry().amount,
    bal: window.__cashBalance(),
  }));
  check('موجودی اول ۵٬۰۰۰ ثبت شد', r.opening, 5000);
  check('صندوق دقیقاً ۹٬۰۰۰ — همان پول شمرده‌شده', r.bal, 9000);

  // ---------- ۱۲) حالت «پول اول را می‌دانم» دوبار حساب نکند ----------
  console.log('\n۱۲) حالت «پول اول را می‌دانم»:');
  await page.evaluate(() => window.__openCashOpening());
  await page.waitForTimeout(250);
  await page.click('#obMode [data-m="know"]');
  await page.fill('#obAmt', '5000');
  await page.waitForTimeout(200);
  r = await page.evaluate(() => ({
    lbl: document.getElementById('obLbl').textContent,
    boxHidden: document.getElementById('obOut').style.display === 'none',
  }));
  check('برچسب «پیش از شروع اپ»', r.lbl.indexOf('پیش از شروع اپ') >= 0, true);
  check('جدول حساب پنهان است', r.boxHidden, true);
  await page.click('#obOk');
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    openings: window.cashEntries.filter(e => e.kind === 'opening').length,
    opening: window.__cashOpeningEntry().amount,
    bal: window.__cashBalance(),
  }));
  check('موجودی اول یکی ماند (جای‌گزین شد)', r.openings, 1);
  check('موجودی اول ۵٬۰۰۰', r.opening, 5000);
  check('صندوق ۹٬۰۰۰ — دوبار حساب نشد', r.bal, 9000);

  // ---------- ۱۳) اخطار روی صفحهٔ صندوق ----------
  console.log('\n۱۳) کارت توضیح صندوق منفی:');
  await reset(page, null);
  await page.evaluate(() => {
    window.expenses.push({ id:'e1', date:'2026-07-12T09:00:00.000Z', amount: 700, note:'' });
    window.__save0('dukan.expenses.v1', window.expenses);
    document.querySelector('nav.tabs button[data-scr="more"]').click();
    window.moreView = 'cash';
    window.__renderMore();
  });
  await page.waitForTimeout(300);
  r = await page.evaluate(() => ({
    bal: window.__cashBalance(),
    txt: document.getElementById('scr-more').textContent,
  }));
  check('صندوق منفی است', r.bal, -700);
  check('کارت «صندوق منفی است» آمد', r.txt.indexOf('صندوق منفی است') >= 0, true);
  check('دلیل موجودی اول نوشته شد', r.txt.indexOf('موجودی اول ثبت نشده') >= 0, true);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
