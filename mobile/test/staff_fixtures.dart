import 'package:dio/dio.dart';

import 'fixtures.dart';
import 'helpers.dart';

/// Respuestas de la API para el personal: Mariana (broker de Casa Las Palmas) con los permisos del rol broker.
const brokerPermissions = [
  'properties.read_all', 'properties.create', 'properties.update', 'clients.manage', 'contracts.manage', 'appointments.manage',
  'payments.register', 'receipts.manage', 'maintenance.manage', 'providers.manage', 'expenses.manage', 'documents.manage',
  'dossier.read', 'activity.read', 'leads.manage',
];

const marianaJson = {
  'id': '00000000-0000-4000-8000-000000000002',
  'name': 'Mariana Solís',
  'email': 'mariana@zugar.example',
  'phone': '998 100 0002',
  'type': 'staff',
  'initials': 'MS',
  'roles': ['broker'],
  'permissions': brokerPermissions,
  'client': null,
};

/// Broker sin permiso para registrar pagos ni cambiar reportes (para probar PermissionGate).
final limitedStaffJson = {...marianaJson, 'permissions': const ['properties.read_all', 'dossier.read']};

const pendingId = '00000000-0000-4000-8000-000000000031';
const overdueNoteId = 'n-olivo-11';

Map<String, Object?> get staffDashboardJson => {
      'profile': 'staff',
      'roles': ['broker'],
      'counts': {
        'appointmentsToConfirm': 2,
        'appointmentsToday': 1,
        'overdueNotes': 1,
        'upcomingNotes': 3,
        'newReports': 1,
        'openReports': 2,
        'overdueReceipts': 0,
        'pendingExpenses': 1,
        'upcomingMaintenance': 0,
        'newLeads': 4,
      },
      'pendingAppointments': [
        {'id': pendingId, 'code': 'CIT-020', 'clientName': 'Laura Medina', 'propertyName': 'Casa Ceiba', 'scheduledAt': DateTime.now().add(const Duration(days: 3)).toUtc().toIso8601String()},
      ],
      'overdueNotes': [
        {'id': overdueNoteId, 'number': 11, 'amount': 18000, 'dueDate': '2026-10-01', 'clientName': 'Jorge Pech', 'propertyName': 'Casa Olivo', 'propertyId': 'p-olivo'},
      ],
      'newReports': [
        {'id': reportOpenId, 'title': 'Fuga en el baño', 'priority': 'high', 'status': 'reported', 'propertyName': 'Casa Las Palmas', 'propertyId': propertyId, 'createdAt': '2026-10-14T14:20:00.000Z'},
      ],
    };

Map<String, Object?> get pendingAppointmentJson => {
      ...appointmentJson,
      'id': pendingId,
      'code': 'CIT-020',
      'status': 'por-confirmar',
      'property': {'id': 'p-ceiba', 'code': 'ZUG-003', 'name': 'Casa Ceiba', 'zone': 'Cumbres', 'address': null, 'photo': null},
      'client': {'id': 'c-medina', 'name': 'Laura Medina', 'email': 'laura.m@example.com', 'phone': '998 555 0128'},
      'broker': {'id': marianaJson['id'], 'name': 'Mariana Solís', 'phone': '998 100 0002'},
      'confirmedBy': null,
    };

final overdueNoteJson = {
  ...note(11, '2026-10-01', 'overdue'),
  'id': overdueNoteId,
  'amount': 18000,
  'property': {'id': 'p-olivo', 'name': 'Casa Olivo'},
  'client': {'id': 'c-pech', 'name': 'Jorge Pech'},
};

final providersJson = {
  'data': [
    {'id': 'prov-1', 'name': 'Plomería Caribe', 'specialty': 'Plomería', 'phone': '998 200 1111', 'email': 'contacto@plomeriacaribe.mx', 'zone': 'Cancún', 'notes': null, 'active': true},
    {'id': 'prov-2', 'name': 'Electro Sur', 'specialty': 'Electricidad', 'phone': '998 200 2222', 'email': null, 'zone': 'Playa del Carmen', 'notes': 'Atiende urgencias.', 'active': true},
  ],
};

final inventoryJson = {
  'data': [
    {'id': propertyId, 'code': 'ZUG-012', 'name': 'Casa Las Palmas', 'operation': 'renta', 'price': 12000, 'zone': 'Isla Dorada', 'status': 'rentada', 'photos': <Object>[], 'broker': {'id': marianaJson['id'], 'name': 'Mariana Solís'}},
    {'id': 'p-ceiba', 'code': 'ZUG-003', 'name': 'Casa Ceiba', 'operation': 'renta', 'price': 28000, 'zone': 'Cumbres', 'status': 'disponible', 'photos': <Object>[], 'broker': {'id': marianaJson['id'], 'name': 'Mariana Solís'}},
  ],
};

Map<String, Object?> get staffDossierJson => {
      ...dossierJson,
      'property': {...(dossierJson['property']! as Map<String, Object?>), 'status': 'rentada', 'broker': {'name': 'Mariana Solís', 'phone': '998 100 0002'}},
      'tenant': {'id': 'c-laura', 'name': 'Laura Mendez', 'phone': '+52 998 000 0000', 'email': 'lau.mendez@correo.com'},
    };

/// Backend simulado del personal. [user] permite cambiar los permisos de la sesión.
FakeReply staffBackend(RequestOptions o, {Map<String, Object?>? log, Map<String, Object?> user = marianaJson}) {
  log?['${o.method} ${o.path}'] = o.data ?? o.queryParameters;
  final q = o.queryParameters;
  return switch ((o.method, o.path)) {
    ('GET', '/users/me') => (200, user),
    ('GET', '/dashboard') => (200, staffDashboardJson),
    ('GET', '/notifications') => (200, {'data': <Object>[], 'unreadCount': 0}),
    ('GET', '/appointments') => (200, {'data': [pendingAppointmentJson, {...appointmentJson, 'client': {'id': 'c-laura', 'name': 'Laura Mendez'}}]}),
    ('GET', '/appointments/$pendingId') => (200, pendingAppointmentJson),
    ('GET', '/appointments/$pendingId/messages') => (200, {'data': <Object>[]}),
    ('POST', '/appointments/$pendingId/confirm') => (200, {...pendingAppointmentJson, 'status': 'confirmada', 'confirmedBy': 'Confirmada por Mariana · 20 oct, 18:00 h.'}),
    ('POST', '/appointments/$pendingId/reject') => (200, {...pendingAppointmentJson, 'status': 'rechazada', 'reason': (o.data as Map)['reason']}),
    ('GET', '/promissory-notes') when (q['status'] as List?)?.contains('overdue') ?? false => (200, {'data': [overdueNoteJson], 'summary': null}),
    ('GET', '/promissory-notes') => (200, {...notesJson, 'data': [for (final n in notesJson['data']! as List) {...(n as Map<String, Object?>), 'client': {'id': 'c-laura', 'name': 'Laura Mendez'}}]}),
    ('POST', '/promissory-notes/$overdueNoteId/payments') => (201, {...overdueNoteJson, 'status': 'paid'}),
    ('POST', '/promissory-notes/n5/payments') => (201, {...note(5, '2026-11-05', 'paid')}),
    ('GET', '/receipts') => (200, receiptsJson),
    ('GET', '/providers') => (200, providersJson),
    ('GET', '/properties') => (200, inventoryJson),
    ('GET', '/properties/$propertyId') => (200, {...(inventoryJson['data']!).first, 'photos': <Object>[]}),
    ('GET', '/properties/$propertyId/dossier') => (200, staffDossierJson),
    ('GET', '/maintenance-reports') => (200, reportsJson),
    ('GET', '/maintenance-reports/$reportOpenId') => (200, {...reportDetail(reportOpenId), 'status': 'reported', 'statusLabel': 'Reportado'}),
    ('GET', '/maintenance-reports/$reportClosedId') => (200, reportDetail(reportClosedId)),
    ('POST', '/maintenance-reports/$reportOpenId/updates') => (200, {...reportDetail(reportOpenId), 'status': (o.data as Map)['status']}),
    _ => (404, apiError('NOT_FOUND', 'No encontrado: ${o.method} ${o.path}')),
  };
}
