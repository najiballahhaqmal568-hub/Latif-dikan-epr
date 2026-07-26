import 'package:intl/intl.dart';

/// قالب‌بندی اعداد و پول برای اپ دوکان.
/// ارقام معمولی (لاتین) استفاده می‌شود؛ واحد پول افغانی.

final NumberFormat _moneyFormat = NumberFormat('#,##0.##', 'en');
final NumberFormat _qtyFormat = NumberFormat('#,##0.###', 'en');

/// مبلغ را به شکل «۱,۲۰۰ افغانی» نشان می‌دهد (ارقام لاتین).
String formatAfghani(num amount) {
  return '${_moneyFormat.format(amount)} افغانی';
}

/// فقط عدد مبلغ بدون واحد.
String formatMoney(num amount) {
  return _moneyFormat.format(amount);
}

/// مقدار را قالب می‌کند؛ اعشار اضافی را حذف می‌کند (۱.۵ ، ۳).
String formatQuantity(num qty) {
  return _qtyFormat.format(qty);
}

/// نام دری واحد.
String unitLabel(String unit) {
  switch (unit) {
    case 'kg':
      return 'کیلو';
    case 'piece':
      return 'دانه';
    case 'gb':
      return 'جی‌بی';
    default:
      return unit;
  }
}

/// مقدار همراه با واحد: «۱.۵ کیلو» یا «۳ دانه».
String formatQuantityWithUnit(num qty, String unit) {
  return '${formatQuantity(qty)} ${unitLabel(unit)}';
}

/// چند روز تا تاریخ خرابی مانده (منفی = تیر شده). اگر تاریخ نبود null.
int? daysToExpiry(String? expiryIso) {
  if (expiryIso == null || expiryIso.isEmpty) return null;
  final d = DateTime.tryParse(expiryIso);
  if (d == null) return null;
  final today = DateTime.now();
  final a = DateTime(d.year, d.month, d.day);
  final b = DateTime(today.year, today.month, today.day);
  return a.difference(b).inDays;
}

/// برچسب دری وضعیت خرابی از روی روزهای مانده.
String expiryLabel(int days) {
  if (days < 0) return 'تاریخ تیر شده';
  if (days == 0) return 'امروز تیر می‌شود';
  return '$days روز تا خرابی';
}

/// سبب ضایعات به دری.
String wasteReasonLabel(String reason) {
  if (reason == 'expired') return 'تاریخ‌تیر';
  if (reason == 'shortage') return 'کسری شمارش';
  return 'خراب';
}
