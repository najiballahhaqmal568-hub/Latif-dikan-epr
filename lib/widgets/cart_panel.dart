import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/cart_item.dart';
import '../screens/sales/cart_model.dart';
import '../theme/app_theme.dart';
import '../utils/formatting.dart';

/// سبد فروش پایین صفحه — همیشه دیده می‌شود، مجموع زنده.
class CartPanel extends StatefulWidget {
  final VoidCallback onCash;
  final VoidCallback onCredit;

  const CartPanel({
    super.key,
    required this.onCash,
    required this.onCredit,
  });

  @override
  State<CartPanel> createState() => _CartPanelState();
}

class _CartPanelState extends State<CartPanel> {
  /// قطی «باقی» بسته است تا جای دکمه‌های «تمام» را نگیرد.
  bool _changeOpen = false;
  final TextEditingController _paid = TextEditingController();

  @override
  void dispose() {
    _paid.dispose();
    super.dispose();
  }

  /// بعد از هر فروش، قطی باقی پاک و بسته شود.
  void resetChange() {
    _paid.clear();
    if (mounted) setState(() => _changeOpen = false);
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartModel>();
    if (cart.isEmpty && (_changeOpen || _paid.text.isNotEmpty)) {
      // سبد خالی شد → قطی باقی هم پاک شود
      WidgetsBinding.instance.addPostFrameCallback((_) => resetChange());
    }

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
              // سر سبد: شمارندهٔ اقلام + پاک‌کردن سبد
              if (cart.isNotEmpty)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${cart.count} قلم',
                        style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey)),
                    TextButton.icon(
                      onPressed: () {
                        HapticFeedback.mediumImpact();
                        cart.clear();
                        resetChange();
                      },
                      icon: const Icon(Icons.delete_outline, size: 18),
                      label: const Text('پاک‌کردن سبد'),
                      style: TextButton.styleFrom(
                          foregroundColor: AppTheme.danger,
                          visualDensity: VisualDensity.compact),
                    ),
                  ],
                ),
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
                  constraints: const BoxConstraints(maxHeight: 260),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: cart.items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = cart.items[index];
                      return _CartRow(
                        item: item,
                        onRemove: () => cart.removeItem(item),
                        onDec: () {
                          HapticFeedback.selectionClick();
                          cart.bump(item, -1);
                        },
                        onInc: () {
                          HapticFeedback.selectionClick();
                          cart.bump(item, 1);
                        },
                      );
                    },
                  ),
                ),
              const Divider(thickness: 1.5),
              // مجموع زنده + دکمهٔ باز/بستن «باقی»
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'مجموع:',
                    style:
                        TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  if (cart.isNotEmpty)
                    OutlinedButton.icon(
                      onPressed: () =>
                          setState(() => _changeOpen = !_changeOpen),
                      icon: const Icon(Icons.calculate_outlined, size: 18),
                      label: const Text('باقی'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor:
                            _changeOpen ? AppTheme.primary : Colors.grey,
                        visualDensity: VisualDensity.compact,
                      ),
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
              // حساب باقی — فقط ماشین‌حساب؛ در هیچ حسابی اثر ندارد
              if (_changeOpen && cart.isNotEmpty) _buildChangeBox(cart.total),
              const SizedBox(height: 10),
              // دو دکمه بزرگ نقد / قرض
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: cart.isEmpty ? null : widget.onCash,
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
                      onPressed: cart.isEmpty ? null : widget.onCredit,
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

  /// قطی «باقی»: پیسهٔ مشتری منهای مجموع. فقط نمایش است.
  Widget _buildChangeBox(double total) {
    final paid = double.tryParse(_paid.text.trim());
    final String label;
    final Color color;
    if (_paid.text.trim().isEmpty || paid == null) {
      label = 'باقی: —';
      color = Colors.grey;
    } else {
      final diff = double.parse((paid - total).toStringAsFixed(2));
      label = diff >= 0
          ? 'باقی: ${formatAfghani(diff)}'
          : 'کم است: ${formatAfghani(-diff)}';
      color = diff >= 0 ? AppTheme.primary : AppTheme.danger;
    }

    void addAmount(double v) {
      final cur = double.tryParse(_paid.text.trim()) ?? 0;
      setState(() => _paid.text = _fmtNum(cur + v));
      HapticFeedback.selectionClick();
    }

    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 2),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _paid,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.bold),
                  decoration: const InputDecoration(
                    hintText: 'پیسهٔ مشتری',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              IconButton(
                onPressed: () => setState(() => _paid.clear()),
                icon: const Icon(Icons.close, color: AppTheme.danger),
                tooltip: 'پاک',
                visualDensity: VisualDensity.compact,
              ),
              Text(label,
                  style: TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w900,
                      color: color)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              for (final v in const [50.0, 100.0, 500.0, 1000.0]) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => addAmount(v),
                    style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 6)),
                    child: Text(formatMoney(v),
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w800)),
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    setState(() => _paid.text = _fmtNum(total));
                    HapticFeedback.selectionClick();
                  },
                  style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 6)),
                  child: const Text('دقیق',
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// عدد بدون اعشار اضافی برای خانهٔ ورودی.
  String _fmtNum(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();
}

class _CartRow extends StatelessWidget {
  final CartItem item;
  final VoidCallback onRemove;
  final VoidCallback onDec;
  final VoidCallback onInc;

  const _CartRow({
    required this.item,
    required this.onRemove,
    required this.onDec,
    required this.onInc,
  });

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
          _StepButton(icon: Icons.remove, onTap: onDec, label: 'کم'),
          const SizedBox(width: 4),
          _StepButton(icon: Icons.add, onTap: onInc, label: 'زیاد'),
          const SizedBox(width: 6),
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

/// دکمهٔ خورد و بزرگِ کم/زیادکردن تعداد در سبد.
class _StepButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final String label;

  const _StepButton({
    required this.icon,
    required this.onTap,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(9),
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppTheme.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(icon, size: 22, color: AppTheme.primary),
        ),
      ),
    );
  }
}
