/// رکورد شمارش ماهانه یک جنس — فرق موجودیِ محاسبه‌شده و شمرده‌شده.
class StockCount {
  final int? id;
  final String month; // مثل "2026/07"
  final int productId;
  final String productName;
  final String unit;
  final double calculated; // باید چقدر باشد (موجودی سیستم)
  final double counted; // تعداد شمرده‌شدهٔ واقعی
  final double difference; // counted - calculated (منفی = کسر)
  final String date; // ISO string

  const StockCount({
    this.id,
    required this.month,
    required this.productId,
    required this.productName,
    required this.unit,
    required this.calculated,
    required this.counted,
    required this.difference,
    required this.date,
  });

  factory StockCount.fromMap(Map<String, Object?> map) {
    return StockCount(
      id: map['id'] as int?,
      month: map['month'] as String,
      productId: map['product_id'] as int,
      productName: map['product_name'] as String,
      unit: map['unit'] as String,
      calculated: (map['calculated'] as num).toDouble(),
      counted: (map['counted'] as num).toDouble(),
      difference: (map['difference'] as num).toDouble(),
      date: map['date'] as String,
    );
  }
}
