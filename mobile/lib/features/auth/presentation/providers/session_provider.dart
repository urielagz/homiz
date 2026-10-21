import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_exception.dart';
import '../../data/models/app_user.dart';
import '../../data/repositories/auth_repository.dart';

/// Sesión actual: null = sin sesión. Al arrancar intenta recuperar la sesión guardada.
final sessionProvider = AsyncNotifierProvider<SessionController, AppUser?>(SessionController.new);

/// Duración mínima de la pantalla de bienvenida.
final splashDelayProvider = FutureProvider<void>((ref) => Future<void>.delayed(const Duration(milliseconds: 1400)));

class SessionController extends AsyncNotifier<AppUser?> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  Future<AppUser?> build() async {
    // Si la renovación del token falla, la sesión termina y el router regresa al login.
    ref.listen(sessionExpiredProvider, (_, _) => state = const AsyncData(null));
    if (!await _repo.hasStoredSession()) return null;
    try {
      return await _repo.me();
    } on ApiException catch (e) {
      if (e.isNetwork) rethrow; // la bienvenida muestra «Reintentar»
      await ref.read(tokenStorageProvider).clear();
      return null;
    }
  }

  /// Los errores se propagan a la pantalla (mensaje de la API).
  Future<void> login(String email, String password) async {
    final user = await _repo.login(email: email, password: password);
    state = AsyncData(user);
  }

  Future<void> register({required String name, required String email, required String phone, required String password}) async {
    final user = await _repo.register(name: name, email: email, phone: phone, password: password);
    state = AsyncData(user);
  }

  Future<void> refreshUser() async {
    state = AsyncData(await _repo.me());
  }

  void updateUser(AppUser user) => state = AsyncData(user);

  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncData(null);
  }

  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(build);
  }
}
