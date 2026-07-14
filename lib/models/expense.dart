/// مدل مصرف خانه (expenses).
/// اگر `correctionOf` مقدار داشته باشد، این رکورد یک «اصلاحیه» برای مصرف اصلی است
/// و `amount` آن می‌تواند منفی باشد (فرق اصلاح).
class Expense {
  final int? id;
  final String date; // ISO string
  final double amount;
  final String? note;
  final int? correctionOf;

  const Expense({
    this.id,
    required this.date,
    required this.amount,
    this.note,
    this.correctionOf,
  });

  bool get isCorrection => correctionOf != null;

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'date': date,
      'amount': amount,
      'note': note,
      'correction_of': correctionOf,
    };
  }

  factory Expense.fromMap(Map<String, Object?> map) {
    return Expense(
      id: map['id'] as int?,
      date: map['date'] as String,
      amount: (map['amount'] as num).toDouble(),
      note: map['note'] as String?,
      correctionOf: map['correction_of'] as int?,
    );
  }
}
