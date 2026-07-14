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

  Future<int> delete(int id) async {
    final db = await _helper.database;
    return db.delete('expenses', where: 'id = ?', whereArgs: [id]);
  }

  Future<double> total() async {
    final db = await _helper.database;
    final rows =
        await db.rawQuery('SELECT COALESCE(SUM(amount), 0) AS s FROM expenses');
    return (rows.first['s'] as num).toDouble();
  }
}
