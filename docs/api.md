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
| PATCH | `/users/me` | Sesión | `{ name?, phone?, birthDate? }` (AAAA-MM-DD) |

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
