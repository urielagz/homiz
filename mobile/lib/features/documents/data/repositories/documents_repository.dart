import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/network/api_call.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_exception.dart';

final documentsRepositoryProvider = Provider<DocumentsRepository>((ref) => DocumentsRepository(ref.watch(dioProvider), ref.watch(httpAdapterProvider)));

/// URL firmadas de lectura y subida de fotos de mantenimiento.
class DocumentsRepository {
  DocumentsRepository(this._dio, HttpClientAdapter? adapter) : _upload = Dio() {
    if (adapter != null) _upload.httpClientAdapter = adapter;
  }

  final Dio _dio;

  /// Cliente sin token para el PUT a la URL firmada (la firma ya autoriza).
  final Dio _upload;

  /// URL firmada (15 min) para ver un documento visible para el cliente.
  Future<String> downloadUrl(String documentId) => apiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/documents/$documentId/download-url');
        return res.data!['url'] as String;
      });

  static String mimeOf(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.pdf')) return 'application/pdf';
    return 'image/jpeg';
  }

  /// Sube una foto de mantenimiento: pide la URL, hace el PUT y devuelve el `storageKey`.
  Future<String> uploadMaintenancePhoto(String propertyId, XFile file) => apiCall(() async {
        final bytes = await file.readAsBytes();
        final mime = mimeOf(file.name);
        final res = await _dio.post<Map<String, dynamic>>('/documents/upload-url', data: {
          'propertyId': propertyId,
          'purpose': 'maintenance_photo',
          'mime': mime,
          'size': bytes.length,
        });
        final upload = res.data!['upload'] as Map<String, dynamic>;
        try {
          await _upload.put<void>(
            upload['url'] as String,
            data: Stream.fromIterable([bytes]),
            options: Options(headers: {...(upload['headers'] as Map? ?? {}), Headers.contentLengthHeader: bytes.length}),
          );
        } on DioException catch (e) {
          if (e.response == null) rethrow;
          throw const ApiException(code: 'UPLOAD_FAILED', message: 'No se pudo subir una de las fotos. Intenta de nuevo.');
        }
        return res.data!['storageKey'] as String;
      });
}
