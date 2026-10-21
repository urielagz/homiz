import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../../core/utils/json_converters.dart';

part 'appointment.freezed.dart';
part 'appointment.g.dart';

/// Cita (vista del cliente: sin datos del broker).
@freezed
abstract class Appointment with _$Appointment {
  const factory Appointment({
    required String id,
    required String code,
    required AppointmentProperty property,
    @LocalDate() required DateTime scheduledAt,
    @Default(60) int durationMin,
    required String status,
    String? note,
    String? reason,
  }) = _Appointment;

  const Appointment._();

  factory Appointment.fromJson(Map<String, dynamic> json) => _$AppointmentFromJson(json);

  /// Se puede cancelar mientras esté por confirmar o confirmada y no haya pasado.
  bool get isActive => (status == 'por-confirmar' || status == 'confirmada') && scheduledAt.isAfter(DateTime.now());

  bool get acceptsMessages => status != 'cancelada' && status != 'rechazada';
}

@freezed
abstract class AppointmentProperty with _$AppointmentProperty {
  const factory AppointmentProperty({
    required String id,
    String? code,
    required String name,
    String? zone,
    String? address,
    String? photo,
  }) = _AppointmentProperty;

  factory AppointmentProperty.fromJson(Map<String, dynamic> json) => _$AppointmentPropertyFromJson(json);
}

/// Mensaje del chat de la cita. Al cliente el personal aparece como «Zugar».
@freezed
abstract class AppointmentMessage with _$AppointmentMessage {
  const factory AppointmentMessage({
    required String id,
    required bool mine,
    required String sender,
    required bool fromStaff,
    required String body,
    @LocalDate() required DateTime createdAt,
  }) = _AppointmentMessage;

  factory AppointmentMessage.fromJson(Map<String, dynamic> json) => _$AppointmentMessageFromJson(json);
}
