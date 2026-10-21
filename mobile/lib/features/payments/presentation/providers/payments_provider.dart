import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/presentation/providers/session_provider.dart';
import '../../data/models/payment_models.dart';
import '../../data/repositories/payments_repository.dart';

final notesProvider = FutureProvider<NotesPage>((ref) {
  ref.watch(sessionProvider.select((s) => s.value?.id));
  return ref.watch(paymentsRepositoryProvider).notes();
});

final receiptsProvider = FutureProvider<List<Receipt>>((ref) {
  ref.watch(sessionProvider.select((s) => s.value?.id));
  return ref.watch(paymentsRepositoryProvider).receipts();
});
