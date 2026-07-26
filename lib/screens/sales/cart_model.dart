import 'package:flutter/foundation.dart';

import '../../models/cart_item.dart';
import '../../models/product.dart';

/// مدل سبد فروش — در حافظه؛ مجموع زنده حساب می‌شود.
class CartModel extends ChangeNotifier {
  final List<CartItem> _items = [];

  List<CartItem> get items => List.unmodifiable(_items);

  bool get isEmpty => _items.isEmpty;
  bool get isNotEmpty => _items.isNotEmpty;

  int get count => _items.length;

  /// مجموع پیسه سبد (زنده).
  double get total {
    double sum = 0;
    for (final item in _items) {
      sum += item.lineTotal;
    }
    return sum;
  }

  /// جنس دانه‌ای: یک دانه اضافه کن؛ اگر قبلاً بود، +۱.
  void addUnit(Product product) {
    final existing = _findByProductId(product.id);
    if (existing != null) {
      existing.quantity += 1;
    } else {
      _items.add(CartItem(product: product, quantity: 1));
    }
    notifyListeners();
  }

  /// جنس وزنی: مقدار مشخص اضافه کن؛ اگر قبلاً بود، جمع شود.
  void addWeighted(Product product, double quantity) {
    if (quantity <= 0) return;
    final existing = _findByProductId(product.id);
    if (existing != null) {
      existing.quantity += quantity;
    } else {
      _items.add(CartItem(product: product, quantity: quantity));
    }
    notifyListeners();
  }

  /// گام کم/زیادکردن برحسب واحد جنس: وزنی نیم کیلو، بقیه یک.
  static double stepFor(Product product) =>
      product.unit == 'kg' ? 0.5 : 1;

  /// کم/زیادکردن یک قلم با دکمه‌های − و ＋؛ اگر به صفر رسید برداشته می‌شود.
  void bump(CartItem item, int direction) {
    final next = double.parse(
        (item.quantity + direction * stepFor(item.product)).toStringAsFixed(3));
    if (next <= 0) {
      removeItem(item);
      return;
    }
    item.quantity = next;
    notifyListeners();
  }

  /// تنظیم مستقیم مقدار یک قلم (برای ویرایش داخل سبد).
  void setQuantity(CartItem item, double quantity) {
    if (quantity <= 0) {
      removeItem(item);
      return;
    }
    item.quantity = quantity;
    notifyListeners();
  }

  /// حذف/برگرداندن یک قلم.
  void removeItem(CartItem item) {
    _items.remove(item);
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }

  CartItem? _findByProductId(int? productId) {
    if (productId == null) return null;
    for (final item in _items) {
      if (item.product.id == productId) return item;
    }
    return null;
  }
}
