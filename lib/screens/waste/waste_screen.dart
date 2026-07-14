import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/product.dart';
import '../../models/waste.dart';
import '../../repositories/product_repository.dart';
import '../../repositories/waste_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';

/// شمار روزهای اخطار پیش از تاریخ خرابی.
const int kExpiryWarnDays = 14;

/// صفحه ضایعات و اخطار تاریخ خرابی.
class WasteScreen extends StatefulWidget {
  const WasteScreen({super.key});

  @override
  State<WasteScreen> createState() => _WasteScreenState();
}

class _WasteScreenState extends State<WasteScreen> {
  final ProductRepository _productRepo = ProductRepository();
  final WasteRepository _wasteRepo = WasteRepository();

  List<Product> _products = [];
  List<Waste> _wasteList = [];
  double _totalLoss = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final products = await _productRepo.getAll();
    final wasteList = await _wasteRepo.getAll();
    final loss = await _wasteRepo.totalLoss();
    if (!mounted) return;
    setState(() {
      _products = products;
      _wasteList = wasteList;
      _totalLoss = loss;
      _loading = false;
    });
  }

  List<Product> get _expiring {
    final list = _products.where((p) {
      final d = daysToExpiry(p.expiryDate);
      return d != null && d <= kExpiryWarnDays && p.quantity > 0;
    }).toList();
    list.sort((a, b) =>
        (daysToExpiry(a.expiryDate) ?? 0).compareTo(daysToExpiry(b.expiryDate) ?? 0));
    return list;
  }

  Future<void> _pickProduct() async {
    if (_products.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('اول از بخش «اجناس» جنس اضافه کنید')));
      return;
    }
    final picked = await showModalBottomSheet<Product>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ProductPicker(products: _products),
    );
    if (picked != null) _recordFlow(picked, 'spoiled');
  }

  Future<void> _recordFlow(Product p, String defaultReason) async {
    final result = await showModalBottomSheet<_WasteInput>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _WasteForm(product: p, defaultReason: defaultReason),
    );
    if (result == null) return;
    await _wasteRepo.createWaste(
      product: p,
      quantity: result.quantity,
      reason: result.reason,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ضایعات ثبت شد ✓ موجودی کم شد')));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ضایعات و تاریخ خرابی')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                _sectionHeader('اخطار تاریخ خرابی (تا $kExpiryWarnDays روز)'),
                if (_expiring.isEmpty)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
                    child: Text('هیچ جنسی نزدیک خرابی نیست ✓',
                        style: TextStyle(color: Colors.grey)),
                  )
                else
                  ..._expiring.map(_warnCard),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
                  child: OutlinedButton.icon(
                    onPressed: _pickProduct,
                    icon: const Icon(Icons.add),
                    label: const Text('ثبت ضایعات جدید'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      side:
                          const BorderSide(color: AppTheme.danger, width: 1.5),
                      foregroundColor: AppTheme.danger,
                      textStyle: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                _lossHeader(),
                if (_wasteList.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('هنوز ضایعاتی ثبت نشده',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey)),
                  )
                else
                  ..._wasteList.map(_wasteRow),
              ],
            ),
    );
  }

  Widget _sectionHeader(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
        child: Text(text,
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Colors.grey)),
      );

  Widget _lossHeader() => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
        child: Row(
          children: [
            const Text('ضایعات ثبت‌شده',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey)),
            const Spacer(),
            const Text('مجموع ضرر: ',
                style: TextStyle(fontSize: 14, color: Colors.grey)),
            Text(formatAfghani(_totalLoss),
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.danger)),
          ],
        ),
      );

  Widget _warnCard(Product p) {
    final d = daysToExpiry(p.expiryDate) ?? 0;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.danger.withValues(alpha: 0.08),
        border: Border.all(color: AppTheme.danger, width: 1.2),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Text('⏰', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.name,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                Text(
                    '${expiryLabel(d)} • موجود: ${formatQuantityWithUnit(p.quantity, p.unit)}',
                    style: const TextStyle(
                        fontSize: 12.5,
                        color: AppTheme.danger,
                        fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          TextButton(
            onPressed: () => _recordFlow(p, 'expired'),
            style: TextButton.styleFrom(
                backgroundColor: AppTheme.danger,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
            child: const Text('ثبت ضایعات',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _wasteRow(Waste w) {
    String short(String iso) {
      final d = DateTime.tryParse(iso);
      if (d == null) return iso;
      String two(int n) => n < 10 ? '0$n' : '$n';
      return '${d.year}/${two(d.month)}/${two(d.day)}';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(w.productName,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                Row(
                  children: [
                    Text('${short(w.date)} • ',
                        style: const TextStyle(
                            fontSize: 12.5, color: Colors.grey)),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.credit.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(wasteReasonLabel(w.reason),
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.credit)),
                    ),
                    Text(' • ${formatQuantityWithUnit(w.quantity, w.unit)}',
                        style: const TextStyle(
                            fontSize: 12.5, color: Colors.grey)),
                  ],
                ),
              ],
            ),
          ),
          Text(formatAfghani(w.loss),
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.danger)),
        ],
      ),
    );
  }
}

/// نتیجهٔ فورم ضایعات.
class _WasteInput {
  final double quantity;
  final String reason;
  const _WasteInput(this.quantity, this.reason);
}

class _WasteForm extends StatefulWidget {
  final Product product;
  final String defaultReason;

  const _WasteForm({required this.product, required this.defaultReason});

  @override
  State<_WasteForm> createState() => _WasteFormState();
}

class _WasteFormState extends State<_WasteForm> {
  late final TextEditingController _qtyCtrl;
  late String _reason;

  @override
  void initState() {
    super.initState();
    _reason = widget.defaultReason;
    final q = widget.product.quantity;
    _qtyCtrl = TextEditingController(
        text: q == q.roundToDouble() ? q.toInt().toString() : q.toString());
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final qty = double.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (qty <= 0) return;
    Navigator.pop(context, _WasteInput(qty, _reason));
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
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
          Text('ثبت ضایعات: ${p.name}',
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
              'موجود: ${formatQuantityWithUnit(p.quantity, p.unit)} • قیمت خرید: ${formatAfghani(p.buyPrice)}',
              style: const TextStyle(fontSize: 13, color: Colors.grey)),
          const SizedBox(height: 16),
          const Text('سبب',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'spoiled', label: Text('خراب')),
              ButtonSegment(value: 'expired', label: Text('تاریخ‌تیر')),
            ],
            selected: {_reason},
            onSelectionChanged: (s) => setState(() => _reason = s.first),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _qtyCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
            ],
            textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 19),
            decoration: InputDecoration(
              labelText: 'مقدار ضایع‌شده (${unitLabel(p.unit)})',
              prefixIcon: const Icon(Icons.delete_outline),
            ),
          ),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            onPressed: _submit,
            icon: const Icon(Icons.check),
            label: const Text('ثبت ضایعات'),
            style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: AppTheme.danger,
                foregroundColor: Colors.white),
          ),
        ],
      ),
    );
  }
}

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
          const Text('انتخاب جنس ضایعاتی',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
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
                    trailing:
                        const Icon(Icons.delete, color: AppTheme.danger),
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
