import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/appointments/presentation/screens/appointment_detail_page.dart';
import '../../features/appointments/presentation/screens/appointments_page.dart';
import '../../features/appointments/presentation/screens/catalog_page.dart';
import '../../features/appointments/presentation/screens/request_visit_page.dart';
import '../../features/auth/presentation/providers/session_provider.dart';
import '../../features/auth/presentation/screens/login_page.dart';
import '../../features/auth/presentation/screens/register_page.dart';
import '../../features/auth/presentation/screens/splash_page.dart';
import '../../features/home/presentation/screens/home_page.dart';
import '../../features/maintenance/presentation/screens/new_report_page.dart';
import '../../features/maintenance/presentation/screens/report_detail_page.dart';
import '../../features/notifications/presentation/screens/notifications_page.dart';
import '../../features/profile/presentation/screens/profile_page.dart';
import '../../features/property/presentation/screens/property_page.dart';
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
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/property',
              builder: (_, state) => PropertyPage(initialTab: int.tryParse(state.uri.queryParameters['tab'] ?? '')),
              routes: [
                GoRoute(path: 'maintenance/new', builder: (_, state) => NewReportPage(propertyId: state.uri.queryParameters['propertyId'] ?? '')),
                GoRoute(path: 'maintenance/:id', builder: (_, state) => ReportDetailPage(reportId: state.pathParameters['id']!)),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/appointments',
              builder: (_, _) => const AppointmentsPage(),
              routes: [
                // «catalog» va antes que «:id» para que no se tome como id de cita.
                GoRoute(path: 'catalog', builder: (_, _) => const CatalogPage()),
                GoRoute(path: 'catalog/:propertyId', builder: (_, state) => RequestVisitPage(propertyId: state.pathParameters['propertyId']!)),
                GoRoute(path: ':id', builder: (_, state) => AppointmentDetailPage(appointmentId: state.pathParameters['id']!)),
              ],
            ),
          ]),
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
