import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/contact_actions.dart';
import '../../../../core/widgets/states.dart';
import '../../data/models/service_provider.dart';
import '../providers/providers_directory_provider.dart';

/// Directorio de proveedores con búsqueda y botones Llamar / Correo.
class ProvidersPage extends ConsumerStatefulWidget {
  const ProvidersPage({super.key});

  @override
  ConsumerState<ProvidersPage> createState() => _ProvidersPageState();
}

class _ProvidersPageState extends ConsumerState<ProvidersPage> {
  final _search = TextEditingController();
  String _q = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final providers = ref.watch(providersDirectoryProvider(_q));
    return Scaffold(
      appBar: AppBar(title: const Text('Proveedores')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.screen, AppSpacing.sm, AppSpacing.screen, AppSpacing.md),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (v) => setState(() => _q = v.trim()),
              decoration: InputDecoration(
                hintText: 'Buscar por nombre, especialidad o zona',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _q.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Limpiar búsqueda',
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => setState(() {
                          _search.clear();
                          _q = '';
                        }),
                      ),
              ),
            ),
          ),
          Expanded(
            child: switch (providers) {
              AsyncData(:final value) when value.isEmpty => EmptyState(
                  icon: Icons.engineering_outlined,
                  title: _q.isEmpty ? 'Sin proveedores' : 'Sin resultados',
                  message: _q.isEmpty ? 'La administración aún no registra proveedores.' : 'Prueba con otra especialidad, por ejemplo «Plomería».',
                ),
              AsyncData(:final value) => RefreshIndicator(
                  onRefresh: () => ref.refresh(providersDirectoryProvider(_q).future),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xl),
                    itemCount: value.length,
                    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
                    itemBuilder: (_, i) => ProviderCard(provider: value[i]),
                  ),
                ),
              AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(providersDirectoryProvider(_q))),
              _ => const LoadingState(),
            },
          ),
        ],
      ),
    );
  }
}

class ProviderCard extends StatelessWidget {
  const ProviderCard({super.key, required this.provider});

  final ServiceProvider provider;

  @override
  Widget build(BuildContext context) {
    final p = provider;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.cardAll, border: Border.all(color: AppColors.divider)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(p.name, style: AppTextStyles.cardTitle.copyWith(fontSize: 15))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                decoration: BoxDecoration(color: AppColors.infoBg, borderRadius: AppRadius.pillAll),
                child: Text(p.specialty, style: AppTextStyles.badge.copyWith(color: AppColors.primary)),
              ),
            ],
          ),
          if (p.zone != null || p.phone != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text([p.zone, p.phone].whereType<String>().join(' · '), style: AppTextStyles.secondary.copyWith(fontSize: 13)),
          ],
          if (p.notes != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(p.notes!, style: AppTextStyles.body.copyWith(fontSize: 13)),
          ],
          const SizedBox(height: AppSpacing.md),
          ContactActions(phone: p.phone, email: p.email, subject: 'Servicio para Inmobiliaria Zugar'),
        ],
      ),
    );
  }
}
