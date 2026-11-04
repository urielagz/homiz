import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/router/app_router.dart';
import 'package:homiz/features/appointments/presentation/providers/pending_visit_provider.dart';
import 'package:homiz/features/auth/presentation/providers/site_link_provider.dart';

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

  test('entró con la contraseña temporal: todo lleva a «Crea tu contraseña» hasta crearla', () {
    String? temp(String location, {bool must = true}) => sessionRedirect(splashDone: true, session: signedIn, location: location, mustChangePassword: must);
    expect(temp('/login'), '/create-password');
    expect(temp('/home'), '/create-password');
    expect(temp('/appointments'), '/create-password');
    expect(temp('/create-password'), isNull);
    // Ya la creó: sale a su inicio
    expect(temp('/create-password', must: false), '/home');
  });

  test('enlace del correo (?reset=): sin sesión va a «Crea tu contraseña»; al entrar ve sus solicitudes', () {
    String? link(String location, AsyncValue<Object?> session) =>
        sessionRedirect(splashDone: true, session: session, location: location, resetLink: true, fromSite: true);
    expect(link('/splash', signedOut), '/reset');
    expect(link('/reset', signedOut), isNull);
    expect(link('/login', signedOut), isNull);
    expect(link('/reset', signedIn), '/home/requests');
    expect(sessionRedirect(splashDone: true, session: signedIn, location: '/login', fromSite: true), '/home/requests');
  });

  test('solo se aceptan un código y un correo válidos en el enlace', () {
    final ok = SiteLink.fromUri(Uri.parse('http://localhost:5600/?reset=abcDEF123_-abcdefghij&email=Ana%40Correo.com'));
    expect(ok.resetToken, 'abcDEF123_-abcdefghij');
    expect(ok.email, 'ana@correo.com');
    expect(ok.fromSite, isTrue);
    final bad = SiteLink.fromUri(Uri.parse('http://localhost:5600/?reset=<script>&email=no-es-correo'));
    expect(bad.resetToken, isNull);
    expect(bad.email, isNull);
    expect(SiteLink.fromUri(Uri.parse('http://localhost:5600/')).fromSite, isFalse);
  });

  test('solo se acepta un slug válido en ?casa=', () {
    expect(visitSlugFromUri(Uri.parse('http://localhost:5600/?casa=casa-ceiba#/splash')), 'casa-ceiba');
    expect(visitSlugFromUri(Uri.parse('http://localhost:5600/')), isNull);
    expect(visitSlugFromUri(Uri.parse('http://localhost:5600/?casa=../x')), isNull);
  });

  test('QR sin datos (?empezar=1): al entrar, «¿Qué quieres hacer?» con su casa si la hay', () {
    expect(SiteLink.fromUri(Uri.parse('http://localhost:5600/?empezar=1&casa=casa-ceiba')).start, isTrue);
    expect(sessionRedirect(splashDone: true, session: signedIn, location: '/login', start: true), '/home/requests/new?bienvenida=1');
    expect(sessionRedirect(splashDone: true, session: signedIn, location: '/register', start: true, pendingVisit: 'casa-ceiba'),
        '/home/requests/new?bienvenida=1&casa=casa-ceiba');
    // Sin sesión, con casa se pide crear cuenta (o entrar con la contraseña temporal)
    expect(sessionRedirect(splashDone: true, session: signedOut, location: '/splash', start: true, pendingVisit: 'casa-ceiba'), '/register');
  });

  test('con sesión las rutas de acceso llevan a /home', () {
    expect(go('/splash', signedIn), '/home');
    expect(go('/login', signedIn), '/home');
    expect(go('/register', signedIn), '/home');
    expect(go('/appointments', signedIn), isNull);
    expect(go('/notifications', signedIn), isNull);
  });
}
