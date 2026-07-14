import '../db/database_helper.dart';
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

  /// ثبت پرداخت به تامین‌کننده — قرض کم می‌شود (کمتر از صفر نمی‌رود).
  Future<void> pay(int supplierId, double amount) async {
    final db = await _helper.database;
    await db.rawUpdate(
      'UPDATE suppliers SET debt = MAX(0, debt - ?) WHERE id = ?',
      [amount, supplierId],
    );
  }
}
