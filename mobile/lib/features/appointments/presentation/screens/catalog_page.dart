import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/whatsapp.dart';
import '../../../../core/widgets/states.dart';
import '../../../property/presentation/providers/property_provider.dart';
import '../../../property/presentation/widgets/property_widgets.dart';

/// Casas disponibles para solicitar una visita.
class CatalogPage extends ConsumerWidget {
  const CatalogPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Elige una casa')),
      body: switch (catalog) {
        AsyncData(:final value) when value.isEmpty => const EmptyState(
            icon: Icons.home_work_outlined,
            title: 'No hay casas disponibles',
            message: 'Vuelve pronto: publicamos casas nuevas cada semana.',
          ),
        AsyncData(:final value) => RefreshIndicator(
            onRefresh: () => ref.refresh(catalogProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.screen),
              itemCount: value.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
              itemBuilder: (context, i) {
                final p = value[i];
                final tarjeta = Semantics(
                  button: true,
                  label: '${p.name}, ${p.zone ?? ''}, ${Fmt.money(p.price)}',
                  child: InkWell(
                    borderRadius: AppRadius.cardAll,
                    onTap: () => context.push('/appointments/catalog/${p.id}'),
                    child: ExcludeSemantics(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          PropertyHero(url: p.coverUrl, height: 160, overlay: HeroCaption(title: p.name, location: p.zone)),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              Expanded(child: FeatureRow(rec: p.rec, banos: p.banos)),
                              Text(
                                '${Fmt.money(p.price)}${p.operation == 'renta' ? '/mes' : ''}',
                                style: AppTextStyles.cardTitle.copyWith(color: AppColors.primary),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
                // Como en las tarjetas del sitio: escribir a Zugar por esta casa
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    tarjeta,
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        style: TextButton.styleFrom(foregroundColor: WhatsAppButton.color),
                        onPressed: () => WhatsApp.open(context, 'Hola, me interesa ${p.name}${p.zone == null ? '' : ' en ${p.zone}'}.'),
                        icon: const Icon(Icons.chat_outlined, size: 18),
                        label: Text('WhatsApp por ${p.name}'),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(catalogProvider)),
        _ => const LoadingState(items: 3, itemHeight: 200),
      },
    );
  }
}
