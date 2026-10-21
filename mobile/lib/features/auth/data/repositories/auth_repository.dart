import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/network/token_storage.dart';
import '../models/app_user.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(dioProvider), ref.watch(tokenStorageProvider)),
);

/// Llamadas de autenticación y perfil propio.
class AuthRepository {
  AuthRepository(this._dio, this._storage);

  final Dio _dio;
  final TokenStorage _storage;

  Future<T> _call<T>(Future<T> Function() fn) async {
    try {
      return await fn();
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<AppUser> _startSession(Map<String, dynamic> data) async {
    await _storage.save(access: data['accessToken'] as String, refresh: data['refreshToken'] as String);
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<bool> hasStoredSession() async => (await _storage.readAccess()) != null;

  Future<AppUser> login({required String email, required String password}) => _call(() async {
        final res = await _dio.post<Map<String, dynamic>>('/auth/login', data: {'email': email.trim(), 'password': password});
        return _startSession(res.data!);
      });

  /// Crea una cuenta de cliente.
  Future<AppUser> register({required String name, required String email, required String phone, required String password}) => _call(() async {
        final res = await _dio.post<Map<String, dynamic>>('/auth/register', data: {
          'name': name.trim(),
          'email': email.trim(),
          'phone': phone.trim(),
          'password': password,
        });
        return _startSession(res.data!);
      });

  Future<AppUser> me() => _call(() async {
        final res = await _dio.get<Map<String, dynamic>>('/users/me');
        return AppUser.fromJson(res.data!);
      });

  Future<AppUser> updateProfile({String? name, String? phone, String? birthDate}) => _call(() async {
        final res = await _dio.patch<Map<String, dynamic>>('/users/me', data: {
          if (name != null) 'name': name.trim(),
          if (phone != null) 'phone': phone.trim(),
          'birthDate': ?birthDate,
        });
        return AppUser.fromJson(res.data!);
      });

  Future<String> changePassword({required String current, required String next}) => _call(() async {
        final res = await _dio.post<Map<String, dynamic>>('/auth/change-password', data: {'currentPassword': current, 'newPassword': next});
        return res.data?['message'] as String? ?? 'Tu contraseña se actualizó.';
      });

  Future<String> forgotPassword(String email) => _call(() async {
        final res = await _dio.post<Map<String, dynamic>>('/auth/forgot-password', data: {'email': email.trim()});
        return res.data?['message'] as String? ?? '';
      });

  /// Cierra la sesión en la API (si no hay red, igual se borra la sesión local).
  Future<void> logout() async {
    final refresh = await _storage.readRefresh();
    try {
      if (refresh != null) await _dio.post<void>('/auth/logout', data: {'refreshToken': refresh});
    } on DioException {
      // Sin conexión o token ya inválido: la sesión local se borra de todas formas.
    } finally {
      await _storage.clear();
    }
  }
}
