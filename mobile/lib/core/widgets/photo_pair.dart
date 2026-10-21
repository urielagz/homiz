import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Dos fotos lado a lado (reporte de mantenimiento, ficha de la casa).
/// Sin URL se muestra el recuadro gris de marcador.
class PhotoPair extends StatelessWidget {
  const PhotoPair({super.key, required this.urls, this.height = 120, this.onTap});

  final List<String> urls;
  final double height;
  final ValueChanged<int>? onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < 2; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.md),
          Expanded(
            child: GestureDetector(
              onTap: i < urls.length && onTap != null ? () => onTap!(i) : null,
              child: ClipRRect(
                borderRadius: AppRadius.cardAll,
                child: SizedBox(
                  height: height,
                  child: i < urls.length
                      ? CachedNetworkImage(
                          imageUrl: urls[i],
                          fit: BoxFit.cover,
                          placeholder: (_, _) => const ColoredBox(color: AppColors.placeholderBox),
                          errorWidget: (_, _, _) => const ColoredBox(color: AppColors.placeholderBox),
                        )
                      : const ColoredBox(color: AppColors.placeholderBox),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
