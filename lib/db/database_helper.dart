import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// مدیریت دیتابیس محلی SQLite (آفلاین).
/// نسخه ۱ فقط جدول‌های لازم مرحله اول را می‌سازد: products, sales, sale_items.
/// جدول‌های دیگر نقشه در مرحله‌های بعد با ارتقای نسخه اضافه می‌شوند.
class DatabaseHelper {
  DatabaseHelper._();
  static final DatabaseHelper instance = DatabaseHelper._();

  static const String _dbName = 'dukan_latif.db';
  static const int _dbVersion = 11;

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, _dbName);
    return openDatabase(
      path,
      version: _dbVersion,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON');
      },
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        unit TEXT NOT NULL,
        buy_price REAL NOT NULL DEFAULT 0,
        sell_price REAL NOT NULL DEFAULT 0,
        quantity REAL NOT NULL DEFAULT 0,
        expiry_date TEXT,
        barcode TEXT,
        is_popular INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total REAL NOT NULL DEFAULT 0,
        payment_type TEXT NOT NULL,
        customer_name TEXT,
        customer_id INTEGER,
        return_of INTEGER,
        returned INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        sell_price REAL NOT NULL,
        buy_price REAL,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
      )
    ''');

    await db.execute(
      'CREATE INDEX idx_sale_items_sale ON sale_items (sale_id)',
    );

    await _createPurchaseTables(db);
    await _createCustomerTable(db);
    await _createPaymentTables(db);
    await _createWasteTable(db);
    await _createExpenseTable(db);
    await _createStockCountTable(db);
  }

  /// جدول شمارش ماهانه (مرحله هفتم — فرق موجودی).
  Future<void> _createStockCountTable(Database db) async {
    await db.execute('''
      CREATE TABLE stock_counts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        unit TEXT NOT NULL,
        calculated REAL NOT NULL,
        counted REAL NOT NULL,
        difference REAL NOT NULL,
        date TEXT NOT NULL
      )
    ''');
  }

  /// جدول مصارف خانه (مرحله ششم).
  Future<void> _createExpenseTable(Database db) async {
    await db.execute('''
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT,
        correction_of INTEGER
      )
    ''');
  }

  /// جدول ضایعات (مرحله پنجم — اجناس خراب/تاریخ‌تیر).
  Future<void> _createWasteTable(Database db) async {
    await db.execute('''
      CREATE TABLE waste (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        unit TEXT NOT NULL,
        quantity REAL NOT NULL,
        buy_price REAL NOT NULL,
        date TEXT NOT NULL,
        reason TEXT NOT NULL,
        count_month TEXT
      )
    ''');
  }

  /// جدول مشتری‌ها (مرحله سوم — دفتر قرض مشتری).
  Future<void> _createCustomerTable(Database db) async {
    await db.execute('''
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        debt REAL NOT NULL DEFAULT 0
      )
    ''');
  }

  /// جدول‌های رسید پرداخت/دریافت (مرحله چهارم — رسید با تاریخ و مبلغ).
  Future<void> _createPaymentTables(Database db) async {
    await db.execute('''
      CREATE TABLE supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE customer_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL
      )
    ''');
  }

  /// جدول‌های مرحله دوم: تامین‌کننده، فاکتور خرید و قلم‌های آن.
  Future<void> _createPurchaseTables(Database db) async {
    await db.execute('''
      CREATE TABLE suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        debt REAL NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        supplier_name TEXT NOT NULL,
        date TEXT NOT NULL,
        total REAL NOT NULL DEFAULT 0,
        paid REAL NOT NULL DEFAULT 0,
        remaining REAL NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        buy_price REAL NOT NULL,
        FOREIGN KEY (purchase_id) REFERENCES purchases (id) ON DELETE CASCADE
      )
    ''');

    await db.execute(
      'CREATE INDEX idx_purchase_items_purchase ON purchase_items (purchase_id)',
    );
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await _createPurchaseTables(db);
    }
    if (oldVersion < 3) {
      await _createCustomerTable(db);
      await db.execute('ALTER TABLE sales ADD COLUMN customer_id INTEGER');
    }
    if (oldVersion < 4) {
      await _createPaymentTables(db);
    }
    if (oldVersion < 5) {
      await _createWasteTable(db);
    }
    if (oldVersion < 6) {
      // جدول expenses از همین نسخه با ستون correction_of ساخته می‌شود (نیازی به ALTER بعدی نیست).
      await _createExpenseTable(db);
    } else if (oldVersion == 6) {
      // دیتابیس v6 جدول expenses را بدون correction_of دارد؛ ستون را اضافه کن.
      await db.execute('ALTER TABLE expenses ADD COLUMN correction_of INTEGER');
    }
    if (oldVersion < 8) {
      // sale_items فقط در onCreate ساخته می‌شود؛ برای همهٔ نسخه‌های قدیمی ستون را اضافه کن.
      await db.execute('ALTER TABLE sale_items ADD COLUMN buy_price REAL');
    }
    if (oldVersion < 9) {
      await _createStockCountTable(db);
    }
    if (oldVersion < 10) {
      // ضایعات کسری شمارش با کلید ماه نشانی می‌شود تا شمارش دوبارهٔ
      // همان ماه، ضرر را دوبار حساب نکند.
      await db.execute('ALTER TABLE waste ADD COLUMN count_month TEXT');
    }
    if (oldVersion < 11) {
      // برگشتی فروش: فروش پاک نمی‌شود؛ یک رکورد منفی با return_of ثبت
      // می‌گردد و فروش اصلی با returned نشانی می‌شود.
      await db.execute('ALTER TABLE sales ADD COLUMN return_of INTEGER');
      await db.execute(
          'ALTER TABLE sales ADD COLUMN returned INTEGER NOT NULL DEFAULT 0');
    }
  }

  /// بستن دیتابیس (بیشتر برای تست).
  Future<void> close() async {
    final db = _db;
    if (db != null) {
      await db.close();
      _db = null;
    }
  }
}
