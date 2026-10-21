import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/homiz_header.dart';
import '../../../core/widgets/states.dart';
import '../../auth/presentation/providers/session_provider.dart';

/// Pestaña Inicio. En esta fase muestra el encabezado y un estado vacío; el panel llega en la Fase 4.
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isStaff = ref.watch(sessionProvider.select((s) => s.value?.isStaff ?? false));
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const HomizHeader(section: 'Inicio'),
          Expanded(
            child: EmptyState(
              icon: Icons.dashboard_outlined,
              title: isStaff ? 'Tu panel de trabajo' : 'Tu resumen',
              message: isStaff
                  ? 'Aquí verás las citas por confirmar, los pagarés vencidos y los reportes nuevos.'
                  : 'Aquí verás tu próximo pago, tu próxima cita y tus reportes de mantenimiento.',
            ),
          ),
        ],
      ),
    );
  }
}
