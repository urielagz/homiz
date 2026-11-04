import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/cards.dart';
import '../../../core/widgets/states.dart';
import '../data/sales_repository.dart';

/// «Mis compras»: el comprobante de cada casa que el cliente compró con nosotros (y su contrato, si se subió).
/// Después de la compra puede seguir pidiendo visitas a otras casas.
class PurchasesPage extends ConsumerWidget {
  const PurchasesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final purchases = ref.watch(myPurchasesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mis compras')),
      body: switch (purchases) {
        AsyncData(:final value) when value.isEmpty => const EmptyState(
            icon: Icons.house_outlined,
            title: 'Sin compras registradas',
            message: 'Cuando cierres la compra de una casa con nosotros, aquí tendrás tu comprobante.',
          ),
        AsyncData(:final value) => RefreshIndicator(
            onRefresh: () => ref.refresh(myPurchasesProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(AppSpacing.screen, AppSpacing.sm, AppSpacing.screen, AppSpacing.xxl),
              children: [
                for (final p in value) ...[PurchaseCard(purchase: p), const SizedBox(height: AppSpacing.md)],
                const InfoNotice(
                  text: 'El comprobante hace constar que cerraste la compra con Inmobiliaria Zugar. No es factura ni escritura: '
                      'la propiedad se formaliza en escritura pública ante notario.',
                ),
                const SizedBox(height: AppSpacing.lg),
                OutlinedButton.icon(
                  onPressed: () => context.go('/appointments/catalog'),
                  icon: const Icon(Icons.search_rounded),
                  label: const Text('Buscar otra casa'),
                ),
              ],
            ),
          ),
        AsyncError(:final error) => ErrorState(error: error, onRetry: () => ref.invalidate(myPurchasesProvider)),
        _ => const LoadingState(items: 2, itemHeight: 160),
      },
    );
  }
}

class PurchaseCard extends ConsumerStatefulWidget {
  const PurchaseCard({super.key, required this.purchase});

  final Purchase purchase;

  @override
  ConsumerState<PurchaseCard> createState() => _PurchaseCardState();
}

class _PurchaseCardState extends ConsumerState<PurchaseCard> {
  String? _busy;

  Future<void> _open(String key, Future<String> Function() url) async {
    setState(() => _busy = key);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final ok = await launchUrl(Uri.parse(await url()), mode: LaunchMode.externalApplication);
      if (!ok) messenger.showSnackBar(const SnackBar(content: Text('No encontramos una aplicación para abrir el PDF.')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(ApiException.from(e).message)));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.purchase;
    final repo = ref.read(salesRepositoryProvider);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.cardAll, border: Border.all(color: AppColors.divider)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(p.isClosed ? Icons.verified_outlined : Icons.block_outlined, color: p.isClosed ? AppColors.primary : AppColors.textSecondary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text(p.propertyName, style: AppTextStyles.sectionTitle)),
              Text(p.isClosed ? 'Compra cerrada' : 'Anulada', style: AppTextStyles.secondary.copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          KeyValueRow(label: 'Folio', value: p.folio),
          KeyValueRow(label: 'Fecha de cierre', value: Fmt.longDate(p.saleDate)),
          KeyValueRow(label: 'Precio', value: Fmt.money(p.price)),
          if (p.paymentMethod != null) KeyValueRow(label: 'Forma de pago', value: p.paymentMethod!),
          if (p.notary != null) KeyValueRow(label: 'Notaría', value: p.notary!),
          KeyValueRow(label: 'Ubicación', value: p.address ?? p.zone ?? p.propertyCode, showDivider: false),
          if (!p.isClosed && p.voidReason != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text('La inmobiliaria anuló este registro: ${p.voidReason}', style: AppTextStyles.secondary.copyWith(fontSize: 13)),
          ],
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: _busy != null ? null : () => _open('receipt', () => repo.receiptUrl(p.id)),
            icon: _busy == 'receipt' ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.picture_as_pdf_outlined),
            label: const Text('Ver comprobante (PDF)'),
          ),
          if (p.hasDocument) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: _busy != null ? null : () => _open('contract', () => repo.contractUrl(p.id)),
              icon: _busy == 'contract' ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.description_outlined),
              label: const Text('Ver contrato firmado'),
            ),
          ],
        ],
      ),
    );
  }
}
