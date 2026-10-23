import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/primary_button.dart';
import '../../../../core/widgets/states.dart';
import '../../../property/data/models/property_models.dart';
import '../../../property/presentation/providers/property_provider.dart';
import '../../../property/presentation/widgets/property_widgets.dart';
import '../providers/appointments_provider.dart';
import '../providers/pending_visit_provider.dart';

/// Ficha de una casa del catálogo con el formulario para solicitar visita.
class RequestVisitPage extends ConsumerWidget {
  const RequestVisitPage({super.key, required this.propertyId});

  final String propertyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final property = ref.watch(propertyDetailProvider(propertyId));
    return Scaffold(
      appBar: AppBar(),
      body: switch (property) {
        AsyncData(:final value) => _VisitForm(property: value),
        AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(propertyDetailProvider(propertyId))),
        _ => const LoadingState(items: 3, itemHeight: 120),
      },
    );
  }
}

/// Casa elegida en el sitio de Zugar («Usar la app»): se busca por su slug y se muestra el mismo formulario.
class VisitFromSitePage extends ConsumerStatefulWidget {
  const VisitFromSitePage({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<VisitFromSitePage> createState() => _VisitFromSitePageState();
}

class _VisitFromSitePageState extends ConsumerState<VisitFromSitePage> {
  @override
  void initState() {
    super.initState();
    // Ya llegó a la casa: al volver a entrar a la app no se redirige otra vez.
    Future.microtask(() => ref.read(pendingVisitProvider.notifier).clear());
  }

  @override
  Widget build(BuildContext context) {
    final property = ref.watch(propertyBySlugProvider(widget.slug));
    return Scaffold(
      appBar: AppBar(),
      body: switch (property) {
        AsyncData(value: final PropertyDetail p) => _VisitForm(property: p),
        AsyncData() => EmptyState(
            icon: Icons.home_work_outlined,
            title: 'Esta casa ya no está disponible',
            message: 'Puede que ya se haya rentado o vendido. Mira otras casas del catálogo.',
            actionLabel: 'Ver catálogo',
            onAction: () => context.go('/appointments/catalog'),
          ),
        AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(propertyBySlugProvider(widget.slug))),
        _ => const LoadingState(items: 3, itemHeight: 120),
      },
    );
  }
}

class _VisitForm extends ConsumerStatefulWidget {
  const _VisitForm({required this.property});

  final PropertyDetail property;

  @override
  ConsumerState<_VisitForm> createState() => _VisitFormState();
}

class _VisitFormState extends ConsumerState<_VisitForm> {
  DateTime? _date;
  TimeOfDay? _time;
  final _note = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  DateTime? get _scheduledAt => _date == null || _time == null ? null : DateTime(_date!.year, _date!.month, _date!.day, _time!.hour, _time!.minute);

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 90)),
      helpText: 'Elige el día de la visita',
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _time ?? const TimeOfDay(hour: 11, minute: 0), helpText: 'Elige la hora');
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _submit() async {
    final when = _scheduledAt;
    if (when == null) {
      setState(() => _error = 'Elige el día y la hora de la visita.');
      return;
    }
    if (!when.isAfter(DateTime.now())) {
      setState(() => _error = 'Elige una fecha y hora futuras.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final a = await ref.read(appointmentActionsProvider).request(propertyId: widget.property.id, scheduledAt: when, note: _note.text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Solicitamos tu visita. Te avisaremos cuando se confirme.')));
      context.go('/appointments/${a.id}');
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.property;
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xxl),
      children: [
        PropertyHero(url: p.coverUrl, height: 210, overlay: HeroCaption(title: p.name, location: [p.zone, p.city].whereType<String>().join(', '))),
        const SizedBox(height: AppSpacing.md),
        Text('${Fmt.money(p.price)}${p.operation == 'renta' ? ' / mes' : ''}', style: AppTextStyles.pageTitle.copyWith(color: AppColors.primary)),
        const SizedBox(height: AppSpacing.sm),
        FeatureRow(rec: p.rec, banos: p.banos, amenities: p.amenities),
        if (p.description != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(p.description!, style: AppTextStyles.body.copyWith(color: AppColors.textMuted)),
        ],
        const SizedBox(height: AppSpacing.xl),
        Text('¿Te imaginas viviendo aquí?', style: AppTextStyles.sectionTitle),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _loading ? null : _pickDate,
                icon: const Icon(Icons.event_outlined),
                label: Text(_date == null ? 'Día' : Fmt.dayMonth(_date!)),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _loading ? null : _pickTime,
                icon: const Icon(Icons.schedule_outlined),
                label: Text(_time == null ? 'Hora' : Fmt.time(DateTime(2000, 1, 1, _time!.hour, _time!.minute))),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _note,
          maxLines: 3,
          maxLength: 1000,
          decoration: const InputDecoration(labelText: 'Comentarios (opcional)', hintText: 'Por ejemplo: vamos 3 personas y una mascota.'),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Semantics(liveRegion: true, child: Text(_error!, style: AppTextStyles.secondary.copyWith(color: AppColors.danger, fontSize: 13))),
          ),
        PrimaryButton(label: 'Solicitar visita', loading: _loading, onPressed: _submit),
      ],
    );
  }
}
