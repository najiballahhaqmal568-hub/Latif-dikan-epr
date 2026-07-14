import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../waste/waste_screen.dart';

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
            icon: Icons.delete_outline,
            title: 'ضایعات و تاریخ خرابی',
            subtitle: 'ثبت اجناس خراب/تاریخ‌تیر و اخطار خرابی',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const WasteScreen()),
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
