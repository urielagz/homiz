// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'property_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PropertyDetail _$PropertyDetailFromJson(Map<String, dynamic> json) =>
    _PropertyDetail(
      id: json['id'] as String,
      code: json['code'] as String?,
      name: json['name'] as String,
      description: json['description'] as String?,
      operation: json['operation'] as String?,
      price: (json['price'] as num?)?.toDouble() ?? 0,
      rec: (json['rec'] as num?)?.toInt(),
      banos: (json['banos'] as num?)?.toDouble(),
      m2: (json['m2'] as num?)?.toDouble(),
      est: (json['est'] as num?)?.toInt(),
      petsAllowed: json['petsAllowed'] as bool? ?? false,
      furnished: json['furnished'] as String?,
      address: json['address'] as String?,
      city: json['city'] as String?,
      zone: json['zone'] as String?,
      status: json['status'] as String?,
      amenities:
          (json['amenities'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      photos:
          (json['photos'] as List<dynamic>?)
              ?.map((e) => PropertyPhoto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <PropertyPhoto>[],
    );

Map<String, dynamic> _$PropertyDetailToJson(_PropertyDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'name': instance.name,
      'description': instance.description,
      'operation': instance.operation,
      'price': instance.price,
      'rec': instance.rec,
      'banos': instance.banos,
      'm2': instance.m2,
      'est': instance.est,
      'petsAllowed': instance.petsAllowed,
      'furnished': instance.furnished,
      'address': instance.address,
      'city': instance.city,
      'zone': instance.zone,
      'status': instance.status,
      'amenities': instance.amenities,
      'photos': instance.photos,
    };

_PropertyPhoto _$PropertyPhotoFromJson(Map<String, dynamic> json) =>
    _PropertyPhoto(
      id: json['id'] as String?,
      label: json['label'] as String?,
      url: json['url'] as String?,
    );

Map<String, dynamic> _$PropertyPhotoToJson(_PropertyPhoto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'url': instance.url,
    };

_Dossier _$DossierFromJson(Map<String, dynamic> json) => _Dossier(
  property: DossierProperty.fromJson(json['property'] as Map<String, dynamic>),
  contract: json['contract'] == null
      ? null
      : DossierContract.fromJson(json['contract'] as Map<String, dynamic>),
  sections:
      (json['sections'] as List<dynamic>?)
          ?.map((e) => DossierSection.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <DossierSection>[],
  documents:
      (json['documents'] as List<dynamic>?)
          ?.map((e) => DossierDocument.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <DossierDocument>[],
);

Map<String, dynamic> _$DossierToJson(_Dossier instance) => <String, dynamic>{
  'property': instance.property,
  'contract': instance.contract,
  'sections': instance.sections,
  'documents': instance.documents,
};

_DossierProperty _$DossierPropertyFromJson(Map<String, dynamic> json) =>
    _DossierProperty(
      id: json['id'] as String,
      name: json['name'] as String,
      zone: json['zone'] as String?,
      address: json['address'] as String?,
      city: json['city'] as String?,
      rec: (json['rec'] as num?)?.toInt(),
      banos: (json['banos'] as num?)?.toDouble(),
      m2: (json['m2'] as num?)?.toDouble(),
      amenities:
          (json['amenities'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
    );

Map<String, dynamic> _$DossierPropertyToJson(_DossierProperty instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'zone': instance.zone,
      'address': instance.address,
      'city': instance.city,
      'rec': instance.rec,
      'banos': instance.banos,
      'm2': instance.m2,
      'amenities': instance.amenities,
    };

_DossierContract _$DossierContractFromJson(Map<String, dynamic> json) =>
    _DossierContract(
      id: json['id'] as String,
      startDate: const LocalDate().fromJson(json['startDate'] as String),
      endDate: const LocalDate().fromJson(json['endDate'] as String),
      monthlyRent: (json['monthlyRent'] as num).toDouble(),
      paymentDay: (json['paymentDay'] as num).toInt(),
      deposit: (json['deposit'] as num?)?.toDouble(),
      status: json['status'] as String,
    );

Map<String, dynamic> _$DossierContractToJson(_DossierContract instance) =>
    <String, dynamic>{
      'id': instance.id,
      'startDate': const LocalDate().toJson(instance.startDate),
      'endDate': const LocalDate().toJson(instance.endDate),
      'monthlyRent': instance.monthlyRent,
      'paymentDay': instance.paymentDay,
      'deposit': instance.deposit,
      'status': instance.status,
    };

_DossierSection _$DossierSectionFromJson(Map<String, dynamic> json) =>
    _DossierSection(
      key: json['key'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String?,
      documentIds:
          (json['documentIds'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
    );

Map<String, dynamic> _$DossierSectionToJson(_DossierSection instance) =>
    <String, dynamic>{
      'key': instance.key,
      'title': instance.title,
      'subtitle': instance.subtitle,
      'documentIds': instance.documentIds,
    };

_DossierDocument _$DossierDocumentFromJson(Map<String, dynamic> json) =>
    _DossierDocument(
      id: json['id'] as String,
      type: json['type'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      mime: json['mime'] as String?,
      createdAt: const LocalDateOrNull().fromJson(json['createdAt'] as String?),
    );

Map<String, dynamic> _$DossierDocumentToJson(_DossierDocument instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'name': instance.name,
      'description': instance.description,
      'mime': instance.mime,
      'createdAt': const LocalDateOrNull().toJson(instance.createdAt),
    };
