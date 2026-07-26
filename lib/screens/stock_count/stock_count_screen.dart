import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/product.dart';
import '../../models/stock_count.dart';
import '../../repositories/product_repository.dart';
import '../../repositories/stock_count_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';

/// صفحه شمارش ماهانه.
class StockCountScreen extends StatefulWidget {
  const StockCountScreen({super.key});

  @override
  State<StockCountScreen> createState() => _StockCountScreenState();
}

class _StockCountScreenState extends State<StockCountScreen> {
  final ProductRepository _productRepo = ProductRepository();
  final StockCountRepository _repo = StockCountRepository();

  List<Product> _products = [];
  List<StockCount> _records = [];
  final Map<int, TextEditingController> _controllers = {};
  bool _loading = true;
  bool _saving = false;

  String get _month => StockCountRepository.currentMonthKey();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final products = await _productRepo.getAll();
    final records = await _repo.getAll();
    if (!mounted) return;
    for (final p in products) {
      final q = p.quantity;
      final text = q == q.roundToDouble() ? q.toInt().toString() : q.toString();
      final existing = _controllers[p.id!];
      if (existing == null) {
        _controllers[p.id!] = TextEditingController(text: text);
      } else {
        existing.text = text;
      }
    }
    setState(() {
      _products = products;
      _records = records;
      _loading = false;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final entries = <CountEntry>[];
    for (final p in _products) {
      final counted = double.tryParse(_controllers[p.id]!.text.trim());
      if (counted == null) continue;
      entries.add(CountEntry(
        productId: p.id!,
        productName: p.name,
        unit: p.unit,
        calculated: p.quantity,
        counted: counted,
      ));
    }
    final res = await _repo.saveCount(_month, entries);
    if (!mounted) return;
    setState(() => _saving = false);
    final lossText = res.shortageLoss > 0
        ? ' • ضرر کسری: ${formatAfghani(res.shortageLoss)}'
        : '';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(res.diffs == 0
            ? 'شمارش ثبت شد — هیچ فرقی نبود ✓'
            : 'شمارش ثبت شد — ${res.diffs} قلم فرق داشت$lossText')));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('شمارش ماهانه')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _products.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(28),
                    child: Text('هنوز جنسی نیست.',
                        style: TextStyle(fontSize: 17, color: Colors.grey)),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.only(bottom: 24),
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                      child: Text('شمارش ماه $_month — تعداد واقعی را بنویسید',
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey)),
                    ),
                    ..._products.map(_countRow),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
                      child: ElevatedButton.icon(
                        onPressed: _saving ? null : _save,
                        icon: _saving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.save),
                        label: const Text('ثبت شمارش ماه'),
                        style: ElevatedButton.styleFrom(
                            minimumSize: const Size.fromHeight(56)),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 14, 16, 4),
                      child: Text('فرق‌های ثبت‌شده',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey)),
                    ),
                    if (_records.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('هنوز شمارشی ثبت نشده',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey)),
                      )
                    else
                      ..._records.map(_recordRow),
                  ],
                ),
    );
  }

  Widget _countRow(Product p) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.name,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                Text('باید باشد: ${formatQuantityWithUnit(p.quantity, p.unit)}',
                    style: const TextStyle(fontSize: 12.5, color: Colors.grey)),
              ],
            ),
          ),
          SizedBox(
            width: 84,
            child: TextField(
              controller: _controllers[p.id],
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
              ],
              textDirection: TextDirection.ltr,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 16),
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'شمرده',
                border: OutlineInputBorder(),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 58,
            child: Text(_diffText(p),
                textAlign: TextAlign.left,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: _diffColor(p))),
          ),
        ],
      ),
    );
  }

  double? _diff(Product p) {
    final counted = double.tryParse(_controllers[p.id]!.text.trim());
    if (counted == null) return null;
    return double.parse((counted - p.quantity).toStringAsFixed(3));
  }

  String _diffText(Product p) {
    final d = _diff(p);
    if (d == null) return '';
    if (d == 0) return '۰';
    return d > 0 ? '+${formatQuantity(d)}' : formatQuantity(d);
  }

  Color _diffColor(Product p) {
    final d = _diff(p);
    if (d == null || d == 0) return Colors.grey;
    return d < 0 ? AppTheme.danger : AppTheme.primary;
  }

  Widget _recordRow(StockCount c) {
    final shortage = c.difference < 0;
    final color = shortage ? AppTheme.danger : AppTheme.primary;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.productName,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                Text(
                    'ماه ${c.month} • شمرده: ${formatQuantity(c.counted)} / باید: ${formatQuantity(c.calculated)}',
                    style: const TextStyle(fontSize: 12.5, color: Colors.grey)),
              ],
            ),
          ),
          Text(
              '${shortage ? 'کسر' : 'زیادت'} ${formatQuantity(c.difference.abs())}',
              style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
