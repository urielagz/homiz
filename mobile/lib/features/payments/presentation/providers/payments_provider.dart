import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/presentation/providers/session_provider.dart';
import '../../../home/presentation/providers/dashboard_provider.dart';
import '../../data/models/payment_models.dart';
import '../../data/repositories/payments_repository.dart';

/// Pagarés con resumen. Cliente: `null` (su contrato vigente). Personal: el id del contrato de la casa.
final notesProvider = FutureProvider.family<NotesPage, String?>((ref, contractId) {
  ref.watch(sessionProvider.select((s) => s.value?.id));
  return ref.watch(paymentsRepositoryProvider).notes(contractId: contractId);
});

/// Recibos y fichas. Cliente: `null` (su casa). Personal: el id de la casa.
final receiptsProvider = FutureProvider.family<List<Receipt>, String?>((ref, propertyId) {
  ref.watch(sessionProvider.select((s) => s.value?.id));
  return ref.watch(paymentsRepositoryProvider).receipts(propertyId: propertyId);
});

/// Pagarés vencidos de las casas del personal.
final overdueNotesProvider = FutureProvider<List<PromissoryNote>>((ref) async {
  ref.watch(sessionProvider.select((s) => s.value?.id));
  return (await ref.watch(paymentsRepositoryProvider).notes(status: const ['overdue'])).notes;
});

final paymentActionsProvider = Provider<PaymentActions>(PaymentActions.new);

class PaymentActions {
  PaymentActions(this._ref);

  final Ref _ref;

  Future<void> register(PromissoryNote note, {required DateTime paidAt, required String receiptFolio, String? notes}) async {
    await _ref.read(paymentsRepositoryProvider).registerPayment(note.id, amount: note.amount, paidAt: paidAt, receiptFolio: receiptFolio, notes: notes);
    _ref.invalidate(notesProvider);
    _ref.invalidate(overdueNotesProvider);
    _ref.invalidate(staffDashboardProvider);
  }
}
