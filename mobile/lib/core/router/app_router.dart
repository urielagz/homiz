import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/appointments/presentation/appointments_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/splash_page.dart';
import '../../features/auth/presentation/providers/session_provider.dart';
import '../../features/home/presentation/home_page.dart';
import '../../features/notifications/presentation/notifications_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/property/presentation/property_page.dart';
import '../widgets/homiz_bottom_nav.dart';

const _authRoutes = {'/login', '/register'};

/// Decide a dónde ir según la sesión. Pura para poder probarla sin widgets.
@visibleForTesting
String? sessionRedirect({required bool splashDone, required AsyncValue<Object?> session, required String location}) {
  // Mientras se recupera la sesión guardada (o si no hubo red) se queda en la bienvenida.
  if (!splashDone || session.isLoading || session.hasError) return location == '/splash' ? null : '/splash';
  final signedIn = session.value != null;
  if (!signedIn) return _authRoutes.contains(location) ? null : '/login';
  if (location == '/splash' || _authRoutes.contains(location)) return '/home';
  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  // Avisa al router cuando cambia la sesión o termina la bienvenida.
  final refresh = ValueNotifier<int>(0);
  ref.listen(sessionProvider, (_, _) => refresh.value++);
  ref.listen(splashDelayProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  final router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) => sessionRedirect(
      splashDone: ref.read(splashDelayProvider).hasValue,
      session: ref.read(sessionProvider),
      location: state.matchedLocation,
    ),
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, _) => const LoginPage()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterPage()),
      GoRoute(path: '/profile', builder: (_, _) => const ProfilePage()),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsPage()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _TabsShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomePage())]),
          StatefulShellBranch(routes: [GoRoute(path: '/property', builder: (_, _) => const PropertyPage())]),
          StatefulShellBranch(routes: [GoRoute(path: '/appointments', builder: (_, _) => const AppointmentsPage())]),
        ],
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

class _TabsShell extends StatelessWidget {
  const _TabsShell({required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: HomizBottomNav(
        currentIndex: shell.currentIndex,
        // Tocar la pestaña activa regresa a su inicio.
        onTap: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
      ),
    );
  }
}
