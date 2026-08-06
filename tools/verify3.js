// آزمایش تقویم هجری شمسی — مقایسه با تقویم خود مرورگر (Intl persian)
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'test-index.html');

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  console.log((ok ? '  ✅' : '  ❌') + ' ' + name + '  → got ' + actual + ', expected ' + expected);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ---------- ۱) مقایسهٔ تبدیل با تقویم خود مرورگر روی ۳۰۰۰ روز ----------
  const sweep = await page.evaluate(() => {
    const fmtP = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
      year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC'
    });
    function browserJalali(d) {
      // از UTC استفاده می‌کنیم تا با ساعت محلی قاطی نشود
      const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const parts = fmtP.formatToParts(u);
      const get = t => parseInt(parts.find(p => p.type === t).value, 10);
      return { jy: get('year'), jm: get('month'), jd: get('day') };
    }
    let mismatches = [], tested = 0;
    // از ۱۴۰۰ روز پیش تا ۱۶۰۰ روز بعد
    const base = new Date(2026, 6, 26);
    for (let i = -1400; i <= 1600; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const mine = window.__toJalali(d);
      const theirs = browserJalali(d);
      tested++;
      if (!mine || mine.jy !== theirs.jy || mine.jm !== theirs.jm || mine.jd !== theirs.jd) {
        if (mismatches.length < 5)
          mismatches.push({ g: d.toDateString(), mine, theirs });
      }
    }
    return { tested, bad: mismatches.length, sample: mismatches };
  });
  console.log('\n۱) مقایسه با تقویم خود مرورگر:');
  console.log('   روزهای آزمایش‌شده: ' + sweep.tested);
  if (sweep.bad) console.log('   نمونهٔ ناجوری:', JSON.stringify(sweep.sample, null, 1));
  check('هیچ ناجوری نبود', sweep.bad, 0);

  // ---------- ۲) رفت و برگشت (شمسی → میلادی → شمسی) ----------
  const rt = await page.evaluate(() => {
    let bad = 0, tested = 0, leapYears = [];
    for (let jy = 1398; jy <= 1410; jy++) {
      for (let jm = 1; jm <= 12; jm++) {
        // حوت در سال کبیسه ۳۰ روز دارد، ورنه ۲۹ — پس ۳۰ حوت را جدا می‌سنجیم
        const maxD = jm <= 6 ? 31 : (jm === 12 ? 29 : 30);
        for (let jd = 1; jd <= maxD; jd++) {
          const d = window.__jalaliToDate(jy, jm, jd);
          if (!d) { bad++; continue; }
          const back = window.__toJalali(d);
          tested++;
          if (!back || back.jy !== jy || back.jm !== jm || back.jd !== jd) bad++;
        }
      }
      // آیا ۳۰ حوت این سال وجود دارد؟ (سال کبیسه)
      const d30 = window.__jalaliToDate(jy, 12, 30);
      const b30 = d30 && window.__toJalali(d30);
      if (b30 && b30.jy === jy && b30.jm === 12 && b30.jd === 30) leapYears.push(jy);
    }
    return { tested, bad, leapYears };
  });
  console.log('\n۲) رفت و برگشت شمسی↔میلادی:');
  console.log('   تاریخ‌های آزمایش‌شده: ' + rt.tested);
  check('همه درست برگشتند', rt.bad, 0);
  console.log('   سال‌های کبیسه (۳۰ حوت دارند): ' + rt.leapYears.join('، '));
  check('سال‌های کبیسه درست‌اند', rt.leapYears.join(','), '1399,1403,1408');

  // ---------- ۳) تاریخ‌های معلوم ----------
  const known = await page.evaluate(() => {
    const f = iso => window.__fmtDate(iso);
    return {
      nowruz2026: f('2026-03-21T10:00:00'),   // ۱ حمل ۱۴۰۵
      beforeNowruz: f('2026-03-20T10:00:00'), // آخر حوت ۱۴۰۴
      today: f('2026-07-26T10:00:00'),
      long: window.__fmtDateLong('2026-07-26T10:00:00'),
    };
  });
  console.log('\n۳) تاریخ‌های معلوم:');
  check('۲۱ مارچ ۲۰۲۶ = نوروز ۱۴۰۵', known.nowruz2026, '1405/01/01');
  check('۲۰ مارچ ۲۰۲۶ = آخر ۱۴۰۴', known.beforeNowruz, '1404/12/29');
  check('۲۶ جولای ۲۰۲۶', known.today, '1405/05/04');
  check('برچسب خوانا (نام افغانی)', known.long, '4 اسد 1405');

  // ---------- ۴) مرز «این ماه» شمسی است نه میلادی ----------
  const boundary = await page.evaluate(() => {
    const w = window;
    ['products','sales','customers','waste','expenses','purchases','suppliers',
     'supPayments','custPayments','stockCounts'].forEach(k => { w[k].length = 0; });
    w.products.push({ id:'p1', name:'برنج', type:'unit', unit:'pcs', buy:10, sell:20, qty:1000, expiry:'' });

    const start = w.__periodStart('month');
    const j = w.__toJalali(new Date());
    const expectedStart = w.__jalaliToDate(j.jy, j.jm, 1);

    // فروش‌های ساختگی: یکی پیش از شروع ماه شمسی، یکی بعد از آن
    const before = new Date(expectedStart.getTime() - 36e5);      // یک ساعت پیشتر
    const after  = new Date(expectedStart.getTime() + 36e5);      // یک ساعت بعدتر
    function mkSale(date, total) {
      w.sales.push({ id: w.__id(), date: date.toISOString(), total: total,
        paymentType: 'cash', customerName: null, customerId: null,
        items: [{ productId:'p1', productName:'برنج', quantity: total/20, sellPrice:20, buyPrice:10 }] });
    }
    mkSale(before, 100);
    mkSale(after, 200);
    const rep = w.__computeReport('month');
    return {
      startIsFirstOfJalaliMonth: start.getTime() === expectedStart.getTime(),
      jalaliDayOfStart: w.__toJalali(start).jd,
      salesInMonth: rep.totalSales,
    };
  });
  console.log('\n۴) مرز «این ماه»:');
  check('شروع = روز اول ماه شمسی', boundary.startIsFirstOfJalaliMonth, true);
  check('روزِ شروع = ۱', boundary.jalaliDayOfStart, 1);
  check('فقط فروش بعد از شروع شمرده شد', boundary.salesInMonth, 200);

  // ---------- ۵) کوچ کلید ماه از میلادی به شمسی ----------
  const mig = await page.evaluate(() => {
    const w = window;
    w.stockCounts.length = 0; w.waste.length = 0;
    // رکورد کهنه با کلید میلادی
    w.stockCounts.push({ id:'c1', month:'2026/07', productId:'p1', productName:'برنج',
      unit:'pcs', calculated:10, counted:8, difference:-2, date:'2026-07-26T10:00:00' });
    w.waste.push({ id:'w1', productId:'p1', productName:'برنج', unit:'pcs', quantity:2,
      buyPrice:10, date:'2026-07-26T10:00:00', reason:'shortage', countMonth:'2026/07' });
    // ضایعات دستی (نباید دست بخورد)
    w.waste.push({ id:'w2', productId:'p1', productName:'برنج', unit:'pcs', quantity:1,
      buyPrice:10, date:'2026-07-26T10:00:00', reason:'expired' });
    w.__migrateMonthKeysToJalali();
    return { countKey: w.stockCounts[0].month, wasteKey: w.waste[0].countMonth,
             manualUntouched: w.waste[1].countMonth === undefined,
             label: w.__monthKeyLabel(w.stockCounts[0].month) };
  });
  console.log('\n۵) کوچ کلید ماهِ شمارش‌های کهنه:');
  check('کلید شمارش شمسی شد', mig.countKey, '1405/05');
  check('کلید ضایعات کسری شمسی شد', mig.wasteKey, '1405/05');
  check('ضایعات دستی دست نخورد', mig.manualUntouched, true);
  check('برچسب ماه', mig.label, 'اسد 1405');

  // ---------- ۶) بعد از کوچ، شمارش دوباره ضرر را دوبار حساب نکند ----------
  const dbl = await page.evaluate(() => {
    const w = window;
    w.products.length = 0;
    w.products.push({ id:'p1', name:'برنج', type:'unit', unit:'pcs', buy:10, sell:20, qty:10, expiry:'' });
    w.stockCounts.length = 0; w.waste.length = 0;
    // رکورد کهنهٔ همین ماه با کلید میلادی + ضایعات کسری‌اش
    const nowIso = new Date().toISOString();
    w.stockCounts.push({ id:'c1', month:'2026/07', productId:'p1', productName:'برنج',
      unit:'pcs', calculated:12, counted:10, difference:-2, date: nowIso });
    w.waste.push({ id:'w1', productId:'p1', productName:'برنج', unit:'pcs', quantity:2,
      buyPrice:10, date: nowIso, reason:'shortage', countMonth:'2026/07' });
    w.__migrateMonthKeysToJalali();
    // حالا شمارش دوبارهٔ همین ماه
    w.moreView = 'count'; w.__renderMore();
    document.querySelector('[data-cnt="p1"]').value = '8';
    w.__saveCount();
    const rep = w.__computeReport('all');
    return { wasteCount: w.waste.length, loss: rep.wasteLoss };
  });
  console.log('\n۶) شمارش دوباره بعد از کوچ (ضرر نباید دوبار شود):');
  check('فقط یک ضایعات کسری ماند', dbl.wasteCount, 1);
  check('ضرر = ۲ × ۱۰', dbl.loss, 20);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
