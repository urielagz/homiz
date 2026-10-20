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