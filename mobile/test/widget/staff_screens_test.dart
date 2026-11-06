import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/network/token_storage.dart';
import 'package:homiz/core/theme/app_text_styles.dart';
import 'package:homiz/core/widgets/primary_button.dart';
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
    expect(find.text('Reportes abiertos...'), findsOneWidget);
    await scrollTo(tester, find.text('Directorio de proveedores'));
    expect(find.text('Solicitudes nuevas del sitio'), findsOneWidget);
    expect(find.text('Directorio de proveedores'), findsOneWidget);
  });

  testWidgets('Pagarés vencidos: registrar pago (el folio lo genera el servidor)', (tester) async {
    await start(tester);
    await tester.tap(find.text('Pagarés vencidos...'));
    await settle(tester);

    expect(find.text('Pagaré 11 - 1 oct'), findsOneWidget);
    expect(find.text('Jorge Pech · Casa Olivo'), findsOneWidget);

    await tester.tap(find.text('Registrar pago'));
    await settle(tester);
    expect(find.text(r'$18,000'), findsWidgets);

    // En el mismo paso: el recibo se genera solo y se adjuntan el PDF del pagaré y la foto del sello
    expect(find.textContaining('El recibo se genera solo como pagado'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Folio del recibo'), findsNothing);
    expect(find.text('Adjuntar PDF del pagaré'), findsOneWidget);
    expect(find.text('Foto del sello'), findsOneWidget);

    await tapVisible(tester, find.widgetWithText(PrimaryButton, 'Marcar como pagado'));
    await settle(tester);

    final body = sent['POST /promissory-notes/$overdueNoteId/payments']! as Map;
    expect(body['amount'], 18000);
    expect(body.containsKey('receiptFolio'), isFalse);
    expect(find.text('Pagaré 11 quedó pagado (folio REC-ZUG-005-11). Avisamos al cliente.'), findsOneWidget);
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
    final page = find.byType(ListView).first;
    await tester.dragUntilVisible(find.text('Prospecto'), page, const Offset(0, -200));
    await tester.dragUntilVisible(find.text('998 555 0128'), page, const Offset(0, -200));
    expect(find.text('Llamar'), findsOneWidget);
    expect(find.text('Mis Datos'), findsNothing);

    // El botón y el diálogo muestran el día y la hora que se confirman
    await tapVisible(tester, find.textContaining(RegExp(r'^Confirmar \w')));
    expect(find.text('¿Confirmar la visita?'), findsOneWidget);
    expect(find.textContaining('Casa Ceiba con Laura Medina'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Confirmar'));
    await settle(tester);
    expect(sent.containsKey('POST /appointments/$pendingId/confirm'), isTrue);
    expect(find.textContaining('Cita confirmada para el'), findsOneWidget);
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
    await tester.tap(find.bySemanticsLabel('Propiedades'));
    await settle(tester);

    expect(find.text('Propiedades'), findsWidgets); // título y barra inferior
    expect(find.text('Casa Las Palmas'), findsOneWidget);
    expect(find.text('ZUG-003 · Cumbres'), findsOneWidget);
    // La broker pide todo el inventario: ve las suyas y las disponibles de los demás
    expect((sent['GET /properties']! as Map)['brokerId'], isNull);

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

  Future<void> openProperty(WidgetTester tester, String tab, {Map<String, Object?> user = marianaJson}) async {
    await start(tester, user: user);
    await tester.tap(find.bySemanticsLabel('Propiedades'));
    await settle(tester);
    await tester.tap(find.text('Casa Las Palmas'));
    await settle(tester);
    await tester.tap(find.text(tab));
    await settle(tester);
  }

  testWidgets('Pagos por rol: la broker edita pagarés pero no corrige ni anula pagos', (tester) async {
    await openProperty(tester, 'Pagos');
    // Pagaré pendiente: registrar y editar.
    await tester.tap(find.text('Pagaré 05 - 5 nov'));
    await settle(tester);
    expect(find.text('Registrar pago'), findsWidgets);
    expect(find.text('Editar pagaré'), findsOneWidget);
    expect(find.text('Anular pago'), findsNothing);
    await tester.tap(find.text('Editar pagaré'));
    await settle(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Monto (MXN)'), '12500');
    await tester.tap(find.text('Guardar cambios'));
    await settle(tester);
    expect((sent['PATCH /promissory-notes/n5']! as Map)['amount'], 12500);
    expect(find.text('Pagaré actualizado.'), findsOneWidget);

    // Pagaré pagado: la broker solo puede ver el comprobante.
    await tester.tap(find.text('Pagaré 04 - 5 oct'));
    await settle(tester);
    expect(find.text('Ver recibo'), findsOneWidget);
    expect(find.text('Corregir pago'), findsNothing);
    expect(find.text('Anular pago'), findsNothing);
  });

  testWidgets('Pagos por rol: administración anula un pago con motivo', (tester) async {
    await openProperty(tester, 'Pagos', user: ownerJson);
    await tester.tap(find.text('Pagaré 04 - 5 oct'));
    await settle(tester);
    expect(find.text('Corregir pago'), findsOneWidget);
    await tester.tap(find.text('Anular pago'));
    await settle(tester);
    await tester.tap(find.text('Sí, anular pago'));
    await tester.pump();
    expect(find.text('Explica por qué se anula el pago (al menos 5 letras).'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la anulación'), 'Se registró en el pagaré equivocado.');
    await tester.tap(find.text('Sí, anular pago'));
    await settle(tester);
    expect((sent['POST /promissory-notes/n4/payments/p4/void']! as Map)['reason'], 'Se registró en el pagaré equivocado.');
    expect(find.text('Pago anulado. El pagaré vuelve a estar por cobrar.'), findsOneWidget);
  });

  testWidgets('PDF del pagaré: la broker ve «Subir pagaré (PDF)»; sin permiso no aparece', (tester) async {
    await openProperty(tester, 'Pagos');
    await tester.tap(find.text('Pagaré 05 - 5 nov'));
    await settle(tester);
    expect(find.text('Subir pagaré (PDF)'), findsOneWidget);
  });

  testWidgets('Expediente por rol: la broker oculta documentos pero no los elimina', (tester) async {
    await openProperty(tester, 'Expediente');
    expect(find.text('Subir documento'), findsOneWidget);
    expect(find.text('Identificación del aval'), findsOneWidget);
    expect(find.text('Solo personal'), findsOneWidget);
    await tester.tap(find.text('Identificación del aval'));
    await settle(tester);
    expect(find.text('Mostrar al cliente'), findsOneWidget);
    expect(find.text('Eliminar documento'), findsNothing);
    await tester.tap(find.text('Mostrar al cliente'));
    await settle(tester);
    expect((sent['PATCH /documents/doc-aval']! as Map)['visibleToClient'], true);
  });

  testWidgets('Expediente por rol: administración elimina un documento', (tester) async {
    await openProperty(tester, 'Expediente', user: ownerJson);
    await tester.tap(find.text('Identificación del aval'));
    await settle(tester);
    await tester.tap(find.text('Eliminar documento'));
    await settle(tester);
    expect(find.text('¿Eliminar «Identificación del aval»?'), findsOneWidget);
    await tester.tap(find.text('Sí, eliminar'));
    await settle(tester);
    expect(sent.containsKey('DELETE /documents/doc-aval'), isTrue);
    expect(find.text('Se eliminó «Identificación del aval» del expediente.'), findsOneWidget);
  });

  testWidgets('Solicitudes: la broker contesta y propone una casa (le llega al cliente en la app)', (tester) async {
    await start(tester);
    await tapVisible(tester, find.textContaining('Solicitudes ·'));
    expect(find.text('Laura Mendez · Z-10001'), findsOneWidget);
    await tester.tap(find.text('Laura Mendez · Z-10001'));
    await settle(tester);
    // Todo el formulario, con sus datos de contacto
    expect(find.text('CONTACTO'), findsOneWidget);
    expect(find.text('lau.mendez@correo.com'), findsOneWidget);
    await scrollTo(tester, find.byTooltip('Enviar mensaje'));
    expect(find.text('Aún no hay mensajes. Escríbele para darle seguimiento.'), findsOneWidget);

    // Le escribe en la conversación (le llega a su app)
    await tester.enterText(find.widgetWithText(TextField, 'Escribe al cliente'), 'Te propongo Casa Ceiba.');
    await tester.tap(find.byTooltip('Enviar mensaje'));
    await settle(tester);
    expect((sent['POST /leads/lead-1/messages']! as Map)['body'], 'Te propongo Casa Ceiba.');

    await tapVisible(tester, find.text('Proponer una casa'));
    expect(find.text('Casa Las Palmas'), findsNothing); // rentada: no se propone
    await tester.tap(find.text('Casa Ceiba').last);
    await settle(tester);
    await tester.tap(find.text('Sin nota'));
    await settle(tester);
    expect((sent['POST /leads/lead-1/proposals']! as Map)['propertyId'], 'p-ceiba');
    expect(find.text('Casa propuesta. Le avisamos al cliente.'), findsOneWidget);
  });

  testWidgets('Pestaña «Solicitudes» en la barra: con las nuevas contadas y abre la lista y el detalle', (tester) async {
    await start(tester);
    final tab = find.bySemanticsLabel('Solicitudes, 1 nuevas');
    expect(tab, findsOneWidget);
    await tester.tap(tab);
    await settle(tester);
    expect(find.text('Laura Mendez · Z-10001'), findsOneWidget);
    await tester.tap(find.text('Laura Mendez · Z-10001'));
    await settle(tester);
    expect(find.text('Solicitud Z-10001'), findsOneWidget);
    expect(find.text('QUÉ BUSCA'), findsOneWidget);
  });

  Future<void> abreSolicitud(WidgetTester tester, Map<String, Object?> user) async {
    await start(tester, user: user);
    await tapVisible(tester, find.textContaining('Solicitudes ·'));
    await tester.tap(find.text('Laura Mendez · Z-10001'));
    await settle(tester);
  }

  testWidgets('Sin broker: quien es broker la atiende, aunque también sea administración', (tester) async {
    final atender = find.text('Atender esta solicitud');
    final asignar = find.text('Sin asignar · elige un broker');

    await abreSolicitud(tester, marianaJson);
    expect(atender, findsOneWidget);
    expect(asignar, findsNothing);
    await tester.pumpWidget(const SizedBox());

    await abreSolicitud(tester, {...ownerJson, 'roles': const ['admin', 'broker']});
    expect(atender, findsOneWidget);
    expect(asignar, findsOneWidget);
    await tester.pumpWidget(const SizedBox());

    await abreSolicitud(tester, ownerJson);
    expect(atender, findsNothing);
    expect(asignar, findsOneWidget);
  });

  testWidgets('«Hacer cita»: acepta la fecha que pidió la persona', (tester) async {
    final pedida = {
      ...staffRequestJson,
      'appointments': [
        {'id': pendingId, 'code': 'CIT-031', 'scheduledAt': DateTime.now().add(const Duration(days: 3)).toUtc().toIso8601String(), 'status': 'por-confirmar', 'awaiting': 'staff', 'property': {'id': 'p-ceiba', 'name': 'Casa Ceiba'}},
      ],
    };
    sent = {};
    tester.view.physicalSize = const Size(1080, 12000);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    final storage = MemoryTokenStorage()
      ..access = 'a1'
      ..refresh = 'r1';
    final adapter = FakeAdapter((o) => o.method == 'GET' && o.path == '/leads/lead-1' ? (200, pedida) : staffBackend(o, log: sent, user: ownerJson));
    await tester.pumpWidget(testApp(testOverrides(adapter: adapter, storage: storage)));
    await settle(tester);
    await tester.tap(find.textContaining('Solicitudes ·'));
    await settle(tester);
    await tester.tap(find.text('Laura Mendez · Z-10001'));
    await settle(tester);

    expect(find.textContaining('Si estás de acuerdo con la fecha y la hora'), findsOneWidget);
    await tester.tap(find.text('Hacer cita'));
    await settle(tester);
    expect(sent.containsKey('POST /appointments/$pendingId/confirm'), isTrue);
    expect(find.textContaining('confirmada. Le avisamos al cliente.'), findsOneWidget);
  });

  testWidgets('Solicitudes: «Agendar cita» crea la cita desde la solicitud', (tester) async {
    await start(tester);
    await tapVisible(tester, find.textContaining('Solicitudes ·'));
    await tester.tap(find.text('Laura Mendez · Z-10001'));
    await settle(tester);
    // Administración ve arriba «Broker asignado»; las citas quedan más abajo
    await tester.scrollUntilVisible(find.text('Aún no tiene cita. Agéndala y le avisamos en la app.'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Aún no tiene cita. Agéndala y le avisamos en la app.'), findsOneWidget);

    // Está en la lista aunque aún no se vea: se lleva a la pantalla y se pulsa
    final open = find.byWidgetPredicate((w) => w is PrimaryButton && w.label == 'Agendar cita', skipOffstage: false);
    await tester.ensureVisible(open);
    await tester.pumpAndSettle();
    await tester.tap(open);
    await settle(tester);
    // Sin elegir nada no deja guardar
    await tapVisible(tester, find.widgetWithText(PrimaryButton, 'Agendar cita').last);
    expect(find.text('Elige la casa, el día y el horario.'), findsOneWidget);

    await tester.tap(find.byType(DropdownButtonFormField<String>).first);
    await settle(tester);
    await tester.tap(find.textContaining('Casa Ceiba').last);
    await settle(tester);
    await tester.tap(find.text('Elegir día'));
    await settle(tester);
    final ok = MaterialLocalizations.of(tester.element(find.byType(DatePickerDialog))).okButtonLabel;
    await tester.tap(find.text(ok));
    await settle(tester);
    // Reloj de 12 horas: se acepta la hora propuesta (11:00 a.m.)
    await tapVisible(tester, find.text('Elegir hora'));
    expect(find.text('p.m.'), findsOneWidget); // selector a.m./p.m.: formato de 12 horas
    final okTime = MaterialLocalizations.of(tester.element(find.byType(TimePickerDialog))).okButtonLabel;
    await tester.tap(find.text(okTime));
    await settle(tester);
    await tapVisible(tester, find.widgetWithText(PrimaryButton, 'Agendar cita').last);

    final body = sent['POST /leads/lead-1/appointment']! as Map;
    expect(body['propertyId'], 'p-ceiba');
    expect(body['scheduledAt'] as String, endsWith('T11:00:00-05:00'));
    expect(find.text('Cita CIT-099 guardada. Quedó por confirmar y le avisamos al cliente.'), findsOneWidget);
  });

  testWidgets('Mantenimiento: UpdateStatusSheet cambia estado y asigna proveedor', (tester) async {
    await start(tester);
    await tester.tap(find.text('Reportes abiertos...'));
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
