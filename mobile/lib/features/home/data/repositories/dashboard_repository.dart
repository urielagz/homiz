import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_call.dart';
import '../../../../core/network/api_client.dart';
import '../models/client_dashboard.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) => DashboardRepository(ref.watch(dioProvider)));

class DashboardRepository {
  DashboardRepository(this._dio);

  final Dio _dio;

  Future<ClientDashboard> client() => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/dashboard');
        return ClientDashboard.fromJson(res.data!);
      });
}
