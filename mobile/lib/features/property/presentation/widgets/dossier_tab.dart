import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/cards.dart';
import '../../../../core/widgets/states.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../documents/presentation/open_document.dart';
import '../../data/models/property_models.dart';
import '../providers/property_provider.dart';

/// Pantalla 8 · Expediente: contrato, depósito, ficha de entrega y documentos (solo los visibles para el cliente).
class DossierTab extends ConsumerWidget {
  const DossierTab({super.key, required this.propertyId});

  final String propertyId;

  Future<void> _open(BuildContext context, WidgetRef ref, Dossier dossier, DossierSection section) async {
    if (section.documentIds.length == 1) return openDocument(context, ref, section.documentIds.single);
    final docs = dossier.documents.where((d) => section.documentIds.contains(d.id)).toList();
    final chosen = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.sm), child: Text(section.title, style: AppTextStyles.pageTitle)),
            for (final d in docs)
              ListTile(
                leading: Icon(d.mime == 'application/pdf' ? Icons.picture_as_pdf_outlined : Icons.image_outlined),
                title: Text(d.name),
                subtitle: d.description == null ? null : Text(d.description!),
                onTap: () => Navigator.pop(context, d.id),
              ),
          ],
        ),
      ),
    );
    if (chosen != null && context.mounted) await openDocument(context, ref, chosen);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dossier = ref.watch(dossierProvider(propertyId));
    return switch (dossier) {
      AsyncData(:final value) when value.sections.isEmpty => const EmptyState(
          icon: Icons.folder_open_outlined,
          title: 'Tu expediente está vacío',
          message: 'Aquí aparecerán tu contrato, el depósito y la ficha de entrega cuando la inmobiliaria los suba.',
        ),
      AsyncData(:final value) => RefreshIndicator(
          onRefresh: () => ref.refresh(dossierProvider(propertyId).future),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xl),
            itemCount: value.sections.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
            itemBuilder: (context, i) {
              final s = value.sections[i];
              return ListCard(
                title: s.title,
                subtitle: s.subtitle,
                trailing: s.documentIds.isEmpty
                    ? null
                    : StatusBadge(kind: BadgeKind.view, onTap: () => _open(context, ref, value, s)),
              );
            },
          ),
        ),
      AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(dossierProvider(propertyId))),
      _ => const LoadingState(),
    };
  }
}
