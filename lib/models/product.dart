/// نوع جنس: وزنی (کیلویی)، دانه‌ای (ثابت)، یا وای‌فای (جی‌بی).
enum ProductType {
  weighted, // وزنی — مقدار موقع فروش پرسیده می‌شود
  unit, // دانه‌ای — یک ضربه = یک دانه
  wifi; // وای‌فای — واحد جی‌بی، مثل وزنی فروخته می‌شود

  String get dbValue => name;

  static ProductType fromDb(String value) {
    return ProductType.values.firstWhere(
      (t) => t.name == value,
      orElse: () => ProductType.unit,
    );
  }

  String get label {
    switch (this) {
      case ProductType.weighted:
        return 'وزنی';
      case ProductType.wifi:
        return 'وای‌فای';
      case ProductType.unit:
        return 'دانه‌ای';
    }
  }

  /// واحد پیش‌فرض این نوع.
  String get defaultUnit {
    switch (this) {
      case ProductType.weighted:
        return 'kg';
      case ProductType.wifi:
        return 'gb';
      case ProductType.unit:
        return 'piece';
    }
  }

  /// آیا موقع فروش مقدار پرسیده می‌شود (وزنی و وای‌فای).
  bool get asksQuantity =>
      this == ProductType.weighted || this == ProductType.wifi;
}

/// مدل جنس (products).
class Product {
  final int? id;
  final String name;
  final ProductType type;
  final String unit; // 'kg' | 'piece' | 'gb'
  final double buyPrice;
  final double sellPrice;
  final double quantity; // تعداد/مقدار موجود (وزنی می‌تواند اعشاری باشد)
  final String? expiryDate; // ISO string، اختیاری
  final String? barcode; // برای مرحله بعد
  final bool isPopular; // پرفروش — برای مرحله بعد

  const Product({
    this.id,
    required this.name,
    required this.type,
    required this.unit,
    required this.buyPrice,
    required this.sellPrice,
    required this.quantity,
    this.expiryDate,
    this.barcode,
    this.isPopular = false,
  });

  bool get isWeighted => type == ProductType.weighted;

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'name': name,
      'type': type.dbValue,
      'unit': unit,
      'buy_price': buyPrice,
      'sell_price': sellPrice,
      'quantity': quantity,
      'expiry_date': expiryDate,
      'barcode': barcode,
      'is_popular': isPopular ? 1 : 0,
    };
  }

  factory Product.fromMap(Map<String, Object?> map) {
    return Product(
      id: map['id'] as int?,
      name: map['name'] as String,
      type: ProductType.fromDb(map['type'] as String),
      unit: map['unit'] as String,
      buyPrice: (map['buy_price'] as num).toDouble(),
      sellPrice: (map['sell_price'] as num).toDouble(),
      quantity: (map['quantity'] as num).toDouble(),
      expiryDate: map['expiry_date'] as String?,
      barcode: map['barcode'] as String?,
      isPopular: (map['is_popular'] as int? ?? 0) == 1,
    );
  }

  Product copyWith({
    int? id,
    String? name,
    ProductType? type,
    String? unit,
    double? buyPrice,
    double? sellPrice,
    double? quantity,
    String? expiryDate,
    String? barcode,
    bool? isPopular,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      type: type ?? this.type,
      unit: unit ?? this.unit,
      buyPrice: buyPrice ?? this.buyPrice,
      sellPrice: sellPrice ?? this.sellPrice,
      quantity: quantity ?? this.quantity,
      expiryDate: expiryDate ?? this.expiryDate,
      barcode: barcode ?? this.barcode,
      isPopular: isPopular ?? this.isPopular,
    );
  }
}
