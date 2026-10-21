# API de Homiz · `/api/v1`

- Formato de error uniforme: `{ "error": { "code": "...", "message": "...", "details": ... } }`.
- Autenticación: `Authorization: Bearer <accessToken>` (JWT de 15 min).
- Paginación: `?page=1&limit=20` (máx. 100). Respuesta: `{ data: [...], pagination: { page, limit, total, pages } }`.
- Toda respuesta lleva `X-Request-Id` para rastrear la petición en los logs.

## Códigos de error comunes

| HTTP | code | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Datos inválidos. `details` = `{ campo: ["mensaje", …] }` |
| 401 | `UNAUTHENTICATED` | Falta el token o expiró |
| 401 | `INVALID_CREDENTIALS` | «El correo o la contraseña son inválidos, intente de nuevo.» |
| 403 | `FORBIDDEN` | El perfil o sus permisos no alcanzan. `details.missingPermissions` |
| 403 | `NOT_OWNER` | El recurso no pertenece a quien lo pide |
| 403 | `ACCOUNT_INACTIVE` | «Su cuenta no está activa, comuníquese con la inmobiliaria.» |
| 404 | `NOT_FOUND` | El recurso no existe |
| 409 | `EMAIL_TAKEN` | Correo ya registrado |
| 423 | `ACCOUNT_LOCKED` | 5 intentos fallidos → bloqueo de 15 min. `details.retryAfterMinutes` |
| 429 | `RATE_LIMITED` | Demasiadas solicitudes |

## Sistema

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/health` | Público | Estado del servicio y de la base (200 / 503) |

## Autenticación (`/auth`)

| Método | Ruta | Acceso | Cuerpo | Respuesta |
|---|---|---|---|---|
| POST | `/auth/login` | Público (límite estricto) | `{ email, password }` | Sesión |
| POST | `/auth/register` | Público (límite estricto) | `{ name, email, phone, password }` — crea un **cliente** | 201 · Sesión |
| POST | `/auth/refresh` | Público | `{ refreshToken }` | Sesión nueva (rota el refresh) |
| POST | `/auth/logout` | Sesión | `{ refreshToken?, allDevices? }` | 204 |
| POST | `/auth/change-password` | Sesión | `{ currentPassword, newPassword }` | `{ message }` · cierra las demás sesiones |
| POST | `/auth/forgot-password` | Público (límite estricto) | `{ email }` | `{ message }` (igual exista o no) |
| POST | `/auth/reset-password` | Público (límite estricto) | `{ token, password }` | `{ message }` |

**Sesión**: `{ accessToken, refreshToken, expiresIn, user: { id, name, email, phone, birthDate, type, initials, roles, permissions } }`.

**Contraseñas**: mínimo 8 caracteres, con mayúscula, minúscula y número (Argon2id).

**Refresh token**: opaco, 30 días, se guarda solo su hash (HMAC-SHA256). Cada uso lo rota; si se presenta uno ya
revocado se cierran todas las sesiones del usuario.

## Usuarios (`/users`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/users/me` | Sesión | Perfil propio. Clientes: incluye `client` (presupuesto, mascotas, inquilinos, propiedad) **sin** datos del broker |
| PATCH | `/users/me` | Sesión | `{ name?, phone?, birthDate? (AAAA-MM-DD), client? }`. `client` solo para clientes: `{ budgetAmount?, hasPets?, petsCount?, occupants? }` («Mis datos»; el personal recibe 400) |

## Historial (`/activity-log`)

| Método | Ruta | Acceso | Filtros |
|---|---|---|---|
| GET | `/activity-log` | Personal con `activity.read` | `propertyId`, `entity`, `action`, `from`, `to`, `page`, `limit` |

Alcance: administrador = todo; broker = solo sus propiedades (si pide `propertyId` ajeno → 403 `NOT_OWNER`); cliente = 403.
Incluye los intentos de acceso (`entity = auth`: `login_success`, `login_failed`, `account_locked`, `login_blocked`,
`login_inactive`, `logout`, `password_changed`, `password_reset_requested`, `password_reset`, `refresh_reuse`).

## Permisos (códigos)

`properties.read_all`, `properties.create`, `properties.update`, `properties.reassign`, `clients.manage`,
`contracts.manage`, `appointments.manage`, `payments.register`, `payments.correct`, `receipts.manage`,
`maintenance.manage`, `providers.manage`, `expenses.manage`, `documents.manage`, `dossier.read`, `activity.read`,
`leads.manage`, `users.manage`, `notifications.overdue`.

Broker: todos excepto `properties.reassign`, `payments.correct`, `users.manage` y `notifications.overdue`.
Administrador: todos. Los permisos se leen en cada petición: un cambio aplica de inmediato.

---

# Módulos (Fase 2)

Alcance general: **administrador** = todo; **broker** = solo sus propiedades (y lo ligado a ellas); **cliente** = solo
lo suyo. Al cliente nunca se le envían datos del broker; el personal aparece como «Zugar» en chats y líneas de tiempo.

## Catálogo público y solicitudes (`/public`, sin sesión)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/public/properties` | Catálogo publicado. Parámetros del sitio: `operacion`, `tipo` (casa · casa-condominio · townhouse), `zona`, `precio_max` (número o `mas`), `presupuesto`, `recamaras` (4 = 4 o más), `banos`, `estacionamientos`, `superficie`, `mascotas=si`, `amueblada` (si · semi · no), `orden` (precio-asc · precio-desc · recientes), `pagina`, `porPagina` (6). Campos con los nombres de `main.js`: `slug, name, op, price, rec, banos, m2, est, pets, zona, zonaKey, mapa, tipo, photos[{src,label}], asesor` (solo el nombre) |
| GET | `/public/properties/:slug` | Ficha pública (solo casas publicadas) |
| POST | `/public/leads` | Formularios del sitio. `{ reason: visita·rentar·comprar·publicar·otro, name, email, phone?, message?, propertySlug? \| propertyCode?, preferredDate?, preferredTime?, payload? }` → `201 { folio: "Z-#####", appointmentCode }`. Una visita con fecha y hora crea la cita «por confirmar» para el broker. Límite estricto por IP |

## Solicitudes del sitio (`/leads`, permiso `leads.manage`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/leads` | `status`, `reason`, paginación. Broker: las de sus casas y las que no tienen casa |
| PATCH | `/leads/:id` | `{ status: nuevo · en_seguimiento · cerrado }` |

## Personal y permisos (`/users`, permiso `users.manage`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/users` | Personal. Filtros `role`, `active`, `q` |
| POST | `/users` | `{ name, email, phone?, zones?, specialty?, roles: [broker, admin], password }` |
| PATCH | `/users/:id` | `{ name?, phone?, zones?, specialty?, roles?, active? }`. No permite quitarse el rol admin ni desactivarse; no quita el rol broker a quien tiene casas. Desactivar cierra sus sesiones |
| GET | `/users/roles` | Roles con sus permisos y catálogo de permisos |
| PUT | `/users/roles/:code/permissions` | `{ permissions: [...] }` (admin conserva siempre `users.manage`) |

## Propiedades (`/properties`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/properties` | Sesión | Personal: todo el catálogo con broker. Cliente: solo disponibles y publicadas, sin broker. Filtros `q, operation, status, visibility, zoneKey, type, brokerId, priceMin, priceMax, bedrooms, bathrooms, parking, m2Min, pets, furnished, amenity` (repetible), `sort` (price_asc · price_desc · recent · updated) |
| GET | `/properties/:id` | Sesión | Cliente: casas del catálogo o la suya |
| POST | `/properties` | `properties.create` | Queda en borrador con clave `ZUG-###`; el broker que la registra queda asignado (el admin puede indicar `brokerId`) |
| PATCH | `/properties/:id` | `properties.update` + pertenencia | Datos, `amenities: [texto]` y `photos: [{ storageKey, label }]` (la primera es portada) |
| PATCH | `/properties/:id/availability` | `properties.update` + pertenencia | `{ status?, visibility? }`. Publicar exige estado ≠ borrador y al menos una foto |
| PATCH | `/properties/:id/broker` | `properties.reassign` | `{ brokerId }`; reasigna sus citas próximas |
| DELETE | `/properties/:id` | `properties.update` + pertenencia | Baja lógica; cancela citas próximas y avisa. 409 si tiene contrato vigente |
| GET | `/properties/:id/dossier` | `dossier.read` + pertenencia, o el cliente vinculado | Expediente. Cliente: vista restringida con `sections` listas para la app |

Estados: `status` disponible · reservada · rentada · vendida · borrador; `visibility` publicada · pausada · borrador.

## Clientes y contratos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET/POST | `/clients` | `clients.manage` | Expedientes (broker: los suyos o ligados a sus casas) |
| GET/PATCH/DELETE | `/clients/:id` | `clients.manage` | Baja lógica (409 con contrato vigente; cancela citas próximas) |
| GET | `/contracts` | `contracts.manage` | Filtros `propertyId, clientId, status` |
| POST | `/contracts` | `contracts.manage` + pertenencia | `{ propertyId, clientId, startDate, endDate, monthlyRent, paymentDay (1-28), deposit?, documentId? }`. Genera un pagaré por mes, marca la casa como rentada y al cliente como inquilino. 409 si ya hay contrato vigente |
| POST | `/contracts/:id/finish` | `contracts.manage` + pertenencia | `{ endDate?, reason? }`. Los pagarés futuros sin pagar quedan `cancelled` |

## Citas (`/appointments`)

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/appointments` | Sesión | Cliente: las suyas. Broker: las que atiende. Filtros `status, from, to, propertyId, clientId` |
| POST | `/appointments` | Cliente o personal | `{ propertyId, scheduledAt (ISO con zona), note?, clientId? (personal) }` → `por-confirmar`, clave `CIT-###` |
| GET | `/appointments/:id` | Participantes | |
| POST | `/appointments/:id/confirm` | Personal (`appointments.manage`) | por-confirmar → confirmada |
| POST | `/appointments/:id/reject` | Personal | `{ reason }` |
| POST | `/appointments/:id/cancel` | Cliente o personal | `{ reason? }` |
| POST | `/appointments/:id/reschedule` | Cliente o personal | `{ scheduledAt, reason? }` → vuelve a por-confirmar |
| POST | `/appointments/:id/complete` | Personal | confirmada → realizada |
| GET/POST | `/appointments/:id/messages` | Participantes | Chat de la cita `{ body }` |

Un broker no puede tener dos citas activas a la misma hora (409 `SCHEDULE_CONFLICT`). Cada cambio avisa a la otra parte.

## Pagarés y pagos (`/promissory-notes`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/promissory-notes` | Sesión | Cliente: los suyos + `summary` («Estado de pagos»: total, paid, remaining, remainingAmount, next) |
| GET | `/promissory-notes/:id` | Sesión | Personal: incluye pagos anulados |
| PATCH | `/promissory-notes/:id` | `contracts.manage` | `{ amount?, dueDate? }` (solo pendientes o vencidos) |
| POST | `/promissory-notes/:id/payments` | `payments.register` + pertenencia | Pago en efectivo `{ amount (= monto del pagaré), paidAt, receiptFolio, notes? }`. Avisa al cliente |
| PATCH | `/promissory-notes/:id/payments/:paymentId` | `payments.correct` | Corrección |
| POST | `/promissory-notes/:id/payments/:paymentId/void` | `payments.correct` | `{ reason }`; el pagaré vuelve a pendiente o vencido |

## Luz, agua y fichas de cobro

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET/POST | `/utility-services` | `receipts.manage` | Cuentas CFE / Aguakan por propiedad (`?propertyId=`) |
| PATCH | `/utility-services/:id` | `receipts.manage` | |
| GET | `/receipts` | Sesión | Cliente: los de su casa. Filtros `propertyId, status, kind (bill · charge_slip), type (electricity · water)`. Incluye `periodLabel` («sep-oct») |
| POST/PATCH | `/receipts`, `/receipts/:id` | `receipts.manage` | Registrar / marcar pagado (avisa al inquilino) |

## Mantenimiento (`/maintenance-reports`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/maintenance-reports` | Sesión | Filtros `propertyId, status, priority, category, open` |
| POST | `/maintenance-reports` | Cliente (su casa) o `maintenance.manage` | `{ propertyId, title, description, category, priority, photos: [storageKey] (máx. 5) }`. Avisa a broker y administración |
| GET | `/maintenance-reports/:id` | Sesión | Con `timeline` y fotos antes/después (URL firmadas) |
| GET | `/maintenance-reports/:id/updates` | Sesión | Línea de tiempo |
| POST | `/maintenance-reports/:id/updates` | `maintenance.manage` + pertenencia | `{ status, comment?, providerId?, photosAfter? }`. Avisa al cliente |

Categorías: Plomería, Electricidad, Climatización, Cerrajería, Jardinería, Albercas, Pintura, Electrodomésticos, Otro.
Estados: reported · in_review · in_repair · resolved · cancelled.

## Proveedores y gastos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/providers`, `/providers/:id` | Personal | Filtros `q, specialty, active` |
| POST/PATCH/DELETE | `/providers…` | `providers.manage` | DELETE = baja lógica |
| GET | `/expenses` | `expenses.manage` | Con `totals { total, paid, pending }`. Filtros `propertyId, providerId, status, from, to` |
| POST/PATCH | `/expenses`, `/expenses/:id` | `expenses.manage` + pertenencia | `{ propertyId, concept, amount, date, status, providerId?, reportId?, nextMaintenanceDate?, notes? }` |

## Documentos y archivos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/documents/upload-url` | Según propósito | `{ propertyId, purpose (document · property_photo · maintenance_photo), mime, size }` → `{ storageKey, upload: { url, method: PUT, headers, expiresAt } }`. PDF/JPG/PNG/WEBP; 15 MB documentos, 10 MB fotos. El cliente solo `maintenance_photo` de su casa |
| POST | `/documents` | `documents.manage` + pertenencia | Confirma un documento subido: `{ propertyId, storageKey, type, name, description?, mime, visibleToClient, contractId?, … }` |
| GET | `/documents` | Sesión | Cliente: solo `visibleToClient` de su casa |
| GET | `/documents/:id/download-url` | Sesión | URL firmada de lectura (15 min) |
| PATCH | `/documents/:id` | `documents.manage` | `{ name?, description?, visibleToClient? }` |
| PUT/GET | `/files/:token` | Firma | Destino de las URL firmadas con almacenamiento local (con R2, las URL van directo al bucket) |

Flujo de subida: 1) `upload-url` → 2) `PUT` del archivo a `upload.url` con `Content-Type` → 3) confirmar
(`POST /documents`, o incluir el `storageKey` en la propiedad / el reporte).

## Notificaciones, dispositivos y dashboard

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/notifications` | Bandeja propia + `unreadCount`. Filtro `unread=true` |
| PATCH | `/notifications/:id/read` | Marcar leída |
| POST | `/notifications/read-all` | Marcar todas |
| POST | `/devices` | `{ fcmToken, platform (android · ios · web) }` |
| DELETE | `/devices/:token` | |
| GET | `/dashboard` | Cliente: `property, nextPayment, nextAppointment, openReports { count, latest }, unreadNotifications`. Personal: `counts` (citas por confirmar, pagarés vencidos, reportes nuevos, …) + listas cortas |

## Tareas programadas

Diario a las 07:00 (America/Cancun, `JOBS_CRON`): marca pagarés y recibos vencidos, recuerda los que vencen en 3 días,
avisa mantenimientos programados en 7 días y gastos pendientes (una vez por semana). Destinatarios según el prompt:
cliente, broker responsable y administradores con `notifications.overdue`. Los avisos no se repiten el mismo día
(tabla `reminder_log`).
