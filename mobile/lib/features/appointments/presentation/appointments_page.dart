import 'package:flutter/material.dart';

import '../../../core/widgets/homiz_header.dart';
import '../../../core/widgets/states.dart';

/// Pestaña Citas. La lista y el detalle llegan en la Fase 4.
class AppointmentsPage extends StatelessWidget {
  const AppointmentsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HomizHeader(section: 'Citas'),
          Expanded(
            child: EmptyState(
              icon: Icons.calendar_today_outlined,
              title: 'No tienes citas próximas',
              message: 'Cuando agendes una visita la verás aquí con su fecha, hora y estado.',
            ),
          ),
        ],
      ),
    );
  }
}
