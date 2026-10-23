import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/push/push_controller.dart';
import 'core/router/app_router.dart';
import 'features/auth/presentation/providers/session_provider.dart';
import 'core/theme/app_theme.dart';

/// Raíz de la app: tema, idioma es_MX y router.
class HomizApp extends ConsumerWidget {
  const HomizApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Avisos push: al iniciar sesión (o recuperar la guardada) se registra este dispositivo.
    ref.listen(sessionProvider.select((s) => s.value?.id), (_, id) {
      if (id != null) unawaited(ref.read(pushProvider).register());
    });
    return MaterialApp.router(
      title: 'Homiz',
      scaffoldMessengerKey: scaffoldMessengerKey,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: ref.watch(routerProvider),
      locale: const Locale('es', 'MX'),
      supportedLocales: const [Locale('es', 'MX'), Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
