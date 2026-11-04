# Puesta en producción segura

Guía para publicar Homiz/Zugar fuera de la computadora de desarrollo. Hoy el sistema corre en una PC con
túneles temporales y en modo desarrollo: sirve para pruebas, **no para clientes reales**.

## 1. Antes de empezar (obligatorio)

1. **Cambia las credenciales que se compartieron** en conversaciones o capturas:
   - Cloudflare R2: crea un token nuevo (R2 → Manage API tokens) y borra el anterior.
   - Gmail: revoca la contraseña de aplicación anterior y crea otra (myaccount.google.com/apppasswords).
2. **Completa los datos legales** en `web/src/lib/legal.ts`: razón social, RFC y domicilio fiscal (dicen
   «POR CONFIRMAR»). Pide a tu abogado que revise `web/src/components/PrivacyText.tsx`.
3. **Respaldos locales** (`respaldos/*.dump`): tienen datos personales. Guárdalos cifrados (por ejemplo, en una
   unidad con BitLocker o un ZIP con AES-256 de 7-Zip) y bórralos de la PC cuando ya no sirvan.

## 2. Servidores (Render)

El archivo `render.yaml` crea la API, el sitio + panel y la base PostgreSQL administrada (con respaldos diarios).

1. En Render: **New → Blueprint** y elige el repositorio. Cambia los dominios de ejemplo (`zugar.mx`,
   `api.zugar.mx`, `app.zugar.mx`) por los tuyos.
2. Captura en el panel de Render los secretos marcados `sync: false` (R2, SMTP, Firebase y `DATABASE_URL`).
3. Crea las tablas **sin datos de demostración**: en la consola del servicio `homiz-api`
   `NODE_ENV=production npm run db:setup` (omite `002_seed.sql`).
4. **Usuario de base de datos con permisos mínimos**: ejecuta `backend/db/produccion/usuario_app.sql` como
   administrador (cambia la contraseña) y pon en `DATABASE_URL` el usuario `homiz_app`, no el administrador.
5. Crea la cuenta del propietario con `npm run db:hash` y un `INSERT` (o pídelo al desarrollador): en producción
   no existen las cuentas de prueba.

En modo producción la API **no arranca** si: `CORS_ORIGINS` tiene `*`, `API_PUBLIC_URL` no es `https://`,
los archivos no van a R2 o el correo no va por SMTP, o los dos secretos JWT son iguales.

## 3. App móvil (Android)

1. Genera la llave de firma **una sola vez** y guárdala en un lugar seguro (si se pierde, no podrás actualizar
   la app en Google Play):
   ```
   keytool -genkey -v -keystore homiz-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias homiz
   ```
2. Crea `mobile/android/key.properties` (está en `.gitignore`, nunca se sube):
   ```
   storeFile=C:/ruta/segura/homiz-release.jks
   storePassword=...
   keyAlias=homiz
   keyPassword=...
   ```
3. Compila apuntando a la API real: `flutter build appbundle --release --dart-define=API_URL=https://api.zugar.mx/api/v1`.
   Sin `key.properties` la compilación de release se detiene a propósito (no se firma con la llave de pruebas).
4. En Google Play → Seguridad de los datos, declara: nombre, correo, teléfono, datos financieros (pagos),
   fotos (reportes) y que el usuario puede **eliminar su cuenta** desde la app y en `https://zugar.mx/eliminar-cuenta`.

App web (opcional): `flutter build web --release --dart-define=API_URL=https://api.zugar.mx/api/v1` y publica
`mobile/build/web` en `app.zugar.mx` (Render static site o Cloudflare Pages) con las mismas cabeceras del sitio.

## 4. Después de publicar

- **Respaldos**: Render guarda copias diarias. Una vez al mes, restaura una copia en una base de prueba para
  confirmar que sirve.
- **Firebase**: en Google Cloud, restringe la API key de la app web a tus dominios y la de Android a tu paquete.
- **Dependencias**: cada mes, `npm audit --omit=dev` en `backend/` y `web/`, y `flutter pub outdated` en `mobile/`.
- **Registros**: los tokens no se escriben en los registros (`?token=` y `/files/…` aparecen como `[oculto]`).

## 5. Pendientes legales (con tu abogado o contador)

- Aviso de privacidad integral publicado en `/aviso-de-privacidad` (completa los datos del responsable).
- Los recibos del sistema son **comprobantes internos**; la factura (CFDI) de la renta se emite aparte ante el SAT.
- Venta de vivienda: NOM-247-SE-2021 (precios totales en pesos, contrato de adhesión registrado en PROFECO).
- Revisa si alguna operación supera los umbrales de actividades vulnerables (Ley Antilavado) con tu contador.
