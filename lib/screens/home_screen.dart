import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'debts/debts_screen.dart';
import 'more/more_screen.dart';
import 'products/product_list_screen.dart';
import 'purchases/purchases_screen.dart';
import 'sales/sales_screen.dart';

/// صفحه اصلی با نویگیشن پایین: فروش، اجناس، خرید، تامین‌کننده.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  Widget _pageFor(int i) {
    switch (i) {
      case 0:
        return const SalesScreen();
      case 1:
        return const ProductListScreen();
      case 2:
        return const PurchasesScreen();
      case 3:
        return const DebtsScreen();
      default:
        return const MoreScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    // هر تب موقع انتخاب دوباره ساخته می‌شود تا معلومات (موجودی، قرض) تازه باشد.
    // سبد فروش در Provider بالای این صفحه است و از بین نمی‌رود.
    return Scaffold(
      body: _pageFor(_index),
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
          NavigationDestination(
            icon: Icon(Icons.shopping_cart_outlined),
            selectedIcon: Icon(Icons.shopping_cart, color: AppTheme.primary),
            label: 'خرید',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book, color: AppTheme.primary),
            label: 'قرض‌ها',
          ),
          NavigationDestination(
            icon: Icon(Icons.more_horiz),
            selectedIcon: Icon(Icons.more_horiz, color: AppTheme.primary),
            label: 'بیشتر',
          ),
        ],
      ),
    );
  }
}
