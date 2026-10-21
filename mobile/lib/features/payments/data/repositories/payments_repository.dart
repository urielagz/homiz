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

  Future<NotesPage> notes() => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/promissory-notes', queryParameters: {'limit': 100});
        final summary = res.data?['summary'];
        return NotesPage(
          notes: dataList(res.data, PromissoryNote.fromJson),
          summary: summary == null ? null : NotesSummary.fromJson(summary as Map<String, dynamic>),
        );
      });

  Future<List<Receipt>> receipts() => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/receipts', queryParameters: {'limit': 100});
        return dataList(res.data, Receipt.fromJson);
      });
}
