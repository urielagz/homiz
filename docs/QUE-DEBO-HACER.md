# Lo que debo hacer: Homiz / Zugar

Lista de pendientes para que el sistema quede **seguro, legal y listo para clientes reales**.
El sistema ya tiene las protecciones en el código (ver `docs/decisiones.md`, decisión 123); lo de aquí
solo lo puedes hacer tú porque usa tus cuentas, tus datos o decisiones legales.

Marca cada casilla cuando lo termines (`[ ]` → `[x]`).

---

## 1. Urgente: esta semana

### 1.1 Cambiar las contraseñas que se compartieron

Algunas claves se escribieron en conversaciones o capturas. Aunque nadie las haya usado, hay que cambiarlas.

- [ ] **Cloudflare R2** (donde se guardan fotos y documentos)
  1. Entra a dash.cloudflare.com → R2 → «Manage API tokens».
  2. Crea un token nuevo con permiso «Object Read & Write» solo para tu bucket.
  3. Copia el nuevo `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` en `backend/.env`.
  4. Borra el token anterior.
- [ ] **Gmail** (los correos que manda el sistema)
  1. Entra a myaccount.google.com/apppasswords.
  2. Elimina la contraseña de aplicación anterior y crea otra.
  3. Ponla en `SMTP_PASS` de `backend/.env`.
- [ ] Reinicia la API después de cambiar el `.env`.

### 1.2 Respaldos con datos personales

En la carpeta `respaldos/` hay copias de la base de datos con nombres, correos y teléfonos de personas.

- [ ] Guárdalas **cifradas**: en una memoria o disco con BitLocker, o en un ZIP con contraseña AES-256 (7-Zip).
- [ ] Bórralas de la computadora cuando ya no las necesites.
- [ ] Nunca las subas a GitHub, Drive o WhatsApp sin cifrar.

### 1.3 Archivo `web.zip`

- [ ] En la carpeta del proyecto hay un `web.zip` (75 MB, copia vieja del sitio). Si no lo usas, bórralo.

---

## 2. Legal: con tu abogado o contador

### 2.1 Aviso de privacidad (obligatorio por ley)

El aviso completo ya está publicado en `/aviso-de-privacidad`, pero le faltan tus datos.

- [ ] Abre `web/src/lib/legal.ts` y completa lo que dice «POR CONFIRMAR»:
  - Razón social o nombre de la persona responsable (como aparece ante el SAT).
  - RFC.
  - Domicilio completo.
  - Correo y teléfono para temas de privacidad (hoy: hola@zugar.mx y +52 998 555 0142).
- [ ] Pide a tu **abogado** que revise el texto del aviso (`web/src/components/PrivacyText.tsx`).
- [ ] Si cambias el aviso, actualiza la fecha `PRIVACY_VERSION` en `web/src/lib/legal.ts` y en `backend/src/config/legal.ts`.
- [ ] Define quién responderá las solicitudes de derechos ARCO. La ley da 20 días hábiles para contestar.

### 2.2 Facturación (SAT)

- [ ] Los recibos que genera el sistema son **comprobantes internos**, no facturas. Pregunta a tu **contador** cómo emitir la factura (CFDI) de cada renta cobrada.

### 2.3 Venta de casas (PROFECO)

- [ ] Si vendes vivienda, revisa con tu abogado la **NOM-247-SE-2021**:
  - precios totales en pesos;
  - aviso de privacidad visible;
  - contrato de adhesión registrado ante PROFECO.

### 2.4 Ley Antilavado

- [ ] Pregunta a tu contador si alguna renta o venta supera los montos de «actividad vulnerable». Las rentas mensuales altas o las ventas grandes deben avisarse al SAT.

---

## 3. Publicar en internet de verdad

Hoy el sistema corre en **tu computadora** con direcciones temporales (`trycloudflare.com`) que cambian solas.
Sirve para pruebas, **no para clientes reales**. La guía técnica completa está en `docs/produccion.md`.

### 3.1 Dominio

- [ ] Compra o confirma tu dominio (por ejemplo `zugar.mx`) y decide las direcciones:
  - `zugar.mx`: sitio y panel (`zugar.mx/admin`).
  - `api.zugar.mx`: servidor.
  - `app.zugar.mx`: app web (opcional).

### 3.2 Servidor (Render)

- [ ] Crea una cuenta en render.com. El plan con base de datos y respaldos diarios tiene costo mensual; revísalo.
- [ ] Sigue la sección 2 de `docs/produccion.md` (o pídeselo a tu desarrollador). El archivo `render.yaml` ya trae casi todo listo.
- [ ] Captura en Render las claves nuevas del punto 1.1, nunca las viejas.
- [ ] Crea tu cuenta de propietaria en el sistema nuevo. Las cuentas de prueba (Lucía, Mariana, Diego, Valeria, Laura) **no existen en producción**.

### 3.3 App en Google Play

- [ ] Crea la **llave de firma** de la app (sección 3 de `docs/produccion.md`). Guárdala en dos lugares seguros: **si se pierde, no podrás actualizar la app nunca más**.
- [ ] Crea tu cuenta de desarrollador en Google Play Console (pago único).
- [ ] En «Seguridad de los datos» declara:
  - qué datos se piden: nombre, correo, teléfono, pagos y fotos de reportes;
  - que el usuario puede eliminar su cuenta desde la app y en `https://zugar.mx/eliminar-cuenta`.
- [ ] En Google Cloud, limita las llaves de Firebase a tus dominios y al paquete `mx.zugar.homiz`.

---

## 4. Cada mes (mantenimiento)

- [ ] Restaura un respaldo en una base de prueba para confirmar que funciona. Render guarda copias diarias.
- [ ] Revisa actualizaciones de seguridad, o pídeselo a tu desarrollador:
  - en `backend/` y `web/`: `npm audit --omit=dev`;
  - en `mobile/`: `flutter pub outdated`.
- [ ] Revisa en el panel quién tiene cuenta del personal y da de baja a quien ya no trabaje contigo.

---

## 5. Buenas prácticas para ti y tu equipo

- Cada persona usa **su propia cuenta**; nunca compartan contraseñas.
- Contraseñas largas y distintas para el panel, Gmail, Cloudflare, Render y Google Play. Activa la verificación en dos pasos en todas.
- Marca «visible para el cliente» solo en los documentos que el inquilino debe ver.
- Para hacer inquilino a alguien usa siempre **«Rentar casa»**: así se generan sus pagarés y la casa sale sola del sitio.
- Si alguien pide borrar sus datos, puede hacerlo él mismo en la app o en `/eliminar-cuenta`. Si te lo pide por correo, atiéndelo dentro de los 20 días hábiles.

---

## Resumen rápido

| # | Qué | Quién | Urgencia |
|---|---|---|---|
| 1 | Cambiar claves de R2 y Gmail | Tú | Esta semana |
| 2 | Cifrar o borrar respaldos y `web.zip` | Tú | Esta semana |
| 3 | Completar datos del aviso de privacidad | Tú + abogado | Antes de publicar |
| 4 | Facturación CFDI de rentas | Contador | Antes de cobrar en el sistema |
| 5 | Publicar en Render con dominio propio | Tú o desarrollador | Antes de clientes reales |
| 6 | Llave de firma y Google Play | Tú o desarrollador | Antes de publicar la app |
| 7 | Revisión mensual (respaldos y actualizaciones) | Tú o desarrollador | Cada mes |
