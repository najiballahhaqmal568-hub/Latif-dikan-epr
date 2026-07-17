import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../expenses/expenses_screen.dart';
import '../reports/reports_screen.dart';
import '../stock_count/stock_count_screen.dart';
import '../waste/waste_screen.dart';
import '../wifi/wifi_screen.dart';

/// صفحه «بیشتر» — منوی بخش‌های کم‌کاربردتر (مقیاس‌پذیر برای بخش‌های آینده).
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('بیشتر')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          _MenuItem(
            icon: Icons.bar_chart,
            title: 'گزارش‌ها و فایده هر جنس',
            subtitle: 'فروش، فایده، ضایعات، مصارف و قرض‌ها',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ReportsScreen()),
            ),
          ),
          _MenuItem(
            icon: Icons.wifi,
            title: 'وای‌فای',
            subtitle: 'جی‌بی مانده، تاریخ ختم و اخطارها',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const WifiScreen()),
            ),
          ),
          _MenuItem(
            icon: Icons.pin_outlined,
            title: 'شمارش ماهانه',
            subtitle: 'مقایسهٔ موجودی با شمارش واقعی و دیدن فرق',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const StockCountScreen()),
            ),
          ),
          _MenuItem(
            icon: Icons.delete_outline,
            title: 'ضایعات و تاریخ خرابی',
            subtitle: 'ثبت اجناس خراب/تاریخ‌تیر و اخطار خرابی',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const WasteScreen()),
            ),
          ),
          _MenuItem(
            icon: Icons.home_outlined,
            title: 'مصارف خانه',
            subtitle: 'پیسه‌ای که از دوکان برای خرچ خانه کشیده می‌شود',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ExpensesScreen()),
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _MenuItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        onTap: onTap,
        leading: CircleAvatar(
          radius: 24,
          backgroundColor: AppTheme.credit,
          child: Icon(icon, color: Colors.white),
        ),
        title: Text(title,
            style:
                const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 13)),
        trailing: const Icon(Icons.chevron_left),
      ),
    );
  }
}
