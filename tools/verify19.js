// آزمایش برگشتی: رد پول باید همیشه دقیقاً به رقم صندوق برسد.
// باگ: باطل‌کردن فاکتور خریدِ نقدی، سطر برگشت پول را در «رد پول» نمی‌آورد،
// چون cashMovements فاکتورهای paid <= 0 را رد می‌کرد و رکورد باطل paid منفی دارد.
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

  await page.evaluate(() => {
    window.__T = {
      reset: function () {
        const w = window;
        ['products','sales','customers','suppliers','purchases','supPayments',
         'custPayments','waste','expenses','stockCounts','cashEntries']
          .forEach(k => { w[k].length = 0; });
        w.cart.length = 0;
        w.products.push({ id:'A', name:'برنج', type:'unit', unit:'piece', buy:80, sell:100, qty:100, expiry:'' });
        w.cashEntries.push({ id:'op', date:'2020-01-01T00:00:00.000Z', kind:'opening', amount:50000 });
        w.customers.push({ id:'c1', name:'احمد', phone:'', opening:1000 });
        w.suppliers.push({ id:'s1', name:'کریم', phone:'', opening:1000 });
        w.__invalidateDebts();
        document.getElementById('overlay').classList.remove('open');
      },
      trail: function () { const m = window.__cashMovements(); return m.length ? m[0].balance : 0; },
      okVoid: function () {
        const y = document.getElementById('voidOk'); if (y) y.click();
        document.getElementById('overlay').classList.remove('open');
      }
    };
  });

  // ===== ۱) کوچک‌ترین حالت: فاکتور نقدی → باطل =====
  console.log('\n۱) فاکتور خرید با پرداخت ۵۹۶، بعد باطل:');
  let r = await page.evaluate(() => {
    const w = window; w.__T.reset();
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-20', paid:596,
      lines:[{ productId:'A', name:'برنج', unit:'piece', qty:5, buyPrice:10 }] };
    w.__savePurchase();
    document.getElementById('overlay').classList.remove('open');
    const afterBuy = { bal: w.__cashBalance(), tr: w.__T.trail() };
    w.__voidPurchase(w.purchases[0]); w.__T.okVoid();
    const rows = w.__cashMovements().filter(m => /خرید نقد/.test(m.label));
    return { afterBuy: afterBuy, bal: w.__cashBalance(), tr: w.__T.trail(),
             rows: rows.length, amounts: rows.map(x => x.amount).sort((a,b)=>a-b) };
  });
  check('پس از خرید: صندوق ۴۹٬۴۰۴', r.afterBuy.bal, 49404);
  check('پس از خرید: رد پول هم ۴۹٬۴۰۴', r.afterBuy.tr, 49404);
  check('پس از باطل: صندوق ۵۰٬۰۰۰', r.bal, 50000);
  check('پس از باطل: رد پول هم ۵۰٬۰۰۰', r.tr, 50000);
  check('دو سطر خرید در رد پول (اصل + برگشت)', r.rows, 2);
  check('سطرها همدیگر را خنثی می‌کنند', r.amounts[0] + r.amounts[1], 0);

  // ===== ۲) بقیهٔ راه‌های باطل هم نشکنند =====
  console.log('\n۲) بقیهٔ باطل‌کردن‌ها:');
  r = await page.evaluate(() => {
    const w = window, out = {};
    w.__T.reset();
    w.supPayments.push({ id:'sp', supplierId:'s1', date:new Date().toISOString(), amount:300 });
    w.__invalidateDebts(); w.__voidSupPayment(w.supPayments[0]); w.__T.okVoid();
    out.sup = { bal: w.__cashBalance(), tr: w.__T.trail() };

    w.__T.reset();
    w.custPayments.push({ id:'cp', customerId:'c1', date:new Date().toISOString(), amount:400 });
    w.__invalidateDebts(); w.__voidCustPayment(w.custPayments[0]); w.__T.okVoid();
    out.cust = { bal: w.__cashBalance(), tr: w.__T.trail() };

    w.__T.reset();
    w.cashEntries.push({ id:'o1', date:new Date().toISOString(), kind:'out', amount:200, note:'بانک' });
    w.__voidCashEntry(w.cashEntries[w.cashEntries.length - 1]); w.__T.okVoid();
    out.out = { bal: w.__cashBalance(), tr: w.__T.trail() };

    w.__T.reset();
    w.cashEntries.push({ id:'i1', date:new Date().toISOString(), kind:'in', amount:700, note:'خانه' });
    w.__voidCashEntry(w.cashEntries[w.cashEntries.length - 1]); w.__T.okVoid();
    out.in = { bal: w.__cashBalance(), tr: w.__T.trail() };

    w.__T.reset();
    w.draft = { supplierName:'کریم', phone:'', date:'2026-07-20', paid:0,
      lines:[{ productId:'A', name:'برنج', unit:'piece', qty:5, buyPrice:10 }] };
    w.__savePurchase(); document.getElementById('overlay').classList.remove('open');
    w.__voidPurchase(w.purchases[0]); w.__T.okVoid();
    out.credit = { bal: w.__cashBalance(), tr: w.__T.trail() };
    return out;
  });
  ['sup','cust','out','in','credit'].forEach(k => {
    const lbl = { sup:'رسید تامین‌کننده', cust:'رسید مشتری', out:'پول خارج',
                  in:'پول داخل', credit:'فاکتور قرضی (paid=0)' }[k];
    check('باطل ' + lbl + ': رد پول = صندوق', r[k].tr, r[k].bal);
  });

  // ===== ۳) باطل کردن چند فاکتور نقدی پشت هم =====
  console.log('\n۳) سه فاکتور نقدی، هر سه باطل:');
  r = await page.evaluate(() => {
    const w = window; w.__T.reset();
    [100, 250, 375].forEach(function (amt, i) {
      w.draft = { supplierName:'کریم', phone:'', date:'2026-07-2' + i, paid:amt,
        lines:[{ productId:'A', name:'برنج', unit:'piece', qty:2, buyPrice:10 }] };
      w.__savePurchase();
      document.getElementById('overlay').classList.remove('open');
    });
    const mid = { bal: w.__cashBalance(), tr: w.__T.trail() };
    w.purchases.slice().forEach(function (pu) {
      if (w.__isVoided(pu)) return;
      w.__voidPurchase(pu); w.__T.okVoid();
    });
    return { mid: mid, bal: w.__cashBalance(), tr: w.__T.trail(),
             rows: w.__cashMovements().filter(m => /خرید نقد/.test(m.label)).length };
  });
  check('پس از سه خرید: صندوق ۴۹٬۲۷۵', r.mid.bal, 49275);
  check('پس از سه خرید: رد پول جور', r.mid.tr, r.mid.bal);
  check('پس از سه باطل: صندوق ۵۰٬۰۰۰', r.bal, 50000);
  check('پس از سه باطل: رد پول جور', r.tr, r.bal);
  check('شش سطر خرید (سه اصل + سه برگشت)', r.rows, 6);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
