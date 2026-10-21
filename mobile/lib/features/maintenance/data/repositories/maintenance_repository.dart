import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_call.dart';
import '../../../../core/network/api_client.dart';
import '../models/maintenance_report.dart';

final maintenanceRepositoryProvider = Provider<MaintenanceRepository>((ref) => MaintenanceRepository(ref.watch(dioProvider)));

class MaintenanceRepository {
  MaintenanceRepository(this._dio);

  final Dio _dio;

  Future<List<MaintenanceReport>> list({required String propertyId}) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/maintenance-reports', queryParameters: {'propertyId': propertyId, 'limit': 100});
        return dataList(res.data, MaintenanceReport.fromJson);
      });

  /// Detalle con línea de tiempo y fotos antes/después.
  Future<MaintenanceReport> get(String id) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/maintenance-reports/$id');
        return MaintenanceReport.fromJson(res.data!);
      });

  Future<MaintenanceReport> create({
    required String propertyId,
    required String title,
    required String description,
    required String category,
    required String priority,
    List<String> photos = const [],
  }) =>
      apiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/maintenance-reports', data: {
          'propertyId': propertyId,
          'title': title.trim(),
          'description': description.trim(),
          'category': category,
          'priority': priority,
          'photos': photos,
        });
        return MaintenanceReport.fromJson(res.data!);
      });
}
