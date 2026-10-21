import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/states.dart';
import 'providers/notifications_provider.dart';

/// Bandeja de avisos: tocar uno lo marca como leído.
class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});

  Future<void> _run(BuildContext context, Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ApiException.from(e).message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(notificationsProvider);
    final controller = ref.read(notificationsProvider.notifier);
    final hasUnread = (inbox.value?.unreadCount ?? 0) > 0;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          if (hasUnread) TextButton(onPressed: () => _run(context, controller.markAllRead), child: const Text('Marcar todas')),
        ],
      ),
      body: switch (inbox) {
        AsyncData(:final value) when value.items.isEmpty => const EmptyState(
            icon: Icons.notifications_none_rounded,
            title: 'Sin notificaciones',
            message: 'Aquí te avisaremos de pagos, citas y mantenimiento.',
          ),
        AsyncData(:final value) => RefreshIndicator(
            onRefresh: controller.reload,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              itemCount: value.items.length,
              separatorBuilder: (_, _) => const Divider(indent: AppSpacing.screen, endIndent: AppSpacing.screen),
              itemBuilder: (context, i) {
                final n = value.items[i];
                return ListTile(
                  contentPadding: AppSpacing.screenInsets,
                  onTap: () => _run(context, () => controller.markRead(n.id)),
                  leading: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(color: n.read ? Colors.transparent : AppColors.primary, shape: BoxShape.circle),
                  ),
                  minLeadingWidth: 10,
                  title: Text(n.title, style: AppTextStyles.cardTitle.copyWith(fontWeight: n.read ? FontWeight.w500 : FontWeight.w600)),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: AppSpacing.xxs),
                      Text(n.message, style: AppTextStyles.body.copyWith(fontSize: 13)),
                      const SizedBox(height: AppSpacing.xs),
                      Text('${Fmt.dayMonthShort(n.sentAt)} · ${Fmt.time(n.sentAt)}', style: AppTextStyles.secondary),
                    ],
                  ),
                );
              },
            ),
          ),
        AsyncError(:final error) => ErrorState(error: error, onRetry: controller.reload),
        _ => const LoadingState(),
      },
    );
  }
}
