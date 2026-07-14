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

    return db.transaction<int>((txn) async {
      final saleId = await txn.insert('sales', {
        'date': now,
        'total': total,
        'payment_type': paymentType.dbValue,
        'customer_name': customerName,
      });

      for (final item in cartItems) {
        await txn.insert('sale_items', {
          'sale_id': saleId,
          'product_id': item.product.id,
          'product_name': item.product.name,
          'quantity': item.quantity,
          'sell_price': item.sellPrice,
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
}
