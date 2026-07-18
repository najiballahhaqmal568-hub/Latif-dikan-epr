import '../db/database_helper.dart';
import '../models/payment.dart';
import '../models/supplier.dart';

/// عملیات دیتابیس روی تامین‌کننده‌ها و قرض آن‌ها.
class SupplierRepository {
  final DatabaseHelper _helper;

  SupplierRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  Future<List<Supplier>> getAll() async {
    final db = await _helper.database;
    final rows = await db.query('suppliers', orderBy: 'debt DESC, name COLLATE NOCASE');
    return rows.map(Supplier.fromMap).toList();
  }

  Future<Supplier?> getById(int id) async {
    final db = await _helper.database;
    final rows = await db.query('suppliers', where: 'id = ?', whereArgs: [id], limit: 1);
    if (rows.isEmpty) return null;
    return Supplier.fromMap(rows.first);
  }

  Future<Supplier?> findByName(String name) async {
    final db = await _helper.database;
    final rows = await db.query(
      'suppliers',
      where: 'name = ? COLLATE NOCASE',
      whereArgs: [name.trim()],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return Supplier.fromMap(rows.first);
  }

  /// ثبت پرداخت به تامین‌کننده — قرض کم می‌شود و یک رسید (تاریخ+مبلغ) ثبت می‌گردد.
  Future<void> pay(int supplierId, double amount) async {
    final db = await _helper.database;
    await db.transaction((txn) async {
      await txn.rawUpdate(
        'UPDATE suppliers SET debt = MAX(0, debt - ?) WHERE id = ?',
        [amount, supplierId],
      );
      await txn.insert('supplier_payments', {
        'supplier_id': supplierId,
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
    final existing = await db.query('suppliers',
        where: 'name = ? COLLATE NOCASE', whereArgs: [name.trim()], limit: 1);
    if (existing.isNotEmpty) {
      final sid = existing.first['id'] as int;
      await db.rawUpdate(
          'UPDATE suppliers SET debt = debt + ? WHERE id = ?', [amount, sid]);
      if ((phone ?? '').isNotEmpty &&
          ((existing.first['phone'] as String?) ?? '').isEmpty) {
        await db.update('suppliers', {'phone': phone},
            where: 'id = ?', whereArgs: [sid]);
      }
    } else {
      await db.insert('suppliers', {
        'name': name.trim(),
        'phone': (phone == null || phone.isEmpty) ? null : phone,
        'debt': amount,
      });
    }
  }

  /// رسیدهای پرداخت به یک تامین‌کننده.
  Future<List<Payment>> getPayments(int supplierId) async {
    final db = await _helper.database;
    final rows = await db.query(
      'supplier_payments',
      where: 'supplier_id = ?',
      whereArgs: [supplierId],
      orderBy: 'date DESC, id DESC',
    );
    return rows
        .map((r) => Payment(
              id: r['id'] as int?,
              refId: r['supplier_id'] as int,
              date: r['date'] as String,
              amount: (r['amount'] as num).toDouble(),
            ))
        .toList();
  }
}
