import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/network/token_storage.dart';
import 'package:homiz/core/theme/app_text_styles.dart';
import 'package:homiz/core/widgets/cards.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Pantallas 4–12 del cliente con los datos del seed (Laura, Casa Las Palmas) y un backend simulado.
void main() {
  setUpAll(() async {
    AppFonts.useGoogleFonts = false;
    await initializeDateFormatting('es_MX');
  });

  late Map<String, Object?> sent;
  late FakeAdapter adapter;

  Future<void> startSignedIn(WidgetTester tester) async {
    sent = {};
    adapter = FakeAdapter((o) => lauraBackend(o, log: sent));
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    final storage = MemoryTokenStorage()
      ..access = 'a1'
      ..refresh = 'r1';
    await tester.pumpWidget(testApp(testOverrides(adapter: adapter, storage: storage)));
    await tester.pump();
    await tester.pumpAndSettle();
  }

  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pumpAndSettle();
  }

  testWidgets('Inicio muestra próximo pago, próxima cita y reportes abiertos', (tester) async {
    await startSignedIn(tester);

    expect(find.text('Información'), findsOneWidget);
    expect(find.text('Próximo pago...'), findsOneWidget);
    expect(find.text('5 de noviembre'), findsOneWidget);
    expect(find.textContaining(r'$12,000 · Pagaré 05'), findsOneWidget);
    expect(find.text('Próxima cita...'), findsOneWidget);
    expect(find.text('Reportes abiertos...'), findsOneWidget);
    expect(find.textContaining('Fuga en el baño'), findsOneWidget);

    // «Próximo pago» abre Mi propiedad › Pagos.
    await tester.tap(find.text('Próximo pago...'));
    await settle(tester);
    expect(find.text('Estado de pagos'), findsOneWidget);
  });

  testWidgets('Pagos: resumen, pagarés y recibos', (tester) async {
    await startSignedIn(tester);
    await tester.tap(find.bySemanticsLabel('Mi propiedad'));
    await settle(tester);
    await tester.tap(find.text('Pagos'));
    await settle(tester);

    expect(find.text(r'Te faltan 8 pagarés ● $96,000'), findsOneWidget);
    expect(find.text('Pagados 4 de 12 ● Próximo: 5 nov'), findsOneWidget);
    expect(find.text('Esta información solo es para consulta, los pagos se realizan en persona con efectivo.'), findsOneWidget);
    expect(find.text('Pagaré 05 - 5 nov'), findsOneWidget);
    expect(find.text('Pendiente'), findsWidgets);
    expect(find.text('Comprobante'), findsNWidgets(2));
    expect(find.text('Pagado'), findsNWidgets(2));

    await tester.tap(find.text('Fichas de cobro / Recibos'));
    await settle(tester);
    expect(find.text('Recibo de luz'), findsOneWidget);
    expect(find.textContaining('Periodo sep-oct'), findsOneWidget);
    expect(find.text('Recibo de agua'), findsOneWidget);
    expect(find.text('Ver'), findsOneWidget);
  });

  testWidgets('Resumen y Expediente de Mi propiedad', (tester) async {
    await startSignedIn(tester);
    await tester.tap(find.bySemanticsLabel('Mi propiedad'));
    await settle(tester);

    expect(find.text('Casa Las Palmas'), findsOneWidget);
    expect(find.text('Cancún, Isla Dorada'), findsOneWidget);
    expect(find.text('5 habitaciones'), findsOneWidget);
    expect(find.text('3 baños'), findsOneWidget);
    expect(find.text('Alberca'), findsOneWidget);
    expect(find.textContaining('vigente hasta 30 de junio de 2027'), findsOneWidget);

    await tester.tap(find.text('Expediente'));
    await settle(tester);
    expect(find.text('Contrato de renta'), findsOneWidget);
    expect(find.text('Vigente hasta 30 jun 2027'), findsOneWidget);
    expect(find.text('Reglamento y anexos - 3 archivos'), findsOneWidget);
    expect(find.text('Ver'), findsNWidgets(2));
  });

  testWidgets('Mantenimiento: reportes abiertos, ficha e historial', (tester) async {
    await startSignedIn(tester);
    await tester.tap(find.text('Reportes abiertos...'));
    await settle(tester);

    expect(find.text('Nuevo reporte'), findsOneWidget);
    expect(find.text('Plomería - prioridad alta'), findsOneWidget);
    expect(find.text('En reparación'), findsWidgets);
    expect(find.text('Ficha de mantenimiento.'), findsOneWidget);
    expect(find.text('Foco de la sala'), findsNothing);

    await tester.tap(find.text('Historial'));
    await settle(tester);
    expect(find.text('Historial de reportes'), findsOneWidget);
    expect(find.text('Foco de la sala'), findsOneWidget);
    expect(find.text('Resuelto el 12 de octubre'), findsOneWidget);
    expect(find.text('Fotos antes'), findsOneWidget);
    expect(find.text('Fotos después'), findsOneWidget);
  });

  testWidgets('Nuevo reporte valida, envía y abre el seguimiento', (tester) async {
    await startSignedIn(tester);
    await tester.tap(find.text('Reportes abiertos...'));
    await settle(tester);
    await tester.tap(find.text('Nuevo reporte'));
    await settle(tester);

    await tester.tap(find.text('Enviar reporte'));
    await tester.pump();
    expect(find.text('Escribe un título breve.'), findsOneWidget);
    expect(find.text('Elige una categoría.'), findsOneWidget);
    expect(sent.containsKey('POST /maintenance-reports'), isFalse);

    await tester.enterText(find.byType(TextFormField).at(0), 'Puerta del patio');
    await tester.tap(find.text('Categoría'));
    await settle(tester);
    await tester.tap(find.text('Cerrajería').last);
    await settle(tester);
    await tester.tap(find.text('Alta'));
    await tester.enterText(find.byType(TextFormField).last, 'La chapa no cierra desde ayer.');
    await tester.ensureVisible(find.text('Enviar reporte'));
    await tester.tap(find.text('Enviar reporte'));
    await settle(tester);

    expect(sent['POST /maintenance-reports'], {
      'propertyId': propertyId,
      'title': 'Puerta del patio',
      'description': 'La chapa no cierra desde ayer.',
      'category': 'Cerrajería',
      'priority': 'high',
      'photos': <String>[],
    });
    expect(find.text('Seguimiento'), findsOneWidget);
    expect(find.text('Plomería Caribe cambiará la llave de paso el lunes.'), findsOneWidget);
  });

  testWidgets('Detalle de cita: mis datos, chat y cancelar', (tester) async {
    await startSignedIn(tester);
    await tester.tap(find.bySemanticsLabel('Citas'));
    await settle(tester);
    await tester.tap(find.text('Casa Las Palmas'));
    await settle(tester);

    expect(find.text('Cita - Casa Las Palmas'), findsOneWidget);
    expect(find.text('Confirmada'), findsOneWidget);
    expect(find.text('Isla Dorada'), findsOneWidget);
    expect(find.widgetWithText(KeyValueRow, r'$12,000/mes'), findsOneWidget);
    expect(find.widgetWithText(KeyValueRow, 'Sí, 1'), findsOneWidget);
    expect(find.widgetWithText(KeyValueRow, '3'), findsOneWidget);
    expect(find.text('Sí, ahí estaré. Gracias'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Escribe un mensaje...'), '¿Puedo llegar 10 minutos antes?');
    await tester.ensureVisible(find.byTooltip('Enviar mensaje'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Enviar mensaje'));
    await settle(tester);
    expect(sent['POST /appointments/$appointmentId/messages'], {'body': '¿Puedo llegar 10 minutos antes?'});
    expect(find.text('¿Puedo llegar 10 minutos antes?'), findsOneWidget);

    expect(find.text('Escribir por WhatsApp'), findsOneWidget);
    await tester.ensureVisible(find.text('Cancelar cita'));
    await tester.tap(find.text('Cancelar cita'));
    await settle(tester);
    await tester.tap(find.widgetWithText(TextButton, 'Cancelar cita'));
    await settle(tester);
    expect(sent.containsKey('POST /appointments/$appointmentId/cancel'), isTrue);
  });

  testWidgets('Editar mis datos envía el expediente a /users/me', (tester) async {
    await startSignedIn(tester);
    await tester.tap(find.bySemanticsLabel('Citas'));
    await settle(tester);
    await tester.tap(find.text('Casa Las Palmas'));
    await settle(tester);

    await tester.ensureVisible(find.text('Editar mis datos'));
    await tester.tap(find.text('Editar mis datos'));
    await settle(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Presupuesto mensual'), '15000');
    await tester.enterText(find.widgetWithText(TextFormField, 'Inquilinos (personas que vivirán en la casa)'), '4');
    await tester.tap(find.text('Guardar'));
    await settle(tester);

    expect(sent['PATCH /users/me'], {
      'client': {'budgetAmount': 15000.0, 'hasPets': true, 'petsCount': 1, 'occupants': 4},
    });
    expect(find.widgetWithText(KeyValueRow, r'$15,000/mes'), findsOneWidget);
    expect(find.widgetWithText(KeyValueRow, '4'), findsOneWidget);
  });

  testWidgets('Notificaciones: tocar una la marca como leída y abre la pantalla', (tester) async {
    await startSignedIn(tester);
    await tester.tap(find.byTooltip('Notificaciones, 2 sin leer'));
    await settle(tester);

    expect(find.text('Tu reporte está en reparación'), findsOneWidget);
    expect(find.text('Cita confirmada'), findsOneWidget);

    await tester.tap(find.text('Cita confirmada'));
    await settle(tester);
    expect(sent.containsKey('PATCH /notifications/not2/read'), isTrue);
    expect(find.text('Cita - Casa Las Palmas'), findsOneWidget);
  });
}
