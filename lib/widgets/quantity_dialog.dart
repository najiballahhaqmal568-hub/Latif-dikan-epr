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

  static const List<double> _presets = [0.5, 1, 2, 5];

  @override
  void dispose() {
    _controller.dispose();
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

  void _confirmTyped() {
    final qty = double.tryParse(_controller.text.trim()) ?? 0;
    _confirm(qty);
  }

  @override
  Widget build(BuildContext context) {
    final unit = unitLabel(widget.product.unit);
    return AlertDialog(
      title: Text('مقدار ${widget.product.name}'),
      content: Column(
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
            onSubmitted: (_) => _confirmTyped(),
          ),
        ],
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
