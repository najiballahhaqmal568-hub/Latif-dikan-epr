// حلقهٔ fuzz برای دفتر «دوکان لطیف».
// دنباله‌های تصادفی از کارهای واقعی دوکان اجرا می‌شوند و بعد از هر قدم
// «قوانین دفتر» بررسی می‌گردند. هر شکستن قانون = یک باگ.
//
//   node fuzz.js [iterations] [opsPerIter] [seed]
//
// خروجی هنگام شکست: seed و دنبالهٔ دقیق قدم‌ها، تا دقیقاً همان دوباره اجرا شود.
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'test-index.html');

const ITERS = parseInt(process.argv[2] || '150', 10);
const OPS = parseInt(process.argv[3] || '25', 10);
const SEED0 = parseInt(process.argv[4] || '1', 10);

// ---- ژنراتور تصادفی با seed (mulberry32) — تا هر شکست دقیقاً تکرارشدنی باشد
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- کدی که داخل صفحه نصب می‌شود: اجرای یک دنباله + بررسی قوانین
const HARNESS = function () {
  const w = window;
  const EPS = 0.02;

  function near(a, b) { return Math.abs(a - b) < EPS; }
  function bad(n) { return typeof n !== "number" || !isFinite(n); }

  // ---------- قوانین دفتر ----------
  // هرکدام باید در هر حالتی درست بماند. شکستنشان یعنی باگ.
  w.__fzInvariants = function () {
    const out = [];
    const rep = w.__computeReport("all");

    // ۱) رد پول باید دقیقاً به رقم صندوق برسد
    const moves = w.__cashMovements();
    const trail = moves.length ? moves[0].balance : 0;
    const bal = w.__cashBalance();
    if (!near(trail, bal)) out.push("رد پول (" + trail + ") با رقم صندوق (" + bal + ") جور نیست");

    // ۲) صندوقِ گزارش == صندوق زنده
    if (!near(rep.cashBox, bal)) out.push("صندوق گزارش (" + rep.cashBox + ") با صندوق زنده (" + bal + ") جور نیست");

    // ۳) اجزای صندوق == رقم صندوق
    const b = w.__cashBreakdown();
    const sum = b.opening + b.sales + b.custPaid + b.manualIn + b.adjust
              - b.purchasePaid - b.supPaid - b.expenses - b.manualOut;
    if (!near(sum, bal)) out.push("جمع اجزای صندوق (" + sum + ") با رقم صندوق (" + bal + ") جور نیست");

    // ۴) قرض هر مشتری == قرض قبلی + فروش قرضی − دریافت‌ها
    w.customers.forEach(function (c) {
      const cb = w.__custBreakdown(c);
      const d = w.__custDebt(c);
      if (!near(cb.opening + cb.sales - cb.paid, d))
        out.push("قرض مشتری «" + c.name + "» با اجزایش جور نیست");
      if (!near(cb.paidCash + cb.paidGoods, cb.paid))
        out.push("اجزای دریافت مشتری «" + c.name + "» (نقد+جنس) با مجموع جور نیست");
      if (bad(d)) out.push("قرض مشتری «" + c.name + "» عدد نیست: " + d);
    });

    // ۵) قرض هر تامین‌کننده == قرض قبلی + باقی فاکتورها − پرداخت‌ها
    w.suppliers.forEach(function (s) {
      const sb = w.__supBreakdown(s);
      const d = w.__supDebt(s);
      if (!near(sb.opening + sb.buys - sb.paid, d))
        out.push("قرض تامین‌کننده «" + s.name + "» با اجزایش جور نیست");
      if (bad(d)) out.push("قرض تامین‌کننده «" + s.name + "» عدد نیست: " + d);
    });

    // ۶) کانال‌ها: دوکان + بازار == مجموع
    if (!near(rep.shopSales + rep.bazaarSales, rep.totalSales))
      out.push("فروش دوکان+بازار با مجموع فروش جور نیست");
    if (!near(rep.shopProfit + rep.bazaarProfit, rep.totalSales - rep.cogs))
      out.push("فایدهٔ دوکان+بازار با (فروش − تمام‌شد) جور نیست");

    // ۷) فرمول فایده
    if (!near(rep.profit, rep.totalSales - rep.cogs - rep.wasteLoss - rep.cashShort))
      out.push("فایدهٔ دوکان با فرمولش جور نیست");
    if (!near(rep.netProfit, rep.profit - rep.expenses))
      out.push("فایدهٔ نهایی با (فایده − مصارف) جور نیست");

    // ۸) جمع فایدهٔ هر جنس == فروش − تمام‌شد
    let pp = 0;
    Object.keys(rep.perProduct).forEach(function (k) { pp += rep.perProduct[k].profit; });
    if (!near(pp, rep.totalSales - rep.cogs))
      out.push("جمع فایدهٔ اجناس (" + pp + ") با (فروش − تمام‌شد) (" + (rep.totalSales - rep.cogs) + ") جور نیست");

    // ۹) هیچ رقمی نباید NaN شود
    ["totalSales","cash","credit","cogs","wasteLoss","expenses","expensesGoods",
     "profit","netProfit","cashIn","cashOut","cashBox","cashShort",
     "shopSales","bazaarSales","shopProfit","bazaarProfit"].forEach(function (k) {
      if (bad(rep[k])) out.push("رقم گزارش «" + k + "» عدد نیست: " + rep[k]);
    });
    if (bad(bal)) out.push("رقم صندوق عدد نیست: " + bal);
    w.products.forEach(function (p) {
      if (bad(p.qty)) out.push("موجودی «" + p.name + "» عدد نیست: " + p.qty);
      if (bad(p.buy)) out.push("قیمت خرید «" + p.name + "» عدد نیست: " + p.buy);
      if (bad(p.sell)) out.push("قیمت فروش «" + p.name + "» عدد نیست: " + p.sell);
    });

    // ۱۰) مصرف «به جنس» نباید در صندوق یا رد پول بیاید
    let goodsExp = 0;
    w.expenses.forEach(function (e) { if (w.__isGoodsExpense(e)) goodsExp += e.amount; });
    if (!near(rep.expensesGoods, goodsExp)) out.push("جمع مصرف به جنس در گزارش جور نیست");
    // مصارفِ صندوق باید دقیقاً «مصارف کل منهای مصارف جنسی» باشد
    if (!near(b.expenses, rep.expenses - rep.expensesGoods))
      out.push("مصارف صندوق (" + b.expenses + ") با (کل − جنسی) (" + (rep.expenses - rep.expensesGoods) + ") جور نیست");

    // ۱۲) حساب مستقل: همان رقم‌ها از روی دادهٔ خام دوباره حساب و مقایسه
    //     می‌شوند — برای هر سه دوره. اگر فلتر دوره یا مرز ماه شمسی خراب
    //     باشد، اینجا لو می‌رود.
    ["today", "month", "all"].forEach(function (per) {
      const R = w.__computeReport(per);
      const start = w.__periodStart(per);
      const inP = function (d) { return new Date(d) >= start; };
      let tSales = 0, tCash = 0, tCredit = 0, tCogs = 0, tWaste = 0, tExp = 0, tShop = 0, tBaz = 0;
      w.sales.forEach(function (sa) {
        if (!inP(sa.date)) return;
        tSales += sa.total;
        if (sa.paymentType === "cash") tCash += sa.total; else tCredit += sa.total;
        if (w.__saleChannel(sa) === "bazaar") tBaz += sa.total; else tShop += sa.total;
        (sa.items || []).forEach(function (it) {
          const pr = w.__findP(it.productId);
          const buy = (it.buyPrice != null) ? it.buyPrice : (pr ? (pr.buy || 0) : 0);
          tCogs += it.quantity * buy;
        });
      });
      w.waste.forEach(function (x) { if (inP(x.date)) tWaste += x.quantity * x.buyPrice; });
      w.expenses.forEach(function (x) { if (inP(x.date)) tExp += x.amount; });
      const tag = " [دورهٔ " + per + "]";
      if (!near(R.totalSales, tSales)) out.push("مجموع فروش گزارش با حساب مستقل جور نیست" + tag);
      if (!near(R.cash, tCash)) out.push("فروش نقد گزارش با حساب مستقل جور نیست" + tag);
      if (!near(R.credit, tCredit)) out.push("فروش قرض گزارش با حساب مستقل جور نیست" + tag);
      if (!near(R.cogs, tCogs)) out.push("قیمت تمام‌شد گزارش با حساب مستقل جور نیست" + tag);
      if (!near(R.wasteLoss, tWaste)) out.push("ضرر ضایعات گزارش با حساب مستقل جور نیست" + tag);
      if (!near(R.expenses, tExp)) out.push("مصارف گزارش با حساب مستقل جور نیست" + tag);
      if (!near(R.shopSales, tShop)) out.push("فروش دوکان گزارش با حساب مستقل جور نیست" + tag);
      if (!near(R.bazaarSales, tBaz)) out.push("فروش بازار گزارش با حساب مستقل جور نیست" + tag);
      // فرمول‌ها در هر دوره
      if (!near(R.profit, R.totalSales - R.cogs - R.wasteLoss - R.cashShort))
        out.push("فرمول فایده در دوره جور نیست" + tag);
      if (!near(R.netProfit, R.profit - R.expenses))
        out.push("فرمول فایدهٔ نهایی در دوره جور نیست" + tag);
      if (!near(R.shopProfit + R.bazaarProfit, R.totalSales - R.cogs))
        out.push("فایدهٔ کانال‌ها در دوره جور نیست" + tag);
      if (!near(R.cashBox, R.cashIn - R.cashOut))
        out.push("صندوق دوره با (داخل − خارج) جور نیست" + tag);
      let ppp = 0;
      Object.keys(R.perProduct).forEach(function (k) { ppp += R.perProduct[k].profit; });
      if (!near(ppp, R.totalSales - R.cogs)) out.push("جمع فایدهٔ اجناس در دوره جور نیست" + tag);
      ["totalSales","cogs","profit","netProfit","cashBox"].forEach(function (k) {
        if (bad(R[k])) out.push("رقم «" + k + "» عدد نیست" + tag);
      });
    });

    // ۱۴) گدام: موجودی هیچ جنسی نباید منفی شود، **مگر** خودِ دوکان‌دار
    //     «به‌هرحال ثبت کن» را زده باشد.
    //
    //     چرا این قانون دیر آمد: سیزده قانون اول همه دربارهٔ پول و قرض
    //     بودند و هیچ‌کدام گدام را نمی‌پاییدند. برای همین دو راهِ خروج
    //     جنس که محافظ نداشتند از ۶۰٬۰۰۰ کار fuzz سالم گذشتند —
    //     باطل‌کردن «دریافت به جنس»، و ثبت ضایعات بیشتر از موجودی
    //     (که ضرر ساختگی هم به فایده می‌زد).
    //     نشان **فی جنس** است، نه یک شمارندهٔ سراسری: ورنه اولین
    //     «به‌هرحال» تمام اجناس را تا آخر دنباله بی‌پایش می‌گذاشت.
    const okNeg = w.__stockOverridden || {};
    w.products.forEach(function (p) {
      if (p.qty < -0.0005 && !okNeg[p.id]) {
        out.push("موجودی «" + p.name + "» بدون تصمیم دوکان‌دار منفی شد: " + p.qty);
      }
    });

    return out;
  };

  // ۱۱) رفت‌وبرگشت سنک: هر رقم باید بعد از collect→apply همان بماند
  w.__fzRoundTrip = function () {
    const before = snapshot();
    const blob = JSON.parse(JSON.stringify(w.__collectData()));
    w.__applyData(blob);
    const after = snapshot();
    const out = [];
    Object.keys(before).forEach(function (k) {
      if (!near(before[k], after[k])) out.push("پس از سنک، «" + k + "» عوض شد: " + before[k] + " → " + after[k]);
    });
    return out;
    function snapshot() {
      const r = w.__computeReport("all");
      return { cash: w.__cashBalance(), sales: r.totalSales, cogs: r.cogs,
               profit: r.profit, net: r.netProfit, waste: r.wasteLoss,
               custD: w.__custDebtTotal(), supD: w.__supDebtTotal(),
               bazaar: r.bazaarSales, expG: r.expensesGoods,
               qty: w.products.reduce(function (a, p) { return a + p.qty; }, 0) };
    }
  };

  // ۱۳) رفت‌وبرگشت فایل بک‌آپ: گرفتن فایل → «شروع نو» → بازگرداندن.
  //     این تکیه‌گاه نجات دوکان‌دار است؛ اگر چیزی گم یا خراب شود، سال
  //     کارش می‌رود. عکس‌ها هم داخلش می‌آیند.
  w.__fzBackupRoundTrip = function () {
    const before = w.__fzSnap();
    // همان کاری که downloadBackup می‌کند
    const blob = JSON.parse(JSON.stringify(w.__collectData()));
    blob.photos = JSON.parse(JSON.stringify(w.photoCacheForTest || {}));
    blob.__backupDate = new Date().toISOString();
    // همه چیز پاک شود، بعد از فایل برگردانده شود
    w.__wipeAll();
    const closeBtn = document.querySelector("#sheet [data-close]");
    if (closeBtn) closeBtn.click();
    document.getElementById("overlay").classList.remove("open");
    const wiped = w.__fzSnap();
    w.__confirmRestore(blob);
    const ok = document.getElementById("restOk");
    if (!ok) return ["دکمهٔ بازگرداندن پیدا نشد"];
    ok.click();
    document.getElementById("overlay").classList.remove("open");
    const after = w.__fzSnap();
    const out = [];
    // اول مطمئن شویم «شروع نو» واقعاً پاک کرده بود (ورنه آزمایش بی‌معنی است)
    if (wiped.sales !== 0 || wiped.custD !== 0) out.push("«شروع نو» همه را پاک نکرد");
    Object.keys(before).forEach(function (k) {
      if (!near(before[k], after[k]))
        out.push("پس از بک‌آپ و بازگرداندن، «" + k + "» عوض شد: " + before[k] + " → " + after[k]);
    });
    return out;
  };
  w.__fzSnap = function () {
    const r = w.__computeReport("all");
    return { cash: w.__cashBalance(), sales: r.totalSales, cogs: r.cogs,
             profit: r.profit, net: r.netProfit, waste: r.wasteLoss,
             custD: w.__custDebtTotal(), supD: w.__supDebtTotal(),
             bazaar: r.bazaarSales, expG: r.expensesGoods, exp: r.expenses,
             qty: w.products.reduce(function (a, p) { return a + p.qty; }, 0),
             nProd: w.products.length, nCust: w.customers.length, nSup: w.suppliers.length };
  };

  // ---------- بستن شیت‌های محافظ (تا دنباله بند نماند) ----------
  function handleGuard(choice) {
    const ov = document.getElementById("overlay");
    if (!ov.classList.contains("open")) return null;
    const sh = document.getElementById("sheet");
    const pick = function (ids) {
      for (let i = 0; i < ids.length; i++) {
        const el = document.getElementById(ids[i]);
        if (el) return el;
      }
      return null;
    };
    // محافظ موجودی / محافظ صندوق / اخطار نرخ / اخطار قیمت خرید
    let el;
    if (choice < 0.5) el = pick(["stAnyway", "lcCredit", "lcFund", "lcAnyway"]);
    else el = pick(["stBack", "lcBack"]);
    if (!el) el = pick(["stAnyway", "lcFund", "lcAnyway", "stBack", "lcBack"]);
    if (el) { const id = el.id; el.click(); return id; }
    // شیت‌های اطلاعی (بازبینی نرخ، اخطار قیمت خرید) — فقط بسته شوند
    const close = sh.querySelector("[data-close]");
    if (close) { close.click(); return "close"; }
    ov.classList.remove("open");
    return "force-close";
  }
  // فقط بسته می‌شود؛ محتویاتش پاک نمی‌گردد تا setTimeout های focus()
  // روی عنصر نبود ارور ندهند (این نویزِ حلقه بود، نه باگ اپ).
  w.__fzCloseSheet = function () {
    document.getElementById("overlay").classList.remove("open");
  };

  // ---------- کارهای دوکان ----------
  function setVal(id, v) {
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  w.__fzOps = {
    // فروش نقد یا قرض
    sale: function (a) {
      const p = w.products[a.pi % w.products.length]; if (!p) return;
      w.cart.length = 0;
      w.__addToCart(p.id, a.qty);
      w.__finishSale(a.credit ? "credit" : "cash", a.credit ? a.name : null);
    },
    // فاکتور خرید
    purchase: function (a) {
      const p = w.products[a.pi % w.products.length]; if (!p) return;
      w.draft = { supplierName: a.sup, phone: "", date: a.date, paid: a.paid,
        lines: [{ productId: p.id, name: p.name, unit: p.unit, qty: a.qty, buyPrice: a.price }] };
      w.__savePurchase();
    },
    // برگشتی یک فروش تصادفی
    returnSale: function (a) {
      const ok = w.sales.filter(function (s) { return !s.returned && !s.returnOf; });
      if (!ok.length) return;
      w.__returnSale(ok[a.i % ok.length]);
    },
    // باطل‌کردن فاکتور
    voidPurchase: function (a) {
      const ok = w.purchases.filter(function (x) { return !w.__isVoided(x); });
      if (!ok.length) return;
      w.__voidPurchase(ok[a.i % ok.length]);
      const y = document.getElementById("voidOk"); if (y) y.click();
    },
    // دریافت نقدی از مشتری
    custPay: function (a) {
      if (!w.customers.length) return;
      const c = w.customers[a.i % w.customers.length];
      w.__openCustomerPay(c);
      setVal("cPayAmt", a.amt);
      const ok = document.getElementById("cPayOk"); if (ok) ok.click();
    },
    // دریافت به جنس
    goodsIn: function (a) {
      if (!w.customers.length || !w.products.length) return;
      const c = w.customers[a.i % w.customers.length];
      const p = w.products[a.pi % w.products.length];
      w.__openCustomerGoods(c);
      const pick = document.getElementById("gPick"); if (!pick) return;
      pick.click();
      const row = document.querySelector('[data-gp="' + p.id + '"]'); if (!row) return;
      row.click();
      setVal("gQty", a.qty); setVal("gPrice", a.price);
      const ok = document.getElementById("gOk"); if (ok) ok.click();
    },
    // پرداخت به تامین‌کننده
    supPay: function (a) {
      if (!w.suppliers.length) return;
      const s = w.suppliers[a.i % w.suppliers.length];
      w.__openPayDialog(s);
      setVal("payAmt", a.amt);
      const ok = document.getElementById("payOk"); if (ok) ok.click();
    },
    // مصرف نقدی
    expense: function (a) {
      w.__openExpenseForm();
      setVal("expAmt", a.amt); setVal("expNote", "خرچ");
      const ok = document.getElementById("expOk"); if (ok) ok.click();
    },
    // برداشتن جنس از گدام
    goodsExp: function (a) {
      if (!w.products.length) return;
      const p = w.products[a.pi % w.products.length];
      w.__openExpenseGoods();
      const pick = document.getElementById("xPick"); if (!pick) return;
      pick.click();
      const row = document.querySelector('[data-xp="' + p.id + '"]'); if (!row) return;
      row.click();
      setVal("xQty", a.qty);
      const ok = document.getElementById("xOk"); if (ok) ok.click();
    },
    // فروش بازار (نقد یا قرض)
    bazaar: function (a) {
      if (!w.products.length) return;
      const p = w.products[a.pi % w.products.length];
      w.__openBazaarSale();
      const pick = document.getElementById("bPick"); if (!pick) return;
      pick.click();
      const row = document.querySelector('[data-bp="' + p.id + '"]'); if (!row) return;
      row.click();
      setVal("bQty", a.qty); setVal("bPrice", a.price);
      if (a.credit) {
        const cb = document.querySelector('#bPay [data-b="credit"]'); if (cb) cb.click();
        setVal("bCust", a.name);
      }
      const ok = document.getElementById("bOk"); if (ok) ok.click();
    },
    // پول داخل / خارج صندوق
    cashIn: function (a) {
      w.__openCashEntry("in"); setVal("ceAmt", a.amt);
      const ok = document.getElementById("ceOk"); if (ok) ok.click();
    },
    cashOut: function (a) {
      w.__openCashEntry("out"); setVal("ceAmt", a.amt);
      const ok = document.getElementById("ceOk"); if (ok) ok.click();
    },
    // ضایعات
    waste: function (a) {
      if (!w.products.length) return;
      const p = w.products[a.pi % w.products.length];
      // از راه واقعیِ فورم ضایعات، نه ساختن دستی رکورد.
      //
      // پیش از این این کار رکورد را خودش می‌ساخت و موجودی را خودش کم
      // می‌کرد — یعنی محافظ موجودی اصلاً امتحان نمی‌شد. حلقه فکر می‌کرد
      // ضایعات را می‌پاید، ولی در واقع کود خودش را می‌پایید. یک باگ
      // واقعی (ثبت ضایعات بیشتر از موجودی) درست از همین‌جا پنهان ماند.
      w.__openWasteForm(p, a.guard < 0.5 ? "spoiled" : "expired");
      const inp = document.getElementById("wQty");
      if (!inp) return;
      inp.value = String(a.qty);
      const ok = document.getElementById("wOk");
      if (ok) ok.click();
    },
    voidWaste: function (a) {
      const ok = w.waste.filter(function (x) { return !w.__isVoided(x); });
      if (!ok.length) return;
      w.__voidWaste(ok[a.i % ok.length]);
      const y = document.getElementById("voidOk"); if (y) y.click();
    },
    voidGoodsExp: function (a) {
      const ok = w.expenses.filter(function (x) { return w.__isGoodsExpense(x) && !w.__isVoided(x); });
      if (!ok.length) return;
      w.__voidGoodsExpense(ok[a.i % ok.length]);
      const y = document.getElementById("voidOk"); if (y) y.click();
    },
    voidCustPay: function (a) {
      const ok = w.custPayments.filter(function (x) { return !w.__isVoided(x); });
      if (!ok.length) return;
      w.__voidCustPayment(ok[a.i % ok.length]);
      const y = document.getElementById("voidOk"); if (y) y.click();
    },
    voidSupPay: function (a) {
      const ok = w.supPayments.filter(function (x) { return !w.__isVoided(x); });
      if (!ok.length) return;
      w.__voidSupPayment(ok[a.i % ok.length]);
      const y = document.getElementById("voidOk"); if (y) y.click();
    },
    // شمارش شبانهٔ صندوق (کسری/زیادت)
    cashCount: function (a) {
      document.querySelector('nav.tabs button[data-scr="more"]').click();
      w.moreView = "cash"; w.__renderMore();
      const btn = document.getElementById("cashCountBtn"); if (!btn) return;
      btn.click();
      setVal("ccAmt", Math.max(0, +(w.__cashBalance() + (a.i - 2) * 137).toFixed(2)));
      const ok = document.getElementById("ccOk"); if (ok) ok.click();
    },
    // موجودی اول صندوق
    opening: function (a) {
      w.__openCashOpening();
      setVal("obAmt", a.amt);
      const ok = document.getElementById("obOk"); if (ok) ok.click();
    },
    // فاکتور چندقلمی
    purchaseMulti: function (a) {
      const lines = [];
      for (let k = 0; k < 1 + (a.i % 3); k++) {
        const p = w.products[(a.pi + k) % w.products.length]; if (!p) continue;
        if (lines.some(function (l) { return l.productId === p.id; })) continue;
        lines.push({ productId: p.id, name: p.name, unit: p.unit,
                     qty: +(a.qty / (k + 1)).toFixed(2), buyPrice: +(a.price / (k + 1)).toFixed(2) });
      }
      if (!lines.length) return;
      w.draft = { supplierName: a.sup, phone: "", date: a.date, paid: a.paid, lines: lines };
      w.__savePurchase();
    },
    // ویرایش جنس: تعداد یا نرخ عوض شود
    editProduct: function (a) {
      const p = w.products[a.pi % w.products.length]; if (!p) return;
      w.__openProductForm(p);
      if (a.credit) setVal("fQty", Math.max(0, +(p.qty + (a.i - 2) * 3).toFixed(2)));
      else setVal("fSell", Math.max(1, +(p.sell + (a.i - 2)).toFixed(2)));
      const sv = document.getElementById("fSave"); if (sv) sv.click();
      const qc = document.getElementById("qcOk"); if (qc) qc.click();
    },
    // فروش دو قلم در یک سبد
    saleMulti: function (a) {
      w.cart.length = 0;
      for (let k = 0; k < 2; k++) {
        const p = w.products[(a.pi + k) % w.products.length]; if (!p) continue;
        w.__addToCart(p.id, +(a.qty / (k + 1)).toFixed(2));
      }
      w.__finishSale(a.credit ? "credit" : "cash", a.credit ? a.name : null);
    },
    // حذف جنس
    deleteProduct: function (a) {
      if (w.products.length <= 1) return;
      const p = w.products[a.pi % w.products.length]; if (!p) return;
      w.__openProductForm(p);
      const del = document.getElementById("fDelete"); if (!del) return;
      del.click();
      const yes = document.getElementById("delYes"); if (yes) yes.click();
    },
    // انتقال باقی‌ماندهٔ وای‌فای تیرشده به ضایعات
    wifiWaste: function (a) {
      document.querySelector('nav.tabs button[data-scr="more"]').click();
      w.moreView = "wifi"; w.__renderMore();
      const btns = document.querySelectorAll("[data-wifiwaste]");
      if (!btns.length) return;
      btns[a.i % btns.length].click();
    },
    // شمارش ماهانه
    count: function (a) {
      document.querySelector('nav.tabs button[data-scr="more"]').click();
      w.moreView = "count"; w.__renderMore();
      w.products.forEach(function (p, i) {
        setVal2('[data-cnt="' + p.id + '"]', Math.max(0, +(p.qty + ((i + a.i) % 3) - 1).toFixed(2)));
      });
      const btn = document.getElementById("saveCountBtn"); if (btn) btn.click();
      function setVal2(sel, v) {
        const el = document.querySelector(sel); if (!el) return;
        el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
  };

  // اجرای یک دنبالهٔ کامل و بررسی قوانین بعد از هر قدم
  w.__fzRun = function (seq) {
    // حالت اولیهٔ ثابت
    ["products","sales","customers","suppliers","purchases","supPayments",
     "custPayments","waste","expenses","stockCounts","cashEntries"]
      .forEach(function (k) { w[k].length = 0; });
    w.cart.length = 0;
    w.moreView = null;
    w.products.push({ id: "A", name: "برنج", type: "weighted", unit: "kg", buy: 80, sell: 100, qty: 100, expiry: "" });
    w.products.push({ id: "B", name: "کیک", type: "unit", unit: "piece", buy: 8, sell: 10, qty: 200, expiry: "" });
    w.products.push({ id: "C", name: "تخم مرغ", type: "unit", unit: "piece", buy: 5, sell: 15, qty: 0, expiry: "" });
    // وای‌فای: یکی زنده، یکی تاریخ‌تیرشده (تا انتقال باقی‌مانده به ضایعات هم بیفتد)
    var past = new Date(); past.setDate(past.getDate() - 5);
    var fut = new Date(); fut.setDate(fut.getDate() + 40);
    w.products.push({ id: "D", name: "وای‌فای", type: "wifi", unit: "gb", buy: 10, sell: 20, qty: 250, expiry: fut.toISOString().slice(0, 10) });
    w.products.push({ id: "E", name: "وای‌فای تیرشده", type: "wifi", unit: "gb", buy: 12, sell: 20, qty: 60, expiry: past.toISOString().slice(0, 10) });
    w.cashEntries.push({ id: "op", date: "2020-01-01T00:00:00.000Z", kind: "opening", amount: 50000 });
    w.__invalidateDebts();
    // شمارندهٔ «به‌هرحال ثبت کن» هر دنباله از نو — ورنه یک اجازهٔ آگاهانه
    // در دنبالهٔ اول، قانون ۱۴ را برای تمام دنباله‌های بعدی خاموش می‌کرد.
    w.__stockOverrides = 0;
    w.__stockOverridden = {};
    w.__fzCloseSheet();

    for (let i = 0; i < seq.length; i++) {
      const step = seq[i];
      try {
        const fn = w.__fzOps[step.op];
        if (fn) fn(step);
      } catch (e) {
        return { step: i, op: step.op, violations: ["ارور: " + (e && e.message)] };
      }
      // اگر شیت محافظی باز شد، تصمیمش گرفته شود
      for (let g = 0; g < 3; g++) { if (handleGuard(step.guard) === null) break; }
      w.__fzCloseSheet();

      const v = w.__fzInvariants();
      if (v.length) return { step: i, op: step.op, violations: v };
    }
    const rt = w.__fzRoundTrip();
    if (rt.length) return { step: seq.length, op: "round-trip", violations: rt };
    const bk = w.__fzBackupRoundTrip();
    if (bk.length) return { step: seq.length, op: "backup-round-trip", violations: bk };
    return null;
  };
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  const pageErrors = [];
  // ارور focus() از تندعوض‌کردن شیت‌ها در خود حلقه می‌آید، نه از اپ
  page.on('pageerror', e => { if (!/reading 'focus'/.test(e.message)) pageErrors.push(e.message); });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(HARNESS);

  const OPNAMES = ['sale','sale','sale','saleMulti','purchase','purchase','purchaseMulti',
                   'returnSale','voidPurchase','custPay','goodsIn','supPay','expense',
                   'goodsExp','bazaar','bazaar','cashIn','cashOut','waste','voidWaste',
                   'voidGoodsExp','voidCustPay','voidSupPay','count','cashCount',
                   'opening','editProduct','deleteProduct','wifiWaste'];
  const NAMES = ['احمد','کریم','رحیم','متفرقه'];
  const SUPS = ['تامین ۱','تامین ۲'];
  const DATES = ['2026-07-10','2026-07-20','2026-07-20','2026-08-01'];

  let failures = 0, firstFail = null;
  const t0 = Date.now();

  for (let it = 0; it < ITERS; it++) {
    const seed = SEED0 + it;
    const rnd = rng(seed);
    const seq = [];
    for (let k = 0; k < OPS; k++) {
      seq.push({
        op: OPNAMES[Math.floor(rnd() * OPNAMES.length)],
        pi: Math.floor(rnd() * 5),
        i: Math.floor(rnd() * 5),
        qty: +(1 + rnd() * 30).toFixed(rnd() < 0.5 ? 0 : 2),
        price: +(1 + rnd() * 120).toFixed(rnd() < 0.5 ? 0 : 2),
        amt: +(1 + rnd() * 2000).toFixed(0),
        paid: +(rnd() * 2500).toFixed(0),
        credit: rnd() < 0.4,
        name: NAMES[Math.floor(rnd() * NAMES.length)],
        sup: SUPS[Math.floor(rnd() * SUPS.length)],
        date: DATES[Math.floor(rnd() * DATES.length)],
        guard: rnd(),
      });
    }
    const res = await page.evaluate(s => window.__fzRun(s), seq);
    if (res) {
      failures++;
      if (!firstFail) {
        firstFail = { seed, res, seq: seq.slice(0, res.step + 1) };
        console.log('\n❌ قانون شکست — seed ' + seed + '، قدم ' + res.step + ' («' + res.op + '»)');
        res.violations.forEach(v => console.log('   • ' + v));
      }
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(52));
  console.log('اجرا: ' + ITERS + ' دنباله × ' + OPS + ' قدم = ' + (ITERS * OPS) + ' کار، در ' + secs + ' ثانیه');
  if (pageErrors.length) {
    console.log('⚠️ ارورهای صفحه: ' + pageErrors.length);
    [...new Set(pageErrors)].slice(0, 5).forEach(e => console.log('   • ' + e));
  }
  if (failures) {
    console.log('❌ ' + failures + ' دنباله از ' + ITERS + ' قانون را شکستند');
    require('fs').writeFileSync(path.join(__dirname,'fuzz-fail.json'), JSON.stringify(firstFail, null, 1));
    console.log('   نمونهٔ اول در fuzz-fail.json ذخیره شد');
  } else {
    console.log('✅ هیچ قانونی نشکست — ' + ITERS + ' دنباله');
  }
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
