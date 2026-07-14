import 'product.dart';

/// مدل فاکتور خرید (purchases).
class Purchase {
  final int? id;
  final int? supplierId;
  final String supplierName;
  final String date; // ISO string
  final double total;
  final double paid;
  final double remaining;
  final List<PurchaseItem> items;

  const Purchase({
    this.id,
    this.supplierId,
    required this.supplierName,
    required this.date,
    required this.total,
    required this.paid,
    required this.remaining,
    this.items = const [],
  });

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'supplier_id': supplierId,
      'supplier_name': supplierName,
      'date': date,
      'total': total,
      'paid': paid,
      'remaining': remaining,
    };
  }

  factory Purchase.fromMap(Map<String, Object?> map, {List<PurchaseItem> items = const []}) {
    return Purchase(
      id: map['id'] as int?,
      supplierId: map['supplier_id'] as int?,
      supplierName: map['supplier_name'] as String,
      date: map['date'] as String,
      total: (map['total'] as num).toDouble(),
      paid: (map['paid'] as num).toDouble(),
      remaining: (map['remaining'] as num).toDouble(),
      items: items,
    );
  }
}

/// قلم فاکتور خرید (purchase_items).
class PurchaseItem {
  final int? id;
  final int? purchaseId;
  final int productId;
  final String productName;
  final double quantity;
  final double buyPrice;

  const PurchaseItem({
    this.id,
    this.purchaseId,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.buyPrice,
  });

  double get lineTotal => quantity * buyPrice;

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'purchase_id': purchaseId,
      'product_id': productId,
      'product_name': productName,
      'quantity': quantity,
      'buy_price': buyPrice,
    };
  }

  factory PurchaseItem.fromMap(Map<String, Object?> map) {
    return PurchaseItem(
      id: map['id'] as int?,
      purchaseId: map['purchase_id'] as int?,
      productId: map['product_id'] as int,
      productName: map['product_name'] as String,
      quantity: (map['quantity'] as num).toDouble(),
      buyPrice: (map['buy_price'] as num).toDouble(),
    );
  }
}

/// قلم قابل ویرایش هنگام ساختن فاکتور (در حافظه).
/// اگر `isNew` باشد، `productId` تهی است و این جنس با ثبت فاکتور در اجناس ساخته می‌شود.
class PurchaseDraftLine {
  int? productId;
  final String productName;
  final String unit;
  double quantity;
  double buyPrice;

  // فقط برای جنس نو
  final bool isNew;
  final ProductType? type;
  final double sellPrice;

  PurchaseDraftLine({
    this.productId,
    required this.productName,
    required this.unit,
    this.quantity = 1,
    this.buyPrice = 0,
    this.isNew = false,
    this.type,
    this.sellPrice = 0,
  });

  double get lineTotal => quantity * buyPrice;
}
