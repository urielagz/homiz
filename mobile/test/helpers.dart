import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:homiz/app.dart';
import 'package:homiz/core/network/api_client.dart';
import 'package:homiz/core/network/token_storage.dart';
import 'package:homiz/features/auth/presentation/providers/session_provider.dart';

/// Respuesta simulada: (status, cuerpo JSON).
typedef FakeReply = (int, Object?);

/// Adaptador HTTP en memoria: cada petición se resuelve con [handler] y queda registrada en [calls].
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);

  final FakeReply Function(RequestOptions options) handler;
  final calls = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    calls.add(options);
    final (status, body) = handler(options);
    return ResponseBody.fromString(
      body == null ? '' : jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Usuaria de ejemplo (igual que en backend/db/002_seed.sql).
const lauraJson = {
  'id': '00000000-0000-4000-8000-000000000101',
  'name': 'Laura Méndez',
  'email': 'lau.mendez@correo.com',
  'phone': '998 123 4567',
  'type': 'client',
  'initials': 'LM',
  'roles': <String>[],
  'permissions': <String>[],
};

Map<String, Object?> apiError(String code, String message, [Object? details]) => {
      'error': {'code': code, 'message': message, 'details': ?details},
    };

/// Overrides comunes: almacenamiento en memoria, adaptador simulado y bienvenida instantánea.
List<Override> testOverrides({required FakeAdapter adapter, TokenStorage? storage}) => [
      tokenStorageProvider.overrideWithValue(storage ?? MemoryTokenStorage()),
      httpAdapterProvider.overrideWithValue(adapter),
      apiBaseUrlProvider.overrideWithValue('http://api.test/api/v1'),
      splashDelayProvider.overrideWith((ref) async {}),
    ];

Widget testApp(List<Override> overrides) => ProviderScope(overrides: overrides, child: const HomizApp());
