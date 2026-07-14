import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'screens/sales/cart_model.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DukanLatifApp());
}

class DukanLatifApp extends StatelessWidget {
  const DukanLatifApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => CartModel(),
      child: MaterialApp(
        title: 'دوکان لطیف',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.theme,
        // زبان دری و راست‌به‌چپ برای تمام اپ
        locale: const Locale('fa'),
        supportedLocales: const [
          Locale('fa'),
          Locale('ps'),
        ],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) {
          // اطمینان از RTL بودن کل اپ
          return Directionality(
            textDirection: TextDirection.rtl,
            child: child ?? const SizedBox.shrink(),
          );
        },
        home: const HomeScreen(),
      ),
    );
  }
}
