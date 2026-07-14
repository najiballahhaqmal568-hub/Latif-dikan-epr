/// مدل تامین‌کننده (suppliers). `debt` = پیسه‌ای که دوکان به او قرضدار است.
class Supplier {
  final int? id;
  final String name;
  final String? phone;
  final double debt;

  const Supplier({
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

  factory Supplier.fromMap(Map<String, Object?> map) {
    return Supplier(
      id: map['id'] as int?,
      name: map['name'] as String,
      phone: map['phone'] as String?,
      debt: (map['debt'] as num?)?.toDouble() ?? 0,
    );
  }

  Supplier copyWith({int? id, String? name, String? phone, double? debt}) {
    return Supplier(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      debt: debt ?? this.debt,
    );
  }
}
