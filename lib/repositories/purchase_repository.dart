import 'package:sqflite/sqflite.dart';

import '../db/database_helper.dart';
import '../models/product.dart';
import '../models/purchase.dart';

/// ثبت و خواندن فاکتورهای خرید. ثبت فاکتور همه در یک ترنزکشن انجام می‌شود:
/// درج فاکتور و قلم‌ها، زیادکردن موجودی، تازه‌کردن قیمت خرید، و افزودن قرض تامین‌کننده.
class PurchaseRepository {
  final DatabaseHelper _helper;

  PurchaseRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  Future<int> createPurchase({
    required String supplierName,
    String? supplierPhone,
    required String date,
    required List<PurchaseDraftLine> lines,
    required double paid,
  }) async {
    final valid = lines.where((l) => l.quantity > 0).toList();
    if (supplierName.trim().isEmpty) {
      throw ArgumentError('نام تامین‌کننده خالی است');
    }
    if (valid.isEmpty) {
      throw ArgumentError('حداقل یک جنس با تعداد بیشتر از صفر لازم است');
    }

    double total = 0;
    for (final l in valid) {
      total += l.lineTotal;
    }
    final remaining = (total - paid) > 0 ? (total - paid) : 0.0;

    final db = await _helper.database;
    return db.transaction<int>((txn) async {
      // یافتن یا ساختن تامین‌کننده
      int supplierId;
      final existing = await txn.query(
        'suppliers',
        where: 'name = ? COLLATE NOCASE',
        whereArgs: [supplierName.trim()],
        limit: 1,
      );
      if (existing.isNotEmpty) {
        supplierId = existing.first['id'] as int;
        await txn.rawUpdate(
          'UPDATE suppliers SET debt = debt + ? WHERE id = ?',
          [remaining, supplierId],
        );
        if ((supplierPhone ?? '').isNotEmpty &&
            ((existing.first['phone'] as String?) ?? '').isEmpty) {
          await txn.update('suppliers', {'phone': supplierPhone},
              where: 'id = ?', whereArgs: [supplierId]);
        }
      } else {
        supplierId = await txn.insert('suppliers', {
          'name': supplierName.trim(),
          'phone': supplierPhone,
          'debt': remaining,
        });
      }

      final purchaseId = await txn.insert('purchases', {
        'supplier_id': supplierId,
        'supplier_name': supplierName.trim(),
        'date': date,
        'total': total,
        'paid': paid,
        'remaining': remaining,
      });

      for (final l in valid) {
        // جنس نو: اول در جدول اجناس ساخته شود (تعداد ۰) و آی‌دی آن گرفته شود
        int productId;
        if (l.productId == null) {
          productId = await txn.insert('products', {
            'name': l.productName,
            'type': (l.type ?? ProductType.unit).dbValue,
            'unit': l.unit,
            'buy_price': l.buyPrice,
            'sell_price': l.sellPrice,
            'quantity': 0,
            'is_popular': 0,
          });
        } else {
          productId = l.productId!;
        }

        await txn.insert('purchase_items', {
          'purchase_id': purchaseId,
          'product_id': productId,
          'product_name': l.productName,
          'quantity': l.quantity,
          'buy_price': l.buyPrice,
        });
        // زیادکردن موجودی و تازه‌کردن قیمت خرید به «اوسط وزنی»:
        // اگر موجودی کهنه بود، اوسط موجودی کهنه و خرید نو؛ ورنه قیمت نو.
        await txn.rawUpdate(
          'UPDATE products SET '
          'buy_price = CASE WHEN quantity > 0 '
          '  THEN ROUND(((quantity * buy_price) + (? * ?)) / (quantity + ?), 2) '
          '  ELSE ? END, '
          'quantity = quantity + ? '
          'WHERE id = ?',
          [
            l.quantity,
            l.buyPrice,
            l.quantity,
            l.buyPrice,
            l.quantity,
            productId,
          ],
        );
      }

      return purchaseId;
    });
  }

  Future<List<Purchase>> getAll() async {
    final db = await _helper.database;
    final rows = await db.query('purchases', orderBy: 'date DESC, id DESC');
    return rows.map((r) => Purchase.fromMap(r)).toList();
  }

  Future<List<Purchase>> getForSupplier(int supplierId) async {
    final db = await _helper.database;
    final rows = await db.query(
      'purchases',
      where: 'supplier_id = ?',
      whereArgs: [supplierId],
      orderBy: 'date DESC, id DESC',
    );
    return rows.map((r) => Purchase.fromMap(r)).toList();
  }

  Future<List<PurchaseItem>> getItems(int purchaseId) async {
    final db = await _helper.database;
    final rows = await db.query(
      'purchase_items',
      where: 'purchase_id = ?',
      whereArgs: [purchaseId],
    );
    return rows.map(PurchaseItem.fromMap).toList();
  }
}
