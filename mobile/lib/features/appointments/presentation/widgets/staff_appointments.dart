import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/segmented_tabs.dart';
import '../../../../core/widgets/states.dart';
import '../../data/models/appointment.dart';
import '../providers/appointments_provider.dart';
import 'appointment_card.dart';

/// Agenda del personal: Por confirmar · Próximas · Anteriores.
class StaffAppointments extends ConsumerStatefulWidget {
  const StaffAppointments({super.key, this.initialFilter});

  final int? initialFilter;

  static const filters = ['Por confirmar', 'Próximas', 'Anteriores'];

  /// Separa la lista según el filtro elegido.
  static List<Appointment> apply(List<Appointment> all, int filter, DateTime now) => switch (filter) {
        0 => all.where((a) => a.status == 'por-confirmar' && a.scheduledAt.isAfter(now)).toList(),
        1 => all.where((a) => a.status == 'confirmada' && a.scheduledAt.isAfter(now)).toList(),
        _ => all.where((a) => !a.scheduledAt.isAfter(now) || !a.isActive).toList(),
      };

  @override
  ConsumerState<StaffAppointments> createState() => _StaffAppointmentsState();
}

class _StaffAppointmentsState extends ConsumerState<StaffAppointments> {
  late int _filter = (widget.initialFilter ?? 0).clamp(0, StaffAppointments.filters.length - 1);

  @override
  void didUpdateWidget(StaffAppointments oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialFilter != null && widget.initialFilter != oldWidget.initialFilter) {
      _filter = widget.initialFilter!.clamp(0, StaffAppointments.filters.length - 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appointments = ref.watch(appointmentsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedTabs(tabs: StaffAppointments.filters, selected: _filter, onChanged: (i) => setState(() => _filter = i)),
        const SizedBox(height: AppSpacing.md),
        Expanded(
          child: switch (appointments) {
            AsyncData(:final value) => () {
                final items = StaffAppointments.apply(value, _filter, DateTime.now());
                if (items.isEmpty) {
                  return EmptyState(
                    icon: Icons.event_available_outlined,
                    title: switch (_filter) { 0 => 'Nada por confirmar', 1 => 'Sin citas próximas', _ => 'Sin citas anteriores' },
                    message: _filter == 0 ? 'Las solicitudes de visita del sitio y de la app aparecerán aquí.' : null,
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => ref.refresh(appointmentsProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xl),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
                    itemBuilder: (context, i) => AppointmentCard(appointment: items[i], onTap: () => context.go('/appointments/${items[i].id}')),
                  ),
                );
              }(),
            AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(appointmentsProvider)),
            _ => const LoadingState(),
          },
        ),
      ],
    );
  }
}
