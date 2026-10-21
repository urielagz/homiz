import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_call.dart';
import '../../../../core/network/api_client.dart';
import '../models/payment_models.dart';

final paymentsRepositoryProvider = Provider<PaymentsRepository>((ref) => PaymentsRepository(ref.watch(dioProvider)));

/// Pagarés con su resumen.
class NotesPage {
  const NotesPage({required this.notes, this.summary});

  final List<PromissoryNote> notes;
  final NotesSummary? summary;
}

class PaymentsRepository {
  PaymentsRepository(this._dio);

  final Dio _dio;

  /// Cliente: los suyos con el resumen del contrato vigente.
  /// Personal: se filtra por [contractId] (incluye el resumen), [propertyId] o [status].
  Future<NotesPage> notes({String? contractId, String? propertyId, List<String>? status}) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/promissory-notes', queryParameters: {
          'limit': 100,
          'contractId': ?contractId,
          'propertyId': ?propertyId,
          if (status != null && status.isNotEmpty) 'status': status,
        });
        final summary = res.data?['summary'];
        return NotesPage(
          notes: dataList(res.data, PromissoryNote.fromJson),
          summary: summary == null ? null : NotesSummary.fromJson(summary as Map<String, dynamic>),
        );
      });

  Future<List<Receipt>> receipts({String? propertyId}) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/receipts', queryParameters: {'limit': 100, 'propertyId': ?propertyId});
        return dataList(res.data, Receipt.fromJson);
      });

  /// Pago en efectivo (permiso payments.register). El monto debe cubrir el pagaré completo.
  Future<PromissoryNote> registerPayment(String noteId, {required double amount, required DateTime paidAt, required String receiptFolio, String? notes}) =>
      apiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/promissory-notes/$noteId/payments', data: {
          'amount': amount,
          'paidAt': paidAt.toUtc().toIso8601String(),
          'receiptFolio': receiptFolio.trim(),
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        });
        return PromissoryNote.fromJson(res.data!);
      });
}
