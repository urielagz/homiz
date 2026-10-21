import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/cards.dart';
import '../../../../core/widgets/states.dart';
import '../../../../core/widgets/status_badge.dart';
import '../providers/maintenance_provider.dart';

/// Reportes recién creados por los clientes en las casas del personal.
class NewReportsPage extends ConsumerWidget {
  const NewReportsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reports = ref.watch(newReportsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Reportes nuevos')),
      body: switch (reports) {
        AsyncData(:final value) when value.isEmpty => const EmptyState(
            icon: Icons.task_alt_rounded,
            title: 'Sin reportes nuevos',
            message: 'Todos los reportes ya están en revisión o atendidos.',
          ),
        AsyncData(:final value) => RefreshIndicator(
            onRefresh: () => ref.refresh(newReportsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.screen),
              itemCount: value.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (context, i) {
                final r = value[i];
                return ListCard(
                  title: r.title,
                  caption: r.property?.name,
                  subtitle: '${r.subtitle}\nReportado el ${Fmt.dayMonth(r.createdAt)}',
                  trailing: StatusBadge.fromStatus(r.status),
                  onTap: () => context.push('/property/maintenance/${r.id}'),
                );
              },
            ),
          ),
        AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(newReportsProvider)),
        _ => const LoadingState(),
      },
    );
  }
}
