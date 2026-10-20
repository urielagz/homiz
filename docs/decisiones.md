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
