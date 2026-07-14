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

  Future<void> _delete(Expense e) async {
    await _repo.delete(e.id!);
    _load();
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
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 5),
                              child: ListTile(
                                title: Text(
                                    (e.note == null || e.note!.isEmpty)
                                        ? 'مصرف'
                                        : e.note!,
                                    style: const TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.bold)),
                                subtitle: Text(_shortDate(e.date),
                                    style: const TextStyle(fontSize: 13)),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(formatAfghani(e.amount),
                                        style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: AppTheme.credit)),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline,
                                          color: AppTheme.danger),
                                      onPressed: () => _delete(e),
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
