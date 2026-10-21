import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/network/token_storage.dart';

/// Almacenamiento que falla, como el cifrado en un navegador sin WebCrypto (web servida por IP sin HTTPS).
class _Broken implements TokenStorage {
  @override
  Future<String?> readAccess() => throw UnsupportedError('sin WebCrypto');
  @override
  Future<String?> readRefresh() => throw UnsupportedError('sin WebCrypto');
  @override
  Future<void> save({required String access, required String refresh}) => throw UnsupportedError('sin WebCrypto');
  @override
  Future<void> clear() => throw UnsupportedError('sin WebCrypto');
}

void main() {
  test('si el almacenamiento cifrado falla, la sesión sigue en memoria', () async {
    final s = FallbackTokenStorage(_Broken());
    expect(await s.readAccess(), isNull);
    await s.save(access: 'a1', refresh: 'r1');
    expect(await s.readAccess(), 'a1');
    expect(await s.readRefresh(), 'r1');
    await s.clear();
    expect(await s.readAccess(), isNull);
  });

  test('si funciona, usa el almacenamiento principal', () async {
    final primary = MemoryTokenStorage();
    final s = FallbackTokenStorage(primary);
    await s.save(access: 'a1', refresh: 'r1');
    expect(primary.access, 'a1');
  });
}
