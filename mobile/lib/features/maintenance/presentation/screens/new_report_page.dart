import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/file_uploader.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../data/models/maintenance_report.dart';
import '../providers/maintenance_provider.dart';

/// Nuevo reporte: título, categoría, prioridad, descripción y hasta 5 fotos. Avisa al broker.
class NewReportPage extends ConsumerStatefulWidget {
  const NewReportPage({super.key, required this.propertyId});

  final String propertyId;

  @override
  ConsumerState<NewReportPage> createState() => _NewReportPageState();
}

class _NewReportPageState extends ConsumerState<NewReportPage> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  String? _category;
  String _priority = 'medium';
  List<XFile> _photos = const [];
  bool _loading = false;
  String? _error;
  Map<String, String> _fieldErrors = const {};

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _fieldErrors = const {};
    });
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _loading = true);
    try {
      final report = await ref.read(newReportProvider).submit(
            propertyId: widget.propertyId,
            title: _title.text,
            description: _description.text,
            category: _category!,
            priority: _priority,
            photos: _photos,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enviamos tu reporte. Te avisaremos cada avance.')));
      context.pushReplacement('/property/maintenance/${report.id}');
    } catch (e) {
      final api = ApiException.from(e);
      if (mounted) {
        setState(() {
          _error = api.message;
          _fieldErrors = api.fieldErrors;
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nuevo reporte')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(AppSpacing.screen, AppSpacing.sm, AppSpacing.screen, AppSpacing.xxl),
          children: [
            TextFormField(
              controller: _title,
              maxLength: 80,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(labelText: 'Título', hintText: 'Por ejemplo: Fuga en el baño', errorText: _fieldErrors['title']),
              validator: (v) => (v ?? '').trim().length < 3 ? 'Escribe un título breve.' : null,
            ),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: InputDecoration(labelText: 'Categoría', errorText: _fieldErrors['category']),
              items: [for (final c in maintenanceCategories) DropdownMenuItem(value: c, child: Text(c))],
              onChanged: _loading ? null : (v) => setState(() => _category = v),
              validator: (v) => v == null ? 'Elige una categoría.' : null,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('Prioridad', style: AppTextStyles.label),
            const SizedBox(height: AppSpacing.sm),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'low', label: Text('Baja')),
                ButtonSegment(value: 'medium', label: Text('Media')),
                ButtonSegment(value: 'high', label: Text('Alta')),
              ],
              selected: {_priority},
              showSelectedIcon: false,
              onSelectionChanged: _loading ? null : (s) => setState(() => _priority = s.first),
            ),
            const SizedBox(height: AppSpacing.lg),
            TextFormField(
              controller: _description,
              minLines: 4,
              maxLines: 8,
              maxLength: 2000,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: 'Descripción',
                hintText: '¿Qué pasa y desde cuándo?',
                alignLabelWithHint: true,
                errorText: _fieldErrors['description'],
              ),
              validator: (v) => (v ?? '').trim().length < 5 ? 'Describe qué pasa.' : Validators.required(v),
            ),
            const SizedBox(height: AppSpacing.md),
            Text('Fotos (opcional, máximo 5)', style: AppTextStyles.label),
            const SizedBox(height: AppSpacing.sm),
            FileUploader(files: _photos, allowDocuments: false, label: 'Agregar fotos', onChanged: (f) => setState(() => _photos = f)),
            const SizedBox(height: AppSpacing.xl),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Semantics(liveRegion: true, child: Text(_error!, style: AppTextStyles.secondary.copyWith(color: AppColors.danger, fontSize: 13))),
              ),
            PrimaryButton(label: _loading && _photos.isNotEmpty ? 'Subiendo fotos…' : 'Enviar reporte', loading: _loading, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
