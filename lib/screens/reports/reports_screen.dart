import 'package:flutter/material.dart';

import '../../repositories/report_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';

/// صفحه گزارش‌ها و فایده هر جنس.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final ReportRepository _repo = ReportRepository();
  ReportPeriod _period = ReportPeriod.today;
  ReportData? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final data = await _repo.build(_period);
    if (!mounted) return;
    setState(() {
      _data = data;
      _loading = false;
    });
  }

  String get _periodLabel => _period == ReportPeriod.today
      ? 'امروز'
      : _period == ReportPeriod.month
          ? 'این ماه'
          : 'همه';

  @override
  Widget build(BuildContext context) {
    final d = _data;
    return Scaffold(
      appBar: AppBar(title: const Text('گزارش‌ها')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
            child: SegmentedButton<ReportPeriod>(
              segments: const [
                ButtonSegment(value: ReportPeriod.today, label: Text('امروز')),
                ButtonSegment(value: ReportPeriod.month, label: Text('این ماه')),
                ButtonSegment(value: ReportPeriod.all, label: Text('همه')),
              ],
              selected: {_period},
              onSelectionChanged: (s) {
                setState(() => _period = s.first);
                _load();
              },
            ),
          ),
          Expanded(
            child: (_loading || d == null)
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.fromLTRB(14, 4, 14, 24),
                    children: [
                      _card([
                        _row('مجموع فروش', d.totalSales),
                        _row('فروش نقد', d.cash),
                        _row('فروش قرض', d.credit),
                      ]),
                      _card([
                        _row('قیمت تمام‌شد اجناس فروخته‌شده', d.cogs),
                        _row('ضرر ضایعات', d.wasteLoss),
                        const Divider(),
                        _row('فایدهٔ دوکان', d.profit,
                            bold: true,
                            color: d.profit >= 0
                                ? AppTheme.primary
                                : AppTheme.danger),
                      ]),
                      _card([
                        _row('مصارف خانه (جدا)', d.expenses),
                        _row('قرض مشتری‌ها (فعلی)', d.customerDebt,
                            color: AppTheme.danger),
                        _row('قرض تامین‌کننده (فعلی)', d.supplierDebt,
                            color: AppTheme.danger),
                      ]),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(2, 14, 2, 6),
                        child: Text('فایده هر جنس ($_periodLabel)',
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                      if (d.perProduct.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 10),
                          child: Text('در این دوره فروشی نبوده',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey)),
                        )
                      else
                        ...d.perProduct.map(_productRow),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _card(List<Widget> children) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(children: children),
    );
  }

  Widget _row(String label, double value, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(label,
                style: TextStyle(
                    fontSize: bold ? 18 : 15,
                    fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          ),
          Text(formatAfghani(value),
              style: TextStyle(
                  fontSize: bold ? 19 : 15,
                  fontWeight: FontWeight.bold,
                  color: color)),
        ],
      ),
    );
  }

  Widget _productRow(ProductProfit p) {
    final col = p.profit >= 0 ? AppTheme.primary : AppTheme.danger;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 2),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.name,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                Text(
                    'فروش: ${formatAfghani(p.sales)} • تعداد: ${formatQuantity(p.qty)}',
                    style: const TextStyle(fontSize: 12.5, color: Colors.grey)),
              ],
            ),
          ),
          Text(formatAfghani(p.profit),
              style: TextStyle(
                  fontSize: 15, fontWeight: FontWeight.bold, color: col)),
        ],
      ),
    );
  }
}
