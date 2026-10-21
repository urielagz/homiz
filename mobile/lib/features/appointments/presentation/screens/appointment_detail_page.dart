import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/confirm_dialog.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../../../core/widgets/states.dart';
import '../../../property/presentation/widgets/property_widgets.dart';
import '../../data/models/appointment.dart';
import '../providers/appointments_provider.dart';
import '../widgets/appointment_card.dart';
import '../widgets/appointment_chat.dart';
import '../widgets/my_data_card.dart';

/// Pantalla 6 · Detalle de cita («Cita - Casa Las Palmas»).
class AppointmentDetailPage extends ConsumerWidget {
  const AppointmentDetailPage({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = ref.watch(appointmentProvider(appointmentId));
    return Scaffold(
      appBar: AppBar(),
      body: switch (appointment) {
        AsyncData(:final value) => _Detail(appointment: value),
        AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(appointmentProvider(appointmentId))),
        _ => const LoadingState(items: 3, itemHeight: 120),
      },
    );
  }
}

class _Detail extends ConsumerStatefulWidget {
  const _Detail({required this.appointment});

  final Appointment appointment;

  @override
  ConsumerState<_Detail> createState() => _DetailState();
}

class _DetailState extends ConsumerState<_Detail> {
  bool _chatOpen = true;
  bool _cancelling = false;

  Future<void> _cancel() async {
    final ok = await showConfirmDialog(
      context,
      title: 'Cancelar cita',
      message: '¿Quieres cancelar tu visita a ${widget.appointment.property.name}? Avisaremos a la inmobiliaria.',
      confirmLabel: 'Cancelar cita',
      cancelLabel: 'Conservar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _cancelling = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(appointmentActionsProvider).cancel(widget.appointment.id);
      messenger.showSnackBar(const SnackBar(content: Text('Tu cita se canceló.')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(ApiException.from(e).message)));
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.appointment;
    final messages = ref.watch(appointmentMessagesProvider(a.id));
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(appointmentMessagesProvider(a.id));
        ref.invalidate(appointmentProvider(a.id));
        await ref.read(appointmentProvider(a.id).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xxl),
        children: [
          Semantics(header: true, child: Text('Cita - ${a.property.name}', style: AppTextStyles.pageTitle.copyWith(fontSize: 24))),
          const SizedBox(height: AppSpacing.md),
          PropertyHero(
            height: 190,
            semanticLabel: 'Foto de ${a.property.name}',
            overlay: a.property.zone == null ? null : LocationChip(label: a.property.zone!),
          ),
          const SizedBox(height: AppSpacing.md),
          AppointmentCard(appointment: a),
          if (a.reason != null && (a.status == 'cancelada' || a.status == 'rechazada')) ...[
            const SizedBox(height: AppSpacing.sm),
            Text('Motivo: ${a.reason}', style: AppTextStyles.secondary.copyWith(fontSize: 13)),
          ],
          const SizedBox(height: AppSpacing.xl),
          Text('Mis Datos', style: AppTextStyles.sectionTitle),
          const SizedBox(height: AppSpacing.sm),
          const MyDataCard(),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: [
              Expanded(child: Text('Mensajes de la cita', style: AppTextStyles.sectionTitle)),
              if (!_chatOpen) TextButton(onPressed: () => setState(() => _chatOpen = true), child: const Text('Mostrar')),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (_chatOpen)
            switch (messages) {
              AsyncData(:final value) => AppointmentChat(
                  messages: value,
                  enabled: a.acceptsMessages,
                  onClose: () => setState(() => _chatOpen = false),
                  onSend: (body) async {
                    try {
                      await ref.read(appointmentMessagesProvider(a.id).notifier).send(body);
                      return null;
                    } catch (e) {
                      return ApiException.from(e).message;
                    }
                  },
                ),
              AsyncError(:final error) => SizedBox(height: 220, child: ErrorState(error: error, onRetry: () => ref.invalidate(appointmentMessagesProvider(a.id)))),
              _ => const SizedBox(height: 160, child: LoadingState(items: 2, itemHeight: 48)),
            },
          if (a.isActive) ...[
            const SizedBox(height: AppSpacing.xl),
            PrimaryButton(label: 'Cancelar cita', variant: ButtonVariant.danger, loading: _cancelling, onPressed: _cancel),
          ],
        ],
      ),
    );
  }
}
