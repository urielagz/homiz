import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/homiz_header.dart';
import '../../../core/widgets/states.dart';
import '../../auth/presentation/providers/session_provider.dart';

/// Pestaña Mi propiedad (personal: Propiedades). El detalle con sus pestañas llega en la Fase 4.
class PropertyPage extends ConsumerWidget {
  const PropertyPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isStaff = ref.watch(sessionProvider.select((s) => s.value?.isStaff ?? false));
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HomizHeader(section: isStaff ? 'Propiedades' : 'Mi propiedad'),
          Expanded(
            child: EmptyState(
              icon: Icons.apartment_outlined,
              title: isStaff ? 'Propiedades a tu cargo' : 'Aún no tienes una propiedad asignada',
              message: isStaff
                  ? 'Aquí verás las casas que atiendes, con su expediente, pagos y mantenimiento.'
                  : 'Cuando firmes tu contrato verás aquí tu expediente, pagos y mantenimiento.',
            ),
          ),
        ],
      ),
    );
  }
}
