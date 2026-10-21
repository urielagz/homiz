import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/cards.dart';
import '../../../../core/widgets/photo_pair.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../../../core/widgets/segmented_tabs.dart';
import '../../../../core/widgets/states.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../data/models/maintenance_report.dart';
import '../providers/maintenance_provider.dart';

/// Pantalla 10 · Mantenimiento: «+ Nuevo reporte», Reportes (abiertos) | Historial.
class MaintenanceTab extends ConsumerStatefulWidget {
  const MaintenanceTab({super.key, required this.propertyId});

  final String propertyId;

  @override
  ConsumerState<MaintenanceTab> createState() => _MaintenanceTabState();
}

class _MaintenanceTabState extends ConsumerState<MaintenanceTab> {
  int _view = 0;
  String? _selectedId;

  @override
  Widget build(BuildContext context) {
    final reports = ref.watch(maintenanceReportsProvider(widget.propertyId));
    return RefreshIndicator(
      onRefresh: () => ref.refresh(maintenanceReportsProvider(widget.propertyId).future),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xl),
        children: [
          PrimaryButton(label: 'Nuevo reporte', icon: Icons.add_rounded, onPressed: () => context.push('/property/maintenance/new?propertyId=${widget.propertyId}')),
          const SizedBox(height: AppSpacing.md),
          PillToggle(options: const ['Reportes', 'Historial'], selected: _view, onChanged: (i) => setState(() => _view = i)),
          const SizedBox(height: AppSpacing.md),
          ...switch (reports) {
            AsyncData(:final value) => _view == 0
                ? [
                    OpenReportsList(
                      reports: value.where((r) => r.isOpen).toList(),
                      selectedId: _selectedId,
                      onSelect: (r) => setState(() => _selectedId = r.id),
                      onOpen: (r) => context.push('/property/maintenance/${r.id}'),
                    ),
                  ]
                : [ReportHistory(reports: value.where((r) => !r.isOpen).toList(), onOpen: (r) => context.push('/property/maintenance/${r.id}'))],
            AsyncError(:final error) => [ErrorState(error: error, onRetry: () => ref.invalidate(maintenanceReportsProvider(widget.propertyId)))],
            _ => [const SizedBox(height: 240, child: LoadingState(items: 3))],
          },
        ],
      ),
    );
  }
}

/// Reportes abiertos y, debajo, la «Ficha de mantenimiento.» del seleccionado.
class OpenReportsList extends StatelessWidget {
  const OpenReportsList({super.key, required this.reports, required this.selectedId, required this.onSelect, required this.onOpen});

  final List<MaintenanceReport> reports;
  final String? selectedId;
  final ValueChanged<MaintenanceReport> onSelect;
  final ValueChanged<MaintenanceReport> onOpen;

  @override
  Widget build(BuildContext context) {
    if (reports.isEmpty) {
      return const EmptyState(icon: Icons.handyman_outlined, title: 'Sin reportes abiertos', message: 'Si algo falla en tu casa, crea un reporte y lo atenderemos.');
    }
    final selected = reports.where((r) => r.id == selectedId).firstOrNull ?? reports.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final r in reports) ...[
          ListCard(title: r.title, subtitle: r.subtitle, onTap: () => onSelect(r), trailing: StatusBadge.fromStatus(r.status)),
          const SizedBox(height: AppSpacing.md),
        ],
        const SizedBox(height: AppSpacing.sm),
        Text('Ficha de mantenimiento.', style: AppTextStyles.sectionTitle),
        const SizedBox(height: AppSpacing.sm),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.cardAll, border: Border.all(color: AppColors.divider)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KeyValueRow(label: 'Reporte', value: selected.title),
              KeyValueRow(label: 'Categoría', value: selected.category),
              KeyValueRow(label: 'Estado', value: selected.statusLabel),
              KeyValueRow(label: 'Reportado', value: Fmt.longDate(selected.createdAt)),
              if (selected.provider != null) KeyValueRow(label: 'Proveedor', value: selected.provider!.name),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                child: Text(selected.description, style: AppTextStyles.body),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(onPressed: () => onOpen(selected), child: const Text('Ver seguimiento')),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// «Historial de reportes»: cerrados con fecha, descripción y fotos antes/después.
class ReportHistory extends StatelessWidget {
  const ReportHistory({super.key, required this.reports, required this.onOpen});

  final List<MaintenanceReport> reports;
  final ValueChanged<MaintenanceReport> onOpen;

  @override
  Widget build(BuildContext context) {
    if (reports.isEmpty) {
      return const EmptyState(icon: Icons.history_rounded, title: 'Sin reportes cerrados', message: 'Los reportes resueltos aparecerán aquí.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Historial de reportes', style: AppTextStyles.sectionTitle),
        const SizedBox(height: AppSpacing.sm),
        for (final r in reports) ...[_HistoryCard(report: r, onTap: () => onOpen(r)), const SizedBox(height: AppSpacing.md)],
      ],
    );
  }
}

class _HistoryCard extends ConsumerWidget {
  const _HistoryCard({required this.report, required this.onTap});

  final MaintenanceReport report;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Las fotos vienen en el detalle (URL firmadas).
    final photos = ref.watch(maintenanceReportProvider(report.id)).value?.photos;
    return Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.cardAll, side: const BorderSide(color: AppColors.divider)),
      child: InkWell(
        borderRadius: AppRadius.cardAll,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(report.title, style: AppTextStyles.cardTitle.copyWith(fontSize: 15))),
                  StatusBadge.fromStatus(report.status),
                ],
              ),
              if (report.closedAt != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text('${report.status == 'resolved' ? 'Resuelto' : 'Cancelado'} el ${Fmt.dayMonth(report.closedAt!)}', style: AppTextStyles.secondary),
              ],
              const SizedBox(height: AppSpacing.sm),
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: 'Descripción: ', style: AppTextStyles.label.copyWith(fontWeight: FontWeight.w600)),
                  TextSpan(text: report.description, style: AppTextStyles.body),
                ]),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(child: Text('Fotos antes', style: AppTextStyles.secondary)),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: Text('Fotos después', style: AppTextStyles.secondary)),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              PhotoPair(
                height: 96,
                urls: [
                  if (photos?.before.firstOrNull case final b?) b.url,
                  if (photos?.after.firstOrNull case final a?) a.url,
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
