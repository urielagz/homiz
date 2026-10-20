# Sitio existente (antes de integrar el monorepo)

Resumen técnico del sitio estático aprobado, para que la API use los mismos campos, estados y nombres.
Respaldo: commit `437f07b` — "Respaldo: sitio estático antes de integrar monorepo".

## 1. Estructura y rutas

```
index.html                   Inicio (formulario de solicitud de visita en #contacto)
paginas/propiedades.html     Listado (filtros por URL, orden, páginas, Google Maps)
paginas/propiedad.html       Ficha + «¿Te imaginas viviendo aquí?» (#contactar, agenda visita)
paginas/contacto.html        Contáctanos (motivo: rentar / comprar / publicar / otro)
paginas/como-trabajamos.html Proceso, requisitos, preguntas frecuentes
paginas/gracias.html         Confirmación tras solicitar visita desde la ficha
assets/css/styles.css        Estilos públicos
assets/js/main.js            JS público (mejora progresiva)
assets/img/                  Fotos (aún no subidas; ver LEEME.txt)
admin/login.html             Login del panel
admin/index.html             Panel (SPA por hash: #/resumen, #/propiedades, #/personas, #/brokers, #/citas)
admin/css/admin.css          Estilos del panel
admin/js/                    auth.js, data.js, ui.js, app.js + resumen, propiedades, personas, brokers, citas
```

Todas las rutas son relativas. `main.js` calcula la raíz con `new URL('../../', document.currentScript.src)`
(constantes `ROOT`, `PAGINAS`, `IMG`), por eso funciona en cualquier carpeta y con `file://`.

## 2. Sitio público — `assets/js/main.js`

### Catálogo (`CATALOGO`, 12 casas)
| Campo | Tipo / valores | Ejemplo |
|---|---|---|
| `slug` | texto único | `casa-ceiba` |
| `img` | opcional; nombre de foto si difiere del slug | `huayacan-01` |
| `name` | texto | `Casa Ceiba` |
| `zona` | texto visible | `Arbolada` |
| `zonaKey` | clave de filtro | `arbolada`, `cumbres`, `huayacan`, `lagos-del-sol`, `palmaris`, `aqua`, `santa-fe`, `jardines-del-sur`, `sm-50` |
| `mapa` | texto para Google Maps (`q=`) | `Residencial Arbolada, Cancún, Quintana Roo` |
| `op` | `renta` \| `venta` | `renta` |
| `price` | número MXN (mensual si renta) | `28000` |
| `rec`, `banos`, `m2`, `est` | números (`banos` admite .5) | `3`, `2`, `180`, `2` |
| `pets` | booleano | `true` |
| `amueblada` | `si` \| `semi` \| `no` | `no` |
| `tipo` | `casa` \| `casa-condominio` \| `townhouse` | `casa` |
| `asesor` | nombre del broker (solo se muestra en la solicitud) | `Mariana Solís` |
| `orden` | número para «Más recientes» | `12` |

### Filtros del listado (parámetros de URL, `method="get"`)
`operacion` (renta|venta), `tipo`, `zona` (= `zonaKey`), `precio_max` (número o `mas` = más de $5 M), `presupuesto`
(alias desde el buscador del inicio), `recamaras` (`4` = 4 o más), `banos`, `estacionamientos`, `superficie` (mínimos),
`mascotas` (`si`), `amueblada`, `orden` (`precio-asc` | `precio-desc` | `recientes`), `vista` (`cuadricula` | `lista` | `mapa`),
`pagina` (6 por página).

### Formularios (todos `action="#"`, envío simulado)
- **`enviarFormulario(form, tipo)`** → `Promise<{ folio }>` (hoy: folio `Z-#####` local tras 700 ms). Es el único punto a conectar.
  `tipo`: `cita` (solicitud de visita) o `contacto`.
- **Inicio (`index.html#contacto`)** y **ficha (`propiedad.html#contactar`)** = solicitud de visita.
  Campos: `nombre`, `correo`, `telefono` (opcional), `nacionalidad`, `ocupacion`, `presupuesto`, `personas`,
  `mascotas` (`si`|`no`), `mascotas_detalle`, `fecha` (AAAA-MM-DD), `horario` (`10:00`, `11:30`, `13:00`, `16:00`, `17:30`),
  `comentarios`. Inicio agrega `operacion` (renta|compra), `casa` (slug o `sin-definir`), `recamaras`, `banos`.
  Ficha agrega `propiedad` (clave `ZUG-HUA-024`, oculto), `forma_pago` (contado|credito-bancario|infonavit|no-se), `privacidad` (casilla).
- **Contáctanos**: `motivo` (`rentar`|`comprar`|`publicar`|`otro`) + `nombre`, `correo`, `telefono`; según motivo:
  rentar/comprar → `nacionalidad`*, `ocupacion`* (solo rentar), `operacion`, `casa`, `presupuesto`, `recamaras`, `banos`,
  `personas`, `mascotas`, `mascotas_detalle`; publicar → `inmueble_tipo`, `inmueble_operacion` (renta|venta|ambas),
  `inmueble_zona`, `inmueble_recamaras`, `inmueble_precio`; todos → `mensaje` (obligatorio en publicar/otro).
  Parámetros de entrada: `?motivo=…&casa=slug` (también `alerta-busqueda` y `asesoria-zona` → otro con texto precargado).
- Tras enviar desde la ficha se guarda en `sessionStorage['zugar-ultimo-contacto']`
  `{ nombre, motivo:'visita', folio, fecha, hora, asesor }` y se abre `gracias.html`.

### Otros
- Favoritos: `localStorage['zugar-favoritos']` = arreglo de nombres de casa.
- Mapas: iframe `https://maps.google.com/maps?q=…&z=…&hl=es&output=embed` (sin clave de API).
- Calculadora de crédito: solo cálculo local.
- Hoy existe **una sola ficha** (`propiedad.html`, casa en Huayacán, clave `ZUG-HUA-024`).

## 3. Panel — `admin/js/`

Patrón: scripts clásicos (sin módulos) que cuelgan todo de `window.Z`. Datos en memoria (`Z.data`), se reinician al recargar.

### `data.js`
- **brokers**: `id` (`mariana`|`diego`|`valeria`), `name`, `initials`, `role`, `zones`, `email`, `phone`, `photo`, `active`.
- **properties**: `id` (`ZUG-001`…), `name`, `type` (Casa|Casa en condominio|Townhouse), `zone`, `city`, `address`, `street`,
  `op` (`renta`|`venta`), `price`, `rec`, `banos`, `m2`, `terreno`, `est`, `age`,
  `status` (`disponible`|`reservada`|`rentada`|`borrador`), `visibility` (`publicada`|`pausada`|`borrador`), `broker` (id),
  `maintenance` (texto), `deposit`, `availableFrom` (AAAA-MM-DD), `furnished` (texto), `desc`, `amenities` (arreglo de textos,
  propios de cada casa), `photos` ([{ `src`, `label` }], la primera es portada), `published`, `updated`, `updatedAt`.
- **people**: `id` (`p1`…), `name`, `email`, `phone`, `type` (`cliente`|`inquilino`), `label` (opcional, p. ej. «Inquilina»),
  `property` (id), `broker` (id), `follow` (Visita confirmada | Por confirmar | Contrato vigente | Reservada | En seguimiento | Nuevo contacto),
  `op` (Renta|Compra), `budget`, `needs`, `job`.
- **appointments**: `id` (`CIT-020`…), `person`, `property`, `broker`, `date`, `start`, `end` (HH:MM, visitas de 45 min),
  `status` (`confirmada`|`por-confirmar`|`realizada`|`cancelada`), `kind` (Presencial), `note`, `confirmedBy`.
- **activity** [{ `when`, `text` }], **history** { [propertyId]: [{ `when`, `text` }] }, **nextNumbers** { property, appointment, person }.
- Constantes: `Z.TODAY = '2026-10-20'`, `Z.ZONES`, `Z.TYPES`, `Z.AMENITIES` (8 opciones base), `Z.STATUS`, `Z.APPT_STATUS`, `Z.FOLLOW`.

### `auth.js` — `window.ZAuth`
- `login(email, password, remember)` → `{ ok:true, user }` | `{ ok:false, error:'invalid', left }` | `{ ok:false, error:'locked', lockedFor }`.
- `current()`, `clear()`, `lockState()`, `logout()` (→ `login.html?salida=1`), `require()` (protege `index.html`, guarda `?volver=#/ruta`).
- Sesión en `sessionStorage` o `localStorage` (si «Mantener la sesión») bajo `zugar-admin-sesion` = `{ email, name, role, exp }` (8 h).
- Bloqueo: 5 intentos → 30 s. Usuario de prueba `lucia@zugar.example` / `Zugar2026!`. **Validación solo de demostración.**
- «Olvidé mi contraseña» en `login.html` está simulado (mensaje genérico).

### Reglas de negocio ya implementadas en el panel
- Eliminar propiedad cancela sus citas próximas (quedan en historial); clientes y broker no se eliminan.
- Cambiar broker de una casa reasigna sus citas próximas.
- Reprogramar una cita la regresa a «por confirmar»; no se permiten dos citas del mismo broker a la misma hora.
- Publicar requiere al menos una foto; una casa en borrador no puede publicarse.
- Exportar = CSV generado en el navegador.

## 4. Diferencias con el prompt del monorepo (gana el sitio; ver `decisiones.md`)
- Estados de propiedad, citas y motivos de solicitud usan los valores en español de arriba.
- Las solicitudes de visita (inicio y ficha) no tienen equivalente en `leads.reason`.
- Claves de propiedad legibles (`ZUG-001`) y `slug` público conviven con el UUID.
