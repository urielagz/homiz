import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/contact_actions.dart';
import '../../../../core/widgets/permission_gate.dart';
import '../../../../core/widgets/photo_pair.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../../../core/widgets/states.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../auth/presentation/providers/session_provider.dart';
import '../../data/models/maintenance_report.dart';
import '../providers/maintenance_provider.dart';
import '../widgets/update_status_sheet.dart';

/// Detalle del reporte: estado, línea de tiempo y fotos antes/después.
class ReportDetailPage extends ConsumerWidget {
  const ReportDetailPage({super.key, required this.reportId});

  final String reportId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final report = ref.watch(maintenanceReportProvider(reportId));
    final staff = ref.watch(sessionProvider.select((s) => s.value?.isStaff ?? false));
    return Scaffold(
      appBar: AppBar(title: const Text('Reporte')),
      body: switch (report) {
        AsyncData(:final value) => RefreshIndicator(
            onRefresh: () => ref.refresh(maintenanceReportProvider(reportId).future),
            child: ReportDetailView(report: value, staff: staff),
          ),
        AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(maintenanceReportProvider(reportId))),
        _ => const LoadingState(items: 4),
      },
    );
  }
}

class ReportDetailView extends StatelessWidget {
  const ReportDetailView({super.key, required this.report, this.staff = false});

  final MaintenanceReport report;
  final bool staff;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xxl),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Semantics(header: true, child: Text(report.title, style: AppTextStyles.pageTitle))),
            const SizedBox(width: AppSpacing.md),
            StatusBadge.fromStatus(report.status),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          [report.subtitle, if (staff && report.property != null) report.property!.name].join(' · '),
          style: AppTextStyles.secondary.copyWith(fontSize: 13),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(report.description, style: AppTextStyles.body),
        if (report.provider != null) ...[
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              const Icon(Icons.engineering_outlined, color: AppColors.primary, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text('Lo atiende ${report.provider!.name}${report.provider!.specialty == null ? '' : ' (${report.provider!.specialty})'}', style: AppTextStyles.label)),
            ],
          ),
          if (staff) ...[const SizedBox(height: AppSpacing.sm), ContactActions(phone: report.provider!.phone)],
        ],
        // Personal con maintenance.manage: UpdateStatusSheet mientras el reporte siga abierto.
        if (staff && report.isOpen) ...[
          const SizedBox(height: AppSpacing.lg),
          PermissionGate(
            permission: 'maintenance.manage',
            child: PrimaryButton(label: 'Actualizar estado', icon: Icons.sync_alt_rounded, onPressed: () => showUpdateStatusSheet(context, report)),
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        Text('Seguimiento', style: AppTextStyles.sectionTitle),
        const SizedBox(height: AppSpacing.sm),
        for (var i = 0; i < report.timeline.length; i++) _TimelineTile(entry: report.timeline[i], isLast: i == report.timeline.length - 1),
        const SizedBox(height: AppSpacing.xl),
        Row(
          children: [
            Expanded(child: Text('Fotos antes', style: AppTextStyles.sectionTitle)),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Text('Fotos después', style: AppTextStyles.sectionTitle)),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        PhotoPair(urls: [if (report.photos.before.firstOrNull case final b?) b.url, if (report.photos.after.firstOrNull case final a?) a.url]),
        if (report.photos.before.length > 1 || report.photos.after.length > 1) ...[
          const SizedBox(height: AppSpacing.sm),
          Text('${report.photos.before.length} fotos antes · ${report.photos.after.length} fotos después', style: AppTextStyles.secondary),
        ],
      ],
    );
  }
}

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({required this.entry, required this.isLast});

  final TimelineEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 24,
            child: Column(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: BoxDecoration(color: isLast ? AppColors.primary : AppColors.divider, shape: BoxShape.circle),
                ),
                if (!isLast) const Expanded(child: VerticalDivider(width: 2, thickness: 2, color: AppColors.divider)),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.statusLabel, style: AppTextStyles.cardTitle),
                  Text('${Fmt.dayMonth(entry.createdAt)} · ${Fmt.time(entry.createdAt)}${entry.author == null ? '' : ' · ${entry.author}'}', style: AppTextStyles.secondary),
                  if (entry.comment != null) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(entry.comment!, style: AppTextStyles.body.copyWith(fontSize: 13)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
