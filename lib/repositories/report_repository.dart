import '../db/database_helper.dart';

/// دورهٔ گزارش.
enum ReportPeriod { today, month, all }

/// فایدهٔ یک جنس در گزارش.
class ProductProfit {
  final String name;
  final double qty;
  final double sales;
  final double profit;

  const ProductProfit({
    required this.name,
    required this.qty,
    required this.sales,
    required this.profit,
  });
}

/// نتیجهٔ گزارش یک دوره.
class ReportData {
  final double totalSales;
  final double cash;
  final double credit;
  final double cogs; // قیمت تمام‌شد اجناس فروخته‌شده
  final double wasteLoss;
  final double expenses;
  final double customerDebt;
  final double supplierDebt;
  final List<ProductProfit> perProduct;

  double get profit => totalSales - cogs - wasteLoss;

  const ReportData({
    required this.totalSales,
    required this.cash,
    required this.credit,
    required this.cogs,
    required this.wasteLoss,
    required this.expenses,
    required this.customerDebt,
    required this.supplierDebt,
    required this.perProduct,
  });
}

/// محاسبهٔ گزارش‌ها با کوئری‌های تجمیعی روی دیتابیس.
/// فایده با «قیمت خرید فعلی هر جنس» به‌عنوان هزینه حساب می‌شود (تقریب).
class ReportRepository {
  final DatabaseHelper _helper;

  ReportRepository({DatabaseHelper? helper})
      : _helper = helper ?? DatabaseHelper.instance;

  String _startIso(ReportPeriod period) {
    final now = DateTime.now();
    switch (period) {
      case ReportPeriod.today:
        return DateTime(now.year, now.month, now.day).toIso8601String();
      case ReportPeriod.month:
        return DateTime(now.year, now.month, 1).toIso8601String();
      case ReportPeriod.all:
        return DateTime.fromMillisecondsSinceEpoch(0).toIso8601String();
    }
  }

  Future<double> _scalar(String sql, List<Object?> args) async {
    final db = await _helper.database;
    final rows = await db.rawQuery(sql, args);
    final v = rows.first.values.first;
    return (v as num?)?.toDouble() ?? 0;
  }

  Future<ReportData> build(ReportPeriod period) async {
    final db = await _helper.database;
    final start = _startIso(period);

    final totalSales = await _scalar(
        'SELECT COALESCE(SUM(total),0) FROM sales WHERE date >= ?', [start]);
    final cash = await _scalar(
        "SELECT COALESCE(SUM(total),0) FROM sales WHERE date >= ? AND payment_type = 'cash'",
        [start]);
    final credit = await _scalar(
        "SELECT COALESCE(SUM(total),0) FROM sales WHERE date >= ? AND payment_type = 'credit'",
        [start]);

    final cogs = await _scalar(
        'SELECT COALESCE(SUM(si.quantity * COALESCE(p.buy_price,0)),0) '
        'FROM sale_items si JOIN sales s ON s.id = si.sale_id '
        'LEFT JOIN products p ON p.id = si.product_id WHERE s.date >= ?',
        [start]);

    final wasteLoss = await _scalar(
        'SELECT COALESCE(SUM(quantity * buy_price),0) FROM waste WHERE date >= ?',
        [start]);
    final expenses = await _scalar(
        'SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date >= ?', [start]);

    final customerDebt =
        await _scalar('SELECT COALESCE(SUM(debt),0) FROM customers', const []);
    final supplierDebt =
        await _scalar('SELECT COALESCE(SUM(debt),0) FROM suppliers', const []);

    final rows = await db.rawQuery(
      'SELECT si.product_name AS name, '
      'SUM(si.quantity) AS qty, '
      'SUM(si.quantity * si.sell_price) AS sales, '
      'SUM(si.quantity * (si.sell_price - COALESCE(p.buy_price,0))) AS profit '
      'FROM sale_items si JOIN sales s ON s.id = si.sale_id '
      'LEFT JOIN products p ON p.id = si.product_id '
      'WHERE s.date >= ? '
      'GROUP BY si.product_id ORDER BY profit DESC',
      [start],
    );
    final perProduct = rows
        .map((r) => ProductProfit(
              name: r['name'] as String,
              qty: (r['qty'] as num?)?.toDouble() ?? 0,
              sales: (r['sales'] as num?)?.toDouble() ?? 0,
              profit: (r['profit'] as num?)?.toDouble() ?? 0,
            ))
        .toList();

    return ReportData(
      totalSales: totalSales,
      cash: cash,
      credit: credit,
      cogs: cogs,
      wasteLoss: wasteLoss,
      expenses: expenses,
      customerDebt: customerDebt,
      supplierDebt: supplierDebt,
      perProduct: perProduct,
    );
  }
}
