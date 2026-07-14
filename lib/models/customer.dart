/// مدل مشتری (customers). `debt` = پیسه‌ای که مشتری به دوکان قرضدار است.
class Customer {
  final int? id;
  final String name;
  final String? phone;
  final double debt;

  const Customer({
    this.id,
    required this.name,
    this.phone,
    this.debt = 0,
  });

  Map<String, Object?> toMap() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'debt': debt,
    };
  }

  factory Customer.fromMap(Map<String, Object?> map) {
    return Customer(
      id: map['id'] as int?,
      name: map['name'] as String,
      phone: map['phone'] as String?,
      debt: (map['debt'] as num?)?.toDouble() ?? 0,
    );
  }

  Customer copyWith({int? id, String? name, String? phone, double? debt}) {
    return Customer(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      debt: debt ?? this.debt,
    );
  }
}
