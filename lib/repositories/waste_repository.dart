import '../db/database_helper.dart';
import '../models/product.dart';
import '../models/waste.dart';

/// ثبت و خواندن ضایعات. ثبت ضایعات موجودی جنس را کم می‌کند.
class WasteRepository {
  final DatabaseHelper _helper;

  WasteRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  /// ثبت ضایعات یک جنس — در یک ترنزکشن: درج رکورد + کم‌کردن موجودی.
  /// قیمت خرید فعلی جنس به‌عنوان هزینه ذخیره می‌شود.
  Future<void> createWaste({
    required Product product,
    required double quantity,
    required String reason,
  }) async {
    if (quantity <= 0) {
      throw ArgumentError('مقدار ضایعات باید بیشتر از صفر باشد');
    }
    final db = await _helper.database;
    await db.transaction((txn) async {
      await txn.insert('waste', {
        'product_id': product.id,
        'product_name': product.name,
        'unit': product.unit,
        'quantity': quantity,
        'buy_price': product.buyPrice,
        'date': DateTime.now().toIso8601String(),
        'reason': reason,
      });
      await txn.rawUpdate(
        'UPDATE products SET quantity = quantity - ? WHERE id = ?',
        [quantity, product.id],
      );
    });
  }

  Future<List<Waste>> getAll() async {
    final db = await _helper.database;
    final rows = await db.query('waste', orderBy: 'date DESC, id DESC');
    return rows.map(Waste.fromMap).toList();
  }

  /// مجموع ضرر ضایعات.
  Future<double> totalLoss() async {
    final db = await _helper.database;
    final rows = await db
        .rawQuery('SELECT COALESCE(SUM(quantity * buy_price), 0) AS s FROM waste');
    return (rows.first['s'] as num).toDouble();
  }
}
