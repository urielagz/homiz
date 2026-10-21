import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) => NotificationsRepository(ref.watch(dioProvider)));

/// Aviso de la bandeja propia (GET /notifications).
class AppNotification {
  const AppNotification({required this.id, required this.type, required this.title, required this.message, required this.read, required this.sentAt, this.entity, this.entityId});

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        type: json['type'] as String? ?? '',
        title: json['title'] as String? ?? '',
        message: json['message'] as String? ?? '',
        read: json['read'] as bool? ?? false,
        sentAt: DateTime.parse(json['sentAt'] as String).toLocal(),
        entity: json['entity'] as String?,
        entityId: json['entityId'] as String?,
      );

  final String id;
  final String type;
  final String title;
  final String message;
  final bool read;
  final DateTime sentAt;
  final String? entity;
  final String? entityId;

  AppNotification markedRead() => AppNotification(id: id, type: type, title: title, message: message, read: true, sentAt: sentAt, entity: entity, entityId: entityId);
}

class NotificationsPage {
  const NotificationsPage({required this.items, required this.unreadCount});

  final List<AppNotification> items;
  final int unreadCount;
}

class NotificationsRepository {
  NotificationsRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() fn) async {
    try {
      return await fn();
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<NotificationsPage> list({int limit = 50}) => _call(() async {
        final res = await _dio.get<Map<String, dynamic>>('/notifications', queryParameters: {'limit': limit});
        final data = res.data!;
        return NotificationsPage(
          items: [for (final n in data['data'] as List) AppNotification.fromJson(n as Map<String, dynamic>)],
          unreadCount: (data['unreadCount'] as num?)?.toInt() ?? 0,
        );
      });

  Future<void> markRead(String id) => _call(() => _dio.patch<void>('/notifications/$id/read'));

  Future<void> markAllRead() => _call(() => _dio.post<void>('/notifications/read-all'));
}
