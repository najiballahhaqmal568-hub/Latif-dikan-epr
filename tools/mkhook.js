// ساختن test-index.html — همان اپ، با یک پل باریک به آزمایش‌ها.
// اپ در یک (function(){…})() بسته است، پس از بیرون به هیچ چیز نمی‌رسد.
// اینجا پیش از })(; پایانی چند سطر export تزریق می‌شود.
//
// فهرست پایین الفبایی و بی‌تکرار نگه داشته شود — پیش از این ۹ نام دو بار
// در آن بود، یعنی کسی دیگر نمی‌دانست چه چیزی از قبل داخلش است.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let h = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');

// آرایه‌های حالت — با get/set تا آزمایش هم بخواند و هم عوض کند
const names = ['cart', 'cashEntries', 'customers', 'custPayments', 'draft', 'expenses',
  'moreView', 'products', 'purchases', 'sales', 'stockCounts', 'suppliers',
  'supPayments', 'waste'];

const fns = [
  'addToCart', 'applyData', 'bumpLine',
  'cashBalance', 'cashBreakdown', 'cashEvents', 'cashMovements',
  'cashNetWithoutOpening', 'cashOpeningEntry', 'collectData', 'computeReport',
  'confirmRestore', 'custBreakdown', 'custDebt', 'custDebtTotal',
  'dayKeyOf', 'downloadBackup', 'findC', 'findP', 'findS', 'finishSale',
  'fmtDate', 'fmtDateLong', 'guardCashOut', 'hasLaterBuyEvent', 'id',
  'invalidateDebts', 'isGoodsExpense', 'isGoodsPay', 'isReversal', 'isVoided',
  'jalaliToDate', 'migrateDebtsToLedger', 'migrateMonthKeysToJalali',
  'monthKey', 'monthKeyLabel', 'monthKeyOf', 'nameHue',
  'openBazaarSale', 'openCashEntry', 'openCashOpening', 'openCustomerDetail',
  'openCustomerGoods', 'openCustomerPay', 'openExpenseForm', 'openExpenseGoods',
  'openPayDialog', 'openProductForm', 'openPurchaseDetail', 'openPurchaseForm',
  'openSupplierDetail', 'openTodaySales', 'periodStart',
  'photoClear', 'photoCount', 'photoLoadAll', 'photoOf', 'photoRemove',
  'photoSave', 'photosShop', 'prodBadge', 'prodColor', 'prodLetter',
  'recentCustomers', 'refreshDebtMirrors',
  'renderBazaar', 'renderCart', 'renderCash', 'renderCustomers', 'renderDebts',
  'renderExpenses', 'renderMore', 'renderProducts', 'renderPurchaseForm',
  'renderSaleGrid', 'renderSuppliers', 'renderWaste',
  'openWasteForm',
  'restoreBuyPrice', 'returnSale', 'saleChannel', 'save0', 'saveCount',
  'savePurchase', 'shrinkImage', 'supBreakdown', 'supDebt', 'supDebtTotal',
  'syncPullPhotos', 'syncPushPhotos', 'toJalali', 'todayISO', 'todaySales',
  'voidCashEntry', 'voidCustPayment', 'voidGoodsExpense', 'voidPurchase',
  'voidSupPayment', 'voidWaste', 'wipeAll'
];

// شمارندهٔ «به‌هرحال ثبت کن» متغیر است نه فنکشن — جدا صادر می‌شود
const vars = ['stockOverrides', 'stockOverridden'];

// نگهبان فهرست: تکرار خاموش نماند
[['names', names], ['fns', fns]].forEach(function (pair) {
  const seen = {}, dup = [];
  pair[1].forEach(function (n) { if (seen[n]) dup.push(n); seen[n] = 1; });
  if (dup.length) { console.error('نام تکراری در ' + pair[0] + ': ' + dup.join(', ')); process.exit(1); }
});

let hook = '\n';
names.forEach(n => { hook += '  Object.defineProperty(window,"' + n + '",{get:function(){return ' + n + ';},set:function(v){' + n + '=v;}});\n'; });
fns.forEach(f => { hook += '  window.__' + f + '=' + f + ';\n'; });
vars.forEach(v => { hook += '  Object.defineProperty(window,"__' + v + '",{get:function(){return ' + v + ';},set:function(x){' + v + '=x;}});\n'; });

const i = h.lastIndexOf('})();');
fs.writeFileSync(path.join(__dirname, 'test-index.html'), h.slice(0, i) + hook + h.slice(i));
console.log('instrumented (' + names.length + ' state + ' + fns.length + ' fns)');
