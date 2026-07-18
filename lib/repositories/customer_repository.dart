import '../db/database_helper.dart';
import '../models/customer.dart';
import '../models/payment.dart';

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

  /// ثبت دریافت از مشتری — قرض کم می‌شود و یک رسید (تاریخ+مبلغ) ثبت می‌گردد.
  Future<void> pay(int customerId, double amount) async {
    final db = await _helper.database;
    await db.transaction((txn) async {
      await txn.rawUpdate(
        'UPDATE customers SET debt = MAX(0, debt - ?) WHERE id = ?',
        [amount, customerId],
      );
      await txn.insert('customer_payments', {
        'customer_id': customerId,
        'date': DateTime.now().toIso8601String(),
        'amount': amount,
      });
    });
  }

  /// افزودن قرض قبلی (پیش از اپ). اگر نام از قبل باشد به قرضش اضافه می‌شود.
  Future<void> addOpeningDebt({
    required String name,
    String? phone,
    required double amount,
  }) async {
    final db = await _helper.database;
    final existing = await db.query('customers',
        where: 'name = ? COLLATE NOCASE', whereArgs: [name.trim()], limit: 1);
    if (existing.isNotEmpty) {
      final cid = existing.first['id'] as int;
      await db.rawUpdate(
          'UPDATE customers SET debt = debt + ? WHERE id = ?', [amount, cid]);
      if ((phone ?? '').isNotEmpty &&
          ((existing.first['phone'] as String?) ?? '').isEmpty) {
        await db.update('customers', {'phone': phone},
            where: 'id = ?', whereArgs: [cid]);
      }
    } else {
      await db.insert('customers', {
        'name': name.trim(),
        'phone': (phone == null || phone.isEmpty) ? null : phone,
        'debt': amount,
      });
    }
  }

  /// رسیدهای دریافت از یک مشتری.
  Future<List<Payment>> getPayments(int customerId) async {
    final db = await _helper.database;
    final rows = await db.query(
      'customer_payments',
      where: 'customer_id = ?',
      whereArgs: [customerId],
      orderBy: 'date DESC, id DESC',
    );
    return rows
        .map((r) => Payment(
              id: r['id'] as int?,
              refId: r['customer_id'] as int,
              date: r['date'] as String,
              amount: (r['amount'] as num).toDouble(),
            ))
        .toList();
  }
}
