import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../../core/utils/json_converters.dart';

part 'property_models.freezed.dart';
part 'property_models.g.dart';

/// Ficha de propiedad (GET /properties/:id y catálogo GET /properties).
@freezed
abstract class PropertyDetail with _$PropertyDetail {
  const factory PropertyDetail({
    required String id,
    String? code,
    required String name,
    String? description,
    String? operation,
    @Default(0) double price,
    int? rec,
    double? banos,
    double? m2,
    int? est,
    @Default(false) bool petsAllowed,
    String? furnished,
    String? address,
    String? city,
    String? zone,
    String? status,
    @Default(<String>[]) List<String> amenities,
    @Default(<PropertyPhoto>[]) List<PropertyPhoto> photos,
  }) = _PropertyDetail;

  const PropertyDetail._();

  factory PropertyDetail.fromJson(Map<String, dynamic> json) => _$PropertyDetailFromJson(json);

  /// Primera foto con URL (las del sitio aún no tienen archivo: se muestra el recuadro gris).
  String? get coverUrl => photos.where((p) => p.url != null).firstOrNull?.url;
}

@freezed
abstract class PropertyPhoto with _$PropertyPhoto {
  const factory PropertyPhoto({String? id, String? label, String? url}) = _PropertyPhoto;

  factory PropertyPhoto.fromJson(Map<String, dynamic> json) => _$PropertyPhotoFromJson(json);
}

/// Expediente del cliente (GET /properties/:id/dossier, vista restringida).
@freezed
abstract class Dossier with _$Dossier {
  const factory Dossier({
    required DossierProperty property,
    DossierContract? contract,
    @Default(<DossierSection>[]) List<DossierSection> sections,
    @Default(<DossierDocument>[]) List<DossierDocument> documents,
  }) = _Dossier;

  factory Dossier.fromJson(Map<String, dynamic> json) => _$DossierFromJson(json);
}

@freezed
abstract class DossierProperty with _$DossierProperty {
  const factory DossierProperty({
    required String id,
    required String name,
    String? zone,
    String? address,
    String? city,
    int? rec,
    double? banos,
    double? m2,
    @Default(<String>[]) List<String> amenities,
  }) = _DossierProperty;

  factory DossierProperty.fromJson(Map<String, dynamic> json) => _$DossierPropertyFromJson(json);
}

@freezed
abstract class DossierContract with _$DossierContract {
  const factory DossierContract({
    required String id,
    @LocalDate() required DateTime startDate,
    @LocalDate() required DateTime endDate,
    required double monthlyRent,
    required int paymentDay,
    double? deposit,
    required String status,
  }) = _DossierContract;

  factory DossierContract.fromJson(Map<String, dynamic> json) => _$DossierContractFromJson(json);
}

/// Sección lista para la pestaña «Expediente» (Contrato, Depósito, Ficha de entrega, Documentos).
@freezed
abstract class DossierSection with _$DossierSection {
  const factory DossierSection({
    required String key,
    required String title,
    String? subtitle,
    @Default(<String>[]) List<String> documentIds,
  }) = _DossierSection;

  factory DossierSection.fromJson(Map<String, dynamic> json) => _$DossierSectionFromJson(json);
}

@freezed
abstract class DossierDocument with _$DossierDocument {
  const factory DossierDocument({
    required String id,
    required String type,
    required String name,
    String? description,
    String? mime,
    @LocalDateOrNull() DateTime? createdAt,
  }) = _DossierDocument;

  factory DossierDocument.fromJson(Map<String, dynamic> json) => _$DossierDocumentFromJson(json);
}
