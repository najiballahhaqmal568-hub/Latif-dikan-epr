import 'package:flutter/material.dart';

import '../../models/purchase.dart';
import '../../repositories/purchase_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';
import 'purchase_form_screen.dart';

/// صفحه فاکتورهای خرید.
class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  final PurchaseRepository _repo = PurchaseRepository();
  late Future<List<Purchase>> _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() => _future = _repo.getAll());
  }

  Future<void> _newPurchase() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const PurchaseFormScreen()),
    );
    if (saved == true) _reload();
  }

  Future<void> _showDetail(Purchase p) async {
    final items = await _repo.getItems(p.id!);
    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _PurchaseDetailSheet(purchase: p, items: items),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('فاکتورهای خرید')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newPurchase,
        icon: const Icon(Icons.add, size: 28),
        label: const Text('فاکتور خرید جدید',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
      ),
      body: FutureBuilder<List<Purchase>>(
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
                  'هنوز فاکتور خریدی ثبت نشده.\nدکمه «فاکتور خرید جدید» را بزنید.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, color: Colors.grey),
                ),
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.only(bottom: 90, top: 6),
            itemCount: list.length,
            itemBuilder: (context, i) {
              final p = list[i];
              final settled = p.remaining <= 0;
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                child: ListTile(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  onTap: () => _showDetail(p),
                  title: Text(p.supplierName,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('مجموع: ${formatAfghani(p.total)}',
                        style: const TextStyle(fontSize: 14)),
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        settled ? 'تصفیه شد' : formatAfghani(p.remaining),
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: settled ? AppTheme.primary : AppTheme.danger,
                        ),
                      ),
                      Text(_shortDate(p.date),
                          style: const TextStyle(
                              fontSize: 12, color: Colors.grey)),
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

String _shortDate(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  String two(int n) => n < 10 ? '0$n' : '$n';
  return '${d.year}/${two(d.month)}/${two(d.day)}';
}

class _PurchaseDetailSheet extends StatelessWidget {
  final Purchase purchase;
  final List<PurchaseItem> items;

  const _PurchaseDetailSheet({required this.purchase, required this.items});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('فاکتور ${purchase.supplierName}',
              style:
                  const TextStyle(fontSize: 21, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text('تاریخ: ${_shortDate(purchase.date)}',
              style: const TextStyle(color: Colors.grey)),
          const SizedBox(height: 12),
          ...items.map((it) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(it.productName,
                              style: const TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.bold)),
                          Text(
                              '${formatQuantity(it.quantity)} × ${formatAfghani(it.buyPrice)}',
                              style: const TextStyle(
                                  fontSize: 13, color: Colors.grey)),
                        ],
                      ),
                    ),
                    Text(formatAfghani(it.lineTotal),
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                  ],
                ),
              )),
          const Divider(height: 24),
          _sumRow('مجموع فاکتور', formatAfghani(purchase.total)),
          _sumRow('پرداخت‌شده', formatAfghani(purchase.paid),
              color: AppTheme.primary),
          _sumRow('باقی‌مانده (قرض)', formatAfghani(purchase.remaining),
              color: AppTheme.danger, bold: true),
        ],
      ),
    );
  }

  Widget _sumRow(String label, String value,
      {Color? color, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: bold ? 18 : 16,
                  fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(value,
              style: TextStyle(
                  fontSize: bold ? 18 : 16,
                  fontWeight: FontWeight.bold,
                  color: color)),
        ],
      ),
    );
  }
}
