import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/expense.dart';
import '../../repositories/expense_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';

/// صفحه مصارف خانه.
class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  final ExpenseRepository _repo = ExpenseRepository();

  List<Expense> _list = [];
  double _total = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final list = await _repo.getAll();
    final total = await _repo.total();
    if (!mounted) return;
    setState(() {
      _list = list;
      _total = total;
      _loading = false;
    });
  }

  Future<void> _add() async {
    final result = await showModalBottomSheet<_ExpenseInput>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _ExpenseForm(),
    );
    if (result == null) return;
    await _repo.insert(amount: result.amount, note: result.note);
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('مصرف ثبت شد ✓')));
    _load();
  }

  Future<void> _correct(Expense e) async {
    final eff = await _repo.effectiveAmount(e.id!);
    if (!mounted) return;
    final correctAmount = await showDialog<double>(
      context: context,
      builder: (_) => _CorrectionDialog(original: e, effective: eff),
    );
    if (correctAmount == null) return;
    final done =
        await _repo.correct(original: e, correctAmount: correctAmount, effective: eff);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(done ? 'اصلاحیه ثبت شد ✓' : 'فرقی نبود')));
    if (done) _load();
  }

  String _signedMoney(double amount) {
    final s = formatAfghani(amount);
    return amount > 0 ? '+$s' : s; // منفی خودش علامت دارد
  }

  String _shortDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    String two(int n) => n < 10 ? '0$n' : '$n';
    return '${d.year}/${two(d.month)}/${two(d.day)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('مصارف خانه')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        icon: const Icon(Icons.add, size: 28),
        label: const Text('ثبت مصرف جدید',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.fromLTRB(14, 12, 14, 6),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color:
                        Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('مجموع مصارف',
                          style: TextStyle(
                              fontSize: 17, fontWeight: FontWeight.bold)),
                      Text(formatAfghani(_total),
                          style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.credit)),
                    ],
                  ),
                ),
                Expanded(
                  child: _list.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(28),
                            child: Text('هنوز مصرفی ثبت نشده',
                                style: TextStyle(
                                    fontSize: 17, color: Colors.grey)),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.only(bottom: 90),
                          itemCount: _list.length,
                          itemBuilder: (context, i) {
                            final e = _list[i];
                            final isCorr = e.isCorrection;
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 5),
                              child: ListTile(
                                title: Row(
                                  children: [
                                    if (isCorr)
                                      Container(
                                        margin:
                                            const EdgeInsets.only(left: 6),
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppTheme.credit
                                              .withValues(alpha: 0.15),
                                          borderRadius:
                                              BorderRadius.circular(20),
                                        ),
                                        child: const Text('اصلاحیه',
                                            style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: AppTheme.credit)),
                                      ),
                                    Expanded(
                                      child: Text(
                                          (e.note == null || e.note!.isEmpty)
                                              ? 'مصرف'
                                              : e.note!,
                                          style: const TextStyle(
                                              fontSize: 17,
                                              fontWeight: FontWeight.bold)),
                                    ),
                                  ],
                                ),
                                subtitle: Text(_shortDate(e.date),
                                    style: const TextStyle(fontSize: 13)),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      isCorr
                                          ? _signedMoney(e.amount)
                                          : formatAfghani(e.amount),
                                      style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: isCorr
                                              ? AppTheme.danger
                                              : AppTheme.credit),
                                    ),
                                    if (!isCorr)
                                      TextButton(
                                        onPressed: () => _correct(e),
                                        style: TextButton.styleFrom(
                                            foregroundColor: AppTheme.credit,
                                            padding: const EdgeInsets.only(
                                                right: 6, left: 4)),
                                        child: const Text('اصلاح',
                                            style: TextStyle(
                                                fontWeight: FontWeight.bold)),
                                      ),
                                  ],
                                ),
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

class _ExpenseInput {
  final double amount;
  final String? note;
  const _ExpenseInput(this.amount, this.note);
}

class _ExpenseForm extends StatefulWidget {
  const _ExpenseForm();

  @override
  State<_ExpenseForm> createState() => _ExpenseFormState();
}

class _ExpenseFormState extends State<_ExpenseForm> {
  final TextEditingController _amtCtrl = TextEditingController();
  final TextEditingController _noteCtrl = TextEditingController();
  bool _amtError = false;

  @override
  void dispose() {
    _amtCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final amt = double.tryParse(_amtCtrl.text.trim()) ?? 0;
    setState(() => _amtError = amt <= 0);
    if (amt <= 0) return;
    Navigator.pop(context, _ExpenseInput(amt, _noteCtrl.text.trim()));
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
          const Text('ثبت مصرف خانه',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(
            controller: _amtCtrl,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
            ],
            textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 19),
            decoration: InputDecoration(
              labelText: 'مبلغ (افغانی)',
              prefixIcon: const Icon(Icons.payments),
              errorText: _amtError ? 'مبلغ را درست بنویسید' : null,
            ),
            onChanged: (_) {
              if (_amtError) setState(() => _amtError = false);
            },
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _noteCtrl,
            style: const TextStyle(fontSize: 18),
            decoration: const InputDecoration(
              labelText: 'توضیح (اختیاری)',
              hintText: 'مثلاً: نان و سبزی',
              prefixIcon: Icon(Icons.notes),
            ),
          ),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            onPressed: _submit,
            icon: const Icon(Icons.check),
            label: const Text('ثبت مصرف'),
            style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(56)),
          ),
        ],
      ),
    );
  }
}

/// دیالوگ اصلاح مبلغ یک مصرف — مبلغ درست را می‌گیرد (اصلاحیه خودکار ساخته می‌شود).
class _CorrectionDialog extends StatefulWidget {
  final Expense original;
  final double effective;

  const _CorrectionDialog({required this.original, required this.effective});

  @override
  State<_CorrectionDialog> createState() => _CorrectionDialogState();
}

class _CorrectionDialogState extends State<_CorrectionDialog> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    final v = widget.effective;
    _ctrl = TextEditingController(
        text: v == v.roundToDouble() ? v.toInt().toString() : v.toString());
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('اصلاح مصرف'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
              '${widget.original.note ?? 'مصرف'} • مبلغ فعلی: ${formatAfghani(widget.effective)}',
              style: const TextStyle(fontSize: 14)),
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
              labelText: 'مبلغ درست (افغانی)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          const Text('مصرف اصلی پاک نمی‌شود؛ فقط یک «اصلاحیه» برای فرق ثبت می‌شود.',
              style: TextStyle(fontSize: 12.5, color: Colors.grey)),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context), child: const Text('لغو')),
        ElevatedButton(
          onPressed: () {
            final v = double.tryParse(_ctrl.text.trim());
            if (v != null && v >= 0) Navigator.pop(context, v);
          },
          child: const Text('ثبت اصلاحیه'),
        ),
      ],
    );
  }
}
