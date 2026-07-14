import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'products/product_list_screen.dart';
import 'sales/sales_screen.dart';

/// صفحه اصلی با نویگیشن پایین: «فروش» و «اجناس».
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    // هر تب موقع انتخاب دوباره ساخته می‌شود تا لیست اجناس/موجودی تازه باشد.
    // سبد فروش در Provider بالای این صفحه است و از بین نمی‌رود.
    final page =
        _index == 0 ? const SalesScreen() : const ProductListScreen();

    return Scaffold(
      body: page,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        height: 70,
        onDestinationSelected: (i) => setState(() => _index = i),
        indicatorColor: AppTheme.primary.withValues(alpha: 0.15),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.point_of_sale_outlined),
            selectedIcon: Icon(Icons.point_of_sale, color: AppTheme.primary),
            label: 'فروش',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2, color: AppTheme.primary),
            label: 'اجناس',
          ),
        ],
      ),
    );
  }
}
