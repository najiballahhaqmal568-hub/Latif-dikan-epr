/// نوع پرداخت فروش.
enum PaymentType {
  cash, // نقد
  credit; // قرض

  String get dbValue => name;

  static PaymentType fromDb(String value) {
    return PaymentType.values.firstWhere(
      (t) => t.name == value,
      orElse: () => PaymentType.cash,
    );
  }

  String get label => this == PaymentType.cash ? 'نقد' : 'قرض';
}

/// مدل فروش (sales).
class Sale {
  final int? id;
  final String date; // ISO string
  final double total;
  final PaymentType paymentType;
  final String? customerName; // یادداشت قرض (مرحله اول)
  final int? customerId;
  final int? returnOf; // اگر پر بود، این رکورد «برگشتی» فروش دیگری است
  final bool returned; // فروش اصلی که برگشت داده شده

  const Sale({
    this.id,
    required this.date,
    required this.total,
    required this.paymentType,
    this.customerName,
    this.customerId,
    this.returnOf,
    this.returned = false,
  });

  /// آیا این فروش هنوز می‌تواند برگشت داده شود؟
  bool get canReturn => returnOf == null && !returned;

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'date': date,
      'total': total,
      'payment_type': paymentType.dbValue,
      'customer_name': customerName,
      'customer_id': customerId,
      'return_of': returnOf,
      'returned': returned ? 1 : 0,
    };
  }

  factory Sale.fromMap(Map<String, Object?> map) {
    return Sale(
      id: map['id'] as int?,
      date: map['date'] as String,
      total: (map['total'] as num).toDouble(),
      paymentType: PaymentType.fromDb(map['payment_type'] as String),
      customerName: map['customer_name'] as String?,
      customerId: map['customer_id'] as int?,
      returnOf: map['return_of'] as int?,
      returned: (map['returned'] as int? ?? 0) == 1,
    );
  }
}

/// قلم فروش (sale_items) — با اسنپ‌شات نام، قیمت فروش و قیمت خرید لحظهٔ فروش.
class SaleItem {
  final int? id;
  final int? saleId;
  final int productId;
  final String productName;
  final double quantity;
  final double sellPrice;
  final double? buyPrice; // قیمت خرید لحظهٔ فروش (فروش‌های قدیمی تهی)

  const SaleItem({
    this.id,
    this.saleId,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.sellPrice,
    this.buyPrice,
  });

  double get lineTotal => quantity * sellPrice;

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'sale_id': saleId,
      'product_id': productId,
      'product_name': productName,
      'quantity': quantity,
      'sell_price': sellPrice,
      'buy_price': buyPrice,
    };
  }

  factory SaleItem.fromMap(Map<String, Object?> map) {
    return SaleItem(
      id: map['id'] as int?,
      saleId: map['sale_id'] as int?,
      productId: map['product_id'] as int,
      productName: map['product_name'] as String,
      quantity: (map['quantity'] as num).toDouble(),
      sellPrice: (map['sell_price'] as num).toDouble(),
      buyPrice: (map['buy_price'] as num?)?.toDouble(),
    );
  }
}
