# homiz

Sitio web y panel administrativo de **Zugar Inmobiliaria** (Cancún, Quintana Roo), hechos con **React + Tailwind CSS**
(Vite y TypeScript). Viven en `web/`; la versión anterior en HTML, CSS y JavaScript queda en el historial de git.

## Estructura (`web/`)

```
index.html                 Entrada del sitio público
admin/index.html           Entrada del panel (rutas con #: /admin/#/propiedades)
admin/login.html           Dirección vieja del acceso: lleva a /admin/#/login
public/                    Archivos tal cual: assets/img/ (fotos, ver LEEME.txt) y admin/ (avisos push)
src/
  main.tsx                 Rutas del sitio y redirecciones desde las direcciones .html anteriores
  styles.css, styles/      Tailwind: theme.css (colores y tipografías en @theme), base.css y components.css
  pages/                   Inicio, Propiedades, Ficha (/propiedad/:slug), Contáctanos, Cómo trabajamos, Gracias, 404
  components/              Encabezado, pie, tarjeta, mapas (Leaflet), formularios de visita, diálogos…
  lib/                     API, catálogo, enlaces a la app, favoritos, formatos y validación
  admin/                   Panel: store.ts (datos), api.ts, auth.ts, push.ts, components/ y views/ (una por sección)
```

## Antes de publicar

- **Fotos:** sube los archivos a `web/public/assets/img/` con los nombres de `LEEME.txt`.
- **Contacto:** reemplaza el teléfono `+52 998 555 0142`, el correo `hola@zugar.mx` y las redes sociales.
- **Versión final:** `cd web && npm run build` genera `web/dist/` (sitio en `/` y panel en `/admin/`). El servidor que
  la publique debe responder `index.html` para las rutas del sitio (`/propiedades`, `/propiedad/…`).

---

## Monorepo Homiz (Rentia)

> El sitio y el panel viven en **`web/`**: desde la Fase 0 eran el HTML original y desde el pedido de React + Tailwind
> son una aplicación de Vite (decisión 66 en `docs/decisiones.md`).

```
backend/      API Node.js + Express + TypeScript + PostgreSQL (/api/v1)
  src/        config, controllers, middlewares, routes, app.ts, server.ts
  db/         001_schema.sql (esquema) y 002_seed.sql (datos de ejemplo)
mobile/       App Flutter del cliente/inquilino y del personal (desde la Fase 3)
web/          Sitio público + panel administrativo (React + Tailwind CSS, Vite)
docs/         sitio-existente.md, decisiones.md (y más documentación por fase)
docker-compose.yml   PostgreSQL para desarrollo
```

### Cómo correr el backend

1. Base de datos: `docker compose up -d` **o** un PostgreSQL local (13 o superior). En local, como usuario `postgres`
   (psql o pgAdmin), crea el usuario y la base:
   ```sql
   CREATE ROLE homiz WITH LOGIN PASSWORD 'elige-una-clave';
   CREATE DATABASE homiz OWNER homiz;
   ```
   Y en `.env`: `DATABASE_URL=postgres://homiz:elige-una-clave@localhost:5432/homiz`
2. En `backend/`: copia `.env.example` a `.env` y llena `DATABASE_URL`. Para los secretos JWT ejecuta
   `npm run secrets` (después de `npm install`) y pega las dos líneas en `.env`.
3. `npm install`
4. `npm run db:setup` — crea el esquema y carga los datos de ejemplo (⚠️ borra lo que haya en la base `homiz`).
5. `npm run dev` — API en `http://localhost:3000/api/v1` (prueba: `GET /api/v1/health`).
6. Pruebas: crea una base **aparte** (p. ej. `CREATE DATABASE homiz_test OWNER homiz;`), ponla en `TEST_DATABASE_URL`
   del `.env` y ejecuta `npm test`. ⚠️ Esa base se borra y se recarga en cada corrida.

Endpoints documentados en `docs/api.md`. En desarrollo:
- Los correos de «olvidé mi contraseña» no se envían: se guardan como archivos en `backend/outbox/`.
- Los archivos subidos (documentos y fotos) se guardan en `backend/uploads/` con URL firmadas de 15 minutos.
  Para producción: `STORAGE_DRIVER=r2` y las credenciales `R2_*` de Cloudflare.
- Las notificaciones push se simulan (`PUSH_DRIVER=mock`). Para producción: `PUSH_DRIVER=fcm` y las credenciales `FCM_*`.
- Las tareas diarias (vencimientos y recordatorios) corren a las 07:00 hora de Cancún mientras el servidor esté
  encendido (`JOBS_ENABLED`, `JOBS_CRON`).

### Cómo correr la app móvil

Requiere Flutter 3.47 o superior y el backend encendido. En `mobile/`:

1. `flutter pub get`
2. `dart run build_runner build --delete-conflicting-outputs`
3. `flutter run` — en el emulador de Android la API se toma de `http://10.0.2.2:3000/api/v1`; en un teléfono físico:
   `flutter run --dart-define=API_URL=http://<IP-de-tu-PC>:3000/api/v1`
4. Pruebas: `flutter analyze` y `flutter test` (no necesitan servidor).
5. Sin emulador: se puede abrir en Chrome (ver `mobile/README.md`, «Verla en Chrome»).

En la app, `lau.mendez@correo.com` ve las pantallas del cliente; `mariana@zugar.example` (broker) y
`lucia@zugar.example` (administradora) ven las del personal.

Más detalle en `mobile/README.md`.

### Sitio y panel conectados a la API (Fase 6)

En `web/`: `npm install` y `npm run dev` → sitio en `http://localhost:5500` y panel en `http://localhost:5500/admin/`.

- La API se busca en el **puerto 3000 del mismo servidor** (`http://localhost:3000/api/v1`). Para otro servidor,
  crea `web/.env` con `VITE_API_URL=https://api.zugar.mx/api/v1`; con `VITE_API_URL=/api/v1` las peticiones pasan
  por el proxy de Vite (útil si el origen no está en `CORS_ORIGINS`).
- **Con el servidor encendido:** el listado y la ficha (`/propiedad/casa-ceiba`) muestran el catálogo real, los
  formularios envían a `/public/leads` y muestran el folio real (una visita con fecha y hora crea la cita
  «por confirmar»), y el panel entra con `/auth/login` y guarda cada cambio en la base.
- **Sin servidor:** el sitio usa su catálogo de respaldo y los envíos se simulan; el panel entra en modo de diseño
  con `lucia@zugar.example` / `Zugar2026!` y datos de ejemplo.
- **Recuperar contraseña:** el correo lleva a `/admin/#/login?token=…`, donde se crea la nueva contraseña
  (`APP_RESET_URL` del backend).

### Abrirlo desde otro equipo o con los Puertos de VS Code

El sitio, el panel y la app web buscan la API en el **puerto 3000 del mismo servidor** desde el que se abrieron
(`localhost`, la IP de la red o un puerto reenviado de VS Code). Servicios:

| Puerto | Qué es | Cómo se levanta |
|---|---|---|
| 3000 | API | `cd backend && npm run dev` |
| 5500 | Sitio y panel (`/admin/`) | `cd web && npm run dev` (ya escucha en la red y acepta los túneles de VS Code) |
| 5600 | App web | `python -m http.server 5600 --bind 0.0.0.0 --directory mobile/build/web` (después de `flutter build web --release`) |

- **En la misma red Wi-Fi:** `http://<IP de la PC>:5500` y `http://<IP de la PC>:5600`. Agrega esos orígenes a
  `CORS_ORIGINS` y abre los puertos en el firewall de Windows (perfil privado).
- **Puertos de VS Code (pestaña «Puertos» → «Reenviar un puerto»):** reenvía 3000, 5500 y 5600 y cambia la visibilidad
  de los tres a **Pública** (clic derecho → *Visibilidad del puerto*). Con `https://*.*.devtunnels.ms` en `CORS_ORIGINS`,
  la API acepta las URL de los túneles. Los documentos y fotos usan `API_PUBLIC_URL`: para verlos por el túnel, pon ahí
  la URL reenviada del puerto 3000.

### Usuarios de ejemplo (contraseña de todos: `Zugar2026!`)

| Perfil | Correo |
|---|---|
| Administradora | `lucia@zugar.example` |
| Broker | `mariana@zugar.example`, `diego@zugar.example`, `valeria@zugar.example` |
| Cliente (inquilina de Casa Las Palmas) | `lau.mendez@correo.com` |

Las diferencias entre el prompt del monorepo y el sitio existente están en `docs/decisiones.md`.
### Mapas (Leaflet + enlace de Google Maps)

- **Sitio:** el listado y la ficha muestran un mapa de Leaflet con OpenStreetMap cuando la casa tiene coordenadas
  (marcadores con ventana en el listado, círculo de zona en la ficha). Sin coordenadas o sin servidor se queda el
  mapa de Google de siempre.
- **Panel:** en *Editar propiedad*, pega el enlace de Google Maps de la casa (en Google Maps: el lugar → *Compartir*
  → copiar enlace) y presiona **Ubicar**; aparece la dirección y una vista previa. Se guarda con *Guardar cambios*.
- **Servidor:** `POST /api/v1/properties/locate { "url": "…" }`. Funciona sin clave (Nominatim de OpenStreetMap).
  Para usar la API de Google agrega en `backend/.env`: `GOOGLE_MAPS_API_KEY=tu_clave` (Geocoding y Places).
- Para una base que ya existía: `cd backend && npx tsx src/config/run-sql.ts db/004_coordenadas.sql`
  (solo llena las casas sin ubicación).

### Del sitio a la app: registrarse y agendar la visita

En una tarjeta o en la ficha de una casa, **Usar la app** abre la app con la casa elegida
(`http://<servidor>:5600/?casa=casa-ceiba`). La persona crea su cuenta (o inicia sesión) y la app abre
directamente *Solicitar visita* de esa casa para elegir día y hora.

### Notificaciones push (Firebase Cloud Messaging)

Proyecto de Firebase: **homiz-413ff**. Un solo sistema para la app (Android, iOS y web) y el panel.

1. **Servidor:** guarda la llave privada (Firebase → Configuración del proyecto → *Cuentas de servicio* →
   *Generar nueva clave privada*) como `backend/firebase-key.json` (ya está en `.gitignore`) y en `backend/.env`:
   ```
   PUSH_DRIVER=fcm
   FCM_KEY_FILE=firebase-key.json
   ```
2. **Panel y app web:** ya configurados (`web/admin/js/firebase-config.js`, `mobile/web/firebase-messaging-sw.js`).
   En el panel: menú de usuario → **Activar avisos en este navegador**. Solo funciona en `https` o `localhost`.
3. **Android:** registra la app `mx.zugar.homiz` en Firebase y copia `google-services.json` a `mobile/android/app/`;
   sus datos van en `mobile/lib/core/push/firebase_options.dart`.
4. **iPhone:** registra la app `mx.zugar.homiz`, copia `GoogleService-Info.plist` a `mobile/ios/Runner/` y sube la
   clave APNs (`.p8`, cuenta de Apple Developer) en Firebase → *Cloud Messaging*. Se compila en una Mac.

Sin Firebase configurado (`PUSH_DRIVER=mock`) todo funciona igual: los avisos quedan en la bandeja de la app.
