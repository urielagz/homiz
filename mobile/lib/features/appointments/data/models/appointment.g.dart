// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'appointment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Appointment _$AppointmentFromJson(Map<String, dynamic> json) => _Appointment(
  id: json['id'] as String,
  code: json['code'] as String,
  property: AppointmentProperty.fromJson(
    json['property'] as Map<String, dynamic>,
  ),
  scheduledAt: const LocalDate().fromJson(json['scheduledAt'] as String),
  durationMin: (json['durationMin'] as num?)?.toInt() ?? 60,
  status: json['status'] as String,
  note: json['note'] as String?,
  reason: json['reason'] as String?,
);

Map<String, dynamic> _$AppointmentToJson(_Appointment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'property': instance.property,
      'scheduledAt': const LocalDate().toJson(instance.scheduledAt),
      'durationMin': instance.durationMin,
      'status': instance.status,
      'note': instance.note,
      'reason': instance.reason,
    };

_AppointmentProperty _$AppointmentPropertyFromJson(Map<String, dynamic> json) =>
    _AppointmentProperty(
      id: json['id'] as String,
      code: json['code'] as String?,
      name: json['name'] as String,
      zone: json['zone'] as String?,
      address: json['address'] as String?,
      photo: json['photo'] as String?,
    );

Map<String, dynamic> _$AppointmentPropertyToJson(
  _AppointmentProperty instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'name': instance.name,
  'zone': instance.zone,
  'address': instance.address,
  'photo': instance.photo,
};

_AppointmentMessage _$AppointmentMessageFromJson(Map<String, dynamic> json) =>
    _AppointmentMessage(
      id: json['id'] as String,
      mine: json['mine'] as bool,
      sender: json['sender'] as String,
      fromStaff: json['fromStaff'] as bool,
      body: json['body'] as String,
      createdAt: const LocalDate().fromJson(json['createdAt'] as String),
    );

Map<String, dynamic> _$AppointmentMessageToJson(_AppointmentMessage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'mine': instance.mine,
      'sender': instance.sender,
      'fromStaff': instance.fromStaff,
      'body': instance.body,
      'createdAt': const LocalDate().toJson(instance.createdAt),
    };
