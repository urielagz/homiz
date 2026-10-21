import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/cards.dart';
import '../../../../core/widgets/confirm_dialog.dart';
import '../../../../core/widgets/contact_actions.dart';
import '../../../../core/widgets/permission_gate.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../data/models/appointment.dart';
import '../providers/appointments_provider.dart';

/// Datos del cliente de la cita (solo personal) con Llamar / Correo.
class AppointmentClientCard extends StatelessWidget {
  const AppointmentClientCard({super.key, required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context) {
    final c = appointment.client!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.cardAll, border: Border.all(color: AppColors.divider)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyValueRow(label: 'Nombre', value: c.name),
          KeyValueRow(label: 'Teléfono', value: c.phone ?? 'Sin registrar'),
          KeyValueRow(label: 'Correo', value: c.email ?? 'Sin registrar', showDivider: appointment.note != null || appointment.broker != null),
          if (appointment.broker != null) KeyValueRow(label: 'Asesor', value: appointment.broker!.name, showDivider: appointment.note != null),
          if (appointment.note != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: Text('Comentario: ${appointment.note}', style: AppTextStyles.body.copyWith(fontSize: 13)),
            ),
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: ContactActions(phone: c.phone, email: c.email, subject: 'Tu visita a ${appointment.property.name}'),
          ),
        ],
      ),
    );
  }
}

/// Pide un motivo. El controlador vive en el estado del diálogo para liberarse cuando el diálogo
/// termina de cerrarse (liberarlo al salir de showDialog fallaba durante la animación de cierre).
class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog({required this.title, required this.label, required this.confirm, required this.required});

  final String title;
  final String label;
  final String confirm;
  final bool required;

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (widget.required && text.length < 3) {
      setState(() => _error = 'Escribe el motivo.');
      return;
    }
    Navigator.pop(context, text);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLines: 3,
        maxLength: 300,
        decoration: InputDecoration(labelText: widget.label, errorText: _error),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Volver')),
        TextButton(onPressed: _submit, child: Text(widget.confirm)),
      ],
    );
  }
}

/// Confirmar · Rechazar · Reprogramar · Marcar como realizada · Cancelar (permiso appointments.manage).
class StaffAppointmentActions extends ConsumerStatefulWidget {
  const StaffAppointmentActions({super.key, required this.appointment});

  final Appointment appointment;

  @override
  ConsumerState<StaffAppointmentActions> createState() => _StaffAppointmentActionsState();
}

class _StaffAppointmentActionsState extends ConsumerState<StaffAppointmentActions> {
  String? _busy;

  Appointment get a => widget.appointment;

  Future<void> _run(String key, Future<void> Function() action, String done) async {
    setState(() => _busy = key);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(done)));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(ApiException.from(e).message)));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<String?> _askReason({required String title, required String label, required String confirm, bool required = true}) =>
      showDialog<String>(context: context, builder: (_) => _ReasonDialog(title: title, label: label, confirm: confirm, required: required));

  Future<void> _reject() async {
    final reason = await _askReason(title: 'Rechazar cita', label: 'Motivo (lo verá el cliente)', confirm: 'Rechazar');
    if (reason == null) return;
    await _run('reject', () => ref.read(appointmentActionsProvider).reject(a.id, reason), 'Cita rechazada. Avisamos al cliente.');
  }

  Future<void> _reschedule() async {
    final now = DateTime.now();
    final day = await showDatePicker(
      context: context,
      initialDate: a.scheduledAt.isAfter(now) ? a.scheduledAt : now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 120)),
      helpText: 'Nuevo día de la visita',
    );
    if (day == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(a.scheduledAt), helpText: 'Nueva hora');
    if (time == null || !mounted) return;
    final when = DateTime(day.year, day.month, day.day, time.hour, time.minute);
    final ok = await showConfirmDialog(context, title: 'Reprogramar cita', message: 'La visita cambiará al ${Fmt.appointment(when)} y quedará por confirmar.', confirmLabel: 'Reprogramar');
    if (!ok) return;
    await _run('reschedule', () => ref.read(appointmentActionsProvider).reschedule(a.id, when), 'Cita reprogramada. Avisamos al cliente.');
  }

  Future<void> _cancel() async {
    final reason = await _askReason(title: 'Cancelar cita', label: 'Motivo (opcional)', confirm: 'Cancelar cita', required: false);
    if (reason == null) return;
    await _run('cancel', () => ref.read(appointmentActionsProvider).cancel(a.id, reason: reason), 'Cita cancelada. Avisamos al cliente.');
  }

  @override
  Widget build(BuildContext context) {
    final upcoming = a.scheduledAt.isAfter(DateTime.now());
    final pending = a.status == 'por-confirmar';
    final confirmed = a.status == 'confirmada';
    if (!pending && !confirmed) return const SizedBox.shrink();
    final disabled = _busy != null;
    return PermissionGate(
      permission: 'appointments.manage',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (a.confirmedBy != null) ...[
            Text(a.confirmedBy!, style: AppTextStyles.secondary),
            const SizedBox(height: AppSpacing.md),
          ],
          if (pending && upcoming) ...[
            PrimaryButton(
              label: 'Confirmar cita',
              icon: Icons.check_rounded,
              loading: _busy == 'confirm',
              onPressed: disabled ? null : () => _run('confirm', () => ref.read(appointmentActionsProvider).confirm(a.id), 'Cita confirmada. Avisamos al cliente.'),
            ),
            const SizedBox(height: AppSpacing.md),
            PrimaryButton(label: 'Rechazar', variant: ButtonVariant.danger, loading: _busy == 'reject', onPressed: disabled ? null : _reject),
            const SizedBox(height: AppSpacing.md),
          ],
          if (confirmed) ...[
            PrimaryButton(
              label: 'Marcar como realizada',
              icon: Icons.task_alt_rounded,
              loading: _busy == 'complete',
              onPressed: disabled ? null : () => _run('complete', () => ref.read(appointmentActionsProvider).complete(a.id), 'Visita marcada como realizada.'),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          PrimaryButton(label: 'Reprogramar', icon: Icons.edit_calendar_outlined, variant: ButtonVariant.outline, loading: _busy == 'reschedule', onPressed: disabled ? null : _reschedule),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(label: 'Cancelar cita', variant: ButtonVariant.danger, loading: _busy == 'cancel', onPressed: disabled ? null : _cancel),
        ],
      ),
    );
  }
}
