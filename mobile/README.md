# Homiz · App móvil (Flutter)

App del cliente/inquilino y del personal de Inmobiliaria Zugar (Flutter 3, Riverpod 3, go_router, Dio).

- **Fase 3 (lista):** tema, navegación con barra inferior, widgets compartidos, cliente HTTP con renovación de
  sesión, bienvenida, inicio de sesión, «Crea tu cuenta», perfil y notificaciones.
- **Fases 4 y 5:** contenido de las pestañas para el cliente y para el personal.

## Cómo correrla

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # genera *.freezed.dart y *.g.dart
flutter run                                                # emulador Android: usa http://10.0.2.2:3000/api/v1
flutter run --dart-define=API_URL=http://192.168.1.50:3000/api/v1   # teléfono físico en la misma red
```

El backend debe estar corriendo (`cd ../backend && npm run dev`). Usuarios de ejemplo en el `README.md` de la raíz
(contraseña de todos: `Zugar2026!`).

## Pruebas

```bash
flutter analyze
flutter test
```

Las pruebas no necesitan servidor: usan un adaptador HTTP simulado (`test/helpers.dart`), tokens en memoria y
desactivan la descarga de fuentes.

## Estructura

```
lib/
  main.dart · app.dart          Arranque, idioma es_MX y router
  core/
    theme/                      Colores, espaciados, tipografía (Poppins) y ThemeData
    router/app_router.dart      Rutas, redirecciones por sesión y shell con barra inferior
    network/                    Dio, interceptor de sesión, tokens cifrados y errores de la API
    utils/                      Variables de entorno, formatos (moneda, fechas) y validadores
    widgets/                    Encabezado, barra inferior, botones, tarjetas, badges, estados, cargador de archivos…
  features/
    auth/                       Modelo de usuario, repositorio, sesión y pantallas de acceso
    home/ · property/ · appointments/   Pestañas
    notifications/              Bandeja de avisos
    profile/                    Perfil, editar datos y cambiar contraseña
assets/
  images/logo_zugar.png         Marcador del logo (reemplazar por el definitivo)
  illustrations/*.svg           Marcadores de las ilustraciones del panel
```
