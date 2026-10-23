# homiz

Sitio web y panel administrativo de **Zugar Inmobiliaria** (Cancún, Quintana Roo). HTML, CSS y JavaScript sin dependencias: se abre con doble clic, sin servidor.

## Estructura

```
index.html                 Inicio
paginas/
  propiedades.html         Listado con filtros, orden, páginas y mapa de Google
  propiedad.html           Ficha de una casa con solicitud de visita
  contacto.html            Contáctanos: el formulario cambia según el motivo
  como-trabajamos.html     Proceso, requisitos y preguntas frecuentes
  gracias.html             Confirmación después de contactar a la asesora
assets/
  css/styles.css           Estilos del sitio (variables en :root)
  js/main.js               Comportamiento del sitio (mejora progresiva)
  img/                     Fotos del sitio y del panel (ver img/LEEME.txt)
admin/
  login.html               Inicio de sesión del panel
  index.html               Panel: Resumen, Propiedades, Clientes, Brokers y Citas
  css/admin.css            Estilos del panel
  js/                      auth.js (sesión), data.js (datos), ui.js (componentes) y un archivo por módulo
```

## Antes de publicar

- **Fotos:** sube los archivos a `assets/img/` con los nombres de `assets/img/LEEME.txt`.
- **Contacto:** reemplaza el teléfono `+52 998 555 0142`, el correo `hola@zugar.mx` y las redes sociales.
- **Formularios:** conecta tu backend en `enviarFormulario()` de `assets/js/main.js`.
- **Login del panel:** la validación actual es de demostración (`admin/js/auth.js`); reemplázala por tu API antes de publicar.
- **Mapas:** son de Google Maps en vivo. Para una ubicación exacta, cambia el texto de `q=` del iframe por la dirección o por `latitud,longitud`.

---

## Monorepo Homiz (Rentia)

> Desde la Fase 0 el sitio de arriba vive en **`web/`** (se movió con `git mv`, sin cambios). Las rutas de las secciones
> anteriores son relativas a esa carpeta: `web/index.html`, `web/paginas/…`, `web/assets/…`, `web/admin/…`.

```
backend/      API Node.js + Express + TypeScript + PostgreSQL (/api/v1)
  src/        config, controllers, middlewares, routes, app.ts, server.ts
  db/         001_schema.sql (esquema) y 002_seed.sql (datos de ejemplo)
mobile/       App Flutter del cliente/inquilino y del personal (desde la Fase 3)
web/          Sitio público + panel administrativo (estático, funciona con doble clic)
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

Los pendientes «Formularios» y «Login del panel» de la sección *Antes de publicar* ya están resueltos:

- `web/assets/js/api.js` (sitio) y `web/admin/js/api.js` (panel) usan `API_URL`, por omisión
  `http://localhost:3000/api/v1`. Para otro servidor, antes de esos archivos:
  `<script>window.ZUGAR_API_URL = 'https://api.zugar.mx/api/v1';</script>` (con `''` se desactiva).
- **Con el servidor encendido:** el listado y la ficha (`paginas/propiedad.html?slug=casa-ceiba`) muestran el catálogo
  real, los formularios envían a `/public/leads` y muestran el folio real (una visita con fecha y hora crea la cita
  «por confirmar»), y el panel entra con `/auth/login` y guarda cada cambio en la base.
- **Sin servidor (o abierto con doble clic):** todo funciona como antes, con datos y envíos simulados.
- Para usarlo con la API, sirve `web/` en `http://localhost:5500` (por ejemplo, Live Server de VS Code o
  `python -m http.server 5500 --directory web`); ese origen ya está en `CORS_ORIGINS` del `.env.example`.

### Abrirlo desde otro equipo o con los Puertos de VS Code

El sitio, el panel y la app web buscan la API en el **puerto 3000 del mismo servidor** desde el que se abrieron
(`localhost`, la IP de la red o un puerto reenviado de VS Code). Servicios:

| Puerto | Qué es | Cómo se levanta |
|---|---|---|
| 3000 | API | `cd backend && npm run dev` |
| 5500 | Sitio y panel (`/admin/login.html`) | `python -m http.server 5500 --bind 0.0.0.0 --directory web` |
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
