import 'package:flutter/material.dart';

import '../../models/product.dart';
import '../../repositories/product_repository.dart';
import '../../repositories/waste_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';

/// آستانهٔ اخطار «جی‌بی کم».
const double kWifiLowGb = 20;

/// صفحه پایش وای‌فای — جی‌بی مانده و تاریخ ختم (دو شرط ختم).
class WifiScreen extends StatefulWidget {
  const WifiScreen({super.key});

  @override
  State<WifiScreen> createState() => _WifiScreenState();
}

class _WifiScreenState extends State<WifiScreen> {
  final ProductRepository _productRepo = ProductRepository();
  final WasteRepository _wasteRepo = WasteRepository();

  List<Product> _wifi = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final all = await _productRepo.getAll();
    if (!mounted) return;
    setState(() {
      _wifi = all.where((p) => p.type == ProductType.wifi).toList();
      _loading = false;
    });
  }

  Future<void> _moveRemainingToWaste(Product p) async {
    await _wasteRepo.createWaste(
      product: p,
      quantity: p.quantity,
      reason: 'expired',
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('باقی‌ماندهٔ جی‌بی به ضایعات منتقل شد')));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('وای‌فای')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _wifi.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(28),
                    child: Text(
                      'هنوز وای‌فایی ثبت نشده.\nاز بخش «اجناس» یک جنس نوع «وای‌فای» بسازید،\nبعد از «خرید» جی‌بی بخرید.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 17, color: Colors.grey),
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(14, 8, 14, 24),
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(2, 0, 2, 8),
                      child: Text(
                        'وای‌فای دو شرط ختم دارد: خلاص‌شدن جی‌بی یا تیرشدن تاریخ. فروش جی‌بی از تب «فروش» انجام می‌شود.',
                        style: TextStyle(fontSize: 13, color: Colors.grey),
                      ),
                    ),
                    ..._wifi.map(_wifiCard),
                  ],
                ),
    );
  }

  Widget _wifiCard(Product p) {
    final dte = daysToExpiry(p.expiryDate);
    final badges = <_Badge>[];
    if (p.quantity <= 0) {
      badges.add(const _Badge('خلاص شده', true));
    } else if (p.quantity <= kWifiLowGb) {
      badges.add(const _Badge('جی‌بی کم', false));
    }
    if (dte != null) {
      if (dte < 0) {
        badges.add(const _Badge('تاریخ تیر شده', true));
      } else if (dte <= 14) {
        badges.add(_Badge(expiryLabel(dte), false));
      }
    }
    final expiredRemaining = dte != null && dte < 0 && p.quantity > 0;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.wifi, color: AppTheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(p.name,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                ),
                if (p.expiryDate != null && p.expiryDate!.isNotEmpty)
                  Text('تا ${_shortDate(p.expiryDate!)}',
                      style: const TextStyle(fontSize: 13, color: Colors.grey)),
              ],
            ),
            const SizedBox(height: 6),
            Text(
                'مانده: ${formatQuantityWithUnit(p.quantity, p.unit)}  •  فروش: ${formatAfghani(p.sellPrice)} فی جی‌بی',
                style: const TextStyle(fontSize: 14)),
            if (badges.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: badges.map((b) => b.build()).toList(),
                ),
              ),
            if (expiredRemaining)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _moveRemainingToWaste(p),
                    icon: const Icon(Icons.delete_outline),
                    label: Text(
                        'انتقال باقی‌مانده (${formatQuantityWithUnit(p.quantity, p.unit)}) به ضایعات'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.danger,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(50)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _shortDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    String two(int n) => n < 10 ? '0$n' : '$n';
    return '${d.year}/${two(d.month)}/${two(d.day)}';
  }
}

class _Badge {
  final String text;
  final bool danger;
  const _Badge(this.text, this.danger);

  Widget build() {
    final color = danger ? AppTheme.danger : AppTheme.credit;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.bold, color: color)),
    );
  }
}
