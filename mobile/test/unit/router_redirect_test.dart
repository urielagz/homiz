import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/router/app_router.dart';
import 'package:homiz/features/appointments/presentation/providers/pending_visit_provider.dart';

void main() {
  const loading = AsyncLoading<Object?>();
  const signedOut = AsyncData<Object?>(null);
  const signedIn = AsyncData<Object?>('usuario');

  String? go(String location, AsyncValue<Object?> session, {bool splashDone = true}) =>
      sessionRedirect(splashDone: splashDone, session: session, location: location);

  test('mientras carga o dura la bienvenida se queda en /splash', () {
    expect(go('/home', loading), '/splash');
    expect(go('/splash', loading), isNull);
    expect(go('/login', signedOut, splashDone: false), '/splash');
  });

  test('un error de red también se queda en /splash (ahí está «Reintentar»)', () {
    expect(go('/home', AsyncError<Object?>(Exception('sin red'), StackTrace.empty)), '/splash');
  });

  test('sin sesión solo puede estar en login o registro', () {
    expect(go('/splash', signedOut), '/login');
    expect(go('/home', signedOut), '/login');
    expect(go('/profile', signedOut), '/login');
    expect(go('/login', signedOut), isNull);
    expect(go('/register', signedOut), isNull);
  });

  test('casa elegida en el sitio: sin sesión pide crear cuenta; al entrar abre su visita', () {
    String? visit(String location, AsyncValue<Object?> session) =>
        sessionRedirect(splashDone: true, session: session, location: location, pendingVisit: 'casa-ceiba');
    expect(visit('/splash', signedOut), '/register');
    expect(visit('/login', signedOut), isNull); // quien ya tiene cuenta puede iniciar sesión
    expect(visit('/register', signedIn), '/appointments/visit/casa-ceiba');
    expect(visit('/login', signedIn), '/appointments/visit/casa-ceiba');
    expect(visit('/splash', signedIn), '/appointments/visit/casa-ceiba');
    expect(visit('/appointments/visit/casa-ceiba', signedIn), isNull);
  });

  test('solo se acepta un slug válido en ?casa=', () {
    expect(visitSlugFromUri(Uri.parse('http://localhost:5600/?casa=casa-ceiba#/splash')), 'casa-ceiba');
    expect(visitSlugFromUri(Uri.parse('http://localhost:5600/')), isNull);
    expect(visitSlugFromUri(Uri.parse('http://localhost:5600/?casa=../x')), isNull);
  });

  test('con sesión las rutas de acceso llevan a /home', () {
    expect(go('/splash', signedIn), '/home');
    expect(go('/login', signedIn), '/home');
    expect(go('/register', signedIn), '/home');
    expect(go('/appointments', signedIn), isNull);
    expect(go('/notifications', signedIn), isNull);
  });
}
