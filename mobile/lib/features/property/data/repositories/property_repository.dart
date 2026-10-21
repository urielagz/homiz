import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_call.dart';
import '../../../../core/network/api_client.dart';
import '../models/property_models.dart';

final propertyRepositoryProvider = Provider<PropertyRepository>((ref) => PropertyRepository(ref.watch(dioProvider)));

class PropertyRepository {
  PropertyRepository(this._dio);

  final Dio _dio;

  Future<PropertyDetail> get(String id) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/properties/$id');
        return PropertyDetail.fromJson(res.data!);
      });

  /// Catálogo disponible para el cliente (publicadas y disponibles).
  Future<List<PropertyDetail>> catalog() => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/properties', queryParameters: {'limit': 50, 'sort': 'recent'});
        return dataList(res.data, PropertyDetail.fromJson);
      });

  /// Inventario para el personal. Con [brokerId] solo las casas de ese broker.
  Future<List<PropertyDetail>> inventory({String? brokerId, String? q}) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/properties', queryParameters: {
          'limit': 100,
          'sort': 'updated',
          'brokerId': ?brokerId,
          if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
        });
        return dataList(res.data, PropertyDetail.fromJson);
      });

  Future<Dossier> dossier(String propertyId) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/properties/$propertyId/dossier');
        return Dossier.fromJson(res.data!);
      });
}
