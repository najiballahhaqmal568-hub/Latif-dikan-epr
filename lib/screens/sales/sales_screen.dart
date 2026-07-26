import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../models/product.dart';
import '../../models/sale.dart';
import '../../repositories/product_repository.dart';
import '../../repositories/sale_repository.dart';
import '../../theme/app_theme.dart';
import '../../utils/formatting.dart';
import '../../widgets/cart_panel.dart';
import '../../widgets/product_tile_button.dart';
import '../../widgets/quantity_dialog.dart';
import 'cart_model.dart';

/// صفحه فروش تیز — جستجو، دکمه‌های بزرگ، سبد و نقد/قرض.
class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key});

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  final ProductRepository _productRepo = ProductRepository();
  final SaleRepository _saleRepo = SaleRepository();
  final TextEditingController _searchController = TextEditingController();

  List<Product> _allProducts = [];
  List<Product> _filtered = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    setState(() => _loading = true);
    final products = await _productRepo.getAll();
    if (!mounted) return;
    setState(() {
      _allProducts = products;
      _applyFilter(_searchController.text);
      _loading = false;
    });
  }

  void _applyFilter(String query) {
    final q = query.trim().toLowerCase();
    setState(() {
      if (q.isEmpty) {
        _filtered = List.of(_allProducts);
      } else {
        _filtered = _allProducts
            .where((p) => p.name.toLowerCase().contains(q))
            .toList();
      }
      _sortForRush(_filtered);
    });
  }

  /// ترتیب وقت شلوغ: پرفروش‌ها (ستاره‌دار) اول، بعد موجودها،
  /// و تمام‌شده‌ها در آخر — هیچ‌کدام پنهان نمی‌شود.
  void _sortForRush(List<Product> list) {
    list.sort((a, b) {
      final sa = a.isPopular ? 0 : 1, sb = b.isPopular ? 0 : 1;
      if (sa != sb) return sa - sb;
      final oa = a.quantity > 0 ? 0 : 1, ob = b.quantity > 0 ? 0 : 1;
      if (oa != ob) return oa - ob;
      return a.name.compareTo(b.name);
    });
  }

  Future<void> _onProductTap(Product product) async {
    final cart = context.read<CartModel>();

    if (product.quantity <= 0) {
      _showLowStockWarning(product);
    }

    if (product.type.asksQuantity) {
      final qty = await showQuantityDialog(context, product);
      if (qty != null && qty > 0) {
        cart.addWeighted(product, qty);
        HapticFeedback.selectionClick();
      }
    } else {
      cart.addUnit(product);
      HapticFeedback.selectionClick();
    }
  }

  void _showLowStockWarning(Product product) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text('اخطار: موجودی «${product.name}» صفر است'),
          backgroundColor: AppTheme.danger,
          duration: const Duration(seconds: 2),
        ),
      );
  }

  Future<void> _finishSale(PaymentType type) async {
    final cart = context.read<CartModel>();
    if (cart.isEmpty) return;

    String? customerName;
    if (type == PaymentType.credit) {
      customerName = await _askCustomerName();
      // اگر کاربر دیالوگ را لغو کرد (دکمه لغو یا بستن)، فروش انجام نشود
      if (customerName == null || customerName == _kCancelled) return;
      // فروش قرضی بدون نام اجازه ندارد — ورنه قرض در دفتر هیچ مشتری ثبت نمی‌شود
      if (customerName.trim().isEmpty) return;
    }

    final items = List.of(cart.items);
    try {
      await _saleRepo.createSale(
        cartItems: items,
        paymentType: type,
        customerName: customerName?.trim(),
      );
      cart.clear();
      await _loadProducts(); // موجودی تازه شود
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(
              type == PaymentType.cash
                  ? 'فروش نقد ثبت شد'
                  : 'فروش قرض ثبت شد',
            ),
            backgroundColor: AppTheme.primary,
          ),
        );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('خطا در ثبت فروش: $e')),
      );
    }
  }

  static const String _kCancelled = '\u0000__cancelled__';

  /// فهرست فروش‌های امروز با دکمهٔ «برگشتی» برای اصلاح فروش اشتباه.
  Future<void> _openTodaySales() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _TodaySalesSheet(saleRepo: _saleRepo),
    );
    if (mounted) await _loadProducts();
  }

  /// دیالوگ نام مشتری (حتمی) برای فروش قرضی.
  /// بدون نام، قرض در دفتر هیچ مشتری ثبت نمی‌شود و پول گم می‌شود.
  /// برمی‌گرداند: نام یا _kCancelled اگر لغو شد.
  Future<String?> _askCustomerName() async {
    final controller = TextEditingController();
    String? error; // بیرون از builder تا با هر rebuild پاک نشود
    // مشتریان اخیر پیش از باز کردن دیالوگ خوانده می‌شوند تا تیز باشد
    final recents = await _saleRepo.getRecentCreditCustomerNames(6);
    if (!mounted) return _kCancelled;
    final result = await showDialog<String?>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) {
          void submit() {
            if (controller.text.trim().isEmpty) {
              setLocal(() => error = 'نام مشتری را بنویسید');
              return;
            }
            Navigator.pop(ctx, controller.text);
          }

          return AlertDialog(
            title: const Text('فروش قرض'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'نام مشتری (حتمی):',
                  style: TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  autofocus: true,
                  style: const TextStyle(fontSize: 20),
                  decoration: InputDecoration(
                    hintText: 'مثلاً: احمد',
                    prefixIcon: const Icon(Icons.person),
                    border: const OutlineInputBorder(),
                    errorText: error,
                  ),
                  onChanged: (_) {
                    if (error != null) setLocal(() => error = null);
                  },
                  onSubmitted: (_) => submit(),
                ),
                if (recents.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  const Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Text('مشتریان اخیر',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey)),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final name in recents)
                        ActionChip(
                          label: Text(name),
                          onPressed: () {
                            HapticFeedback.selectionClick();
                            setLocal(() {
                              controller.text = name;
                              error = null;
                            });
                          },
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: () => setLocal(() {
                      controller.text = 'متفرقه';
                      error = null;
                    }),
                    icon: const Icon(Icons.person_outline),
                    label: const Text('مشتری «متفرقه»'),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, _kCancelled),
                child: const Text('لغو'),
              ),
              ElevatedButton.icon(
                onPressed: submit,
                icon: const Icon(Icons.check),
                label: const Text('ثبت قرض'),
              ),
            ],
          );
        },
      ),
    );
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('فروش'),
        actions: [
          IconButton(
            onPressed: _openTodaySales,
            icon: const Icon(Icons.receipt_long),
            tooltip: 'فروش‌های امروز',
          ),
        ],
      ),
      body: Column(
        children: [
          // جستجوی تیز
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: TextField(
              controller: _searchController,
              onChanged: _applyFilter,
              style: const TextStyle(fontSize: 20),
              decoration: InputDecoration(
                hintText: 'جستجوی جنس...',
                prefixIcon: const Icon(Icons.search, size: 28),
                suffixIcon: _searchController.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          _applyFilter('');
                        },
                      ),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
          // شبکه دکمه‌های اجناس
          Expanded(
            child: _buildProductGrid(),
          ),
          // سبد فروش
          CartPanel(
            onCash: () => _finishSale(PaymentType.cash),
            onCredit: () => _finishSale(PaymentType.credit),
          ),
        ],
      ),
    );
  }

  Widget _buildProductGrid() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_allProducts.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'هنوز جنسی ثبت نشده.\nاول از بخش «اجناس» جنس اضافه کنید.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, color: Colors.grey),
          ),
        ),
      );
    }
    if (_filtered.isEmpty) {
      return const Center(
        child: Text(
          'جنسی پیدا نشد',
          style: TextStyle(fontSize: 18, color: Colors.grey),
        ),
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 180,
        childAspectRatio: 1.05,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: _filtered.length,
      itemBuilder: (context, index) {
        final product = _filtered[index];
        return ProductTileButton(
          product: product,
          onTap: () => _onProductTap(product),
        );
      },
    );
  }
}

/// شیت «فروش‌های امروز» — با دکمهٔ برگشتی برای اصلاح فروش اشتباه.
/// فروش هرگز پاک نمی‌شود؛ یک رکورد منفی ثبت می‌گردد.
class _TodaySalesSheet extends StatefulWidget {
  final SaleRepository saleRepo;

  const _TodaySalesSheet({required this.saleRepo});

  @override
  State<_TodaySalesSheet> createState() => _TodaySalesSheetState();
}

class _TodaySalesSheetState extends State<_TodaySalesSheet> {
  List<Sale> _sales = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final list = await widget.saleRepo.getTodaySales();
    if (!mounted) return;
    setState(() {
      _sales = list;
      _loading = false;
    });
  }

  Future<void> _confirmReturn(Sale sale) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('برگشتی فروش'),
        content: Text(
          'این فروش به مبلغ ${formatAfghani(sale.total)} برگشت داده شود؟\n\n'
          'موجودی پس می‌آید'
          '${sale.paymentType == PaymentType.credit ? " و قرض مشتری کم می‌شود" : ""}'
          '. فروش پاک نمی‌شود؛ اصلاحیه ثبت می‌گردد.',
          style: const TextStyle(fontSize: 15),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('نی'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.danger,
                foregroundColor: Colors.white),
            child: const Text('بلی، برگشتی'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await widget.saleRepo.returnSale(sale);
    HapticFeedback.mediumImpact();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('برگشتی ثبت شد ✓ موجودی پس آمد'),
        backgroundColor: AppTheme.primary,
      ),
    );
    await _load();
  }

  String _time(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    String p(int n) => n < 10 ? '0$n' : '$n';
    return '${p(d.hour)}:${p(d.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    double net = 0;
    for (final s in _sales) {
      net += s.total;
    }

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('فروش‌های امروز',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('مجموع امروز',
                      style: TextStyle(
                          fontSize: 17, fontWeight: FontWeight.bold)),
                  Text(formatAfghani(net),
                      style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primary)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'اگر فروشی غلط ثبت شد، «برگشتی» را بزنید. فروش پاک نمی‌شود؛ '
              'اصلاحیه ثبت می‌گردد.',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _sales.isEmpty
                      ? const Center(
                          child: Text('امروز فروشی ثبت نشده',
                              style: TextStyle(color: Colors.grey)))
                      : ListView.separated(
                          controller: scrollController,
                          itemCount: _sales.length,
                          separatorBuilder: (_, __) =>
                              const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final s = _sales[i];
                            final isReturn = s.returnOf != null;
                            final kind = s.paymentType == PaymentType.cash
                                ? 'نقد'
                                : 'قرض${s.customerName != null ? " — ${s.customerName}" : ""}';
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: s.canReturn
                                  ? TextButton(
                                      onPressed: () => _confirmReturn(s),
                                      style: TextButton.styleFrom(
                                          foregroundColor: AppTheme.danger),
                                      child: const Text('برگشتی'),
                                    )
                                  : null,
                              title: Row(
                                children: [
                                  Text(_time(s.date),
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold)),
                                  const SizedBox(width: 6),
                                  if (isReturn)
                                    const _Tag(text: 'برگشتی')
                                  else if (s.returned)
                                    const _Tag(text: 'برگشت شد'),
                                ],
                              ),
                              subtitle: Text(kind,
                                  style: const TextStyle(fontSize: 13)),
                              trailing: Text(
                                formatAfghani(s.total),
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: s.total < 0
                                      ? AppTheme.danger
                                      : AppTheme.primary,
                                ),
                              ),
                            );
                          },
                        ),
            ),
            SafeArea(
              top: false,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('بستن'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// نشان خورد «برگشتی» / «برگشت شد».
class _Tag extends StatelessWidget {
  final String text;

  const _Tag({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: AppTheme.danger.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(text,
          style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppTheme.danger)),
    );
  }
}
