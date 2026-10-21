import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/homiz_header.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../../../core/widgets/states.dart';
import '../../../auth/presentation/providers/session_provider.dart';
import '../../data/models/appointment.dart';
import '../providers/appointments_provider.dart';
import '../widgets/appointment_card.dart';
import '../widgets/staff_appointments.dart';

/// Pantalla 5 · Mis citas.
class AppointmentsPage extends ConsumerWidget {
  const AppointmentsPage({super.key, this.initialFilter});

  /// Filtro del personal pedido por la ruta (`/appointments?filter=0`).
  final int? initialFilter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isStaff = ref.watch(sessionProvider.select((s) => s.value?.isStaff ?? false));
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HomizHeader(section: isStaff ? 'Citas' : 'Mis citas'),
          Expanded(
            child: isStaff ? StaffAppointments(initialFilter: initialFilter) : const _ClientAppointments(),
          ),
        ],
      ),
    );
  }
}

class _ClientAppointments extends ConsumerWidget {
  const _ClientAppointments();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointments = ref.watch(appointmentsProvider);
    void request() => context.push('/appointments/catalog');
    return switch (appointments) {
      AsyncData(:final value) when value.isEmpty => EmptyState(
          icon: Icons.calendar_today_outlined,
          title: 'No tienes citas próximas',
          message: 'Elige una casa del catálogo y solicita una visita.',
          actionLabel: 'Solicitar visita',
          onAction: request,
        ),
      AsyncData(:final value) => RefreshIndicator(
          onRefresh: () => ref.refresh(appointmentsProvider.future),
          child: AppointmentsList(appointments: value, onOpen: (a) => context.go('/appointments/${a.id}'), onRequest: request),
        ),
      AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(appointmentsProvider)),
      _ => const LoadingState(),
    };
  }
}

/// Lista de citas: próximas arriba y pasadas abajo.
class AppointmentsList extends StatelessWidget {
  const AppointmentsList({super.key, required this.appointments, required this.onOpen, required this.onRequest});

  final List<Appointment> appointments;
  final ValueChanged<Appointment> onOpen;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final upcoming = appointments.where((a) => a.scheduledAt.isAfter(now)).toList();
    final past = appointments.where((a) => !a.scheduledAt.isAfter(now)).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.screen, AppSpacing.sm, AppSpacing.screen, AppSpacing.xl),
      children: [
        for (final a in upcoming) ...[AppointmentCard(appointment: a, onTap: () => onOpen(a)), const SizedBox(height: AppSpacing.md)],
        if (past.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.md, bottom: AppSpacing.sm),
            child: Text('Anteriores', style: AppTextStyles.sectionTitle),
          ),
          for (final a in past) ...[AppointmentCard(appointment: a, onTap: () => onOpen(a)), const SizedBox(height: AppSpacing.md)],
        ],
        const SizedBox(height: AppSpacing.sm),
        PrimaryButton(label: 'Solicitar visita', icon: Icons.add_rounded, variant: ButtonVariant.outline, onPressed: onRequest),
      ],
    );
  }
}
