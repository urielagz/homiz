import 'package:dio/dio.dart';

import 'helpers.dart';

/// Respuestas con la forma exacta de la API para Laura (inquilina de Casa Las Palmas, datos de 002_seed.sql).
const propertyId = '00000000-0000-4000-8000-000000000012';
const appointmentId = '00000000-0000-4000-8000-000000000019';
const reportOpenId = '00000000-0000-4000-8000-0000000000a1';
const reportClosedId = '00000000-0000-4000-8000-0000000000a2';

final lauraClientJson = {
  ...lauraJson,
  'birthDate': '1995-03-15',
  'client': {
    'id': '00000000-0000-4000-8000-000000000201',
    'kind': 'inquilino',
    'budget': r'$12,000 MXN / mes',
    'budgetAmount': 12000,
    'hasPets': true,
    'petsCount': 1,
    'occupants': 3,
    'propertyId': propertyId,
  },
};

DateTime get _future => DateTime.now().add(const Duration(days: 2));

Map<String, Object?> get dashboardJson => {
      'profile': 'client',
      'property': {'id': propertyId, 'name': 'Casa Las Palmas', 'zone': 'Isla Dorada'},
      'nextPayment': {'id': 'n5', 'number': 5, 'amount': 12000, 'dueDate': '2026-11-05', 'status': 'pending'},
      'nextAppointment': {'id': appointmentId, 'code': 'CIT-019', 'propertyName': 'Casa Las Palmas', 'scheduledAt': _future.toUtc().toIso8601String(), 'status': 'confirmada'},
      'openReports': {
        'count': 1,
        'latest': {'id': reportOpenId, 'title': 'Fuga en el baño', 'status': 'in_repair', 'createdAt': '2026-10-14T14:20:00.000Z'},
      },
      'unreadNotifications': 2,
    };

Map<String, Object?> get appointmentJson => {
      'id': appointmentId,
      'code': 'CIT-019',
      'property': {'id': propertyId, 'code': 'ZUG-012', 'name': 'Casa Las Palmas', 'zone': 'Isla Dorada', 'address': 'Av. Isla Dorada 12', 'photo': 'casa-palmas.jpg'},
      'scheduledAt': _future.toUtc().toIso8601String(),
      'durationMin': 60,
      'kind': 'visita',
      'status': 'confirmada',
      'note': 'Revisión de la fuga del baño con el plomero.',
      'reason': null,
      'createdAt': '2026-10-17T15:00:00.000Z',
    };

final messages = <Map<String, Object?>>[
  {'id': 'm1', 'mine': false, 'sender': 'Zugar', 'fromStaff': true, 'body': 'Tu cita en Casa Las Palmas es el Jueves 22 de Octubre a las 5:00 pm.', 'createdAt': '2026-10-18T17:00:00.000Z'},
  {'id': 'm2', 'mine': true, 'sender': 'Laura Mendez', 'fromStaff': false, 'body': 'Sí, ahí estaré. Gracias', 'createdAt': '2026-10-18T17:20:00.000Z'},
];

Map<String, Object?> note(int n, String due, String status, {String? proof}) => {
      'id': 'n$n',
      'contractId': 'c1',
      'number': n,
      'label': 'Pagaré ${n.toString().padLeft(2, '0')}',
      'amount': 12000,
      'dueDate': due,
      'status': status,
      'paidAt': status == 'paid' ? '${due}T16:00:00.000Z' : null,
      'payment': status == 'paid' ? {'id': 'p$n', 'amount': 12000, 'paidAt': '${due}T16:00:00.000Z', 'receiptFolio': 'F-00$n', 'notes': null} : null,
      'proofDocumentId': proof,
      'property': {'id': propertyId, 'name': 'Casa Las Palmas'},
    };

final notesJson = {
  'data': [note(5, '2026-11-05', 'pending'), note(4, '2026-10-05', 'paid', proof: 'doc-n4'), note(3, '2026-09-05', 'paid', proof: 'doc-n3')],
  'pagination': {'page': 1, 'limit': 100, 'total': 3, 'pages': 1},
  'summary': {
    'contractId': 'c1',
    'total': 12,
    'paid': 4,
    'remaining': 8,
    'remainingAmount': 96000,
    'next': {'number': 5, 'dueDate': '2026-11-05', 'amount': 12000},
  },
};

final receiptsJson = {
  'data': [
    {'id': 'r1', 'property': {'id': propertyId, 'name': 'Casa Las Palmas'}, 'kind': 'bill', 'concept': 'Recibo de luz', 'utility': null, 'periodStart': '2026-09-01', 'periodEnd': '2026-10-31', 'periodLabel': 'sep-oct', 'amount': 1840.5, 'dueDate': '2026-11-10', 'paidAt': null, 'status': 'pending', 'documentId': null},
    {'id': 'r2', 'property': {'id': propertyId, 'name': 'Casa Las Palmas'}, 'kind': 'bill', 'concept': 'Recibo de agua', 'utility': null, 'periodStart': '2026-10-01', 'periodEnd': '2026-10-31', 'periodLabel': 'oct', 'amount': 420, 'dueDate': '2026-10-20', 'paidAt': '2026-10-15T15:00:00.000Z', 'status': 'paid', 'documentId': 'doc-r2'},
  ],
};

Map<String, Object?> report(String id, String title, String status, {String? closedAt}) => {
      'id': id,
      'property': {'id': propertyId, 'code': 'ZUG-012', 'name': 'Casa Las Palmas'},
      'title': title,
      'description': 'Desde el martes pasado no funciona.',
      'category': status == 'resolved' ? 'Electricidad' : 'Plomería',
      'priority': status == 'resolved' ? 'low' : 'high',
      'subtitle': status == 'resolved' ? 'Electricidad - prioridad baja' : 'Plomería - prioridad alta',
      'status': status,
      'statusLabel': status == 'resolved' ? 'Resuelto' : 'En reparación',
      'provider': null,
      'closedAt': closedAt,
      'createdAt': '2026-10-07T00:45:00.000Z',
    };

final reportsJson = {
  'data': [report(reportOpenId, 'Fuga en el baño', 'in_repair'), report(reportClosedId, 'Foco de la sala', 'resolved', closedAt: '2026-10-12T18:00:00.000Z')],
};

Map<String, Object?> reportDetail(String id) => {
      ...(reportsJson['data']!.firstWhere((r) => r['id'] == id)),
      'timeline': [
        {'id': 't1', 'status': 'reported', 'statusLabel': 'Reportado', 'comment': 'Reporte creado desde la app.', 'createdAt': '2026-10-07T00:45:00.000Z', 'author': 'Laura Mendez'},
        {'id': 't2', 'status': 'in_repair', 'statusLabel': 'En reparación', 'comment': 'Plomería Caribe cambiará la llave de paso el lunes.', 'createdAt': '2026-10-15T16:00:00.000Z', 'author': 'Zugar'},
      ],
      'photos': {'before': <Object>[], 'after': <Object>[]},
    };

final dossierJson = {
  'property': {'id': propertyId, 'code': 'ZUG-012', 'name': 'Casa Las Palmas', 'zone': 'Isla Dorada', 'address': 'Av. Isla Dorada 12', 'city': 'Cancún', 'rec': 5, 'banos': 3, 'm2': 320, 'amenities': ['Alberca'], 'photo': 'casa-palmas.jpg'},
  'contract': {'id': 'c1', 'startDate': '2026-07-01', 'endDate': '2027-06-30', 'monthlyRent': 12000, 'paymentDay': 5, 'deposit': 12000, 'status': 'active'},
  'sections': [
    {'key': 'contract', 'title': 'Contrato de renta', 'subtitle': 'Vigente hasta 30 jun 2027', 'documentIds': ['doc-contract']},
    {'key': 'documents', 'title': 'Documentos', 'subtitle': 'Reglamento y anexos - 3 archivos', 'documentIds': ['d1', 'd2', 'd3']},
  ],
  'documents': [
    {'id': 'doc-contract', 'type': 'contract', 'name': 'Contrato firmado', 'description': null, 'mime': 'application/pdf', 'size': 1000, 'createdAt': '2026-07-01T15:00:00.000Z'},
  ],
  'payments': null,
  'receipts': <Object>[],
  'maintenance': <Object>[],
};

final notificationsJson = {
  'data': [
    {'id': 'not1', 'type': 'maintenance_status', 'title': 'Tu reporte está en reparación', 'message': 'Fuga en el baño: Plomería Caribe cambiará la llave de paso el lunes.', 'entity': 'maintenance_report', 'entityId': reportOpenId, 'read': false, 'sentAt': '2026-10-15T16:00:00.000Z'},
    {'id': 'not2', 'type': 'appointment_confirmed', 'title': 'Cita confirmada', 'message': 'Tu cita en Casa Las Palmas es el jueves 22 de octubre a las 5:00 pm.', 'entity': 'appointment', 'entityId': appointmentId, 'read': false, 'sentAt': '2026-10-18T17:00:00.000Z'},
  ],
  'unreadCount': 2,
};

/// Backend simulado de Laura. [log] guarda los cuerpos enviados por ruta.
FakeReply lauraBackend(RequestOptions o, {Map<String, Object?>? log}) {
  log?['${o.method} ${o.path}'] = o.data;
  return switch ((o.method, o.path)) {
    ('GET', '/users/me') => (200, lauraClientJson),
    ('PATCH', '/users/me') => (200, {
        ...lauraClientJson,
        'client': {...lauraClientJson['client']! as Map<String, Object?>, ...((o.data as Map)['client'] as Map<String, Object?>? ?? {})},
      }),
    ('GET', '/dashboard') => (200, dashboardJson),
    ('GET', '/notifications') => (200, notificationsJson),
    ('PATCH', _) when o.path.startsWith('/notifications/') => (204, null),
    ('GET', '/appointments') => (200, {'data': [appointmentJson]}),
    ('GET', '/appointments/$appointmentId') => (200, appointmentJson),
    ('GET', '/appointments/$appointmentId/messages') => (200, {'data': messages}),
    ('POST', '/appointments/$appointmentId/messages') => (201, {
        'data': [
          ...messages,
          {'id': 'm3', 'mine': true, 'sender': 'Laura Mendez', 'fromStaff': false, 'body': (o.data as Map)['body'], 'createdAt': DateTime.now().toUtc().toIso8601String()},
        ],
      }),
    ('POST', '/appointments/$appointmentId/cancel') => (200, {...appointmentJson, 'status': 'cancelada'}),
    ('GET', '/promissory-notes') => (200, notesJson),
    ('GET', '/receipts') => (200, receiptsJson),
    ('GET', '/maintenance-reports') => (200, reportsJson),
    ('GET', '/maintenance-reports/$reportOpenId') => (200, reportDetail(reportOpenId)),
    ('GET', '/maintenance-reports/$reportClosedId') => (200, reportDetail(reportClosedId)),
    // El reporte creado se devuelve con el id de un reporte existente para que su detalle cargue.
    ('POST', '/maintenance-reports') => (201, {...reportDetail(reportOpenId), 'title': (o.data as Map)['title']}),
    ('GET', '/properties/$propertyId') => (200, {'id': propertyId, 'name': 'Casa Las Palmas', 'price': 12000, 'photos': <Object>[]}),
    ('GET', '/properties/$propertyId/dossier') => (200, dossierJson),
    _ => (404, apiError('NOT_FOUND', 'No encontrado: ${o.method} ${o.path}')),
  };
}
