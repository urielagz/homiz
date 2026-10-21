import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/network/api_client.dart';
import 'package:homiz/core/network/api_exception.dart';
import 'package:homiz/core/network/token_storage.dart';
import 'package:homiz/features/auth/data/repositories/auth_repository.dart';

import '../helpers.dart';

void main() {
  late MemoryTokenStorage storage;

  ProviderContainer container(FakeAdapter adapter) {
    final c = ProviderContainer(overrides: testOverrides(adapter: adapter, storage: storage));
    addTearDown(c.dispose);
    return c;
  }

  setUp(() => storage = MemoryTokenStorage()
    ..access = 'vencido'
    ..refresh = 'refresh-1');

  test('ante un 401 renueva una vez, guarda los tokens nuevos y repite la petición', () async {
    final adapter = FakeAdapter((o) {
      if (o.path == '/auth/refresh') return (200, {'accessToken': 'nuevo', 'refreshToken': 'refresh-2'});
      final auth = o.headers['Authorization'];
      return auth == 'Bearer nuevo' ? (200, lauraJson) : (401, apiError('UNAUTHENTICATED', 'Token vencido'));
    });
    final user = await container(adapter).read(authRepositoryProvider).me();

    expect(user.name, 'Laura Méndez');
    expect(storage.access, 'nuevo');
    expect(storage.refresh, 'refresh-2');
    expect(adapter.calls.map((c) => c.path), ['/users/me', '/auth/refresh', '/users/me']);
  });

  test('si la renovación falla borra la sesión y avisa que expiró', () async {
    final adapter = FakeAdapter((o) => (401, apiError('UNAUTHENTICATED', 'Sesión expirada')));
    final c = container(adapter);

    await expectLater(c.read(authRepositoryProvider).me(), throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)));
    expect(storage.access, isNull);
    expect(storage.refresh, isNull);
    expect(c.read(sessionExpiredProvider), 1);
  });

  test('si el reintento vuelve a dar 401 no se bloquea ni renueva de nuevo', () async {
    final adapter = FakeAdapter((o) {
      if (o.path == '/auth/refresh') return (200, {'accessToken': 'nuevo', 'refreshToken': 'refresh-2'});
      return (401, apiError('UNAUTHENTICATED', 'Sin acceso'));
    });

    await expectLater(container(adapter).read(authRepositoryProvider).me().timeout(const Duration(seconds: 2)), throwsA(isA<ApiException>()));
    expect(adapter.calls.where((c) => c.path == '/auth/refresh'), hasLength(1));
  });

  test('login y registro no envían el token ni intentan renovar', () async {
    final adapter = FakeAdapter((o) => (401, apiError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.')));

    await expectLater(
      container(adapter).read(authRepositoryProvider).login(email: 'a@b.com', password: 'x'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Correo o contraseña incorrectos.')),
    );
    expect(adapter.calls.single.headers['Authorization'], isNull);
  });

  test('sin conexión da un mensaje claro', () {
    expect(ApiException.from(Exception('x')).message, ApiException.unknownMessage);
    expect(const ApiException(code: 'NETWORK', message: ApiException.networkMessage).isNetwork, isTrue);
  });
}
