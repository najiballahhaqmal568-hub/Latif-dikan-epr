import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/cart_item.dart';
import '../screens/sales/cart_model.dart';
import '../theme/app_theme.dart';
import '../utils/formatting.dart';

/// سبد فروش پایین صفحه — همیشه دیده می‌شود، مجموع زنده.
class CartPanel extends StatelessWidget {
  final VoidCallback onCash;
  final VoidCallback onCredit;

  const CartPanel({
    super.key,
    required this.onCash,
    required this.onCredit,
  });

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartModel>();

    return Material(
      elevation: 12,
      color: Colors.white,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // لیست قلم‌های سبد
              if (cart.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'سبد خالی است — یک جنس را بزنید',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                )
              else
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 180),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: cart.items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = cart.items[index];
                      return _CartRow(
                        item: item,
                        onRemove: () => cart.removeItem(item),
                      );
                    },
                  ),
                ),
              const Divider(thickness: 1.5),
              // مجموع زنده
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'مجموع:',
                    style:
                        TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    formatAfghani(cart.total),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              // دو دکمه بزرگ نقد / قرض
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: cart.isEmpty ? null : onCash,
                      icon: const Icon(Icons.payments, size: 26),
                      label: const Text('تمام — نقد'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.cash,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(64),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: cart.isEmpty ? null : onCredit,
                      icon: const Icon(Icons.account_balance_wallet, size: 26),
                      label: const Text('تمام — قرض'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.credit,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(64),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartRow extends StatelessWidget {
  final CartItem item;
  final VoidCallback onRemove;

  const _CartRow({required this.item, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.close, color: AppTheme.danger),
            onPressed: onRemove,
            tooltip: 'برگرداندن',
            visualDensity: VisualDensity.compact,
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.product.name,
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.bold),
                ),
                Text(
                  '${formatQuantityWithUnit(item.quantity, item.product.unit)}'
                  ' × ${formatAfghani(item.sellPrice)}',
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
              ],
            ),
          ),
          Text(
            formatAfghani(item.lineTotal),
            style:
                const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
