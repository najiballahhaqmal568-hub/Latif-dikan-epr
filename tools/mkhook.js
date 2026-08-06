const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
let h=fs.readFileSync(path.join(ROOT,'docs','index.html'),'utf8');
const names=['products','sales','suppliers','purchases','customers','supPayments','custPayments','waste','expenses','stockCounts','cart','draft','moreView','cashEntries'];
let hook='\n';
names.forEach(n=>{ hook+='  Object.defineProperty(window,"'+n+'",{get:function(){return '+n+';},set:function(v){'+n+'=v;}});\n'; });
const fns=['savePurchase','finishSale','computeReport','saveCount','renderMore','save0','todayISO',
 'returnSale','todaySales','addToCart','bumpLine','renderCart','recentCustomers','renderSaleGrid',
 'renderProducts','toJalali','jalaliToDate','fmtDate','fmtDateLong','monthKey','monthKeyOf',
 'monthKeyLabel','periodStart','migrateMonthKeysToJalali','id',
 'custDebt','supDebt','custBreakdown','supBreakdown','custDebtTotal','supDebtTotal',
 'migrateDebtsToLedger','refreshDebtMirrors','collectData','invalidateDebts','renderCustomers','renderDebts',
 'photoOf','photoSave','photoRemove','photoClear','photoLoadAll','photoCount','shrinkImage','prodBadge','prodColor','prodLetter','nameHue','downloadBackup','confirmRestore','openProductForm','applyData','wipeAll','guardCashOut','cashNetWithoutOpening','openCashOpening','openCashEntry','openExpenseForm','openPayDialog','savePurchase','openPurchaseForm','renderPurchaseForm','findS','findC','openCustomerGoods','openCustomerDetail','openCustomerPay','isGoodsPay','findP','openBazaarSale','renderBazaar','saleChannel','openTodaySales','voidPurchase','voidSupPayment','voidCustPayment','voidCashEntry','voidWaste','isVoided','isReversal','openPurchaseDetail','openSupplierDetail','renderWaste','supBreakdown','hasLaterBuyEvent','restoreBuyPrice','openBazaarSale','renderDebts','renderSuppliers','photosShop','syncPushPhotos','syncPullPhotos','photoClear','photoCount','collectData','openExpenseGoods','voidGoodsExpense','isGoodsExpense','renderExpenses','openExpenseForm','cashBreakdown','cashBalance','cashBreakdown','cashMovements','cashOpeningEntry','dayKeyOf','renderCash'];
fns.forEach(f=>{ hook+='  window.__'+f+'='+f+';\n'; });
const i=h.lastIndexOf('})();');
fs.writeFileSync(path.join(__dirname,'test-index.html'), h.slice(0,i)+hook+h.slice(i));
console.log('instrumented');
