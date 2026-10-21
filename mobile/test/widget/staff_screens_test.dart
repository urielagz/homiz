import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/network/token_storage.dart';
import 'package:homiz/core/theme/app_text_styles.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../fixtures.dart';
import '../helpers.dart';
import '../staff_fixtures.dart';

/// Punto 13 · Vistas del personal con un backend simulado (Mariana, broker).
void main() {
  setUpAll(() async {
    AppFonts.useGoogleFonts = false;
    await initializeDateFormatting('es_MX');
  });

  late Map<String, Object?> sent;

  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pumpAndSettle();
  }

  Future<void> start(WidgetTester tester, {Map<String, Object?> user = marianaJson}) async {
    sent = {};
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    final storage = MemoryTokenStorage()
      ..access = 'a1'
      ..refresh = 'r1';
    await tester.pumpWidget(testApp(testOverrides(adapter: FakeAdapter((o) => staffBackend(o, log: sent, user: user)), storage: storage)));
    await settle(tester);
  }

  /// Las listas son perezosas: se desplaza hasta que el elemento exista y se vea.
  Future<void> scrollTo(WidgetTester tester, Finder finder) async {
    await tester.dragUntilVisible(finder, find.byType(ListView).first, const Offset(0, -250));
    await tester.pumpAndSettle();
  }

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await scrollTo(tester, finder);
    await tester.tap(finder);
    await settle(tester);
  }

  testWidgets('Inicio del personal: tarjetas de pendientes y resumen', (tester) async {
    await start(tester);

    expect(find.text('Hola, Mariana'), findsOneWidget);
    expect(find.text('Pendientes'), findsOneWidget);
    expect(find.text('Citas por confirmar...'), findsOneWidget);
    expect(find.text('2 citas'), findsOneWidget);
    expect(find.text('Pagarés vencidos...'), findsOneWidget);
    expect(find.text('1 pagaré'), findsOneWidget);
    expect(find.text('Reportes nuevos...'), findsOneWidget);
    await scrollTo(tester, find.text('Directorio de proveedores'));
    expect(find.text('Solicitudes nuevas del sitio'), findsOneWidget);
    expect(find.text('Directorio de proveedores'), findsOneWidget);
  });

  testWidgets('Pagarés vencidos: registrar pago con folio', (tester) async {
    await start(tester);
    await tester.tap(find.text('Pagarés vencidos...'));
    await settle(tester);

    expect(find.text('Pagaré 11 - 1 oct'), findsOneWidget);
    expect(find.text('Jorge Pech · Casa Olivo'), findsOneWidget);

    await tester.tap(find.text('Registrar pago'));
    await settle(tester);
    expect(find.text(r'$18,000'), findsWidgets);

    // El último «Registrar pago» es el botón de la hoja.
    await tester.tap(find.text('Registrar pago').last);
    await tester.pump();
    expect(find.text('Escribe el folio del recibo.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Folio del recibo'), 'F-00125');
    await tester.tap(find.text('Registrar pago').last);
    await settle(tester);

    final body = sent['POST /promissory-notes/$overdueNoteId/payments']! as Map;
    expect(body['amount'], 18000);
    expect(body['receiptFolio'], 'F-00125');
    expect(find.text('Pago registrado. Avisamos al cliente.'), findsOneWidget);
  });

  testWidgets('Sin el permiso payments.register no aparece «Registrar pago»', (tester) async {
    await start(tester, user: limitedStaffJson);
    await tester.tap(find.text('Pagarés vencidos...'));
    await settle(tester);

    expect(find.text('Pagaré 11 - 1 oct'), findsOneWidget);
    expect(find.text('Registrar pago'), findsNothing);
  });

  testWidgets('Agenda: confirmar una cita por confirmar', (tester) async {
    await start(tester);
    await tester.tap(find.bySemanticsLabel('Citas'));
    await settle(tester);

    expect(find.text('Por confirmar'), findsWidgets);
    expect(find.text('Casa Ceiba'), findsOneWidget);
    expect(find.text('Laura Medina'), findsOneWidget);

    await tester.tap(find.text('Casa Ceiba'));
    await settle(tester);
    expect(find.text('Cita - Casa Ceiba'), findsOneWidget);
    expect(find.text('Cliente'), findsOneWidget);
    expect(find.text('998 555 0128'), findsOneWidget);
    expect(find.text('Llamar'), findsOneWidget);
    expect(find.text('Mis Datos'), findsNothing);

    await tapVisible(tester, find.text('Confirmar cita'));
    expect(sent.containsKey('POST /appointments/$pendingId/confirm'), isTrue);
    expect(find.text('Cita confirmada. Avisamos al cliente.'), findsOneWidget);
  });

  testWidgets('Agenda: rechazar pide el motivo', (tester) async {
    await start(tester);
    await tester.tap(find.bySemanticsLabel('Citas'));
    await settle(tester);
    await tester.tap(find.text('Casa Ceiba'));
    await settle(tester);

    await tapVisible(tester, find.text('Rechazar'));
    await tester.enterText(find.byType(TextField).last, 'La casa ya se rentó.');
    await tester.tap(find.widgetWithText(TextButton, 'Rechazar'));
    await settle(tester);
    expect(sent['POST /appointments/$pendingId/reject'], {'reason': 'La casa ya se rentó.'});
  });

  testWidgets('Propiedades: lista y ficha con inquilino y asesor', (tester) async {
    await start(tester);
    await tester.tap(find.bySemanticsLabel('Mi propiedad'));
    await settle(tester);

    expect(find.text('Propiedades'), findsOneWidget);
    expect(find.text('Casa Las Palmas'), findsOneWidget);
    expect(find.text('ZUG-003 · Cumbres'), findsOneWidget);
    // La broker solo pide sus casas.
    expect((sent['GET /properties']! as Map)['brokerId'], marianaJson['id']);

    await tester.tap(find.text('Casa Las Palmas'));
    await settle(tester);
    expect(find.text('Inquilino'), findsOneWidget);
    expect(find.text('Laura Mendez'), findsOneWidget);
    expect(find.text('Asesor responsable'), findsOneWidget);

    await tester.tap(find.text('Pagos'));
    await settle(tester);
    expect(find.text('Estado de pagos'), findsOneWidget);
    expect(find.text('Registrar pago'), findsOneWidget); // solo el pagaré 05 está pendiente
  });

  testWidgets('Mantenimiento: UpdateStatusSheet cambia estado y asigna proveedor', (tester) async {
    await start(tester);
    await tester.tap(find.text('Reportes nuevos...'));
    await settle(tester);
    expect(find.text('Fuga en el baño'), findsOneWidget);

    await tester.tap(find.text('Fuga en el baño'));
    await settle(tester);
    await tapVisible(tester, find.text('Actualizar estado'));

    expect(find.text('En revisión'), findsWidgets); // sugerencia: reportado → en revisión
    await tester.tap(find.text('Sin proveedor'));
    await settle(tester);
    await tester.tap(find.text('Plomería Caribe · Plomería').last);
    await settle(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Comentario para el cliente'), 'El plomero irá el lunes.');
    await tester.tap(find.text('Guardar cambio'));
    await settle(tester);

    expect(sent['POST /maintenance-reports/$reportOpenId/updates'], {'status': 'in_review', 'comment': 'El plomero irá el lunes.', 'providerId': 'prov-1'});
  });

  testWidgets('Directorio de proveedores con Llamar y Correo', (tester) async {
    await start(tester);
    await tapVisible(tester, find.text('Directorio de proveedores'));

    expect(find.text('Plomería Caribe'), findsOneWidget);
    expect(find.text('Electro Sur'), findsOneWidget);
    expect(find.text('Llamar'), findsNWidgets(2));
    expect(find.text('Correo'), findsOneWidget); // Electro Sur no tiene correo
  });
}
