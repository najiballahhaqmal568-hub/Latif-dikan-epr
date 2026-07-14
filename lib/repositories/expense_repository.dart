import '../db/database_helper.dart';
import '../models/expense.dart';

/// عملیات دیتابیس روی مصارف خانه.
class ExpenseRepository {
  final DatabaseHelper _helper;

  ExpenseRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  Future<List<Expense>> getAll() async {
    final db = await _helper.database;
    final rows = await db.query('expenses', orderBy: 'date DESC, id DESC');
    return rows.map(Expense.fromMap).toList();
  }

  Future<int> insert({required double amount, String? note}) async {
    final db = await _helper.database;
    return db.insert('expenses', {
      'date': DateTime.now().toIso8601String(),
      'amount': amount,
      'note': (note == null || note.isEmpty) ? null : note,
    });
  }

  /// مبلغ مؤثر یک مصرف = مبلغ اصلی + مجموع اصلاحیه‌های آن.
  Future<double> effectiveAmount(int originalId) async {
    final db = await _helper.database;
    final rows = await db.rawQuery(
      'SELECT COALESCE(SUM(amount), 0) AS s FROM expenses '
      'WHERE id = ? OR correction_of = ?',
      [originalId, originalId],
    );
    return (rows.first['s'] as num).toDouble();
  }

  /// ثبت اصلاحیه: یک قلم جبران‌کننده با فرق ذخیره می‌شود؛ رکورد اصلی پاک نمی‌شود.
  /// برمی‌گرداند: آیا اصلاحیه‌ای ثبت شد (اگر فرق صفر بود، نه).
  Future<bool> correct({
    required Expense original,
    required double correctAmount,
    required double effective,
  }) async {
    final diff = double.parse((correctAmount - effective).toStringAsFixed(2));
    if (diff == 0) return false;
    final db = await _helper.database;
    await db.insert('expenses', {
      'date': DateTime.now().toIso8601String(),
      'amount': diff,
      'note': 'اصلاحیه: ${original.note ?? 'مصرف'}',
      'correction_of': original.id,
    });
    return true;
  }

  Future<double> total() async {
    final db = await _helper.database;
    final rows =
        await db.rawQuery('SELECT COALESCE(SUM(amount), 0) AS s FROM expenses');
    return (rows.first['s'] as num).toDouble();
  }
}
