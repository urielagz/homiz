# Decisiones

Registro de ambigüedades del prompt y de contradicciones con el sitio existente (regla: **gana el sitio existente**).

| # | Tema | Prompt | Decisión |
|---|---|---|---|
| 1 | Motivos de solicitud (`leads.reason`) | `rent`, `buy`, `publish`, `other` | Se agrega `visit` para las solicitudes de visita del inicio y de la ficha. La API acepta los valores del sitio (`rentar`, `comprar`, `publicar`, `otro`, `visita`) y los traduce. |
| 2 | Estado de propiedad | `availability`: `available`, `rented`, `sold`, `unavailable` | Se usan los estados del panel: `status` (`disponible`, `reservada`, `rentada`, `borrador`) + `visibility` (`publicada`, `pausada`, `borrador`). Se agrega `vendida` para ventas cerradas. |
| 3 | Operación | `rent` \| `sale` | Se conserva `renta` \| `venta` (y `compra` del lado del cliente en formularios). |
| 4 | Estados de cita | `requested`, `confirmed`, `rejected`, `cancelled`, `rescheduled`, `completed` | El panel usa `por-confirmar`, `confirmada`, `realizada`, `cancelada`; reprogramar regresa a `por-confirmar`. Se agrega `rechazada` para la app móvil. |
| 5 | Identificadores | UUID | UUID como llave primaria + `code` legible (`ZUG-001`, `CIT-024`) + `slug` público, porque el panel y el sitio muestran esas claves. |
| 6 | Campos de propiedad | `title`, `bedrooms`, `bathrooms`… | Se respetan los del panel: `name`, `rec`, `banos`, `m2`, `terreno`, `est`, `age`, `furnished`, `maintenance`, `deposit`, `available_from`, `type`, `zone`, `zone_key`, `map_query`. |
| 7 | Amenidades | Tabla `amenities` + relación | El panel no tiene catálogo compartido: cada propiedad guarda sus amenidades como texto. Se usa `property_amenities(property_id, name)` sin tabla catálogo. |
| 8 | Bloqueo de login | 5 intentos → 15 min | Se aplica 15 min en el backend (configurable). El modo sin servidor del panel conserva 30 s. |
