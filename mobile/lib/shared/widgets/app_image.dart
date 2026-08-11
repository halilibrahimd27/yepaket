import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class AppImage extends StatelessWidget {
  const AppImage(
    this.source, {
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    super.key,
  });

  final String source;
  final double? width;
  final double? height;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return Image.network(
        source,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (context, error, stackTrace) => _fallback(),
      );
    }
    return Image.asset(source, width: width, height: height, fit: fit);
  }

  Widget _fallback() => Container(
    width: width,
    height: height,
    color: AppColors.limeSoft,
    alignment: Alignment.center,
    child: const Icon(Icons.restaurant_rounded, color: AppColors.forest),
  );
}
