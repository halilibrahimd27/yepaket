import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class BrandLogo extends StatelessWidget {
  const BrandLogo({this.size = 42, this.showName = true, super.key});

  final double size;
  final bool showName;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(size * .3),
          child: Image.asset(
            'assets/brand/yep-logo.png',
            width: size,
            height: size,
            fit: BoxFit.cover,
          ),
        ),
        if (showName) ...[
          const SizedBox(width: 10),
          const Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: 'Ye',
                  style: TextStyle(color: AppColors.forest),
                ),
                TextSpan(
                  text: 'Paket',
                  style: TextStyle(color: AppColors.limeDark),
                ),
              ],
            ),
            style: TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w900,
              letterSpacing: -.8,
            ),
          ),
        ],
      ],
    );
  }
}
