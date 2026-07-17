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
  /// موجودی هر جنس به تعداد شمرده‌شده اصلاح می‌شود. برمی‌گرداند: تعداد اقلام دارای فرق.
  Future<int> saveCount(String month, List<CountEntry> entries) async {
    final db = await _helper.database;
    final now = DateTime.now().toIso8601String();
    return db.transaction<int>((txn) async {
      await txn
          .delete('stock_counts', where: 'month = ?', whereArgs: [month]);
      int diffs = 0;
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
        }
        if (e.counted != e.calculated) {
          // اصلاح موجودی به تعداد شمرده‌شده
          await txn.update('products', {'quantity': e.counted},
              where: 'id = ?', whereArgs: [e.productId]);
        }
      }
      return diffs;
    });
  }
}
