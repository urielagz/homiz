import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/cards.dart';
import '../../../../core/widgets/segmented_tabs.dart';
import '../../../../core/widgets/states.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../documents/presentation/open_document.dart';
import '../../data/models/payment_models.dart';
import '../../data/repositories/payments_repository.dart';
import '../providers/payments_provider.dart';

/// Pantalla 9 · Pagos: resumen, pagarés y fichas de cobro / recibos (solo consulta).
class PaymentsTab extends ConsumerStatefulWidget {
  const PaymentsTab({super.key});

  @override
  ConsumerState<PaymentsTab> createState() => _PaymentsTabState();
}

class _PaymentsTabState extends ConsumerState<PaymentsTab> {
  int _view = 0;

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(notesProvider);
    final receipts = _view == 1 ? ref.watch(receiptsProvider) : null;
    void open(String id) => openDocument(context, ref, id);

    final List<Widget> body = switch (_view) {
      0 => switch (notes) {
          AsyncData(:final value) => [NotesList(page: value, onOpenProof: open)],
          AsyncError(:final error) => [ErrorState(error: error, onRetry: () => ref.invalidate(notesProvider))],
          _ => [const SizedBox(height: 260, child: LoadingState(items: 3))],
        },
      _ => switch (receipts!) {
          AsyncData(:final value) => [ReceiptsList(receipts: value, onOpen: open)],
          AsyncError(:final error) => [ErrorState(error: error, onRetry: () => ref.invalidate(receiptsProvider))],
          _ => [const SizedBox(height: 260, child: LoadingState(items: 3))],
        },
    };

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(receiptsProvider);
        ref.invalidate(notesProvider);
        await ref.read(notesProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xl),
        children: [
          if (notes.value?.summary case final summary?) ...[PaymentsSummaryCard(summary: summary), const SizedBox(height: AppSpacing.lg)],
          PillToggle(options: const ['Pagarés', 'Fichas de cobro / Recibos'], selected: _view, onChanged: (i) => setState(() => _view = i)),
          const SizedBox(height: AppSpacing.md),
          const InfoNotice(text: 'Esta información solo es para consulta, los pagos se realizan en persona con efectivo.'),
          const SizedBox(height: AppSpacing.md),
          ...body,
        ],
      ),
    );
  }
}

/// «Estado de pagos»: faltan N pagarés ● $monto, pagados X de N ● Próximo: fecha, y la barra verde.
class PaymentsSummaryCard extends StatelessWidget {
  const PaymentsSummaryCard({super.key, required this.summary});

  final NotesSummary summary;

  @override
  Widget build(BuildContext context) {
    final next = summary.next;
    return SummaryProgressCard(
      title: 'Estado de pagos',
      lines: [
        summary.remaining == 0
            ? 'No tienes pagarés pendientes'
            : 'Te faltan ${summary.remaining} ${summary.remaining == 1 ? 'pagaré' : 'pagarés'} ● ${Fmt.money(summary.remainingAmount)}',
        'Pagados ${summary.paid} de ${summary.total}${next == null ? '' : ' ● Próximo: ${Fmt.dayMonthShort(next.dueDate)}'}',
      ],
      progress: summary.progress,
    );
  }
}

/// Lista de pagarés: «Pagaré 05 - 5 nov» · $12,000 · Pendiente / Comprobante.
class NotesList extends StatelessWidget {
  const NotesList({super.key, required this.page, required this.onOpenProof});

  final NotesPage page;
  final ValueChanged<String> onOpenProof;

  @override
  Widget build(BuildContext context) {
    final notes = page.notes.where((n) => n.status != 'cancelled').toList();
    if (notes.isEmpty) {
      return const EmptyState(icon: Icons.receipt_long_outlined, title: 'Sin pagarés', message: 'Tus pagarés aparecerán aquí cuando se registre tu contrato.');
    }
    return Column(
      children: [
        for (final n in notes) ...[
          ListCard(
            title: '${n.label} - ${Fmt.dayMonthShort(n.dueDate)}',
            caption: Fmt.money(n.amount),
            subtitle: switch (n.status) {
              'paid' => n.proofDocumentId != null ? 'Comprobante' : 'Pagado el ${Fmt.dayMonthShort(n.payment?.paidAt ?? n.dueDate)}',
              'overdue' => 'Vencido',
              _ => 'Pendiente',
            },
            onTap: n.proofDocumentId == null ? null : () => onOpenProof(n.proofDocumentId!),
            trailing: StatusBadge.fromStatus(n.status),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

/// Recibos de luz y agua y fichas de cobro.
class ReceiptsList extends StatelessWidget {
  const ReceiptsList({super.key, required this.receipts, required this.onOpen});

  final List<Receipt> receipts;
  final ValueChanged<String> onOpen;

  static String title(Receipt r) => r.kind == 'charge_slip' && r.dueDate != null ? '${r.concept} - ${Fmt.dayMonthShort(r.dueDate!)}' : r.concept;

  static String subtitle(Receipt r) {
    final status = switch (r.status) { 'paid' => 'pagado', 'overdue' => 'vencido', _ => 'pendiente' };
    return [if (r.periodLabel != null) 'Periodo ${r.periodLabel}', '${Fmt.money(r.amount)} · Estado $status'].join('\n');
  }

  @override
  Widget build(BuildContext context) {
    if (receipts.isEmpty) {
      return const EmptyState(icon: Icons.bolt_outlined, title: 'Sin recibos', message: 'Aquí verás tus recibos de luz y agua y las fichas de cobro.');
    }
    return Column(
      children: [
        for (final r in receipts) ...[
          ListCard(
            title: title(r),
            subtitle: subtitle(r),
            // Pagado o ficha de cobro con archivo: botón «Ver». Si no: su estado.
            trailing: r.documentId != null && (r.status == 'paid' || r.kind == 'charge_slip')
                ? StatusBadge(kind: BadgeKind.view, onTap: () => onOpen(r.documentId!))
                : StatusBadge.fromStatus(r.status),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}
