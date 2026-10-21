import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/cards.dart';
import '../../../../core/widgets/homiz_header.dart';
import '../../../../core/widgets/states.dart';
import '../../../auth/presentation/providers/session_provider.dart';
import '../../../notifications/presentation/providers/notifications_provider.dart';
import '../../data/models/client_dashboard.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/staff_home.dart';

/// Pantalla 4 · Inicio: próximo pago, próxima cita y reportes abiertos.
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isStaff = ref.watch(sessionProvider.select((s) => s.value?.isStaff ?? false));
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HomizHeader(section: isStaff ? 'Pendientes' : 'Información'),
          Expanded(child: isStaff ? const StaffHome() : const _ClientHome()),
        ],
      ),
    );
  }
}

class _ClientHome extends ConsumerWidget {
  const _ClientHome();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(clientDashboardProvider);
    Future<void> reload() async {
      ref.invalidate(notificationsProvider);
      return ref.refresh(clientDashboardProvider.future).then((_) {});
    }

    return switch (dashboard) {
      AsyncData(:final value) => RefreshIndicator(onRefresh: reload, child: DashboardCards(dashboard: value)),
      AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(clientDashboardProvider)),
      _ => const LoadingState(items: 3, itemHeight: 132),
    };
  }
}

/// Las tres tarjetas azules del inicio (separadas para probarlas sin red).
class DashboardCards extends StatelessWidget {
  const DashboardCards({super.key, required this.dashboard});

  final ClientDashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final pay = dashboard.nextPayment;
    final appt = dashboard.nextAppointment;
    final reports = dashboard.openReports;
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.screen, AppSpacing.sm, AppSpacing.screen, AppSpacing.xl),
      children: [
        DashboardCard(
          title: 'Próximo pago...',
          value: pay == null ? 'Sin pagos pendientes' : Fmt.dayMonth(pay.dueDate),
          detail: pay == null ? null : '${Fmt.money(pay.amount)} · Pagaré ${pay.number.toString().padLeft(2, '0')}',
          illustration: 'assets/illustrations/pago.svg',
          onTap: () => context.go('/property?tab=2'),
        ),
        const SizedBox(height: AppSpacing.md),
        DashboardCard(
          title: 'Próxima cita...',
          value: appt == null ? 'Sin citas próximas' : Fmt.dayMonth(appt.scheduledAt),
          detail: appt == null ? null : '${appt.propertyName} · ${Fmt.time(appt.scheduledAt)}',
          illustration: 'assets/illustrations/cita.svg',
          onTap: () => appt == null ? context.go('/appointments') : context.go('/appointments/${appt.id}'),
        ),
        const SizedBox(height: AppSpacing.md),
        DashboardCard(
          title: 'Reportes abiertos...',
          value: reports.latest == null ? 'Sin reportes abiertos' : Fmt.dayMonth(reports.latest!.createdAt),
          detail: reports.latest == null
              ? null
              : reports.count > 1
                  ? '${reports.latest!.title} y ${reports.count - 1} más · Detalles...'
                  : '${reports.latest!.title} · Detalles...',
          illustration: 'assets/illustrations/reportes.svg',
          onTap: () => context.go('/property?tab=3'),
        ),
      ],
    );
  }
}
