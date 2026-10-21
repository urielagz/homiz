import 'package:freezed_annotation/freezed_annotation.dart';

part 'app_user.freezed.dart';
part 'app_user.g.dart';

/// Usuario de la sesión (GET /users/me y respuesta de /auth/login).
@freezed
abstract class AppUser with _$AppUser {
  const factory AppUser({
    required String id,
    required String name,
    required String email,
    String? phone,
    String? birthDate,
    required String type,
    String? initials,
    @Default(<String>[]) List<String> roles,
    @Default(<String>[]) List<String> permissions,
    ClientProfile? client,
  }) = _AppUser;

  const AppUser._();

  factory AppUser.fromJson(Map<String, dynamic> json) => _$AppUserFromJson(json);

  bool get isClient => type == 'client';
  bool get isStaff => type == 'staff';
  bool get isAdmin => roles.contains('admin');
  bool get isBroker => roles.contains('broker');

  /// ¿Tiene el permiso? (las opciones del personal se ocultan si no; la API vuelve a validar).
  bool can(String permission) => permissions.contains(permission);
}

/// Expediente básico del cliente (nunca incluye datos del broker).
@freezed
abstract class ClientProfile with _$ClientProfile {
  const factory ClientProfile({
    required String id,
    required String kind,
    String? budget,
    @Default(false) bool hasPets,
    @Default(0) int petsCount,
    int? occupants,
    String? propertyId,
  }) = _ClientProfile;

  factory ClientProfile.fromJson(Map<String, dynamic> json) => _$ClientProfileFromJson(json);
}
