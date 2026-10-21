import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_text_styles.dart';

/// Fondo de las pantallas de acceso: degradado azul a pantalla completa y pie «Inmobiliaria Zugar».
class AuthBackground extends StatelessWidget {
  const AuthBackground({super.key, required this.child, this.scrollable = true});

  final Widget child;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final footer = Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xl, bottom: AppSpacing.lg),
      child: Text('Inmobiliaria Zugar', style: AppTextStyles.label.copyWith(color: Colors.white70), textAlign: TextAlign.center),
    );
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppColors.authGradient),
      child: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final content = ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: IntrinsicHeight(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: Column(children: [Expanded(child: child), footer]),
                ),
              ),
            );
            return scrollable ? SingleChildScrollView(child: content) : content;
          },
        ),
      ),
    );
  }
}

/// Logo de Zugar (marcador en assets/images/logo_zugar.png).
class ZugarLogo extends StatelessWidget {
  const ZugarLogo({super.key, this.height = 56});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/logo_zugar.png',
      height: height,
      semanticLabel: 'Zugar',
      errorBuilder: (_, _, _) => Text('Zugar.', style: AppTextStyles.authTitle.copyWith(fontSize: height * 0.6)),
    );
  }
}
