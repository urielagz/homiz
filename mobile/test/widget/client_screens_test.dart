import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/widgets/primary_button.dart';
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

  testWidgets('Editar mi información: el formulario sale con lo que mandó y guarda los cambios', (tester) async {
    await startSignedIn(tester);
    await tester.dragUntilVisible(find.text('Mis solicitudes...'), find.byType(ListView).first, const Offset(0, -250));
    await tester.tap(find.text('Mis solicitudes...'));
    await settle(tester);
    await tester.tap(find.text('Quiero rentar · Z-10001'));
    await settle(tester);
    await tester.dragUntilVisible(find.text('Editar mi información'), find.byType(ListView).first, const Offset(0, -250));
    await tester.tap(find.text('Editar mi información'));
    await settle(tester);
    expect(find.text('Corrige lo que mandaste'), findsOneWidget);
    expect(find.text('Puerto Morelos'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Zona de preferencia'), 'Mérida, Yucatán');
    // Lo obligatorio que la solicitud de ejemplo no traía
    await tester.enterText(find.widgetWithText(TextFormField, 'Máximo (tu límite)'), '20000');
    await tester.enterText(find.widgetWithText(TextFormField, 'Nacionalidad'), 'Mexicana');
    await tester.enterText(find.widgetWithText(TextFormField, '¿En qué trabajas?'), 'Diseño');
    await tester.pump();
    tester.widget<PrimaryButton>(find.widgetWithText(PrimaryButton, 'Guardar cambios')).onPressed!();
    await settle(tester);
    expect(((sent['PATCH /requests/lead-1']! as Map)['payload'] as Map)['zona'], 'Mérida, Yucatán');
    expect(find.text('Guardamos tus cambios y le avisamos a tu asesor.'), findsOneWidget);
  });

  testWidgets('Mis solicitudes: respuesta del asesor y casas propuestas; «Busco casa» envía lo que busca', (tester) async {
    await startSignedIn(tester);
    await tester.dragUntilVisible(find.text('Mis solicitudes...'), find.byType(ListView).first, const Offset(0, -250));
    await tester.tap(find.text('Mis solicitudes...'));
    await settle(tester);
    expect(find.text('Quiero rentar · Z-10001'), findsOneWidget);
    expect(find.text('En seguimiento'), findsOneWidget);

    await tester.tap(find.text('Quiero rentar · Z-10001'));
    await settle(tester);
    // Todo lo que llenó, por secciones (el cliente no ve la sección de contacto)
    expect(find.text('Puerto Morelos'), findsOneWidget);
    expect(find.text('QUÉ BUSCA'), findsOneWidget);
    expect(find.text('CONTACTO'), findsNothing);
    final page = find.byType(ListView).first;
    // Mensajes con su asesor (en lugar del correo)
    await tester.dragUntilVisible(find.text('¿Qué días puedes visitar?'), page, const Offset(0, -250));
    await tester.dragUntilVisible(find.byTooltip('Enviar mensaje'), page, const Offset(0, -250));
    await tester.enterText(find.widgetWithText(TextField, 'Escribe a tu asesor'), 'El sábado en la mañana');
    await tester.tap(find.byTooltip('Enviar mensaje'));
    await settle(tester);
    expect((sent['POST /requests/lead-1/messages']! as Map)['body'], 'El sábado en la mañana');
    expect(find.textContaining('te conseguimos otra'), findsOneWidget);
    // Menú desplegable para elegir cuál visitar
    await tester.dragUntilVisible(find.text('¿Cuál quieres visitar?'), page, const Offset(0, -250));
    expect(find.text('Casa Ceiba'), findsOneWidget);

    await tester.tap(find.byType(BackButton));
    await settle(tester);
    await tester.tap(find.text('Nueva solicitud'));
    await settle(tester);
    // «¿Qué quieres hacer?»: el mismo formulario de Contáctanos
    expect(find.text('¿Qué quieres hacer?'), findsOneWidget);
    final form = find.byType(SingleChildScrollView).first;
    await tester.dragUntilVisible(find.text('Enviar solicitud'), form, const Offset(0, -300));
    await tester.ensureVisible(find.text('Enviar solicitud'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enviar solicitud'));
    await tester.pump();
    await tester.dragUntilVisible(find.text('Escribe la zona que buscas.'), form, const Offset(0, 300));
    await tester.enterText(find.widgetWithText(TextFormField, 'Zona de preferencia'), 'Mérida, Yucatán');
    await tester.enterText(find.widgetWithText(TextFormField, 'Mínimo'), '10000');
    await tester.enterText(find.widgetWithText(TextFormField, 'Máximo (tu límite)'), '15000');
    await tester.dragUntilVisible(find.widgetWithText(TextFormField, 'Nacionalidad'), form, const Offset(0, -300));
    await tester.enterText(find.widgetWithText(TextFormField, 'Nacionalidad'), 'Mexicana');
    await tester.enterText(find.widgetWithText(TextFormField, '¿En qué trabajas?'), 'Diseño');
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    await tester.drag(form, const Offset(0, -6000)); // hasta el botón, al final del formulario
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enviar solicitud'));
    await settle(tester);
    final body = sent['POST /requests']! as Map;
    expect(body['reason'], 'rentar');
    final payload = body['payload'] as Map;
    expect(payload['zona'], 'Mérida, Yucatán');
    // Los montos viajan como número
    expect(payload['presupuesto_min'], 10000);
    expect(payload['presupuesto_max'], 15000);
    expect(payload['presupuesto'], r'$10,000 – $15,000 MXN / mes');
    expect(payload['nacionalidad'], 'Mexicana');
    expect(payload['ocupacion'], 'Diseño');
    expect(payload['banos'], '2');
  });

  testWidgets('Inicio muestra próximo pago, próxima cita y reportes abiertos', (tester) async {
    await startSignedIn(tester);

    expect(find.text('Información'), findsOneWidget);
    expect(find.text('Próximo pago...'), findsOneWidget);
    expect(find.text('5 de noviembre'), findsWidgets); // la cita de prueba cae a 2 días y puede coincidir con el pago
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
    expect(find.text('Recibo'), findsNWidgets(2));
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
    expect(find.text('Isla Dorada'), findsWidgets);
    final page = find.byType(ListView).first;
    // Cita confirmada: la dirección exacta y el contacto de su asesor
    await tester.dragUntilVisible(find.text('Tu asesor'), page, const Offset(0, -200));
    await tester.dragUntilVisible(find.widgetWithText(KeyValueRow, r'$12,000/mes'), page, const Offset(0, -200));
    expect(find.widgetWithText(KeyValueRow, 'Sí, 1'), findsOneWidget);
    expect(find.widgetWithText(KeyValueRow, '3'), findsOneWidget);
    await tester.dragUntilVisible(find.text('Sí, ahí estaré. Gracias'), page, const Offset(0, -200));
    await tester.dragUntilVisible(find.widgetWithText(TextField, 'Escribe un mensaje...'), page, const Offset(0, -200));

    await tester.enterText(find.widgetWithText(TextField, 'Escribe un mensaje...'), '¿Puedo llegar 10 minutos antes?');
    await tester.ensureVisible(find.byTooltip('Enviar mensaje'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Enviar mensaje'));
    await settle(tester);
    expect(sent['POST /appointments/$appointmentId/messages'], {'body': '¿Puedo llegar 10 minutos antes?'});
    expect(find.text('¿Puedo llegar 10 minutos antes?'), findsOneWidget);

    await tester.dragUntilVisible(find.text('Cancelar cita'), page, const Offset(0, -200));
    await tester.ensureVisible(find.text('Cancelar cita'));
    await tester.pumpAndSettle();
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

    await tester.dragUntilVisible(find.text('Editar mis datos'), find.byType(ListView).first, const Offset(0, -200));
    await tester.ensureVisible(find.text('Editar mis datos'));
    await tester.pumpAndSettle();
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
