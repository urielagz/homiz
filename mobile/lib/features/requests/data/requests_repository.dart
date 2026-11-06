import 'package:dio/dio.dart';

import '../../../core/utils/formatters.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_call.dart';
import '../../../core/network/api_client.dart';

final requestsRepositoryProvider = Provider<RequestsRepository>((ref) => RequestsRepository(ref.watch(dioProvider)));

/// Casa que el asesor propone en una solicitud.
class ProposedHouse {
  const ProposedHouse({
    required this.id,
    this.note,
    required this.propertyId,
    required this.name,
    required this.zone,
    this.city,
    required this.operation,
    required this.price,
    required this.rec,
    required this.banos,
    this.photo,
  });

  factory ProposedHouse.fromJson(Map<String, dynamic> j) {
    final p = j['property'] as Map<String, dynamic>;
    return ProposedHouse(
      id: j['id'] as String,
      note: j['note'] as String?,
      propertyId: p['id'] as String,
      name: p['name'] as String,
      zone: p['zone'] as String? ?? '',
      city: p['city'] as String?,
      operation: p['operation'] as String? ?? 'renta',
      price: (p['price'] as num?)?.toDouble() ?? 0,
      rec: (p['rec'] as num?)?.toInt() ?? 0,
      banos: (p['banos'] as num?)?.toDouble() ?? 0,
      photo: p['photo'] as String?,
    );
  }

  final String id;
  final String? note;
  final String propertyId;
  final String name;
  final String zone;
  final String? city;
  final String operation;
  final double price;
  final int rec;
  final double banos;
  final String? photo;
}

/// Cita agendada desde una solicitud (solo la ve el personal).
class RequestAppointment {
  const RequestAppointment({required this.id, required this.code, required this.scheduledAt, required this.status, this.awaiting, this.propertyId, required this.propertyName, this.broker});

  factory RequestAppointment.fromJson(Map<String, dynamic> j) => RequestAppointment(
    id: j['id'] as String,
    code: j['code'] as String,
    scheduledAt: Fmt.parse(j['scheduledAt'] as String),
    status: j['status'] as String,
    awaiting: j['awaiting'] as String?,
    propertyId: (j['property'] as Map<String, dynamic>?)?['id'] as String?,
    propertyName: (j['property'] as Map<String, dynamic>?)?['name'] as String? ?? '',
    broker: j['broker'] as String?,
  );

  final String id;
  final String code;
  final DateTime scheduledAt;
  final String status;

  /// Por confirmar: quién debe aceptar la fecha (`staff` o `client`).
  final String? awaiting;
  final String? propertyId;
  final String propertyName;

  /// Por confirmar o confirmada: «Agendar» la reprograma en lugar de crear otra.
  bool get isActive => status == 'por-confirmar' || status == 'confirmada';
  final String? broker;
}

/// Solicitud: «Busco casa» de la app o formulario del sitio, con la respuesta y las casas propuestas.
class LeadRequest {
  const LeadRequest({
    required this.id,
    required this.folio,
    required this.reason,
    required this.status,
    required this.statusLabel,
    this.name,
    this.email,
    this.phone,
    this.message,
    this.propertyId,
    this.propertyName,
    this.preferredDate,
    this.preferredTime,
    this.payload = const {},
    this.response,
    this.respondedBy,
    this.proposalCount = 0,
    this.proposals = const [],
    this.appointmentCount = 0,
    this.appointments = const [],
    this.others = const [],
    this.brokerId,
    this.brokerName,
    required this.createdAt,
  });

  /// Resumen de otra solicitud de la misma persona (en «others» la casa llega solo con su nombre).
  factory LeadRequest.summaryFromJson(Map<String, dynamic> j) => LeadRequest(
    id: j['id'] as String,
    folio: j['folio'] as String,
    reason: j['reason'] as String,
    status: j['status'] as String,
    statusLabel: j['statusLabel'] as String? ?? '',
    message: j['message'] as String?,
    propertyName: j['property'] as String?,
    payload: {for (final e in ((j['payload'] as Map?) ?? const {}).entries) e.key as String: '${e.value}'},
    createdAt: Fmt.parse(j['createdAt'] as String),
  );

  factory LeadRequest.fromJson(Map<String, dynamic> j) => LeadRequest(
    id: j['id'] as String,
    folio: j['folio'] as String,
    reason: j['reason'] as String,
    status: j['status'] as String,
    statusLabel: j['statusLabel'] as String? ?? '',
    name: j['name'] as String?,
    email: j['email'] as String?,
    phone: j['phone'] as String?,
    message: j['message'] as String?,
    propertyId: (j['property'] as Map<String, dynamic>?)?['id'] as String?,
    propertyName: (j['property'] as Map<String, dynamic>?)?['name'] as String?,
    preferredDate: j['preferredDate'] as String?,
    preferredTime: j['preferredTime'] as String?,
    payload: {for (final e in ((j['payload'] as Map?) ?? const {}).entries) e.key as String: '${e.value}'},
    response: j['response'] as String?,
    respondedBy: j['respondedBy'] as String?,
    proposalCount: (j['proposalCount'] as num?)?.toInt() ?? 0,
    proposals: [for (final p in (j['proposals'] as List? ?? const [])) ProposedHouse.fromJson(p as Map<String, dynamic>)],
    appointmentCount: (j['appointmentCount'] as num?)?.toInt() ?? 0,
    appointments: [for (final a in (j['appointments'] as List? ?? const [])) RequestAppointment.fromJson(a as Map<String, dynamic>)],
    others: [for (final o in (j['others'] as List? ?? const [])) LeadRequest.summaryFromJson(o as Map<String, dynamic>)],
    brokerId: (j['broker'] as Map<String, dynamic>?)?['id'] as String?,
    brokerName: (j['broker'] as Map<String, dynamic>?)?['name'] as String?,
    createdAt: Fmt.parse(j['createdAt'] as String),
  );

  final String id;
  final String folio;
  final String reason;
  final String status;
  final String statusLabel;
  // Solo para el personal:
  final String? name;
  final String? email;
  final String? phone;
  final String? message;
  final String? propertyId;
  final String? propertyName;

  /// Fecha y hora que pidió para la visita (YYYY-MM-DD y HH:MM), si las dio
  final String? preferredDate;
  final String? preferredTime;
  final Map<String, String> payload;
  final String? response;
  final String? respondedBy;
  final int proposalCount;
  final List<ProposedHouse> proposals;
  final int appointmentCount;
  final List<RequestAppointment> appointments;

  /// Otras solicitudes de la misma persona (solo el personal)
  final List<LeadRequest> others;

  /// Broker que la atiende (lo asigna administración; null = sin asignar). Solo el personal.
  final String? brokerId;
  final String? brokerName;
  final DateTime createdAt;

  static const reasons = {'visita': 'Visita a una casa', 'rentar': 'Quiero rentar', 'comprar': 'Quiero comprar', 'publicar': 'Publicar mi casa', 'otro': 'Otro motivo'};

  String get reasonLabel => reasons[reason] ?? reason;

  /// «$15,000 · 3 rec. · Puerto Morelos»
  String get summary => [
    payload['presupuesto'],
    if ((payload['recamaras'] ?? '').isNotEmpty) '${payload['recamaras']} rec.',
    payload['zona'] ?? payload['inmueble_zona'],
  ].whereType<String>().where((s) => s.isNotEmpty).join(' · ');
}

/// Mensaje de la solicitud (cliente ↔ asesor). Para el cliente, el personal aparece como «Zugar».
class RequestMessage {
  const RequestMessage({required this.id, required this.body, required this.fromStaff, required this.mine, required this.sender, required this.createdAt});

  factory RequestMessage.fromJson(Map<String, dynamic> j) => RequestMessage(
    id: j['id'] as String,
    body: j['body'] as String,
    fromStaff: j['fromStaff'] as bool? ?? false,
    mine: j['mine'] as bool? ?? false,
    sender: j['sender'] as String? ?? '',
    createdAt: Fmt.parse(j['createdAt'] as String),
  );

  final String id;
  final String body;
  final bool fromStaff;
  final bool mine;
  final String sender;
  final DateTime createdAt;
}

class RequestsRepository {
  RequestsRepository(this._dio);

  final Dio _dio;

  /// Mensajes: el personal usa /leads; el cliente, /requests.
  Future<List<RequestMessage>> messages(String id, {required bool staff}) => apiCall(() async {
    final res = await _dio.get<Map<String, dynamic>>('${staff ? '/leads' : '/requests'}/$id/messages');
    return dataList(res.data, RequestMessage.fromJson);
  });

  Future<List<RequestMessage>> send(String id, String body, {required bool staff}) => apiCall(() async {
    final res = await _dio.post<Map<String, dynamic>>('${staff ? '/leads' : '/requests'}/$id/messages', data: {'body': body.trim()});
    return dataList(res.data, RequestMessage.fromJson);
  });

  /* ---------- Cliente: «Mis solicitudes» ---------- */

  Future<List<LeadRequest>> mine() => apiCall(() async {
    final res = await _dio.get<Map<String, dynamic>>('/requests');
    return dataList(res.data, LeadRequest.fromJson);
  });

  Future<LeadRequest> mineOne(String id) => apiCall(() async {
    final res = await _dio.get<Map<String, dynamic>>('/requests/$id');
    return LeadRequest.fromJson(res.data!);
  });

  /// «¿Qué quieres hacer?»: el nombre, correo y teléfono salen de la cuenta. Los montos van como número.
  /// Con [propertySlug], [preferredDate] (AAAA-MM-DD) y [preferredTime] (HH:MM) se agenda además la cita.
  Future<LeadRequest> create({
    required String reason,
    String? message,
    required Map<String, Object?> payload,
    String? propertySlug,
    String? propertyCode,
    String? preferredDate,
    String? preferredTime,
  }) => apiCall(() async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/requests',
      data: {
        'reason': reason,
        'propertySlug': ?propertySlug,
        'propertyCode': ?propertyCode,
        'preferredDate': ?preferredDate,
        'preferredTime': ?preferredTime,
        if (message != null && message.trim().isNotEmpty) 'message': message.trim(),
        'payload': {
          for (final e in payload.entries)
            if (e.value is num) e.key: e.value else if (e.value is String && (e.value! as String).trim().isNotEmpty) e.key: (e.value! as String).trim(),
        },
      },
    );
    return LeadRequest.fromJson(res.data!);
  });

  /// El cliente corrige lo que mandó; lo que deje vacío se borra.
  Future<void> edit(String id, {String? message, required Map<String, Object?> payload}) => apiCall(() async {
    await _dio.patch<Map<String, dynamic>>(
      '/requests/$id',
      data: {
        'message': (message ?? '').trim().isEmpty ? null : message!.trim(),
        'payload': {
          for (final e in payload.entries)
            if (e.value is num) e.key: e.value else if (e.value is String && (e.value! as String).trim().isNotEmpty) e.key: (e.value! as String).trim(),
        },
      },
    );
  });

  /* ---------- Personal (leads.manage): contestar y proponer casas ---------- */

  /// [status] "sin_asignar" = las que aún no tienen broker.
  Future<List<LeadRequest>> staffList({String? status}) => apiCall(() async {
    final res = await _dio.get<Map<String, dynamic>>('/leads', queryParameters: {'limit': 100, if (status == 'sin_asignar') 'unassigned': 'true' else 'status': ?status});
    return dataList(res.data, LeadRequest.fromJson);
  });

  Future<LeadRequest> staffOne(String id) => apiCall(() async {
    final res = await _dio.get<Map<String, dynamic>>('/leads/$id');
    return LeadRequest.fromJson(res.data!);
  });

  Future<void> update(String id, {String? status, String? response}) => apiCall(() async {
    await _dio.patch<Map<String, dynamic>>('/leads/$id', data: {'status': ?status, 'response': ?response});
  });

  Future<void> propose(String id, String propertyId, {String? note}) => apiCall(() async {
    await _dio.post<Map<String, dynamic>>('/leads/$id/proposals', data: {'propertyId': propertyId, if (note != null && note.trim().isNotEmpty) 'note': note.trim()});
  });

  Future<void> unpropose(String id, String proposalId) => apiCall(() async {
    await _dio.delete<Map<String, dynamic>>('/leads/$id/proposals/$proposalId');
  });

  /// Agenda la visita desde la solicitud; devuelve la clave de la cita (CIT-…).
  /// Con [agreed], el personal acepta la fecha y hora que pidió la persona y la cita queda confirmada.
  Future<String> schedule(String id, {required String propertyId, required DateTime at, String? note, bool agreed = false}) => apiCall(() async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/leads/$id/appointment',
      data: {'propertyId': propertyId, 'scheduledAt': cancunIso(at), if (note != null && note.trim().isNotEmpty) 'note': note.trim(), if (agreed) 'agreed': true},
    );
    return (res.data!['appointment'] as Map<String, dynamic>)['code'] as String;
  });

  /// El broker toma una solicitud sin broker: se queda con su seguimiento.
  Future<void> take(String id) => apiCall(() async {
    await _dio.post<Map<String, dynamic>>('/leads/$id/take');
  });

  /// Solo administración: asigna el broker; la cita (si hay) se va con él y los datos de la persona no cambian.
  Future<void> assign(String id, String brokerId) => apiCall(() async {
    await _dio.patch<Map<String, dynamic>>('/leads/$id/broker', data: {'brokerId': brokerId});
  });

  /// Brokers activos (administración). Si no puede ver al personal, salen de las casas.
  Future<List<({String id, String name})>> brokers() => apiCall(() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/users', queryParameters: {'limit': 100});
      return [
        for (final u in (res.data?['data'] as List? ?? const []).cast<Map<String, dynamic>>())
          if ((u['roles'] as List? ?? const []).contains('broker') && u['active'] != false) (id: u['id'] as String, name: u['name'] as String),
      ];
    } on DioException {
      final res = await _dio.get<Map<String, dynamic>>('/properties', queryParameters: {'limit': 100});
      final seen = <String, String>{};
      for (final p in (res.data?['data'] as List? ?? const []).cast<Map<String, dynamic>>()) {
        final b = p['broker'] as Map<String, dynamic>?;
        if (b != null) seen[b['id'] as String] = b['name'] as String;
      }
      return [for (final e in seen.entries) (id: e.key, name: e.value)];
    }
  });

  /// Solo administración.
  Future<void> remove(String id) => apiCall(() async {
    await _dio.delete<void>('/leads/$id');
  });
}

/// Fecha y hora elegidas como hora de Cancún (UTC-5, sin horario de verano): 2026-11-03T10:00:00-05:00
String cancunIso(DateTime at) => Fmt.cancunIso(at);
