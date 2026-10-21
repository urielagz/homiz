import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/states.dart';
import '../../data/models/property_models.dart';
import '../providers/property_provider.dart';
import 'property_widgets.dart';

/// Pantalla 7 · Resumen: foto, ubicación, características y vigencia del contrato.
class SummaryTab extends ConsumerWidget {
  const SummaryTab({super.key, required this.propertyId});

  final String propertyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dossier = ref.watch(dossierProvider(propertyId));
    // La foto sale de la ficha (URL firmada); si falla se muestra el recuadro gris.
    final photo = ref.watch(propertyDetailProvider(propertyId)).value?.coverUrl;
    return switch (dossier) {
      AsyncData(:final value) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(propertyDetailProvider(propertyId));
            ref.invalidate(dossierProvider(propertyId));
            await ref.read(dossierProvider(propertyId).future);
          },
          child: SummaryView(dossier: value, photoUrl: photo),
        ),
      AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(dossierProvider(propertyId))),
      _ => const LoadingState(items: 2, itemHeight: 180),
    };
  }
}

class SummaryView extends StatelessWidget {
  const SummaryView({super.key, required this.dossier, this.photoUrl});

  final Dossier dossier;
  final String? photoUrl;

  static String contractText(DossierContract? c) {
    if (c == null) return 'Aún no hay un contrato registrado para esta casa.';
    final rent = Fmt.money(c.monthlyRent);
    if (c.status != 'active') return 'El contrato finalizó el ${Fmt.shortDate(c.endDate)}.';
    return 'El contrato está vigente hasta ${Fmt.longDate(c.endDate)}. La renta es de $rent al mes y se paga el día ${c.paymentDay} de cada mes.';
  }

  @override
  Widget build(BuildContext context) {
    final p = dossier.property;
    final location = [p.city ?? 'Cancún', p.zone].whereType<String>().join(', ');
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xl),
      children: [
        PropertyHero(url: photoUrl, height: 210, semanticLabel: 'Foto de ${p.name}', overlay: HeroCaption(title: p.name, location: location)),
        const SizedBox(height: AppSpacing.lg),
        FeatureRow(rec: p.rec, banos: p.banos, amenities: p.amenities),
        const SizedBox(height: AppSpacing.lg),
        Text(contractText(dossier.contract), style: AppTextStyles.body.copyWith(color: AppColors.textMuted)),
        if (p.address != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(p.address!, style: AppTextStyles.secondary),
        ],
      ],
    );
  }
}
