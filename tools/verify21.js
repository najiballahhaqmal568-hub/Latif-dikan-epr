// آزمایش «رویدادهای صندوق» — درزِ تازه‌ای که قانون پول در آن یک بار نوشته شده.
//
// چرا این آزمایش هست: پیش از cashEvents()، همین قانون سه بار جدا نوشته شده
// بود (تفصیل، رد پول، گزارش) و دو بار یکی از سه جا از قلم افتاد. آزمایش‌های
// قبلی هر سه را جدا امتحان می‌کردند؛ این یکی امتحان می‌کند که **هر سه از یک
// جا می‌آیند** — یعنی همان چیزی که آن دو باگ را ممکن کرده بود.
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

  // یک دفتر با «یکی از هر نوع رکورد» — نقدی و غیرنقدی، تا هر دو طرف
  // قانون امتحان شود.
  await page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments',
     'custPayments','waste','expenses','stockCounts','cashEntries']
      .forEach(k => { w[k].length = 0; });
    w.customers.push({ id: 'C1', name: 'کریم', phone: '', opening: 0 });
    w.suppliers.push({ id: 'S1', name: 'احمد', phone: '', opening: 0 });

    w.cashEntries.push({ id: 'op', date: '2020-01-01T00:00:00.000Z', kind: 'opening', amount: 1000 });
    // نقدی‌ها — هرکدام باید دقیقاً یک رویداد بسازند
    w.sales.push({ id: 's1', date: '2026-07-01T01:00:00.000Z', total: 300, paymentType: 'cash', items: [] });
    w.custPayments.push({ id: 'cp1', date: '2026-07-01T02:00:00.000Z', customerId: 'C1', amount: 200 });
    w.purchases.push({ id: 'pu1', date: '2026-07-01T03:00:00.000Z', supplierName: 'احمد', supplierId: 'S1', total: 400, paid: 400, lines: [] });
    w.supPayments.push({ id: 'sp1', date: '2026-07-01T04:00:00.000Z', supplierId: 'S1', amount: 100 });
    w.expenses.push({ id: 'e1', date: '2026-07-01T05:00:00.000Z', amount: 50, note: 'نان' });
    w.cashEntries.push({ id: 'in1', date: '2026-07-01T06:00:00.000Z', kind: 'in', amount: 60, note: 'از خانه' });
    w.cashEntries.push({ id: 'out1', date: '2026-07-01T07:00:00.000Z', kind: 'out', amount: 30, note: 'به بانک' });
    w.cashEntries.push({ id: 'ct1', date: '2026-07-01T08:00:00.000Z', kind: 'count', amount: -20 });
    // غیرنقدی‌ها — هیچ‌کدام نباید رویداد بسازند
    w.sales.push({ id: 's2', date: '2026-07-01T09:00:00.000Z', total: 500, paymentType: 'credit', customerId: 'C1', items: [] });
    w.custPayments.push({ id: 'cp2', date: '2026-07-01T10:00:00.000Z', customerId: 'C1', amount: 150, kind: 'goods' });
    w.purchases.push({ id: 'pu2', date: '2026-07-01T11:00:00.000Z', supplierName: 'احمد', supplierId: 'S1', total: 700, paid: 0, lines: [] });
    w.expenses.push({ id: 'e2', date: '2026-07-01T12:00:00.000Z', amount: 70, kind: 'goods', note: 'برداشت بوره' });
    w.__invalidateDebts();
  });

  // ===== ۱) هر رکورد نقدی دقیقاً یک رویداد =====
  console.log('\n۱) شمار رویدادها (۹ رکورد نقدی، ۴ رکورد غیرنقدی):');
  let r = await page.evaluate(() => {
    const ev = window.__cashEvents(), by = {};
    ev.forEach(e => { by[e.kind] = (by[e.kind] || 0) + 1; });
    return { n: ev.length, by: by, kinds: Object.keys(by).sort().join(',') };
  });
  check('۹ رویداد، نه بیشتر و نه کمتر', r.n, 9);
  check('فروش نقد یکی (فروش قرضی رویداد ندارد)', r.by.sales, 1);
  check('دریافت یکی (دریافت به جنس رویداد ندارد)', r.by.custPaid, 1);
  check('خرید نقد یکی (خرید قرضی رویداد ندارد)', r.by.purchasePaid, 1);
  check('مصرف یکی (مصرف به جنس رویداد ندارد)', r.by.expenses, 1);
  check('هر نه نوع رویداد حاضر است', r.kinds,
    'adjust,custPaid,expenses,manualIn,manualOut,opening,purchasePaid,sales,supPaid');

  // ===== ۲) هر سه مصرف‌کننده از یک جا می‌آیند =====
  console.log('\n۲) مانده، تفصیل، رد پول و گزارش باید یک رقم بدهند:');
  r = await page.evaluate(() => {
    const w = window;
    const ev = w.__cashEvents();
    let sum = 0; ev.forEach(e => { sum += e.amount; });
    const b = w.__cashBreakdown();
    const fromB = b.opening + b.sales + b.custPaid + b.manualIn + b.adjust -
                  b.purchasePaid - b.supPaid - b.expenses - b.manualOut;
    const mv = w.__cashMovements();
    const rep = w.__computeReport('all');
    return { bal: w.__cashBalance(), sum: +sum.toFixed(2), fromB: +fromB.toFixed(2),
             mvN: mv.length, mvTop: mv[0].balance, cashBox: rep.cashBox,
             cashIn: rep.cashIn, cashOut: rep.cashOut, short: rep.cashShort,
             net: w.__cashNetWithoutOpening() };
  });
  check('مانده ۹۶۰', r.bal, 960);
  check('جمع رویدادها = مانده', r.sum, 960);
  check('جدول تفصیل = مانده', r.fromB, 960);
  check('رد پول ۹ سطر دارد', r.mvN, 9);
  check('ماندهٔ آخرِ رد پول = مانده', r.mvTop, 960);
  check('صندوقِ گزارش = مانده', r.cashBox, 960);
  check('پول داخل ۱٬۵۶۰', r.cashIn, 1560);
  check('پول خارج ۶۰۰', r.cashOut, 600);
  check('کسری شمارش ۲۰ (ضرر واقعی)', r.short, 20);
  check('جمع بدون موجودی اول = −۴۰', r.net, -40);

  // ===== ۳) باگ اول که خورده بودیم: مصرف خانه «به جنس» =====
  // پول از صندوق نرفته، پس نباید در هیچ‌کدام از سه جا بیاید.
  console.log('\n۳) برگشت‌ناپذیری باگ ۱ — مصرف به جنس:');
  r = await page.evaluate(() => {
    const w = window;
    const before = w.__cashBalance();
    w.expenses.push({ id: 'e3', date: '2026-07-02T01:00:00.000Z', amount: 500,
      kind: 'goods', note: 'برداشت آرد' });
    const ev = w.__cashEvents();
    const mv = w.__cashMovements();
    return { before: before, after: w.__cashBalance(), n: ev.length,
             inTrail: mv.some(m => (m.label || '').indexOf('برداشت آرد') >= 0),
             breakdownExp: w.__cashBreakdown().expenses,
             repOut: w.__computeReport('all').cashOut };
  });
  check('مانده تکان نخورد', r.after, r.before);
  check('رویدادی ساخته نشد', r.n, 9);
  check('در رد پول هم نیامد', r.inTrail, false);
  check('در جدول تفصیل هم نیامد', r.breakdownExp, 50);
  check('در پول‌خارجِ گزارش هم نیامد', r.repOut, 600);

  // ===== ۴) باگ دوم که خورده بودیم: باطل‌کردن خرید نقد =====
  // paid منفی است؛ پول باید پس بیاید و سطرش هم در رد پول باشد.
  console.log('\n۴) برگشت‌ناپذیری باگ ۲ — باطل‌کردن خرید نقد:');
  r = await page.evaluate(() => {
    const w = window;
    w.purchases.push({ id: 'pu3', date: '2026-07-03T01:00:00.000Z', reverseOf: 'pu1',
      supplierName: 'احمد', supplierId: 'S1', total: -400, paid: -400, lines: [] });
    const ev = w.__cashEvents();
    const rev = ev.filter(e => e.kind === 'purchasePaid' && e.amount > 0);
    const mv = w.__cashMovements();
    return { bal: w.__cashBalance(), n: ev.length, revN: rev.length,
             revAmt: rev[0] && rev[0].amount,
             inTrail: mv.some(m => (m.label || '').indexOf('برگشت خرید نقد') >= 0),
             mvN: mv.length, mvTop: mv[0].balance,
             breakdownPur: w.__cashBreakdown().purchasePaid,
             cashBox: w.__computeReport('all').cashBox };
  });
  check('پول ۴۰۰ پس آمد → مانده ۱٬۳۶۰', r.bal, 1360);
  check('یک رویداد برگشتی ساخته شد', r.revN, 1);
  check('مبلغش ＋۴۰۰ است', r.revAmt, 400);
  check('در رد پول سطر دارد', r.inTrail, true);
  check('رد پول ۱۰ سطر شد', r.mvN, 10);
  check('ماندهٔ رد پول هم ۱٬۳۶۰', r.mvTop, 1360);
  check('خرید نقدِ تفصیل صفر شد', r.breakdownPur, 0);
  check('صندوقِ گزارش هم ۱٬۳۶۰', r.cashBox, 1360);

  // ===== ۵) قانون کلی: هیچ رویدادی بی‌تاریخ و بی‌نام نباشد =====
  // اگر روزی رکورد تازه‌ای به cashEvents اضافه شود و برچسب یا تاریخ نداشته
  // باشد، رد پول سطر بی‌معنی نشان می‌دهد و ترتیبش هم به‌هم می‌خورد.
  console.log('\n۵) سلامت شکل رویدادها:');
  r = await page.evaluate(() => {
    const ev = window.__cashEvents();
    return {
      noDate: ev.filter(e => !e.date).length,
      noLabel: ev.filter(e => !e.label).length,
      noKind: ev.filter(e => !e.kind).length,
      nan: ev.filter(e => typeof e.amount !== 'number' || isNaN(e.amount)).length,
    };
  });
  check('همه تاریخ دارند', r.noDate, 0);
  check('همه برچسب دارند', r.noLabel, 0);
  check('همه نوع دارند', r.noKind, 0);
  check('هیچ مبلغی خراب نیست', r.nan, 0);

  // ===== ۶) «موجودی اول» چندتایی (دیتای بازگردانده‌شده) =====
  // از راه اپ همیشه یکی است — openCashOpening پیش از ثبت، قبلی را برمی‌دارد.
  // ولی در فایل بک‌آپ یا سنکِ کهنه می‌تواند چندتا باشد، و آن‌وقت کود قدیمی
  // **با خودش جور نبود**: جدول تفصیل فقط آخری را می‌شمرد، رد پول همه را.
  // حالا هر چهار مصرف‌کننده همه را می‌شمارند.
  console.log('\n۶) دو «موجودی اول» در دیتای بازگردانده‌شده:');
  r = await page.evaluate(() => {
    const w = window;
    ['sales','custPayments','purchases','supPayments','expenses'].forEach(k => { w[k].length = 0; });
    w.cashEntries.length = 0;
    w.cashEntries.push({ id:'op1', date:'2020-01-01T00:00:00.000Z', kind:'opening', amount:1000 });
    w.cashEntries.push({ id:'op2', date:'2020-01-02T00:00:00.000Z', kind:'opening', amount:500 });
    w.__invalidateDebts();
    const mv = w.__cashMovements();
    return { bal: w.__cashBalance(), opening: w.__cashBreakdown().opening,
             mvTop: mv[0].balance, cashBox: w.__computeReport('all').cashBox };
  });
  check('تفصیل هر دو را می‌شمارد (۱٬۵۰۰)', r.opening, 1500);
  check('مانده هم ۱٬۵۰۰', r.bal, 1500);
  check('رد پول هم ۱٬۵۰۰ — با تفصیل جور است', r.mvTop, 1500);
  check('گزارش هم ۱٬۵۰۰', r.cashBox, 1500);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
