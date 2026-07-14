import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/purchase.dart';
import '../../models/supplier.dart';
import '../../repositories/purchase_repository.dart';
import '../../repositories/supplier_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';

/// صفحه تامین‌کننده‌ها و دفتر قرض آن‌ها.
class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  final SupplierRepository _repo = SupplierRepository();
  final PurchaseRepository _purchaseRepo = PurchaseRepository();
  late Future<List<Supplier>> _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() => _future = _repo.getAll());
  }

  Future<void> _openDetail(Supplier s) async {
    final purchases = await _purchaseRepo.getForSupplier(s.id!);
    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _SupplierDetailSheet(
        supplier: s,
        purchases: purchases,
        onPay: (amount) async {
          await _repo.pay(s.id!, amount);
        },
      ),
    );
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تامین‌کننده‌ها و قرض')),
      body: FutureBuilder<List<Supplier>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final list = snap.data ?? [];
          if (list.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(28),
                child: Text(
                  'هنوز تامین‌کننده‌ای نیست.\nبا ثبت فاکتور خرید، تامین‌کننده ساخته می‌شود.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, color: Colors.grey),
                ),
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 6),
            itemCount: list.length,
            itemBuilder: (context, i) {
              final s = list[i];
              final hasDebt = s.debt > 0;
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                child: ListTile(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  onTap: () => _openDetail(s),
                  leading: const CircleAvatar(
                    radius: 24,
                    backgroundColor: AppTheme.credit,
                    child: Icon(Icons.handshake, color: Colors.white),
                  ),
                  title: Text(s.name,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                  subtitle: Text(
                      (s.phone == null || s.phone!.isEmpty)
                          ? 'بدون نمبر'
                          : s.phone!,
                      style: const TextStyle(fontSize: 14)),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(formatAfghani(s.debt),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color:
                                hasDebt ? AppTheme.danger : AppTheme.primary,
                          )),
                      Text(hasDebt ? 'قرض ما' : 'تصفیه',
                          style: TextStyle(
                              fontSize: 12,
                              color: hasDebt ? AppTheme.danger : Colors.grey)),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _SupplierDetailSheet extends StatefulWidget {
  final Supplier supplier;
  final List<Purchase> purchases;
  final Future<void> Function(double amount) onPay;

  const _SupplierDetailSheet({
    required this.supplier,
    required this.purchases,
    required this.onPay,
  });

  @override
  State<_SupplierDetailSheet> createState() => _SupplierDetailSheetState();
}

class _SupplierDetailSheetState extends State<_SupplierDetailSheet> {
  late double _debt;

  @override
  void initState() {
    super.initState();
    _debt = widget.supplier.debt;
  }

  String _shortDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    String two(int n) => n < 10 ? '0$n' : '$n';
    return '${d.year}/${two(d.month)}/${two(d.day)}';
  }

  Future<void> _pay() async {
    final amount = await showDialog<double>(
      context: context,
      builder: (_) => _PayDialog(currentDebt: _debt, name: widget.supplier.name),
    );
    if (amount != null && amount > 0) {
      await widget.onPay(amount);
      setState(() {
        _debt = (_debt - amount) > 0 ? _debt - amount : 0;
      });
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('پرداخت ثبت شد ✓')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.supplier.name,
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          if (widget.supplier.phone != null &&
              widget.supplier.phone!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(widget.supplier.phone!,
                  style: const TextStyle(color: Colors.grey)),
            ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('مجموع قرض ما',
                    style:
                        TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                Text(formatAfghani(_debt),
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: _debt > 0 ? AppTheme.danger : AppTheme.primary)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (_debt > 0)
            ElevatedButton.icon(
              onPressed: _pay,
              icon: const Icon(Icons.payments),
              label: const Text('پرداخت به تامین‌کننده'),
              style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56)),
            ),
          const SizedBox(height: 16),
          const Align(
            alignment: Alignment.centerRight,
            child: Text('فاکتورها',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 6),
          if (widget.purchases.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('فاکتوری نیست',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey)),
            )
          else
            ...widget.purchases.map((p) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_shortDate(p.date),
                                style: const TextStyle(
                                    fontSize: 15, fontWeight: FontWeight.bold)),
                            Text(
                                'مجموع: ${formatAfghani(p.total)} • پرداخت: ${formatAfghani(p.paid)}',
                                style: const TextStyle(
                                    fontSize: 12, color: Colors.grey)),
                          ],
                        ),
                      ),
                      Text(
                        p.remaining > 0 ? formatAfghani(p.remaining) : '✓',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: p.remaining > 0
                                ? AppTheme.danger
                                : AppTheme.primary),
                      ),
                    ],
                  ),
                )),
        ],
      ),
    );
  }
}

class _PayDialog extends StatefulWidget {
  final double currentDebt;
  final String name;

  const _PayDialog({required this.currentDebt, required this.name});

  @override
  State<_PayDialog> createState() => _PayDialogState();
}

class _PayDialogState extends State<_PayDialog> {
  final TextEditingController _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('پرداخت به ${widget.name}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('قرض فعلی: ${formatAfghani(widget.currentDebt)}',
              style: const TextStyle(fontSize: 15)),
          const SizedBox(height: 12),
          TextField(
            controller: _ctrl,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
            ],
            textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 20),
            decoration: const InputDecoration(
              labelText: 'مقدار پرداخت (افغانی)',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context), child: const Text('لغو')),
        ElevatedButton(
          onPressed: () {
            final v = double.tryParse(_ctrl.text.trim()) ?? 0;
            if (v > 0) Navigator.pop(context, v);
          },
          child: const Text('ثبت پرداخت'),
        ),
      ],
    );
  }
}
