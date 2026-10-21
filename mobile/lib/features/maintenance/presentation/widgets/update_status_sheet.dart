import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../../providers/presentation/providers/providers_directory_provider.dart';
import '../../data/models/maintenance_report.dart';
import '../providers/maintenance_provider.dart';

/// UpdateStatusSheet: cambia el estado del reporte, deja un comentario y asigna proveedor. Avisa al cliente.
Future<void> showUpdateStatusSheet(BuildContext context, MaintenanceReport report) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => Padding(
      padding: EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl),
      child: UpdateStatusSheet(report: report),
    ),
  );
  if ((saved ?? false) && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reporte actualizado. Avisamos al cliente.')));
  }
}

class UpdateStatusSheet extends ConsumerStatefulWidget {
  const UpdateStatusSheet({super.key, required this.report});

  final MaintenanceReport report;

  @override
  ConsumerState<UpdateStatusSheet> createState() => _UpdateStatusSheetState();
}

class _UpdateStatusSheetState extends ConsumerState<UpdateStatusSheet> {
  final _form = GlobalKey<FormState>();
  final _comment = TextEditingController();
  late String? _status = _nextSuggested();
  late String? _providerId = widget.report.provider?.id;
  bool _loading = false;
  String? _error;

  /// Sugerencia: reportado → en revisión → en reparación → resuelto.
  String? _nextSuggested() => switch (widget.report.status) {
        'reported' => 'in_review',
        'in_review' => 'in_repair',
        'in_repair' => 'resolved',
        _ => null,
      };

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(maintenanceActionsProvider).updateStatus(
            widget.report.id,
            status: _status!,
            comment: _comment.text,
            // Solo se envía si cambió, para no tocar la asignación actual.
            providerId: _providerId != widget.report.provider?.id ? _providerId : null,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final providers = ref.watch(providersDirectoryProvider(''));
    final options = maintenanceStatusLabels.entries.where((e) => e.key != widget.report.status).toList();
    return Form(
      key: _form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Actualizar estado', style: AppTextStyles.pageTitle),
          const SizedBox(height: AppSpacing.xs),
          Text('${widget.report.title} · ${widget.report.statusLabel}', style: AppTextStyles.secondary.copyWith(fontSize: 13)),
          const SizedBox(height: AppSpacing.lg),
          DropdownButtonFormField<String>(
            initialValue: _status,
            decoration: const InputDecoration(labelText: 'Nuevo estado'),
            items: [for (final e in options) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: _loading ? null : (v) => setState(() => _status = v),
            validator: (v) => v == null ? 'Elige el nuevo estado.' : null,
          ),
          const SizedBox(height: AppSpacing.md),
          switch (providers) {
            AsyncData(:final value) => DropdownButtonFormField<String?>(
                initialValue: value.any((p) => p.id == _providerId) ? _providerId : null,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Proveedor asignado (opcional)'),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('Sin proveedor')),
                  for (final p in value)
                    DropdownMenuItem<String?>(value: p.id, child: Text('${p.name} · ${p.specialty}', overflow: TextOverflow.ellipsis)),
                ],
                onChanged: _loading ? null : (v) => setState(() => _providerId = v),
              ),
            AsyncError() => Text('No se pudo cargar el directorio de proveedores.', style: AppTextStyles.secondary),
            _ => const LinearProgressIndicator(),
          },
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: _comment,
            maxLength: 1000,
            maxLines: 3,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Comentario para el cliente',
              hintText: 'Por ejemplo: el plomero irá el lunes a las 10:00.',
              alignLabelWithHint: true,
            ),
            validator: (v) => _status == 'cancelled' && (v ?? '').trim().isEmpty ? 'Explica por qué se cancela.' : null,
          ),
          const SizedBox(height: AppSpacing.md),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Semantics(liveRegion: true, child: Text(_error!, style: AppTextStyles.secondary.copyWith(color: AppColors.danger, fontSize: 13))),
            ),
          PrimaryButton(label: 'Guardar cambio', loading: _loading, onPressed: _save),
        ],
      ),
    );
  }
}
