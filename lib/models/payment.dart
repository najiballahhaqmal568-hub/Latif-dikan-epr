/// رسید پرداخت/دریافت — با تاریخ و مبلغ.
/// `refId` آی‌دی تامین‌کننده یا مشتری است.
class Payment {
  final int? id;
  final int refId;
  final String date; // ISO string
  final double amount;

  const Payment({
    this.id,
    required this.refId,
    required this.date,
    required this.amount,
  });
}
