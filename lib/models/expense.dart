/// مدل مصرف خانه (expenses).
class Expense {
  final int? id;
  final String date; // ISO string
  final double amount;
  final String? note;

  const Expense({
    this.id,
    required this.date,
    required this.amount,
    this.note,
  });

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'date': date,
      'amount': amount,
      'note': note,
    };
  }

  factory Expense.fromMap(Map<String, Object?> map) {
    return Expense(
      id: map['id'] as int?,
      date: map['date'] as String,
      amount: (map['amount'] as num).toDouble(),
      note: map['note'] as String?,
    );
  }
}
