import 'product.dart';

/// قلم سبد فروش — فقط در حافظه است تا موقع «تمام» ثبت شود.
class CartItem {
  final Product product;
  double quantity; // مقدار (وزنی اعشاری، دانه‌ای عدد صحیح)

  CartItem({
    required this.product,
    required this.quantity,
  });

  /// قیمت فروش فی‌واحد در لحظه فروش.
  double get sellPrice => product.sellPrice;

  /// مجموع این قلم = مقدار × قیمت فروش.
  double get lineTotal => quantity * product.sellPrice;
}
