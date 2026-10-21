import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/cards.dart';
import '../../../../core/widgets/permission_gate.dart';
import '../../../../core/widgets/segmented_tabs.dart';
import '../../../../core/widgets/states.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../documents/presentation/open_document.dart';
import '../../data/models/payment_models.dart';
import '../../data/repositories/payments_repository.dart';
import '../providers/payments_provider.dart';
import 'register_payment_sheet.dart';

/// Pantalla 9 · Pagos: resumen, pagarés y fichas de cobro / recibos.
/// Cliente: solo consulta (sin parámetros). Personal: la casa [propertyId] con su contrato [contractId]
/// y «Registrar pago» si tiene el permiso.
class PaymentsTab extends ConsumerStatefulWidget {
  const PaymentsTab({super.key, this.contractId, this.propertyId, this.staff = false});

  final String? contractId;
  final String? propertyId;
  final bool staff;

  @override
  ConsumerState<PaymentsTab> createState() => _PaymentsTabState();
}

class _PaymentsTabState extends ConsumerState<PaymentsTab> {
  int _view = 0;

  @override
  Widget build(BuildContext context) {
    // El personal sin contrato vigente no tiene pagarés que mostrar.
    final noContract = widget.staff && widget.contractId == null;
    final notes = noContract ? const AsyncData(NotesPage(notes: [])) : ref.watch(notesProvider(widget.contractId));
    final receipts = _view == 1 ? ref.watch(receiptsProvider(widget.propertyId)) : null;
    void open(String id) => openDocument(context, ref, id);

    final List<Widget> body = switch (_view) {
      0 => switch (notes) {
          AsyncData(:final value) => [NotesList(page: value, staff: widget.staff, onOpenProof: open)],
          AsyncError(:final error) => [ErrorState(error: error, onRetry: () => ref.invalidate(notesProvider(widget.contractId)))],
          _ => [const SizedBox(height: 260, child: LoadingState(items: 3))],
        },
      _ => switch (receipts!) {
          AsyncData(:final value) => [ReceiptsList(receipts: value, onOpen: open)],
          AsyncError(:final error) => [ErrorState(error: error, onRetry: () => ref.invalidate(receiptsProvider(widget.propertyId)))],
          _ => [const SizedBox(height: 260, child: LoadingState(items: 3))],
        },
    };

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(receiptsProvider(widget.propertyId));
        if (noContract) return;
        ref.invalidate(notesProvider(widget.contractId));
        await ref.read(notesProvider(widget.contractId).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen, AppSpacing.xl),
        children: [
          if (notes.value?.summary case final summary?) ...[PaymentsSummaryCard(summary: summary), const SizedBox(height: AppSpacing.lg)],
          PillToggle(options: const ['Pagarés', 'Fichas de cobro / Recibos'], selected: _view, onChanged: (i) => setState(() => _view = i)),
          const SizedBox(height: AppSpacing.md),
          InfoNotice(
            text: widget.staff
                ? 'Los pagos se reciben en persona con efectivo. Registra cada pago con el folio del recibo; avisaremos al cliente.'
                : 'Esta información solo es para consulta, los pagos se realizan en persona con efectivo.',
          ),
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
            ? 'No hay pagarés pendientes'
            : 'Te faltan ${summary.remaining} ${summary.remaining == 1 ? 'pagaré' : 'pagarés'} ● ${Fmt.money(summary.remainingAmount)}',
        'Pagados ${summary.paid} de ${summary.total}${next == null ? '' : ' ● Próximo: ${Fmt.dayMonthShort(next.dueDate)}'}',
      ],
      progress: summary.progress,
    );
  }
}

/// Lista de pagarés: «Pagaré 05 - 5 nov» · $12,000 · Pendiente / Comprobante.
class NotesList extends StatelessWidget {
  const NotesList({super.key, required this.page, required this.onOpenProof, this.staff = false});

  final NotesPage page;
  final ValueChanged<String> onOpenProof;
  final bool staff;

  static String statusText(PromissoryNote n) => switch (n.status) {
        'paid' => n.proofDocumentId != null ? 'Comprobante' : 'Pagado el ${Fmt.dayMonthShort(n.payment?.paidAt ?? n.dueDate)}',
        'overdue' => 'Vencido',
        _ => 'Pendiente',
      };

  @override
  Widget build(BuildContext context) {
    final notes = page.notes.where((n) => n.status != 'cancelled').toList();
    if (notes.isEmpty) {
      return EmptyState(
        icon: Icons.receipt_long_outlined,
        title: 'Sin pagarés',
        message: staff ? 'Esta casa no tiene un contrato vigente con pagarés.' : 'Tus pagarés aparecerán aquí cuando se registre tu contrato.',
      );
    }
    return Column(
      children: [
        for (final n in notes) ...[
          NoteCard(
            note: n,
            title: '${n.label} - ${Fmt.dayMonthShort(n.dueDate)}',
            subtitle: [statusText(n), if (staff && n.payment?.receiptFolio != null) 'Folio ${n.payment!.receiptFolio}'].join(' · '),
            onTap: n.proofDocumentId == null ? null : () => onOpenProof(n.proofDocumentId!),
            allowRegister: staff,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

/// Tarjeta de pagaré con su estado y, para el personal con `payments.register`, «Registrar pago».
class NoteCard extends StatelessWidget {
  const NoteCard({super.key, required this.note, required this.title, this.subtitle, this.onTap, this.allowRegister = true});

  final PromissoryNote note;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool allowRegister;

  @override
  Widget build(BuildContext context) {
    return ListCard(
      title: title,
      caption: Fmt.money(note.amount),
      subtitle: subtitle,
      onTap: onTap,
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          StatusBadge.fromStatus(note.status),
          if (allowRegister && note.isPayable)
            PermissionGate(
              permission: 'payments.register',
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Material(
                  color: Colors.white,
                  borderRadius: AppRadius.pillAll,
                  child: InkWell(
                    borderRadius: AppRadius.pillAll,
                    onTap: () => showRegisterPaymentSheet(context, note),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                      child: Text('Registrar pago', style: AppTextStyles.badge.copyWith(color: AppColors.primary, fontSize: 12)),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
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
      return const EmptyState(icon: Icons.bolt_outlined, title: 'Sin recibos', message: 'Aquí aparecen los recibos de luz y agua y las fichas de cobro.');
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
