import 'package:sqflite/sqflite.dart';

import '../db/database_helper.dart';
import '../models/product.dart';

/// عملیات دیتابیس روی جدول اجناس.
class ProductRepository {
  final DatabaseHelper _helper;

  ProductRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  /// همهٔ اجناس — پرفروش‌ها (ستاره‌دار) اول تا زود پیدا شوند.
  Future<List<Product>> getAll() async {
    final db = await _helper.database;
    final rows = await db.query('products',
        orderBy: 'is_popular DESC, name COLLATE NOCASE');
    return rows.map(Product.fromMap).toList();
  }

  Future<Product?> getById(int id) async {
    final db = await _helper.database;
    final rows = await db.query(
      'products',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return Product.fromMap(rows.first);
  }

  /// جستجوی تیز — بخشی از نام (برای صفحه فروش).
  Future<List<Product>> search(String query) async {
    final q = query.trim();
    if (q.isEmpty) return getAll();
    final db = await _helper.database;
    final rows = await db.query(
      'products',
      where: 'name LIKE ?',
      whereArgs: ['%$q%'],
      orderBy: 'name COLLATE NOCASE',
    );
    return rows.map(Product.fromMap).toList();
  }

  Future<int> insert(Product product) async {
    final db = await _helper.database;
    final map = product.toMap()..remove('id');
    return db.insert('products', map);
  }

  Future<int> update(Product product) async {
    final db = await _helper.database;
    return db.update(
      'products',
      product.toMap(),
      where: 'id = ?',
      whereArgs: [product.id],
    );
  }

  Future<int> delete(int id) async {
    final db = await _helper.database;
    return db.delete('products', where: 'id = ?', whereArgs: [id]);
  }

  /// کم‌کردن موجودی بعد از فروش (اجازه می‌دهد منفی هم شود — اخطار در UI داده می‌شود).
  Future<void> decreaseStock(int productId, double amount) async {
    final db = await _helper.database;
    await db.rawUpdate(
      'UPDATE products SET quantity = quantity - ? WHERE id = ?',
      [amount, productId],
    );
  }
}
