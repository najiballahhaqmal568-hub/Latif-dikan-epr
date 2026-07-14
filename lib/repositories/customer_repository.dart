import '../db/database_helper.dart';
import '../models/customer.dart';

/// عملیات دیتابیس روی مشتری‌ها و قرض آن‌ها.
class CustomerRepository {
  final DatabaseHelper _helper;

  CustomerRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  Future<List<Customer>> getAll() async {
    final db = await _helper.database;
    final rows =
        await db.query('customers', orderBy: 'debt DESC, name COLLATE NOCASE');
    return rows.map(Customer.fromMap).toList();
  }

  Future<Customer?> getById(int id) async {
    final db = await _helper.database;
    final rows =
        await db.query('customers', where: 'id = ?', whereArgs: [id], limit: 1);
    if (rows.isEmpty) return null;
    return Customer.fromMap(rows.first);
  }

  /// ثبت دریافت پرداخت از مشتری — قرض کم می‌شود (کمتر از صفر نمی‌رود).
  Future<void> pay(int customerId, double amount) async {
    final db = await _helper.database;
    await db.rawUpdate(
      'UPDATE customers SET debt = MAX(0, debt - ?) WHERE id = ?',
      [amount, customerId],
    );
  }
}
