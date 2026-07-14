import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/customer.dart';
import '../../models/payment.dart';
import '../../models/purchase.dart';
import '../../models/sale.dart';
import '../../models/supplier.dart';
import '../../repositories/customer_repository.dart';
import '../../repositories/purchase_repository.dart';
import '../../repositories/sale_repository.dart';
import '../../repositories/supplier_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';

/// صفحه «قرض‌ها» — دو دفتر: مشتری‌ها و تامین‌کننده‌ها با یک ضامن بالای صفحه.
class DebtsScreen extends StatefulWidget {
  const DebtsScreen({super.key});

  @override
  State<DebtsScreen> createState() => _DebtsScreenState();
}

enum _DebtView { customers, suppliers }

class _DebtsScreenState extends State<DebtsScreen> {
  _DebtView _view = _DebtView.customers;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('دفتر قرض‌ها')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
            child: SegmentedButton<_DebtView>(
              segments: const [
                ButtonSegment(
                    value: _DebtView.customers,
                    label: Text('مشتری‌ها'),
                    icon: Icon(Icons.person)),
                ButtonSegment(
                    value: _DebtView.suppliers,
                    label: Text('تامین‌کننده‌ها'),
                    icon: Icon(Icons.handshake)),
              ],
              selected: {_view},
              onSelectionChanged: (s) => setState(() => _view = s.first),
            ),
          ),
          Expanded(
            child: _view == _DebtView.customers
                ? const _CustomersView()
                : const _SuppliersView(),
          ),
        ],
      ),
    );
  }
}

// ================= مشتری‌ها =================

class _CustomersView extends StatefulWidget {
  const _CustomersView();

  @override
  State<_CustomersView> createState() => _CustomersViewState();
}

class _CustomersViewState extends State<_CustomersView> {
  final CustomerRepository _repo = CustomerRepository();
  final SaleRepository _saleRepo = SaleRepository();
  late Future<List<Customer>> _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() => setState(() => _future = _repo.getAll());

  Future<void> _openDetail(Customer c) async {
    final sales = await _saleRepo.getCreditSalesForCustomer(c.id!);
    final receipts = await _repo.getPayments(c.id!);
    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _CustomerDetailSheet(
        customer: c,
        sales: sales,
        receipts: receipts,
        onPay: (amount) => _repo.pay(c.id!, amount),
      ),
    );
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Customer>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final list = snap.data ?? [];
        if (list.isEmpty) {
          return const _EmptyDebt(
            icon: Icons.person_outline,
            text:
                'هنوز مشتری قرضداری نیست.\nبا فروش «قرض» و نوشتن نام مشتری، اینجا ثبت می‌شود.',
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 6),
          itemCount: list.length,
          itemBuilder: (context, i) {
            final c = list[i];
            return _DebtTile(
              icon: Icons.person,
              color: AppTheme.primary,
              name: c.name,
              phone: c.phone,
              debt: c.debt,
              debtLabel: c.debt > 0 ? 'قرض او' : 'تصفیه',
              onTap: () => _openDetail(c),
            );
          },
        );
      },
    );
  }
}

class _CustomerDetailSheet extends StatefulWidget {
  final Customer customer;
  final List<Sale> sales;
  final List<Payment> receipts;
  final Future<void> Function(double amount) onPay;

  const _CustomerDetailSheet({
    required this.customer,
    required this.sales,
    required this.receipts,
    required this.onPay,
  });

  @override
  State<_CustomerDetailSheet> createState() => _CustomerDetailSheetState();
}

class _CustomerDetailSheetState extends State<_CustomerDetailSheet> {
  late double _debt;
  late List<Payment> _receipts;

  @override
  void initState() {
    super.initState();
    _debt = widget.customer.debt;
    _receipts = List.of(widget.receipts);
  }

  Future<void> _pay() async {
    final amount = await showDialog<double>(
      context: context,
      builder: (_) => _PayDialog(
        title: 'دریافت پرداخت از ${widget.customer.name}',
        actionLabel: 'ثبت دریافت',
        currentDebt: _debt,
      ),
    );
    if (amount != null && amount > 0) {
      await widget.onPay(amount);
      setState(() {
        _debt = (_debt - amount) > 0 ? _debt - amount : 0;
        _receipts.insert(
            0,
            Payment(
                refId: widget.customer.id!,
                date: DateTime.now().toIso8601String(),
                amount: amount));
      });
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('رسید دریافت ثبت شد ✓')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _LedgerSheet(
      name: widget.customer.name,
      phone: widget.customer.phone,
      debtLabel: 'مجموع قرض او به ما',
      debt: _debt,
      payLabel: 'دریافت پرداخت از مشتری',
      onPay: _debt > 0 ? _pay : null,
      receiptsTitle: 'رسیدهای دریافت',
      receipts: _receipts
          .map((r) => _HistoryRow(
                title: _shortDate(r.date),
                subtitle: 'رسید',
                trailing: formatAfghani(r.amount),
                trailingColor: AppTheme.primary,
              ))
          .toList(),
      emptyReceipts: 'رسیدی ثبت نشده',
      historyTitle: 'فروش‌های قرضی',
      history: widget.sales
          .map((s) => _HistoryRow(
                title: _shortDate(s.date),
                subtitle: 'فروش قرضی',
                trailing: formatAfghani(s.total),
                trailingColor: AppTheme.danger,
              ))
          .toList(),
      emptyHistory: 'فروش قرضی نیست',
    );
  }
}

// ================= تامین‌کننده‌ها =================

class _SuppliersView extends StatefulWidget {
  const _SuppliersView();

  @override
  State<_SuppliersView> createState() => _SuppliersViewState();
}

class _SuppliersViewState extends State<_SuppliersView> {
  final SupplierRepository _repo = SupplierRepository();
  final PurchaseRepository _purchaseRepo = PurchaseRepository();
  late Future<List<Supplier>> _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() => setState(() => _future = _repo.getAll());

  Future<void> _openDetail(Supplier s) async {
    final purchases = await _purchaseRepo.getForSupplier(s.id!);
    final receipts = await _repo.getPayments(s.id!);
    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _SupplierDetailSheet(
        supplier: s,
        purchases: purchases,
        receipts: receipts,
        onPay: (amount) => _repo.pay(s.id!, amount),
      ),
    );
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Supplier>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final list = snap.data ?? [];
        if (list.isEmpty) {
          return const _EmptyDebt(
            icon: Icons.handshake_outlined,
            text:
                'هنوز تامین‌کننده‌ای نیست.\nبا ثبت فاکتور خرید، تامین‌کننده ساخته می‌شود.',
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 6),
          itemCount: list.length,
          itemBuilder: (context, i) {
            final s = list[i];
            return _DebtTile(
              icon: Icons.handshake,
              color: AppTheme.credit,
              name: s.name,
              phone: s.phone,
              debt: s.debt,
              debtLabel: s.debt > 0 ? 'قرض ما' : 'تصفیه',
              onTap: () => _openDetail(s),
            );
          },
        );
      },
    );
  }
}

class _SupplierDetailSheet extends StatefulWidget {
  final Supplier supplier;
  final List<Purchase> purchases;
  final List<Payment> receipts;
  final Future<void> Function(double amount) onPay;

  const _SupplierDetailSheet({
    required this.supplier,
    required this.purchases,
    required this.receipts,
    required this.onPay,
  });

  @override
  State<_SupplierDetailSheet> createState() => _SupplierDetailSheetState();
}

class _SupplierDetailSheetState extends State<_SupplierDetailSheet> {
  late double _debt;
  late List<Payment> _receipts;

  @override
  void initState() {
    super.initState();
    _debt = widget.supplier.debt;
    _receipts = List.of(widget.receipts);
  }

  Future<void> _pay() async {
    final amount = await showDialog<double>(
      context: context,
      builder: (_) => _PayDialog(
        title: 'پرداخت به ${widget.supplier.name}',
        actionLabel: 'ثبت پرداخت',
        currentDebt: _debt,
      ),
    );
    if (amount != null && amount > 0) {
      await widget.onPay(amount);
      setState(() {
        _debt = (_debt - amount) > 0 ? _debt - amount : 0;
        _receipts.insert(
            0,
            Payment(
                refId: widget.supplier.id!,
                date: DateTime.now().toIso8601String(),
                amount: amount));
      });
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('رسید پرداخت ثبت شد ✓')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _LedgerSheet(
      name: widget.supplier.name,
      phone: widget.supplier.phone,
      debtLabel: 'مجموع قرض ما',
      debt: _debt,
      payLabel: 'پرداخت به تامین‌کننده',
      onPay: _debt > 0 ? _pay : null,
      receiptsTitle: 'رسیدهای پرداخت',
      receipts: _receipts
          .map((r) => _HistoryRow(
                title: _shortDate(r.date),
                subtitle: 'رسید',
                trailing: formatAfghani(r.amount),
                trailingColor: AppTheme.primary,
              ))
          .toList(),
      emptyReceipts: 'رسیدی ثبت نشده',
      historyTitle: 'فاکتورها',
      history: widget.purchases
          .map((p) => _HistoryRow(
                title: _shortDate(p.date),
                subtitle:
                    'مجموع: ${formatAfghani(p.total)} • پرداخت: ${formatAfghani(p.paid)}',
                trailing:
                    p.remaining > 0 ? formatAfghani(p.remaining) : '✓',
                trailingColor:
                    p.remaining > 0 ? AppTheme.danger : AppTheme.primary,
              ))
          .toList(),
      emptyHistory: 'فاکتوری نیست',
    );
  }
}

// ================= اجزای مشترک =================

String _shortDate(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  String two(int n) => n < 10 ? '0$n' : '$n';
  return '${d.year}/${two(d.month)}/${two(d.day)}';
}

class _DebtTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String name;
  final String? phone;
  final double debt;
  final String debtLabel;
  final VoidCallback onTap;

  const _DebtTile({
    required this.icon,
    required this.color,
    required this.name,
    required this.phone,
    required this.debt,
    required this.debtLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasDebt = debt > 0;
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        onTap: onTap,
        leading: CircleAvatar(
          radius: 24,
          backgroundColor: color,
          child: Icon(icon, color: Colors.white),
        ),
        title: Text(name,
            style:
                const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        subtitle: Text((phone == null || phone!.isEmpty) ? 'بدون نمبر' : phone!,
            style: const TextStyle(fontSize: 14)),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(formatAfghani(debt),
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: hasDebt ? AppTheme.danger : AppTheme.primary)),
            Text(debtLabel,
                style: TextStyle(
                    fontSize: 12,
                    color: hasDebt ? AppTheme.danger : Colors.grey)),
          ],
        ),
      ),
    );
  }
}

class _EmptyDebt extends StatelessWidget {
  final IconData icon;
  final String text;

  const _EmptyDebt({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 70, color: Colors.grey),
            const SizedBox(height: 14),
            Text(text,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 17, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}

class _HistoryRow {
  final String title;
  final String subtitle;
  final String trailing;
  final Color trailingColor;

  const _HistoryRow({
    required this.title,
    required this.subtitle,
    required this.trailing,
    required this.trailingColor,
  });
}

/// چیدمان مشترک برگه جزئیات دفتر (مشتری یا تامین‌کننده).
class _LedgerSheet extends StatelessWidget {
  final String name;
  final String? phone;
  final String debtLabel;
  final double debt;
  final String payLabel;
  final VoidCallback? onPay;
  final String receiptsTitle;
  final List<_HistoryRow> receipts;
  final String emptyReceipts;
  final String historyTitle;
  final List<_HistoryRow> history;
  final String emptyHistory;

  const _LedgerSheet({
    required this.name,
    required this.phone,
    required this.debtLabel,
    required this.debt,
    required this.payLabel,
    required this.onPay,
    required this.receiptsTitle,
    required this.receipts,
    required this.emptyReceipts,
    required this.historyTitle,
    required this.history,
    required this.emptyHistory,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(name,
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          if (phone != null && phone!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child:
                  Text(phone!, style: const TextStyle(color: Colors.grey)),
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
                Text(debtLabel,
                    style: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.bold)),
                Text(formatAfghani(debt),
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color:
                            debt > 0 ? AppTheme.danger : AppTheme.primary)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (onPay != null)
            ElevatedButton.icon(
              onPressed: onPay,
              icon: const Icon(Icons.payments),
              label: Text(payLabel),
              style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56)),
            ),
          const SizedBox(height: 16),
          ..._section(receiptsTitle, receipts, emptyReceipts),
          const SizedBox(height: 16),
          ..._section(historyTitle, history, emptyHistory),
        ],
      ),
    );
  }

  List<Widget> _section(String title, List<_HistoryRow> rows, String empty) {
    return [
      Align(
        alignment: Alignment.centerRight,
        child: Text(title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ),
      const SizedBox(height: 6),
      if (rows.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(empty,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.grey)),
        )
      else
        ...rows.map((h) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(h.title,
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.bold)),
                        Text(h.subtitle,
                            style: const TextStyle(
                                fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                  ),
                  Text(h.trailing,
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: h.trailingColor)),
                ],
              ),
            )),
    ];
  }
}

class _PayDialog extends StatefulWidget {
  final String title;
  final String actionLabel;
  final double currentDebt;

  const _PayDialog({
    required this.title,
    required this.actionLabel,
    required this.currentDebt,
  });

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
      title: Text(widget.title),
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
              labelText: 'مقدار (افغانی)',
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
          child: Text(widget.actionLabel),
        ),
      ],
    );
  }
}
