# Decisiones

Registro de ambigüedades del prompt y de contradicciones con el sitio existente (regla: **gana el sitio existente**).

| # | Tema | Prompt | Decisión |
|---|---|---|---|
| 1 | Motivos de solicitud (`leads.reason`) | `rent`, `buy`, `publish`, `other` | Se guardan los valores que envía el sitio: `visita`, `rentar`, `comprar`, `publicar`, `otro`. `visita` cubre las solicitudes del inicio y de la ficha. |
| 2 | Estado de propiedad | `availability`: `available`, `rented`, `sold`, `unavailable` | Se usan los estados del panel: `status` (`disponible`, `reservada`, `rentada`, `borrador`) + `visibility` (`publicada`, `pausada`, `borrador`). Se agrega `vendida` para ventas cerradas. |
| 3 | Operación | `rent` \| `sale` | Se conserva `renta` \| `venta` (y `compra` del lado del cliente en formularios). |
| 4 | Estados de cita | `requested`, `confirmed`, `rejected`, `cancelled`, `rescheduled`, `completed` | El panel usa `por-confirmar`, `confirmada`, `realizada`, `cancelada`; reprogramar regresa a `por-confirmar`. Se agrega `rechazada` para la app móvil. |
| 5 | Identificadores | UUID | UUID como llave primaria + `code` legible (`ZUG-001`, `CIT-024`) + `slug` público, porque el panel y el sitio muestran esas claves. |
| 6 | Campos de propiedad | `title`, `bedrooms`, `bathrooms`… | Se respetan los del panel: `name`, `rec`, `banos`, `m2`, `terreno`, `est`, `age`, `furnished`, `maintenance`, `deposit`, `available_from`, `type`, `zone`, `zone_key`, `map_query`. |
| 7 | Amenidades | Tabla `amenities` + relación | El panel no tiene catálogo compartido: cada propiedad guarda sus amenidades como texto. Se usa `property_amenities(property_id, name)` sin tabla catálogo. |
| 8 | Bloqueo de login | 5 intentos → 15 min | Se aplica 15 min en el backend (configurable). El modo sin servidor del panel conserva 30 s. |
| 9 | Fecha de la cita de Laura | «jue 16 oct 5:00 pm» | El 16 de octubre de 2026 es viernes y ya pasó respecto a la fecha del proyecto (20 oct 2026). Se usa **jueves 22 de octubre de 2026, 5:00 pm** para conservar «jueves» y que sea la próxima cita. |
| 10 | Casas repetidas entre panel y sitio | — | Ceiba, Patio, Olivo, Luz, Nativa y Almendra existen en ambos con datos un poco distintos (p. ej. m² de Casa Nativa). El seed usa los valores del **panel**; el sitio los tomará de la API en la Fase 6. |
| 11 | Nombres parecidos | — | «Laura Medina» (cliente del panel) y «Laura Mendez» (inquilina del prompt) son personas distintas; se conservan ambas. |
| 12 | Amenidades de Casa Las Palmas | «Alberca» | Se guarda como amenidad junto con «Jardín privado» y «Se aceptan mascotas» (tiene 1 mascota). |
| 13 | Entorno | Node 20, Docker | La máquina tiene Node 24 y PostgreSQL 18 instalado como servicio, sin Docker. Se deja `docker-compose.yml` y el backend funciona igual con la base local. `engines` pide Node ≥ 20. |
| 14 | Versiones de librerías | — | Se instalaron las vigentes: Express 5, Zod 4, TypeScript 7. El backend es módulo ES (`"type": "module"`). |
| 15 | Contraseña del seed | «documentada en el README» | Todos los usuarios de ejemplo usan `Zugar2026!` (cumple la política: mayúscula, minúscula y número). |
| 16 | Refresh token | «JWT refresh … guardar hash» | Es un token **opaco** aleatorio (no JWT); en la base se guarda su HMAC-SHA256 con `JWT_REFRESH_SECRET`. Así se puede revocar y detectar reutilización. |
| 17 | Permisos en el token | — | El access token solo lleva `sub` y `type`. Roles, permisos y estado activo se leen de la base en cada petición, para que una baja o un cambio de permisos apliquen de inmediato. |
| 18 | Cuenta bloqueada | Sin mensaje definido | Responde 423 `ACCOUNT_LOCKED`: «Por seguridad tu cuenta está bloqueada. Intenta de nuevo en N minutos.» El correo inexistente y la contraseña incorrecta comparten el mensaje genérico. |
| 19 | Correo de recuperación | — | No hay proveedor de correo aún: en desarrollo cada correo se guarda en `backend/outbox/`; en pruebas, en memoria; en producción se registra un aviso hasta configurar el proveedor en `mail.service.ts`. |
| 20 | Registro con correo existente en clientes | — | Si la inmobiliaria ya tenía a la persona como cliente (mismo correo, sin cuenta), el registro vincula ese expediente en lugar de duplicarlo. |
| 21 | Ubicación de las pruebas | `backend/` solo con `src/` y `db/` | Las pruebas viven en `backend/src/__tests__/` (subcarpeta permitida) y usan una base dedicada `TEST_DATABASE_URL` que se borra en cada corrida; se niegan a correr si coincide con `DATABASE_URL`. |
| 22 | Broker en el catálogo público | «sin datos del broker» | El sitio muestra «Te acompaña: Mariana Solís» en la solicitud de visita, así que el catálogo público devuelve **solo el nombre** (`asesor`), nunca teléfono, correo ni id. Gana el sitio. |
| 23 | Solicitud de visita del sitio | — | Una solicitud `visita` con fecha y hora crea el expediente del cliente (o usa el que ya existe con ese correo) y una cita «por confirmar». Si el broker ya tiene una cita a esa hora, se guarda la solicitud sin cita y él propone otro horario. |
| 24 | Pago parcial | — | Un pagaré solo admite un pago vigente que debe cubrir el monto completo (400 `AMOUNT_MISMATCH`). Para otro monto, primero se edita el pagaré. |
| 25 | Pagarés al finalizar un contrato | — | No se borran: los futuros sin pagar quedan en el nuevo estado `cancelled` (migración 003). |
| 26 | Fotos del sitio vs. subidas | — | Las fotos del seed (`casa-ceiba.jpg`) son archivos de `web/assets/img`; la API las devuelve tal cual. Las subidas viven en el almacenamiento (`properties/ZUG-###/…`) y se devuelven con URL firmada. |
| 27 | Pagos del cliente | — | El cliente ve folio, fecha y monto de sus pagos, pero no quién los registró. |
| 28 | Push | FCM | Interfaz única: `mock` en desarrollo y pruebas; `fcm` usa la API HTTP v1 con la cuenta de servicio (sin dependencias extra). El envío real con FCM y con Cloudflare R2 no se probó: requiere credenciales. |
| 29 | Script de base de datos | — | `npm run db:setup` ejecuta todos los `.sql` de `db/` en orden y solo necesita `DATABASE_URL` (no los secretos JWT). |
| 30 | Acentos en la app | Textos del prompt sin acentos («Iniciar sesion», «Contrasena») | La interfaz usa la ortografía correcta del español de México: «Iniciar sesión», «Contraseña», «Regístrate aquí». |
| 31 | Logo e ilustraciones | Arte del diseño | Mientras llegan los archivos finales, `assets/images/logo_zugar.png` y `assets/illustrations/*.svg` son marcadores con los mismos nombres; basta reemplazarlos. Si el logo falta, se muestra el texto «Zugar.». |
| 32 | Pestañas en la Fase 3 | — | Inicio, Mi propiedad y Citas muestran el encabezado y un estado vacío; su contenido llega en las Fases 4 (cliente) y 5 (personal). Para el personal, «Mi propiedad» se titula «Propiedades». |
| 33 | Recuperar contraseña en la app | — | El login incluye «¿Olvidaste tu contraseña?», que llama a `POST /auth/forgot-password`; el cambio con el enlace del correo se hace fuera de la app. |
| 34 | Reintento tras renovar el token | — | La petición original se repite con el cliente sin interceptores: repetirla con el principal podía bloquear la cola si el reintento volvía a responder 401. |
| 35 | Compresión de fotos | «comprimir antes de subir» | Las fotos de cámara y galería se reducen al tomarlas (lado mayor 1600 px, calidad 80) con image_picker; no se agrega otra dependencia. Máximo 5 archivos por envío. |
| 36 | «Editar mis datos» en la cita | `PATCH /users/me` solo con nombre, teléfono y nacimiento | Se agregó `client: { budgetAmount, hasPets, petsCount, occupants }` (solo clientes; el personal recibe 400). El texto del presupuesto se arma como en el panel: «$15,000 MXN / mes». |
| 37 | Solicitar visita desde la app | «desde el detalle de una propiedad del catálogo» | «Mis citas» tiene «Solicitar visita» → catálogo (`GET /properties`) → ficha con «¿Te imaginas viviendo aquí?» (el mismo título que el sitio), día, hora y comentarios → `POST /appointments`. |
| 38 | Fotos de las casas | — | Las fotos del seed son archivos del sitio sin URL en la API; la app muestra el recuadro gris (`placeholderBox`) hasta que se suban fotos al almacenamiento. |
| 39 | Ver documentos | «abre el visor (PDF/imagen)» | La app pide la URL firmada y la abre con el visor del teléfono (`url_launcher`), sin agregar un visor de PDF propio. |
| 40 | Ficha de mantenimiento | — | En «Reportes» se toca un reporte para ver su ficha debajo; «Ver seguimiento» abre el detalle con la línea de tiempo. En «Historial» las fotos antes/después salen del detalle de cada reporte. |
| 41 | Pestaña inicial de Mi propiedad | — | Las tarjetas del inicio abren `/property?tab=2` (Pagos) y `?tab=3` (Mantenimiento); las notificaciones de pagos, recibos, reportes y citas llevan a su pantalla. |
| 42 | Organización de pantallas | `presentation/screens` | Las pantallas de la Fase 3 se movieron con `git mv` de `presentation/` y `presentation/pages/` a `presentation/screens/`, como pide la convención 6.5. |
| 43 | Navegación del personal | Punto 13 «reutiliza el mismo sistema visual» | Misma barra de 3 íconos: casa = **Pendientes** (citas por confirmar, pagarés vencidos, reportes nuevos y resumen), edificio = **Propiedades**, calendario = **Agenda**. El directorio de proveedores se abre desde Pendientes. |
| 44 | Casas del broker en la app | El broker tiene `properties.read_all` | La pestaña Propiedades del broker pide solo sus casas (`brokerId`); la administración ve todo el inventario y el asesor de cada casa. |
| 45 | Registrar pago en la app | «monto, fecha, folio» | El monto es el del pagaré y no se edita (la API exige el pago completo, decisión 24). Fecha de hoy con la hora actual; otro día se registra a las 12:00 para no cambiar de fecha por la zona horaria. |
| 46 | UpdateStatusSheet | — | Sugiere el siguiente estado (reportado → en revisión → en reparación → resuelto), exige comentario al cancelar y solo envía el proveedor si cambió. |
| 47 | Listas cortas del panel del personal | — | `overdueNotes` y `newReports` de `GET /dashboard` incluyen `propertyId` para abrir la casa desde la app. |
| 48 | Plataforma web en `mobile/` | Prompt: Android e iOS | Se agregó `mobile/web/` (`flutter create --platforms=web`) solo para revisar la app en Chrome cuando no hay emulador; no es un objetivo de publicación. |
| 49 | Minutos de bloqueo | — | El aviso de cuenta bloqueada nunca dice más de `LOGIN_LOCK_MINUTES`: el reloj de la base podía ir unos milisegundos adelante y el redondeo daba «16 minutos». |
| 50 | Diálogos con texto | — | Los diálogos que piden texto (motivo de rechazo, recuperar contraseña) son widgets con estado propio: liberar el controlador al salir de `showDialog` fallaba durante la animación de cierre. |
