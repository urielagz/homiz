import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../data/models/payment_models.dart';
import '../providers/payments_provider.dart';

/// «Registrar pago» en efectivo: monto (el del pagaré), fecha y folio del recibo.
Future<bool> showRegisterPaymentSheet(BuildContext context, PromissoryNote note) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => Padding(
      padding: EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl),
      child: RegisterPaymentSheet(note: note),
    ),
  );
  if ((saved ?? false) && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Pago registrado. Avisamos al cliente.')));
  }
  return saved ?? false;
}

class RegisterPaymentSheet extends ConsumerStatefulWidget {
  const RegisterPaymentSheet({super.key, required this.note});

  final PromissoryNote note;

  @override
  ConsumerState<RegisterPaymentSheet> createState() => _RegisterPaymentSheetState();
}

class _RegisterPaymentSheetState extends ConsumerState<RegisterPaymentSheet> {
  final _form = GlobalKey<FormState>();
  final _folio = TextEditingController();
  final _notes = TextEditingController();
  DateTime _paidOn = DateTime.now();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _folio.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(context: context, initialDate: _paidOn, firstDate: DateTime(now.year - 1), lastDate: now, helpText: 'Fecha del pago');
    if (picked != null) setState(() => _paidOn = picked);
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final now = DateTime.now();
    // Hoy: la hora actual. Otro día: mediodía, para no cambiar de fecha por la zona horaria.
    final sameDay = _paidOn.year == now.year && _paidOn.month == now.month && _paidOn.day == now.day;
    final paidAt = sameDay ? now : DateTime(_paidOn.year, _paidOn.month, _paidOn.day, 12);
    try {
      await ref.read(paymentActionsProvider).register(widget.note, paidAt: paidAt, receiptFolio: _folio.text, notes: _notes.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.note;
    return Form(
      key: _form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Registrar pago', style: AppTextStyles.pageTitle),
          const SizedBox(height: AppSpacing.xs),
          Text(
            [n.label, if (n.client != null) n.client!.name, if (n.property != null) n.property!.name].join(' · '),
            style: AppTextStyles.secondary.copyWith(fontSize: 13),
          ),
          const SizedBox(height: AppSpacing.lg),
          InputDecorator(
            decoration: const InputDecoration(labelText: 'Monto en efectivo', helperText: 'El pago cubre el pagaré completo.'),
            child: Text(Fmt.money(n.amount), style: AppTextStyles.cardTitle.copyWith(fontSize: 16)),
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: _loading ? null : _pickDate,
            icon: const Icon(Icons.event_outlined),
            label: Text('Pagado el ${Fmt.longDate(_paidOn)}'),
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: _folio,
            maxLength: 40,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'Folio del recibo', hintText: 'Por ejemplo: F-00125'),
            validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe el folio del recibo.' : null,
          ),
          TextFormField(
            controller: _notes,
            maxLength: 500,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Notas (opcional)'),
          ),
          const SizedBox(height: AppSpacing.md),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Semantics(liveRegion: true, child: Text(_error!, style: AppTextStyles.secondary.copyWith(color: AppColors.danger, fontSize: 13))),
            ),
          PrimaryButton(label: 'Registrar pago', loading: _loading, onPressed: _save),
        ],
      ),
    );
  }
}
