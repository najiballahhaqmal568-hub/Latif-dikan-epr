import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/product.dart';
import '../theme/app_theme.dart';
import '../utils/formatting.dart';

/// دیالوگ پرسیدن مقدار برای جنس وزنی.
/// دکمه‌های آماده: نیم / ۱ / ۲ / ۵ + جای تایپ مقدار دلخواه.
/// در صورت تایید، مقدار (double) برگردانده می‌شود؛ در صورت لغو null.
Future<double?> showQuantityDialog(
  BuildContext context,
  Product product,
) {
  return showDialog<double>(
    context: context,
    builder: (_) => _QuantityDialog(product: product),
  );
}

class _QuantityDialog extends StatefulWidget {
  final Product product;

  const _QuantityDialog({required this.product});

  @override
  State<_QuantityDialog> createState() => _QuantityDialogState();
}

class _QuantityDialogState extends State<_QuantityDialog> {
  final TextEditingController _controller = TextEditingController();
  final TextEditingController _moneyController = TextEditingController();

  // پیش‌فرض‌های مقدار — برای جی‌بی (وای‌فای) اعداد بزرگ‌تر.
  List<double> get _presets =>
      widget.product.unit == 'gb' ? const [1, 2, 5, 10] : const [0.5, 1, 2, 5];

  /// مقدار از روی پیسه: مقدار = پیسه ÷ قیمت فی واحد.
  double get _moneyQty {
    final m = double.tryParse(_moneyController.text.trim()) ?? 0;
    final price = widget.product.sellPrice;
    if (m <= 0 || price <= 0) return 0;
    return double.parse((m / price).toStringAsFixed(3));
  }

  @override
  void dispose() {
    _controller.dispose();
    _moneyController.dispose();
    super.dispose();
  }

  String _presetLabel(double v) {
    if (v == 0.5) return 'نیم';
    return formatQuantity(v);
  }

  void _confirm(double qty) {
    if (qty > 0) {
      Navigator.of(context).pop(qty);
    }
  }

  /// اول مقدار تایپ‌شده؛ اگر نبود، مقدار از روی پیسه.
  void _confirmTyped() {
    var qty = double.tryParse(_controller.text.trim()) ?? 0;
    if (qty <= 0) qty = _moneyQty;
    _confirm(qty);
  }

  @override
  Widget build(BuildContext context) {
    final unit = unitLabel(widget.product.unit);
    return AlertDialog(
      title: Text('مقدار ${widget.product.name}'),
      // در تیلفون خورد، محتوا سکرول شود تا دکمه‌ها همیشه برسند
      content: SingleChildScrollView(
        child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'قیمت فی $unit: ${formatAfghani(widget.product.sellPrice)}',
            style: const TextStyle(fontSize: 16),
          ),
          const SizedBox(height: 16),
          // دکمه‌های آماده
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 2.2,
            children: _presets.map((v) {
              return ElevatedButton(
                onPressed: () => _confirm(v),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                ),
                child: Text('${_presetLabel(v)} $unit'),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 8),
          const Text(
            'یا مقدار دلخواه:',
            style: TextStyle(fontSize: 16),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            ],
            textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 22),
            decoration: InputDecoration(
              hintText: '0',
              suffixText: unit,
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) {
              // اگر مقدار تایپ شد، خانهٔ پیسه پاک شود
              if (v.trim().isNotEmpty && _moneyController.text.isNotEmpty) {
                setState(() => _moneyController.clear());
              }
            },
            onSubmitted: (_) => _confirmTyped(),
          ),
          const SizedBox(height: 12),
          const Text(
            'یا به اندازهٔ پیسه:',
            style: TextStyle(fontSize: 16),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _moneyController,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            ],
            textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 20),
            decoration: const InputDecoration(
              hintText: 'مثلاً: 50',
              suffixText: 'افغانی',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) {
              setState(() {
                if (v.trim().isNotEmpty) _controller.clear();
              });
            },
            onSubmitted: (_) => _confirmTyped(),
          ),
          const SizedBox(height: 6),
          Text(
            _moneyQty > 0
                ? 'مقدار: ${formatQuantityWithUnit(_moneyQty, widget.product.unit)}'
                : 'مقدار: —',
            style: const TextStyle(fontSize: 14, color: Colors.grey),
          ),
        ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('لغو'),
        ),
        ElevatedButton.icon(
          onPressed: _confirmTyped,
          icon: const Icon(Icons.add_shopping_cart),
          label: const Text('اضافه'),
        ),
      ],
    );
  }
}
