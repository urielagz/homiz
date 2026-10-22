import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/network/token_storage.dart';
import 'package:homiz/core/theme/app_text_styles.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../fixtures.dart';
import '../helpers.dart';

void main() {
  setUpAll(() async {
    AppFonts.useGoogleFonts = false;
    await initializeDateFormatting('es_MX');
  });

  FakeReply backend(RequestOptions o) => switch (o.path) {
        '/auth/login' => (o.data['password'] == 'Zugar2026!')
            ? (200, {'accessToken': 'a1', 'refreshToken': 'r1', 'user': lauraJson})
            : (401, apiError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.')),
        '/auth/register' => (409, apiError('VALIDATION_ERROR', 'Revisa los datos.', {'email': ['Ese correo ya está registrado.']})),
        _ => lauraBackend(o),
      };

  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pumpAndSettle();
  }

  testWidgets('sin sesión guardada muestra el login', (tester) async {
    await tester.pumpWidget(testApp(testOverrides(adapter: FakeAdapter((o) => backend(o)))));
    await settle(tester);

    expect(find.text('Iniciar sesión'), findsOneWidget);
    expect(find.text('Ingresar'), findsOneWidget);
    expect(find.text('Regístrate aquí'), findsOneWidget);
  });

  testWidgets('valida los campos antes de llamar a la API', (tester) async {
    final adapter = FakeAdapter((o) => backend(o));
    await tester.pumpWidget(testApp(testOverrides(adapter: adapter)));
    await settle(tester);

    await tester.tap(find.text('Ingresar'));
    await tester.pump();

    expect(find.text('Escribe tu correo electrónico.'), findsOneWidget);
    expect(find.text('Escribe tu contraseña.'), findsOneWidget);
    expect(adapter.calls.where((c) => c.path == '/auth/login'), isEmpty);
  });

  testWidgets('muestra el mensaje de la API si las credenciales son incorrectas', (tester) async {
    await tester.pumpWidget(testApp(testOverrides(adapter: FakeAdapter((o) => backend(o)))));
    await settle(tester);

    await tester.enterText(find.byType(TextFormField).at(0), 'lau.mendez@correo.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'otra');
    await tester.tap(find.text('Ingresar'));
    await settle(tester);

    expect(find.text('Correo o contraseña incorrectos.'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
  });

  testWidgets('al iniciar sesión entra a Inicio con saludo, contador y barra inferior', (tester) async {
    final storage = MemoryTokenStorage();
    await tester.pumpWidget(testApp(testOverrides(adapter: FakeAdapter((o) => backend(o)), storage: storage)));
    await settle(tester);

    await tester.enterText(find.byType(TextFormField).at(0), 'lau.mendez@correo.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'Zugar2026!');
    await tester.tap(find.text('Ingresar'));
    await settle(tester);

    expect(find.text('Hola, Laura'), findsOneWidget);
    expect(find.text('2'), findsOneWidget); // no leídas en la campana
    expect(find.bySemanticsLabel('Mi propiedad'), findsOneWidget);
    expect(storage.access, 'a1');

    await tester.tap(find.bySemanticsLabel('Citas'));
    await settle(tester);
    expect(find.text('Mis citas'), findsOneWidget);
    expect(find.text('Casa Las Palmas'), findsOneWidget);
  });

  testWidgets('con sesión guardada entra directo y cerrar sesión regresa al login', (tester) async {
    final storage = MemoryTokenStorage()
      ..access = 'a1'
      ..refresh = 'r1';
    await tester.pumpWidget(testApp(testOverrides(adapter: FakeAdapter((o) => backend(o)), storage: storage)));
    await settle(tester);
    expect(find.text('Hola, Laura'), findsOneWidget);

    await tester.tap(find.byTooltip('Mi perfil'));
    await settle(tester);
    expect(find.text('lau.mendez@correo.com'), findsOneWidget);

    // La lista del perfil es perezosa: se desplaza hasta que el botón exista
    await tester.dragUntilVisible(find.text('Cerrar sesión'), find.byType(ListView).first, const Offset(0, -250));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cerrar sesión'));
    await settle(tester);
    await tester.tap(find.widgetWithText(TextButton, 'Cerrar sesión'));
    await settle(tester);

    expect(find.text('Iniciar sesión'), findsOneWidget);
    expect(storage.access, isNull);
  });

  testWidgets('registro muestra el indicador de seguridad y los errores por campo de la API', (tester) async {
    await tester.pumpWidget(testApp(testOverrides(adapter: FakeAdapter((o) => backend(o)))));
    await settle(tester);
    await tester.ensureVisible(find.text('Regístrate aquí'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Regístrate aquí'));
    await settle(tester);
    expect(find.text('Crea tu cuenta'), findsOneWidget);

    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Laura Méndez');
    await tester.enterText(fields.at(1), 'lau.mendez@correo.com');
    await tester.enterText(fields.at(2), '998 123 4567');
    await tester.enterText(fields.at(3), 'zugar');
    await tester.pump();
    expect(find.textContaining('Débil'), findsOneWidget);

    await tester.enterText(fields.at(3), 'Zugar2026!');
    await tester.pump();
    expect(find.text('Muy segura'), findsOneWidget);

    await tester.ensureVisible(find.text('Crear cuenta'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Crear cuenta'));
    await settle(tester);
    expect(find.text('Ese correo ya está registrado.'), findsOneWidget);
  });
}
