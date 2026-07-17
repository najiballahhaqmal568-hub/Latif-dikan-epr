import 'package:flutter/material.dart';

import '../models/product.dart';
import '../theme/app_theme.dart';
import '../utils/formatting.dart';

/// دکمه بزرگ یک جنس در صفحه فروش.
class ProductTileButton extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;

  const ProductTileButton({
    super.key,
    required this.product,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final outOfStock = product.quantity <= 0;
    final isUnit = product.type == ProductType.unit;
    final color = isUnit ? AppTheme.credit : AppTheme.primary;
    final icon = product.type == ProductType.wifi
        ? Icons.wifi
        : (product.type == ProductType.weighted
            ? Icons.scale
            : Icons.inventory_2);

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.4), width: 1.5),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                color: color,
                size: 26,
              ),
              const SizedBox(height: 6),
              Text(
                product.name,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                formatAfghani(product.sellPrice),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (outOfStock)
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Text(
                    'موجود نیست',
                    style: TextStyle(fontSize: 11, color: AppTheme.danger),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
