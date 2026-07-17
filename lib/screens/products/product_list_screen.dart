import 'package:flutter/material.dart';

import '../../models/product.dart';
import '../../repositories/product_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';
import 'product_form_screen.dart';

/// صفحه لیست اجناس و موجودی.
class ProductListScreen extends StatefulWidget {
  const ProductListScreen({super.key});

  @override
  State<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends State<ProductListScreen> {
  final ProductRepository _repo = ProductRepository();
  late Future<List<Product>> _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() {
      _future = _repo.getAll();
    });
  }

  Future<void> _openForm({Product? product}) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProductFormScreen(product: product),
      ),
    );
    if (changed == true) {
      _reload();
    }
  }

  Future<void> _confirmDelete(Product product) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف جنس'),
        content: Text('آیا «${product.name}» حذف شود؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('نی'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
    if (ok == true && product.id != null) {
      await _repo.delete(product.id!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('«${product.name}» حذف شد')),
        );
      }
      _reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اجناس و موجودی')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add, size: 28),
        label: const Text(
          'جنس جدید',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: FutureBuilder<List<Product>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('خطا: ${snapshot.error}'));
          }
          final products = snapshot.data ?? [];
          if (products.isEmpty) {
            return const _EmptyState();
          }
          return ListView.separated(
            padding: const EdgeInsets.only(bottom: 90, top: 8),
            itemCount: products.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              return _ProductRow(
                product: products[index],
                onTap: () => _openForm(product: products[index]),
                onDelete: () => _confirmDelete(products[index]),
              );
            },
          );
        },
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const _ProductRow({
    required this.product,
    required this.onTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final lowStock = product.quantity <= 0;
    final expDays = daysToExpiry(product.expiryDate);
    final showExpiry = expDays != null && expDays <= 14;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      onTap: onTap,
      title: Text(
        product.name,
        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${product.type.label} • فروش: ${formatAfghani(product.sellPrice)}',
              style: const TextStyle(fontSize: 15),
            ),
            if (showExpiry)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(
                  '⏰ ${expiryLabel(expDays)}',
                  style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.danger),
                ),
              ),
          ],
        ),
      ),
      leading: CircleAvatar(
        radius: 26,
        backgroundColor: product.type == ProductType.unit
            ? AppTheme.credit
            : AppTheme.primary,
        child: Icon(
          product.type == ProductType.wifi
              ? Icons.wifi
              : (product.type == ProductType.weighted
                  ? Icons.scale
                  : Icons.inventory_2),
          color: Colors.white,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatQuantityWithUnit(product.quantity, product.unit),
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: lowStock ? AppTheme.danger : Colors.black87,
                ),
              ),
              Text(
                lowStock ? 'موجود نیست' : 'موجود',
                style: TextStyle(
                  fontSize: 13,
                  color: lowStock ? AppTheme.danger : Colors.grey,
                ),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
            onPressed: onDelete,
            tooltip: 'حذف',
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inventory_2_outlined, size: 80, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            'هنوز جنسی ثبت نشده',
            style: TextStyle(fontSize: 20, color: Colors.grey),
          ),
          SizedBox(height: 8),
          Text(
            'برای شروع، دکمه «جنس جدید» را بزنید',
            style: TextStyle(fontSize: 16, color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
