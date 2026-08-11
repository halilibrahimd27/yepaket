import 'package:flutter/material.dart';

abstract final class AppColors {
  static const forest = Color(0xFF0B3B2E);
  static const forestLight = Color(0xFF075143);
  static const lime = Color(0xFFC7F22B);
  static const limeDark = Color(0xFF76A900);
  static const limeSoft = Color(0xFFEEF9C6);
  static const cream = Color(0xFFF7F5EC);
  static const ink = Color(0xFF10251E);
  static const muted = Color(0xFF65736E);
  static const line = Color(0x1F0B3B2E);
  static const warning = Color(0xFFFFC857);
  static const danger = Color(0xFFE65D4F);
}

abstract final class AppTheme {
  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.forest,
      primary: AppColors.forest,
      secondary: AppColors.lime,
      surface: Colors.white,
      error: AppColors.danger,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.cream,
      fontFamily: 'Manrope',
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 54,
          height: .96,
          fontWeight: FontWeight.w900,
          letterSpacing: -2.8,
          color: AppColors.forest,
        ),
        displayMedium: TextStyle(
          fontSize: 42,
          height: .98,
          fontWeight: FontWeight.w900,
          letterSpacing: -2,
          color: AppColors.forest,
        ),
        headlineLarge: TextStyle(
          fontSize: 32,
          height: 1.05,
          fontWeight: FontWeight.w900,
          letterSpacing: -1.3,
          color: AppColors.forest,
        ),
        headlineMedium: TextStyle(
          fontSize: 26,
          height: 1.1,
          fontWeight: FontWeight.w900,
          letterSpacing: -.9,
          color: AppColors.forest,
        ),
        titleLarge: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w900,
          letterSpacing: -.45,
          color: AppColors.forest,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w800,
          color: AppColors.forest,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          height: 1.55,
          color: AppColors.muted,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          height: 1.45,
          color: AppColors.muted,
        ),
        labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.cream,
        foregroundColor: AppColors.forest,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          fontFamily: 'Manrope',
          fontSize: 20,
          fontWeight: FontWeight.w900,
          color: AppColors.forest,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        hintStyle: const TextStyle(color: AppColors.muted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.forest, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(26),
          side: const BorderSide(color: AppColors.line),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white,
        selectedColor: AppColors.forest,
        labelStyle: const TextStyle(
          fontWeight: FontWeight.w800,
          color: AppColors.muted,
        ),
        secondaryLabelStyle: const TextStyle(
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
          side: const BorderSide(color: AppColors.line),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: AppColors.limeSoft,
        height: 72,
        labelTextStyle: WidgetStatePropertyAll(
          TextStyle(
            fontFamily: 'Manrope',
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: AppColors.forest,
          ),
        ),
      ),
    );
  }
}
