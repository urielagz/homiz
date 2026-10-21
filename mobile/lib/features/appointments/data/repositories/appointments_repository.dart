import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_call.dart';
import '../../../../core/network/api_client.dart';
import '../models/appointment.dart';

final appointmentsRepositoryProvider = Provider<AppointmentsRepository>((ref) => AppointmentsRepository(ref.watch(dioProvider)));

class AppointmentsRepository {
  AppointmentsRepository(this._dio);

  final Dio _dio;

  Future<List<Appointment>> list() => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/appointments', queryParameters: {'limit': 100});
        return dataList(res.data, Appointment.fromJson);
      });

  Future<Appointment> get(String id) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/appointments/$id');
        return Appointment.fromJson(res.data!);
      });

  /// Solicita una visita (queda «por confirmar»).
  Future<Appointment> request({required String propertyId, required DateTime scheduledAt, String? note}) => apiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/appointments', data: {
          'propertyId': propertyId,
          'scheduledAt': scheduledAt.toUtc().toIso8601String(),
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        });
        return Appointment.fromJson(res.data!);
      });

  Future<Appointment> cancel(String id, {String? reason}) => apiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/appointments/$id/cancel', data: {
          if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
        });
        return Appointment.fromJson(res.data!);
      });

  Future<List<AppointmentMessage>> messages(String id) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/appointments/$id/messages');
        return dataList(res.data, AppointmentMessage.fromJson);
      });

  /// Envía un mensaje y devuelve la conversación completa.
  Future<List<AppointmentMessage>> sendMessage(String id, String body) => apiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/appointments/$id/messages', data: {'body': body.trim()});
        return dataList(res.data, AppointmentMessage.fromJson);
      });
}
