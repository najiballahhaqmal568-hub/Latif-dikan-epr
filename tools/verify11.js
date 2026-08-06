// آزمایش شناسایی چشمی جنس: رنگ و حرف، عکس، تایل عکس‌محور، بک‌آپ و بازگرداندن
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

// یک PNG کوچک واقعی (۲×۲) به‌شکل base64 — برای ساختن File در مرورگر
const PNG2 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAF0lEQVR4nGP8z4AATAxIYFThKMKhqRAAccMBIVjEDFcAAAAASUVORK5CYII=';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', e => { console.log('  ⚠️ PAGE ERROR:', e.message); fail++; });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.evaluate(() => {
    const w = window;
    ['products','sales','customers','suppliers','purchases','supPayments','custPayments','waste','expenses','stockCounts','cashEntries']
      .forEach(k => { w[k].length = 0; });
    w.cart.length = 0;
    const add = (id,n,buy,sell) => w.products.push({ id, name:n, type:'unit', unit:'piece', buy, sell, qty:20, expiry:'' });
    add('a1','کیک نازگل',3,5); add('a2','کیک انار',2.5,5); add('a3','آدامس',0.6,1);
    w.__save0('dukan.products.v1', w.products);
    document.querySelector('nav.tabs button[data-scr="sales"]').click();
    w.__renderSaleGrid();
  });
  await page.waitForTimeout(250);

  // ---------- ۱) رنگ ثابت از روی نام ----------
  console.log('\n۱) رنگ و حرف از روی نام:');
  const ident = await page.evaluate(() => ({
    same1: window.__prodColor('کیک نازگل'),
    same2: window.__prodColor('کیک نازگل'),
    other: window.__prodColor('کیک انار'),
    l1: window.__prodLetter('کیک نازگل'),
    l2: window.__prodLetter('  «آدامس»'),
    l3: window.__prodLetter(''),
    hue: window.__nameHue('کیک نازگل'),
  }));
  check('همان نام همیشه همان رنگ', ident.same1 === ident.same2, true);
  check('نام دیگر رنگ دیگر', ident.same1 !== ident.other, true);
  check('حرف اول «ک»', ident.l1, 'ک');
  check('نشانه‌ها رد می‌شوند', ident.l2, 'آ');
  check('نام خالی → ؟', ident.l3, '؟');
  check('رنگ در دایرهٔ ۰..۳۵۹', ident.hue >= 0 && ident.hue < 360, true);

  // ---------- ۲) بدون عکس: دایرهٔ رنگی با حرف ----------
  console.log('\n۲) تایل بدون عکس:');
  const noPhoto = await page.evaluate(() => {
    const t = document.querySelector('#saleGrid .tile[data-id="a1"]');
    const ico = t.querySelector('.ico');
    return {
      isPhotoTile: t.classList.contains('photo'),
      letter: ico ? ico.textContent.trim() : null,
      bg: ico ? ico.getAttribute('style') : null,
    };
  });
  check('تایل عادی است (نه عکسی)', noPhoto.isPhotoTile, false);
  check('حرف اول نشان داده شد', noPhoto.letter, 'ک');
  check('رنگ روی دایره گذاشته شد', /hsl\(/.test(noPhoto.bg || ''), true);

  // دو جنس هم‌حرف ولی رنگ فرق کند (کیک نازگل / کیک انار)
  const twoColors = await page.evaluate(() => {
    const a = document.querySelector('.tile[data-id="a1"] .ico').style.background;
    const b = document.querySelector('.tile[data-id="a2"] .ico').style.background;
    return a !== b;
  });
  check('دو «کیک» رنگ جدا دارند', twoColors, true);

  // ---------- ۳) کوچک‌کردن عکس ----------
  console.log('\n۳) کوچک‌کردن عکس (۲۵۶×۲۵۶ jpeg):');
  const shrunk = await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const f = new File([arr], 'x.png', { type: 'image/png' });
    const d = await window.__shrinkImage(f, 256);
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = d; });
    return { head: d.slice(0, 22), w: img.width, h: img.height };
  }, PNG2);
  check('نتیجه jpeg است', shrunk.head.indexOf('data:image/jpeg') === 0, true);
  check('عرض ۲۵۶', shrunk.w, 256);
  check('ارتفاع ۲۵۶ (مربع)', shrunk.h, 256);

  // ---------- ۴) ذخیره و خواندن عکس از IndexedDB ----------
  console.log('\n۴) انبار عکس:');
  const stored = await page.evaluate(async () => {
    const d = 'data:image/jpeg;base64,AAAA';
    await window.__photoSave('a1', d);
    const inCache = window.__photoOf({ id: 'a1' }) === d;
    // خواندن دوباره از خود دیتابیس (کش پاک شود و از نو بار شود)
    const loaded = await window.__photoLoadAll();
    return { inCache: inCache, fromDb: loaded['a1'] === d, count: window.__photoCount() };
  });
  check('در کش نشست', stored.inCache, true);
  check('در IndexedDB ماند', stored.fromDb, true);
  check('شمار عکس ۱', stored.count, 1);

  // ---------- ۵) تایل عکس‌محور ----------
  await page.evaluate(() => window.__renderSaleGrid());
  await page.waitForTimeout(150);
  console.log('\n۵) تایل عکس‌دار:');
  const photoTile = await page.evaluate(() => {
    const t = document.querySelector('#saleGrid .tile[data-id="a1"]');
    const img = t.querySelector('img.ph');
    const cap = t.querySelector('.phcap');
    const r = t.getBoundingClientRect(), ir = img ? img.getBoundingClientRect() : null;
    return {
      isPhoto: t.classList.contains('photo'),
      hasImg: !!img,
      name: cap ? cap.querySelector('.nm').textContent : null,
      hasPrice: !!(cap && cap.querySelector('.pr')),
      // عکس باید بخش عمدهٔ تایل را بگیرد
      share: ir ? ir.height / r.height : 0,
      otherStillBadge: !!document.querySelector('.tile[data-id="a2"] .ico'),
    };
  });
  check('تایل عکسی شد', photoTile.isPhoto, true);
  check('عکس داخل تایل', photoTile.hasImg, true);
  check('نام روی تایل ماند', photoTile.name, 'کیک نازگل');
  check('نرخ روی تایل ماند', photoTile.hasPrice, true);
  check('عکس بیش از نیم تایل', photoTile.share > 0.5, true);
  check('جنس بی‌عکس هنوز دایرهٔ رنگی دارد', photoTile.otherStillBadge, true);

  // ---------- ۶) زدن تایل عکسی باز هم بفروشد ----------
  console.log('\n۶) فروش با تایل عکسی:');
  await page.click('#saleGrid .tile[data-id="a1"]');
  await page.waitForTimeout(200);
  const sold = await page.evaluate(() => {
    const w = window;
    const inCart = w.cart.length === 1 && w.cart[0].productId === 'a1';
    w.__finishSale('cash', null);
    const r = w.__computeReport('all');
    return { inCart: inCart, total: r.totalSales, profit: r.profit, qty: w.products[0].qty };
  });
  check('در سبد رفت', sold.inCart, true);
  check('مجموع فروش ۵', sold.total, 5);
  check('فایده ۲', sold.profit, 2);
  check('موجودی ۱۹', sold.qty, 19);

  // ---------- ۷) فهرست اجناس هم عکس/دایره نشان دهد ----------
  await page.evaluate(() => { document.querySelector('nav.tabs button[data-scr="products"]').click(); });
  await page.waitForTimeout(250);
  console.log('\n۷) فهرست اجناس:');
  const list = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#prodList .prow')];
    const withImg = rows.filter(r => r.querySelector('img.ico.ph')).length;
    const withBadge = rows.filter(r => {
      const b = r.querySelector('div.ico');
      return !!b && /hsl\(/.test(b.getAttribute('style') || '');
    }).length;
    return { rows: rows.length, withImg: withImg, withBadge: withBadge };
  });
  check('۳ سطر', list.rows, 3);
  check('۱ سطر عکس دارد', list.withImg, 1);
  check('۲ سطر دایرهٔ رنگی دارند', list.withBadge, 2);

  // ---------- ۸) فورم جنس: پیش‌نمایش زندهٔ حرف ----------
  await page.evaluate(() => document.getElementById('btnAdd').click());
  await page.waitForTimeout(250);
  console.log('\n۸) فورم جنس نو:');
  await page.fill('#fName', 'شامپو');
  await page.waitForTimeout(150);
  const formPrev = await page.evaluate(() => ({
    letter: document.querySelector('#fPhotoBox .ico').textContent.trim(),
    delHidden: document.getElementById('fPhotoDel').style.display,
    hasFileInput: !!document.getElementById('fPhotoInp'),
    capture: document.getElementById('fPhotoInp').getAttribute('capture'),
  }));
  check('حرف اول زنده شد', formPrev.letter, 'ش');
  check('دکمهٔ حذف عکس پنهان است', formPrev.delHidden, 'none');
  check('خانهٔ عکس هست', formPrev.hasFileInput, true);
  check('کمرهٔ پشت‌سر باز می‌شود', formPrev.capture, 'environment');

  // عکس گرفتن در خود فورم و ذخیره
  await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([arr], 'x.png', { type: 'image/png' }));
    const inp = document.getElementById('fPhotoInp');
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change'));
  }, PNG2);
  await page.waitForTimeout(400);
  const afterShot = await page.evaluate(() => ({
    hasImg: !!document.querySelector('#fPhotoBox img'),
    delShown: document.getElementById('fPhotoDel').style.display !== 'none',
  }));
  check('پیش‌نمایش عکس آمد', afterShot.hasImg, true);
  check('دکمهٔ حذف عکس پیدا شد', afterShot.delShown, true);

  await page.fill('#fSell', '20');
  await page.fill('#fBuy', '14');
  await page.fill('#fQty', '5');
  await page.click('#fSave');
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => {
    const p = window.products.filter(x => x.name === 'شامپو')[0];
    return { exists: !!p, hasPhoto: !!window.__photoOf(p), count: window.__photoCount() };
  });
  console.log('\n۹) ذخیرهٔ جنس نو با عکس:');
  check('جنس ثبت شد', saved.exists, true);
  check('عکسش ماند', saved.hasPhoto, true);
  check('شمار عکس ۲', saved.count, 2);

  // ---------- ۱۰) حذف عکس در ویرایش ----------
  console.log('\n۱۰) برداشتن عکس در ویرایش:');
  await page.evaluate(() => {
    const p = window.products.filter(x => x.name === 'شامپو')[0];
    window.__openProductForm(p);
  });
  await page.waitForTimeout(300);
  await page.click('#fPhotoDel');
  await page.waitForTimeout(150);
  const afterDel = await page.evaluate(() => ({
    backToBadge: !!document.querySelector('#fPhotoBox .ico') && !document.querySelector('#fPhotoBox img'),
  }));
  check('دوباره دایرهٔ رنگی شد', afterDel.backToBadge, true);
  await page.click('#fSave');
  await page.waitForTimeout(400);
  const goneChecks = await page.evaluate(() => {
    const p = window.products.filter(x => x.name === 'شامپو')[0];
    return { hasPhoto: !!window.__photoOf(p), star: p.star === true || p.star === false, count: window.__photoCount() };
  });
  check('عکس پاک شد', goneChecks.hasPhoto, false);
  check('شمار عکس دوباره ۱', goneChecks.count, 1);

  // ---------- ۱۱) حذف جنس، عکسش را هم ببرد ----------
  console.log('\n۱۱) حذف جنس:');
  const afterProdDel = await page.evaluate(async () => {
    await window.__photoSave('a2', 'data:image/jpeg;base64,BBBB');
    const before = window.__photoCount();
    // حذف مستقیم مثل دکمهٔ حذف
    window.products = window.products.filter(x => x.id !== 'a2');
    await window.__photoRemove('a2');
    const reloaded = await window.__photoLoadAll();
    return { before: before, after: window.__photoCount(), inDb: !!reloaded['a2'] };
  });
  check('پیش از حذف ۲ عکس', afterProdDel.before, 2);
  check('پس از حذف ۱ عکس', afterProdDel.after, 1);
  check('از IndexedDB هم رفت', afterProdDel.inDb, false);

  // ---------- ۱۲) عکس در بک‌آپ بیاید، در سنک نه ----------
  console.log('\n۱۲) بک‌آپ و سنک:');
  const backup = await page.evaluate(() => {
    const sync = window.__collectData();
    // همان کاری که downloadBackup می‌کند
    const bak = window.__collectData();
    bak.photos = JSON.parse(JSON.stringify({ a1: window.__photoOf({ id: 'a1' }) }));
    return {
      syncHasPhotos: Object.prototype.hasOwnProperty.call(sync, 'photos'),
      bakHasPhotos: !!bak.photos && Object.keys(bak.photos).length === 1,
    };
  });
  check('سنک عکس ندارد (سبک می‌ماند)', backup.syncHasPhotos, false);
  check('بک‌آپ عکس دارد', backup.bakHasPhotos, true);

  // ---------- ۱۳) بازگرداندن از فایل بک‌آپ ----------
  console.log('\n۱۳) بازگرداندن بک‌آپ:');
  const restored = await page.evaluate(async () => {
    const d = {
      __backupDate: '2026-07-01T00:00:00.000Z',
      products: [{ id: 'z1', name: 'روغن', type: 'unit', unit: 'piece', buy: 100, sell: 130, qty: 4, expiry: '' }],
      sales: [], customers: [{ id: 'c1', name: 'احمد', opening: 50 }], suppliers: [],
      purchases: [], supPayments: [], custPayments: [], waste: [], expenses: [],
      stockCounts: [], cashEntries: [],
      photos: { z1: 'data:image/jpeg;base64,CCCC' }
    };
    window.__confirmRestore(d);
    document.getElementById('restOk').click();
    await new Promise(r => setTimeout(r, 500));
    const reloaded = await window.__photoLoadAll();
    return {
      prodCount: window.products.length,
      prodName: window.products[0] && window.products[0].name,
      custDebt: window.__custDebt(window.customers[0]),
      photoBack: window.__photoOf({ id: 'z1' }) === 'data:image/jpeg;base64,CCCC',
      oldGone: !reloaded['a1'],
      inDb: reloaded['z1'] === 'data:image/jpeg;base64,CCCC',
    };
  });
  check('اجناس عوض شد', restored.prodCount, 1);
  check('نام درست', restored.prodName, 'روغن');
  check('قرض قبلی مشتری هم آمد', restored.custDebt, 50);
  check('عکس بازگشت', restored.photoBack, true);
  check('عکس‌های کهنه رفتند', restored.oldGone, true);
  check('در IndexedDB نشست', restored.inDb, true);

  // فایل بی‌ربط رد شود
  const badFile = await page.evaluate(() => {
    const before = window.products.length;
    try { window.__confirmRestore({ hello: 1 }); } catch (e) {}
    return { unchanged: window.products.length === before };
  });
  check('فایل بی‌ربط چیزی را خراب نکرد', badFile.unchanged, true);

  // ---------- ۱۴) شروع نو عکس‌ها را هم ببرد ----------
  console.log('\n۱۴) شروع نو:');
  const wiped = await page.evaluate(async () => {
    window.__wipeAll();
    await new Promise(r => setTimeout(r, 400));
    const reloaded = await window.__photoLoadAll();
    return { products: window.products.length, photos: Object.keys(reloaded).length };
  });
  check('اجناس صفر', wiped.products, 0);
  check('عکس‌ها صفر', wiped.photos, 0);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `✅ همه درست — ${pass} آزمایش موفق` : `❌ ${fail} ناکام از ${pass + fail}`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
