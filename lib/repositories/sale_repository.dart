import '../db/database_helper.dart';
import '../models/cart_item.dart';
import '../models/sale.dart';

/// ثبت فروش در دیتابیس — همه در یک ترنزکشن.
class SaleRepository {
  final DatabaseHelper _helper;

  SaleRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  /// یک فروش کامل را ثبت می‌کند:
  /// درج sales، درج sale_items، و کم‌کردن موجودی هر جنس — همه با هم.
  /// آی‌دی فروش را برمی‌گرداند.
  Future<int> createSale({
    required List<CartItem> cartItems,
    required PaymentType paymentType,
    String? customerName,
  }) async {
    if (cartItems.isEmpty) {
      throw ArgumentError('سبد فروش خالی است');
    }
    final db = await _helper.database;
    final now = DateTime.now().toIso8601String();

    double total = 0;
    for (final item in cartItems) {
      total += item.lineTotal;
    }

    final name = (customerName ?? '').trim();

    return db.transaction<int>((txn) async {
      // فروش قرضی با نام: مشتری یافته/ساخته شود و قرض او زیاد گردد
      int? customerId;
      if (paymentType == PaymentType.credit && name.isNotEmpty) {
        final existing = await txn.query(
          'customers',
          where: 'name = ? COLLATE NOCASE',
          whereArgs: [name],
          limit: 1,
        );
        if (existing.isNotEmpty) {
          customerId = existing.first['id'] as int;
          await txn.rawUpdate(
            'UPDATE customers SET debt = debt + ? WHERE id = ?',
            [total, customerId],
          );
        } else {
          customerId = await txn.insert('customers', {
            'name': name,
            'phone': null,
            'debt': total,
          });
        }
      }

      final saleId = await txn.insert('sales', {
        'date': now,
        'total': total,
        'payment_type': paymentType.dbValue,
        'customer_name': name.isEmpty ? null : name,
        'customer_id': customerId,
      });

      for (final item in cartItems) {
        await txn.insert('sale_items', {
          'sale_id': saleId,
          'product_id': item.product.id,
          'product_name': item.product.name,
          'quantity': item.quantity,
          'sell_price': item.sellPrice,
          'buy_price': item.product.buyPrice, // اسنپ‌شات قیمت خرید لحظهٔ فروش
        });

        // کم‌کردن موجودی
        await txn.rawUpdate(
          'UPDATE products SET quantity = quantity - ? WHERE id = ?',
          [item.quantity, item.product.id],
        );
      }

      return saleId;
    });
  }

  /// فروش‌های امروز (تازه‌ترین اول) — برای اصلاح فروش اشتباه در وقت شلوغ.
  Future<List<Sale>> getTodaySales() async {
    final db = await _helper.database;
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day).toIso8601String();
    final rows = await db.query('sales',
        where: 'date >= ?', whereArgs: [start], orderBy: 'date DESC, id DESC');
    return rows.map(Sale.fromMap).toList();
  }

  /// نام آخرین مشتریانِ قرضی (تازه‌ترین اول) — برای انتخاب بدون تایپ.
  Future<List<String>> getRecentCreditCustomerNames(int limit) async {
    final db = await _helper.database;
    final rows = await db.rawQuery(
      "SELECT customer_name, MAX(date) AS last_date FROM sales "
      "WHERE payment_type = 'credit' AND customer_name IS NOT NULL "
      "AND customer_name <> '' AND return_of IS NULL "
      "GROUP BY customer_name COLLATE NOCASE "
      "ORDER BY last_date DESC LIMIT ?",
      [limit],
    );
    return rows.map((r) => r['customer_name'] as String).toList();
  }

  /// برگشتی یک فروش — فروش پاک نمی‌شود.
  ///
  /// یک رکورد فروش منفی با `return_of` ثبت می‌شود (مقدارها هم منفی)، پس
  /// گزارش‌ها خودکار درست می‌شوند: فروش، قیمت تمام‌شد، فایده و صندوق نقد
  /// همه کم می‌گردند. موجودی پس می‌آید و اگر قرضی بود قرض مشتری کم می‌شود.
  Future<void> returnSale(Sale sale) async {
    if (!sale.canReturn || sale.id == null) return;
    final db = await _helper.database;
    final now = DateTime.now().toIso8601String();

    await db.transaction((txn) async {
      // محافظت در برابر دوبار زدن: فقط اگر هنوز برگشت نشده
      final updated = await txn.rawUpdate(
        'UPDATE sales SET returned = 1 WHERE id = ? AND returned = 0 AND return_of IS NULL',
        [sale.id],
      );
      if (updated == 0) return;

      final items = await txn.query('sale_items',
          where: 'sale_id = ?', whereArgs: [sale.id]);

      final revId = await txn.insert('sales', {
        'date': now,
        'total': -sale.total,
        'payment_type': sale.paymentType.dbValue,
        'customer_name': sale.customerName,
        'customer_id': sale.customerId,
        'return_of': sale.id,
        'returned': 0,
      });

      for (final it in items) {
        final qty = (it['quantity'] as num).toDouble();
        final productId = it['product_id'] as int;
        await txn.insert('sale_items', {
          'sale_id': revId,
          'product_id': productId,
          'product_name': it['product_name'],
          'quantity': -qty,
          'sell_price': it['sell_price'],
          'buy_price': it['buy_price'],
        });
        // موجودی پس بیاید
        await txn.rawUpdate(
          'UPDATE products SET quantity = quantity + ? WHERE id = ?',
          [qty, productId],
        );
      }

      // اگر قرضی بود، قرض مشتری کم شود
      if (sale.paymentType == PaymentType.credit && sale.customerId != null) {
        await txn.rawUpdate(
          'UPDATE customers SET debt = ROUND(debt - ?, 2) WHERE id = ?',
          [sale.total, sale.customerId],
        );
      }
    });
  }

  /// فروش‌های قرضی یک مشتری (برای صفحه قرض مشتری).
  Future<List<Sale>> getCreditSalesForCustomer(int customerId) async {
    final db = await _helper.database;
    final rows = await db.query(
      'sales',
      where: "customer_id = ? AND payment_type = 'credit'",
      whereArgs: [customerId],
      orderBy: 'date DESC, id DESC',
    );
    return rows.map(Sale.fromMap).toList();
  }
}
