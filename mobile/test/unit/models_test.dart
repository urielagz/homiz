import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/features/appointments/data/models/appointment.dart';
import 'package:homiz/features/home/data/models/client_dashboard.dart';
import 'package:homiz/features/maintenance/data/models/maintenance_report.dart';
import 'package:homiz/features/notifications/data/models/app_notification.dart';
import 'package:homiz/features/payments/data/models/payment_models.dart';
import 'package:homiz/features/property/data/models/property_models.dart';

import '../fixtures.dart';

/// Los modelos leen exactamente la forma JSON de la API.
void main() {
  test('panel del cliente', () {
    final d = ClientDashboard.fromJson(dashboardJson);
    expect(d.property?.name, 'Casa Las Palmas');
    expect(d.nextPayment?.amount, 12000);
    expect(d.nextPayment?.dueDate, DateTime(2026, 11, 5, 12));
    expect(d.openReports.count, 1);
    expect(d.openReports.latest?.title, 'Fuga en el baño');
  });

  test('panel sin contrato ni citas', () {
    final d = ClientDashboard.fromJson({'profile': 'client', 'property': null, 'nextPayment': null, 'nextAppointment': null, 'openReports': {'count': 0, 'latest': null}, 'unreadNotifications': 0});
    expect(d.property, isNull);
    expect(d.openReports.latest, isNull);
  });

  test('las horas de la API se pasan a la hora local', () {
    final m = AppointmentMessage.fromJson(messages.first);
    expect(m.createdAt.isUtc, isFalse);
    expect(m.createdAt.toUtc(), DateTime.utc(2026, 10, 18, 17));
  });

  test('cita activa y cancelable', () {
    final a = Appointment.fromJson(appointmentJson);
    expect(a.property.zone, 'Isla Dorada');
    expect(a.isActive, isTrue);
    expect(a.copyWith(status: 'cancelada').isActive, isFalse);
    expect(a.copyWith(status: 'cancelada').acceptsMessages, isFalse);
  });

  test('pagarés con resumen y recibos', () {
    final s = NotesSummary.fromJson(notesJson['summary']! as Map<String, dynamic>);
    expect(s.progress, closeTo(4 / 12, 0.001));
    final n = PromissoryNote.fromJson(note(4, '2026-10-05', 'paid', proof: 'doc-n4'));
    expect(n.payment?.receiptFolio, 'F-004');
    final r = Receipt.fromJson((receiptsJson['data']!).first);
    expect(r.amount, 1840.5);
    expect(r.periodLabel, 'sep-oct');
  });

  test('expediente y reporte con línea de tiempo', () {
    final d = Dossier.fromJson(dossierJson);
    expect(d.contract?.endDate, DateTime(2027, 6, 30, 12));
    expect(d.sections.last.documentIds, hasLength(3));
    final r = MaintenanceReport.fromJson(reportDetail(reportOpenId));
    expect(r.isOpen, isTrue);
    expect(r.timeline.last.author, 'Zugar');
  });

  test('notificación lleva a la pantalla relacionada', () {
    final items = [for (final n in notificationsJson['data']! as List) AppNotification.fromJson(n as Map<String, dynamic>)];
    expect(items.first.route, '/property/maintenance/$reportOpenId');
    expect(items.last.route, '/appointments/$appointmentId');
    expect(items.first.copyWith(entity: 'promissory_note').route, '/property?tab=2');
    expect(items.first.copyWith(entity: null).route, isNull);
  });
}
