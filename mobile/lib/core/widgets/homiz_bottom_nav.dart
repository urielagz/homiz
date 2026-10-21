import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Barra inferior de 3 íconos sin texto (Inicio, Mi propiedad, Citas) con un punto rojo bajo el activo.
class HomizBottomNav extends StatelessWidget {
  const HomizBottomNav({super.key, required this.currentIndex, required this.onTap});

  final int currentIndex;
  final ValueChanged<int> onTap;

  static const _items = [
    (Icons.home_outlined, Icons.home_rounded, 'Inicio'),
    (Icons.apartment_outlined, Icons.apartment_rounded, 'Mi propiedad'),
    (Icons.calendar_today_outlined, Icons.calendar_today_rounded, 'Citas'),
  ];

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(color: AppColors.surface, boxShadow: [BoxShadow(color: AppColors.shadow, blurRadius: 8, offset: Offset(0, -2))]),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              for (var i = 0; i < _items.length; i++)
                Expanded(
                  child: Semantics(
                    selected: i == currentIndex,
                    button: true,
                    label: _items[i].$3,
                    child: InkResponse(
                      onTap: () => onTap(i),
                      child: ExcludeSemantics(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              i == currentIndex ? _items[i].$2 : _items[i].$1,
                              size: 28,
                              color: i == currentIndex ? AppColors.navIcon : AppColors.navIconInactive,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            AnimatedOpacity(
                              duration: const Duration(milliseconds: 150),
                              opacity: i == currentIndex ? 1 : 0,
                              child: Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.navActiveDot, shape: BoxShape.circle)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
