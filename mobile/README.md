# Homiz · App móvil (Flutter)

App del cliente/inquilino y del personal de Inmobiliaria Zugar (Flutter 3, Riverpod 3, go_router, Dio).

- **Fase 3 (lista):** tema, navegación con barra inferior, widgets compartidos, cliente HTTP con renovación de
  sesión, bienvenida, inicio de sesión, «Crea tu cuenta», perfil y notificaciones.
- **Fase 4 (lista):** pantallas del cliente conectadas a la API: Inicio (próximo pago, cita y reportes), Mis citas,
  detalle de cita con «Mis Datos» y chat, solicitar visita, Mi propiedad (Resumen, Expediente, Pagos y
  Mantenimiento), nuevo reporte con fotos, seguimiento del reporte, perfil y notificaciones con navegación.
- **Fase 5 (lista):** vistas del personal (broker y administración) con el mismo diseño: Pendientes (citas por
  confirmar, pagarés vencidos, reportes nuevos), Propiedades con su ficha y pestañas, Agenda con confirmar /
  rechazar / reprogramar / realizada / cancelar, «Registrar pago», `UpdateStatusSheet` y directorio de proveedores
  con Llamar / Correo. Las acciones se ocultan si falta el permiso (`PermissionGate`); la API vuelve a validar.

### Verla en Chrome (sin emulador)

```bash
flutter build web --release --dart-define=API_URL=http://localhost:3000/api/v1
python -m http.server 5600 --directory build/web   # y abrir http://localhost:5600
```

El backend necesita `CORS_ORIGINS=http://localhost:5600` en su `.env`.

> **Documentos y fotos en el emulador:** las URL firmadas usan `API_PUBLIC_URL` del backend. Para abrirlas desde
> el emulador de Android pon `API_PUBLIC_URL=http://10.0.2.2:3000` en `backend/.env` (o la IP de tu PC si usas un
> teléfono físico).

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

Las pruebas no necesitan servidor: usan un adaptador HTTP simulado (`test/helpers.dart`) con respuestas que copian
la forma de la API y los datos del seed (`test/fixtures.dart`), tokens en memoria y sin descargar fuentes.

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
  features/                     Cada una con data/models (freezed), data/repositories (Dio),
                                presentation/providers (Riverpod), presentation/screens y presentation/widgets
    auth/                       Usuario, sesión y pantallas de acceso
    home/                       Inicio (panel del cliente)
    appointments/               Mis citas, detalle con chat, catálogo y solicitar visita
    property/                   Mi propiedad: Resumen y Expediente
    payments/                   Pagarés, recibos y fichas de cobro
    maintenance/                Reportes, nuevo reporte con fotos y seguimiento
    documents/                  URL firmadas: ver documentos y subir fotos
    providers/                  Directorio de proveedores (personal)
    notifications/              Bandeja de avisos
    profile/                    Perfil, editar información y cambiar contraseña
assets/
  images/logo_zugar.png         Marcador del logo (reemplazar por el definitivo)
  illustrations/*.svg           Marcadores de las ilustraciones del panel
```
