/// رکورد ضایعات — جنس خراب، تاریخ‌تیر شده، یا کسری شمارش ماهانه.
/// `reason` یکی از `spoiled` (خراب)، `expired` (تاریخ‌تیر)
/// یا `shortage` (کسری شمارش) است.
class Waste {
  final int? id;
  final int productId;
  final String productName;
  final String unit;
  final double quantity;
  final double buyPrice; // هزینه (قیمت خرید) در لحظه ثبت
  final String date; // ISO string
  final String reason;

  const Waste({
    this.id,
    required this.productId,
    required this.productName,
    required this.unit,
    required this.quantity,
    required this.buyPrice,
    required this.date,
    required this.reason,
  });

  double get loss => quantity * buyPrice;

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'product_id': productId,
      'product_name': productName,
      'unit': unit,
      'quantity': quantity,
      'buy_price': buyPrice,
      'date': date,
      'reason': reason,
    };
  }

  factory Waste.fromMap(Map<String, Object?> map) {
    return Waste(
      id: map['id'] as int?,
      productId: map['product_id'] as int,
      productName: map['product_name'] as String,
      unit: map['unit'] as String,
      quantity: (map['quantity'] as num).toDouble(),
      buyPrice: (map['buy_price'] as num).toDouble(),
      date: map['date'] as String,
      reason: map['reason'] as String,
    );
  }
}
