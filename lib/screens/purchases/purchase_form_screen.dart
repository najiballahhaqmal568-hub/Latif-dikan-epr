import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../../models/product.dart';
import '../../models/purchase.dart';
import '../../repositories/product_repository.dart';
import '../../repositories/purchase_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';

/// نشانهٔ انتخاب «جنس نو» از داخل انتخاب‌گر جنس.
const String _newProductSentinel = '__new_product__';

/// فورم ساختن فاکتور خرید.
class PurchaseFormScreen extends StatefulWidget {
  const PurchaseFormScreen({super.key});

  @override
  State<PurchaseFormScreen> createState() => _PurchaseFormScreenState();
}

class _PurchaseFormScreenState extends State<PurchaseFormScreen> {
  final ProductRepository _productRepo = ProductRepository();
  final PurchaseRepository _purchaseRepo = PurchaseRepository();

  final TextEditingController _supplierCtrl = TextEditingController();
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _paidCtrl = TextEditingController();

  DateTime _date = DateTime.now();
  final List<PurchaseDraftLine> _lines = [];
  bool _saving = false;
  bool _supplierError = false;

  @override
  void dispose() {
    _supplierCtrl.dispose();
    _phoneCtrl.dispose();
    _paidCtrl.dispose();
    super.dispose();
  }

  double get _total {
    double s = 0;
    for (final l in _lines) {
      s += l.lineTotal;
    }
    return s;
  }

  double get _paid => double.tryParse(_paidCtrl.text.trim()) ?? 0;
  double get _remaining => (_total - _paid) > 0 ? _total - _paid : 0;

  Future<void> _addLine() async {
    final products = await _productRepo.getAll();
    if (!mounted) return;
    // اجناسی که قبلاً در فاکتور اضافه شده‌اند را کنار می‌گذاریم؛
    // انتخاب‌گر همیشه باز می‌شود چون گزینه «جنس نو» هم دارد.
    final existingIds = _lines.map((l) => l.productId).whereType<int>().toSet();
    final available =
        products.where((p) => !existingIds.contains(p.id)).toList();
    final result = await showModalBottomSheet<Object>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ProductPicker(products: available),
    );
    if (result == null) return;
    if (result is Product) {
      setState(() {
        _lines.add(PurchaseDraftLine(
          productId: result.id!,
          productName: result.name,
          unit: result.unit,
          quantity: 1,
          buyPrice: result.buyPrice,
        ));
      });
    } else if (result == _newProductSentinel) {
      // کاربر «جنس نو» را انتخاب کرد
      final line = await _newProductForm();
      if (line != null) setState(() => _lines.add(line));
    }
  }

  /// فورم کوچک «جنس نو» — نام، نوع، واحد، قیمت فروش. قیمت خرید و تعداد از فاکتور.
  Future<PurchaseDraftLine?> _newProductForm() async {
    return showModalBottomSheet<PurchaseDraftLine>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _NewProductForm(),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(_date.year - 2),
      lastDate: DateTime(_date.year + 2),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    final name = _supplierCtrl.text.trim();
    setState(() => _supplierError = name.isEmpty);
    if (name.isEmpty) return;
    if (_lines.where((l) => l.quantity > 0).isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('حداقل یک جنس با تعداد بیشتر از صفر اضافه کنید')));
      return;
    }
    setState(() => _saving = true);
    try {
      await _purchaseRepo.createPurchase(
        supplierName: name,
        supplierPhone: _phoneCtrl.text.trim(),
        date: _date.toIso8601String(),
        lines: _lines,
        paid: _paid,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('خطا در ثبت: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('فاکتور خرید جدید')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _supplierCtrl,
            style: const TextStyle(fontSize: 19),
            decoration: InputDecoration(
              labelText: 'نام تامین‌کننده',
              prefixIcon: const Icon(Icons.person),
              errorText: _supplierError ? 'نام تامین‌کننده را بنویسید' : null,
            ),
            onChanged: (_) {
              if (_supplierError) setState(() => _supplierError = false);
            },
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(
              labelText: 'نمبر تیلفون (اختیاری)',
              prefixIcon: Icon(Icons.phone),
            ),
          ),
          const SizedBox(height: 14),
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(12),
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'تاریخ',
                prefixIcon: Icon(Icons.event),
              ),
              child: Text(DateFormat('yyyy/MM/dd').format(_date),
                  style: const TextStyle(fontSize: 17)),
            ),
          ),
          const SizedBox(height: 20),
          const Text('اجناس فاکتور',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          if (_lines.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: Text('هنوز جنسی اضافه نشده',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey)),
            ),
          ..._lines.asMap().entries.map((e) => _LineEditor(
                key: ObjectKey(e.value),
                line: e.value,
                onChanged: () => setState(() {}),
                onRemove: () => setState(() => _lines.removeAt(e.key)),
              )),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _addLine,
            icon: const Icon(Icons.add),
            label: const Text('افزودن جنس'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              side: const BorderSide(color: AppTheme.primary, width: 1.5),
              foregroundColor: AppTheme.primary,
              textStyle:
                  const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _paidCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
            ],
            textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 19),
            decoration: const InputDecoration(
              labelText: 'پرداخت شد (افغانی)',
              prefixIcon: Icon(Icons.payments),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                _row('مجموع فاکتور', formatAfghani(_total)),
                const Divider(),
                _row('باقی‌مانده (قرض)', formatAfghani(_remaining),
                    color: AppTheme.danger, bold: true),
              ],
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.save, size: 26),
            label: const Text('ثبت فاکتور'),
            style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(64)),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {Color? color, bool bold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: bold ? 18 : 16,
                fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        Text(value,
            style: TextStyle(
                fontSize: bold ? 20 : 16,
                fontWeight: FontWeight.bold,
                color: color)),
      ],
    );
  }
}

/// ویرایشگر یک قلم فاکتور: تعداد و قیمت خرید.
class _LineEditor extends StatefulWidget {
  final PurchaseDraftLine line;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  const _LineEditor({
    super.key,
    required this.line,
    required this.onChanged,
    required this.onRemove,
  });

  @override
  State<_LineEditor> createState() => _LineEditorState();
}

class _LineEditorState extends State<_LineEditor> {
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _buyCtrl;

  @override
  void initState() {
    super.initState();
    _qtyCtrl = TextEditingController(text: _fmt(widget.line.quantity));
    _buyCtrl = TextEditingController(text: _fmt(widget.line.buyPrice));
  }

  String _fmt(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _buyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(widget.line.productName,
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.bold)),
                ),
                Text(formatAfghani(widget.line.lineTotal),
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                IconButton(
                  icon: const Icon(Icons.close, color: AppTheme.danger),
                  onPressed: widget.onRemove,
                ),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _qtyCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                    ],
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(
                      labelText: 'تعداد (${unitLabel(widget.line.unit)})',
                      isDense: true,
                    ),
                    onChanged: (v) {
                      widget.line.quantity = double.tryParse(v.trim()) ?? 0;
                      widget.onChanged();
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _buyCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                    ],
                    textDirection: TextDirection.ltr,
                    decoration: const InputDecoration(
                      labelText: 'قیمت خرید',
                      isDense: true,
                    ),
                    onChanged: (v) {
                      widget.line.buyPrice = double.tryParse(v.trim()) ?? 0;
                      widget.onChanged();
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// انتخاب جنس از لیست موجود.
class _ProductPicker extends StatelessWidget {
  final List<Product> products;

  const _ProductPicker({required this.products});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('انتخاب جنس',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => Navigator.pop(context, _newProductSentinel),
            icon: const Icon(Icons.add),
            label: const Text('جنس نو (که در اجناس نیست)'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              side: const BorderSide(color: AppTheme.primary, width: 1.5),
              foregroundColor: AppTheme.primary,
              textStyle:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.5),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: products.length,
              itemBuilder: (context, i) {
                final p = products[i];
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  child: ListTile(
                    onTap: () => Navigator.pop(context, p),
                    title: Text(p.name,
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.bold)),
                    subtitle: Text(
                        'موجود: ${formatQuantityWithUnit(p.quantity, p.unit)}'),
                    trailing: const Icon(Icons.add_circle,
                        color: AppTheme.primary),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// فورم کوچک ساختن «جنس نو» داخل فاکتور خرید.
/// یک `PurchaseDraftLine` نو برمی‌گرداند (isNew=true). قیمت خرید و تعداد در فاکتور پر می‌شود.
class _NewProductForm extends StatefulWidget {
  const _NewProductForm();

  @override
  State<_NewProductForm> createState() => _NewProductFormState();
}

class _NewProductFormState extends State<_NewProductForm> {
  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _sellCtrl = TextEditingController();
  ProductType _type = ProductType.unit;
  String _unit = 'piece';
  bool _nameError = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _sellCtrl.dispose();
    super.dispose();
  }

  void _onType(ProductType t) {
    setState(() {
      _type = t;
      _unit = t.defaultUnit;
    });
  }

  void _add() {
    final name = _nameCtrl.text.trim();
    setState(() => _nameError = name.isEmpty);
    if (name.isEmpty) return;
    final sell = double.tryParse(_sellCtrl.text.trim()) ?? 0;
    Navigator.pop(
      context,
      PurchaseDraftLine(
        productId: null,
        productName: name,
        unit: _unit,
        type: _type,
        sellPrice: sell,
        quantity: 1,
        buyPrice: 0,
        isNew: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 4,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('جنس نو',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 14),
          TextField(
            controller: _nameCtrl,
            autofocus: true,
            style: const TextStyle(fontSize: 19),
            decoration: InputDecoration(
              labelText: 'نام جنس',
              prefixIcon: const Icon(Icons.shopping_bag),
              errorText: _nameError ? 'نام جنس را بنویسید' : null,
            ),
            onChanged: (_) {
              if (_nameError) setState(() => _nameError = false);
            },
          ),
          const SizedBox(height: 16),
          const Text('نوع جنس',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          SegmentedButton<ProductType>(
            segments: const [
              ButtonSegment(
                  value: ProductType.weighted,
                  label: Text('وزنی'),
                  icon: Icon(Icons.scale)),
              ButtonSegment(
                  value: ProductType.unit,
                  label: Text('دانه‌ای'),
                  icon: Icon(Icons.inventory_2)),
            ],
            selected: {_type},
            onSelectionChanged: (s) => _onType(s.first),
          ),
          const SizedBox(height: 16),
          const Text('واحد',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'kg', label: Text('کیلو')),
              ButtonSegment(value: 'piece', label: Text('دانه')),
            ],
            selected: {_unit},
            onSelectionChanged: (s) => setState(() => _unit = s.first),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _sellCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
            ],
            textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 19),
            decoration: const InputDecoration(
              labelText: 'قیمت فروش (افغانی)',
              prefixIcon: Icon(Icons.sell_outlined),
            ),
          ),
          const SizedBox(height: 8),
          const Text('قیمت خرید و تعداد را در خود فاکتور می‌نویسید.',
              style: TextStyle(fontSize: 13, color: Colors.grey)),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            onPressed: _add,
            icon: const Icon(Icons.add),
            label: const Text('افزودن به فاکتور'),
            style:
                ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(56)),
          ),
        ],
      ),
    );
  }
}
