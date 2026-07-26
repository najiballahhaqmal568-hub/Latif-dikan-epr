import '../db/database_helper.dart';
import '../models/stock_count.dart';

/// یک قلم ورودی شمارش (جنس + تعداد شمرده‌شده).
class CountEntry {
  final int productId;
  final String productName;
  final String unit;
  final double calculated;
  final double counted;

  const CountEntry({
    required this.productId,
    required this.productName,
    required this.unit,
    required this.calculated,
    required this.counted,
  });

  double get difference =>
      double.parse((counted - calculated).toStringAsFixed(3));
}

/// نتیجهٔ ثبت شمارش: تعداد اقلام دارای فرق و ضرر مجموعی کسری.
class CountResult {
  final int diffs;
  final double shortageLoss;

  const CountResult({required this.diffs, required this.shortageLoss});
}

/// ثبت و خواندن شمارش ماهانه.
class StockCountRepository {
  final DatabaseHelper _helper;

  StockCountRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  /// کلید ماه جاری مثل "2026/07".
  static String currentMonthKey() {
    final d = DateTime.now();
    final m = d.month < 10 ? '0${d.month}' : '${d.month}';
    return '${d.year}/$m';
  }

  Future<List<StockCount>> getAll() async {
    final db = await _helper.database;
    final rows =
        await db.query('stock_counts', orderBy: 'date DESC, id DESC');
    return rows.map(StockCount.fromMap).toList();
  }

  /// ثبت شمارش ماه: رکوردهای همان ماه جایگزین می‌شوند؛ فقط فرق‌ها ذخیره می‌شوند؛
  /// موجودی هر جنس به تعداد شمرده‌شده اصلاح می‌شود.
  ///
  /// کسری (شمرده کمتر از کتاب) ضرر واقعی است و به‌عنوان ضایعات
  /// (reason=shortage) ثبت می‌شود تا از فایده کم گردد. زیادی فقط موجودی را
  /// درست می‌کند و فایدهٔ ساختگی نمی‌سازد.
  /// برمی‌گرداند: تعداد اقلام دارای فرق و ضرر مجموعی کسری.
  Future<CountResult> saveCount(
      String month, List<CountEntry> entries) async {
    final db = await _helper.database;
    final now = DateTime.now().toIso8601String();
    return db.transaction<CountResult>((txn) async {
      await txn
          .delete('stock_counts', where: 'month = ?', whereArgs: [month]);
      // ضایعات کسری همین ماه پاک شود تا شمارش دوباره، ضرر را دوبار حساب نکند
      await txn
          .delete('waste', where: 'count_month = ?', whereArgs: [month]);
      int diffs = 0;
      double shortageLoss = 0;
      for (final e in entries) {
        final diff = e.difference;
        if (diff != 0) {
          await txn.insert('stock_counts', {
            'month': month,
            'product_id': e.productId,
            'product_name': e.productName,
            'unit': e.unit,
            'calculated': e.calculated,
            'counted': e.counted,
            'difference': diff,
            'date': now,
          });
          diffs++;

          if (diff < 0) {
            // قیمت خرید فعلی جنس به‌عنوان هزینهٔ کسری
            final rows = await txn.query('products',
                columns: ['buy_price'],
                where: 'id = ?',
                whereArgs: [e.productId]);
            final buyPrice = rows.isEmpty
                ? 0.0
                : ((rows.first['buy_price'] as num?)?.toDouble() ?? 0);
            await txn.insert('waste', {
              'product_id': e.productId,
              'product_name': e.productName,
              'unit': e.unit,
              'quantity': -diff,
              'buy_price': buyPrice,
              'date': now,
              'reason': 'shortage',
              'count_month': month,
            });
            shortageLoss += (-diff) * buyPrice;
          }
        }
        if (e.counted != e.calculated) {
          // اصلاح موجودی به تعداد شمرده‌شده
          // (موجودی مستقیم برابر شمرده می‌شود، پس ضایعات آن را دوباره کم نمی‌کند)
          await txn.update('products', {'quantity': e.counted},
              where: 'id = ?', whereArgs: [e.productId]);
        }
      }
      return CountResult(diffs: diffs, shortageLoss: shortageLoss);
    });
  }
}
