import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../../models/product.dart';
import '../../repositories/product_repository.dart';

/// فورم اضافه/ویرایش جنس.
class ProductFormScreen extends StatefulWidget {
  final Product? product;

  const ProductFormScreen({super.key, this.product});

  bool get isEditing => product != null;

  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends State<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final ProductRepository _repo = ProductRepository();

  late final TextEditingController _nameController;
  late final TextEditingController _buyPriceController;
  late final TextEditingController _sellPriceController;
  late final TextEditingController _quantityController;

  late ProductType _type;
  late String _unit;
  DateTime? _expiryDate;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _nameController = TextEditingController(text: p?.name ?? '');
    _buyPriceController = TextEditingController(
      text: p != null ? _numText(p.buyPrice) : '',
    );
    _sellPriceController = TextEditingController(
      text: p != null ? _numText(p.sellPrice) : '',
    );
    _quantityController = TextEditingController(
      text: p != null ? _numText(p.quantity) : '',
    );
    _type = p?.type ?? ProductType.unit;
    _unit = p?.unit ?? _type.defaultUnit;
    if (p?.expiryDate != null && p!.expiryDate!.isNotEmpty) {
      _expiryDate = DateTime.tryParse(p.expiryDate!);
    }
  }

  String _numText(double v) {
    // بدون اعشار اضافی
    if (v == v.roundToDouble()) return v.toInt().toString();
    return v.toString();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _buyPriceController.dispose();
    _sellPriceController.dispose();
    _quantityController.dispose();
    super.dispose();
  }

  void _onTypeChanged(ProductType type) {
    setState(() {
      _type = type;
      // واحد را به پیش‌فرض نوع تنظیم کن
      _unit = type.defaultUnit;
    });
  }

  Future<void> _pickExpiryDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiryDate ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 10),
    );
    if (picked != null) {
      setState(() => _expiryDate = picked);
    }
  }

  double _parseNum(String s) {
    return double.tryParse(s.trim()) ?? 0;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final product = Product(
      id: widget.product?.id,
      name: _nameController.text.trim(),
      type: _type,
      unit: _unit,
      buyPrice: _parseNum(_buyPriceController.text),
      sellPrice: _parseNum(_sellPriceController.text),
      quantity: _parseNum(_quantityController.text),
      expiryDate: _expiryDate?.toIso8601String(),
      barcode: widget.product?.barcode,
      isPopular: widget.product?.isPopular ?? false,
    );

    try {
      if (widget.isEditing) {
        await _repo.update(product);
      } else {
        await _repo.insert(product);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('خطا در ذخیره: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEditing ? 'ویرایش جنس' : 'جنس جدید'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameController,
              textInputAction: TextInputAction.next,
              style: const TextStyle(fontSize: 20),
              decoration: const InputDecoration(
                labelText: 'نام جنس',
                prefixIcon: Icon(Icons.shopping_bag),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'نام جنس را بنویسید';
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            const Text(
              'نوع جنس',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            SegmentedButton<ProductType>(
              segments: const [
                ButtonSegment(
                  value: ProductType.weighted,
                  label: Text('وزنی'),
                  icon: Icon(Icons.scale),
                ),
                ButtonSegment(
                  value: ProductType.unit,
                  label: Text('دانه‌ای'),
                  icon: Icon(Icons.inventory_2),
                ),
                ButtonSegment(
                  value: ProductType.wifi,
                  label: Text('وای‌فای'),
                  icon: Icon(Icons.wifi),
                ),
              ],
              selected: {_type},
              onSelectionChanged: (s) => _onTypeChanged(s.first),
            ),
            if (_type != ProductType.wifi) ...[
              const SizedBox(height: 20),
              const Text(
                'واحد',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'kg', label: Text('کیلو')),
                  ButtonSegment(value: 'piece', label: Text('دانه')),
                ],
                selected: {_unit == 'gb' ? 'kg' : _unit},
                onSelectionChanged: (s) => setState(() => _unit = s.first),
              ),
            ],
            const SizedBox(height: 20),
            _NumberField(
              controller: _buyPriceController,
              label: _type == ProductType.wifi
                  ? 'قیمت خرید فی جی‌بی (افغانی)'
                  : 'قیمت خرید (افغانی)',
              icon: Icons.shopping_cart_outlined,
            ),
            const SizedBox(height: 16),
            _NumberField(
              controller: _sellPriceController,
              label: _type == ProductType.wifi
                  ? 'قیمت فروش فی جی‌بی (افغانی)'
                  : 'قیمت فروش (افغانی)',
              icon: Icons.sell_outlined,
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'قیمت فروش را بنویسید';
                }
                if (double.tryParse(v.trim()) == null) {
                  return 'عدد معتبر بنویسید';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            _NumberField(
              controller: _quantityController,
              label: _type == ProductType.weighted
                  ? 'مقدار موجود (کیلو)'
                  : (_type == ProductType.wifi
                      ? 'مقدار (جی‌بی)'
                      : 'تعداد موجود (دانه)'),
              icon: Icons.numbers,
            ),
            const SizedBox(height: 20),
            _ExpiryField(
              date: _expiryDate,
              emptyLabel: _type == ProductType.wifi
                  ? 'تاریخ ختم'
                  : 'تاریخ خرابی (اختیاری)',
              onPick: _pickExpiryDate,
              onClear: () => setState(() => _expiryDate = null),
            ),
            const SizedBox(height: 28),
            ElevatedButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save, size: 26),
              label: Text(widget.isEditing ? 'ذخیره تغییرات' : 'ثبت جنس'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(64),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NumberField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final String? Function(String?)? validator;

  const _NumberField({
    required this.controller,
    required this.label,
    required this.icon,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
      ],
      style: const TextStyle(fontSize: 20),
      textDirection: TextDirection.ltr,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
      ),
      validator: validator,
    );
  }
}

class _ExpiryField extends StatelessWidget {
  final DateTime? date;
  final String emptyLabel;
  final VoidCallback onPick;
  final VoidCallback onClear;

  const _ExpiryField({
    required this.date,
    this.emptyLabel = 'تاریخ خرابی (اختیاری)',
    required this.onPick,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final text =
        date == null ? emptyLabel : DateFormat('yyyy/MM/dd').format(date!);
    return InkWell(
      onTap: onPick,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          prefixIcon: const Icon(Icons.event),
          suffixIcon: date == null
              ? const Icon(Icons.chevron_left)
              : IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: onClear,
                ),
        ),
        child: Text(text, style: const TextStyle(fontSize: 17)),
      ),
    );
  }
}
