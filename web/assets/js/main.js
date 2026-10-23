/* ==========================================================================
   Zugar Inmobiliaria · JavaScript del sitio público
   Mejora progresiva: el sitio funciona sin JS; este archivo agrega filtros
   reales, formularios que se adaptan al motivo, favoritos, mapas en vivo,
   calculadora de crédito, etc.
   Los envíos están simulados en enviarFormulario(): ahí se conecta el backend.
   Con api.js cargado, el catálogo y los envíos usan la API (si responde).
   ========================================================================== */
document.documentElement.classList.add('js');
/* Espera a que api.js intente cargar el catálogo; sin api.js arranca de inmediato */
(window.ZugarAPI ? window.ZugarAPI.listo : function (fn) { fn(); })(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var params = new URLSearchParams(location.search);
  var WHATSAPP = '529985550142';

  /* Rutas: este archivo vive en assets/js/, así que la raíz del sitio está dos niveles arriba */
  var script = document.currentScript || $('script[src*="main.js"]');
  var ROOT = new URL('../../', script.src).href;
  var PAGINAS = ROOT + 'paginas/';
  var IMG = ROOT + 'assets/img/';

  /* ---------- Utilidades ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function num(v) { return Number(String(v).replace(/[^\d.]/g, '')) || 0; }
  function icon(id) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function storage(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }
  function folio() { return 'Z-' + String(Date.now()).slice(-5); }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fechaLarga(iso) {
    if (!iso) return '';
    var t = new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  /* Google Maps sin clave de API: mapa embebido y enlace para abrirlo */
  function mapaEmbebido(q, zoom) { return 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=' + (zoom || 15) + '&hl=es&output=embed'; }
  function mapaEnlace(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }

  /* Avisos flotantes */
  var toastBox = document.createElement('div');
  toastBox.className = 'site-toasts';
  toastBox.setAttribute('role', 'status');
  toastBox.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastBox);
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'site-toast';
    t.textContent = msg;
    toastBox.appendChild(t);
    setTimeout(function () { t.remove(); }, 3800);
  }

  /* ---------- Catálogo (cuando exista el backend, vendrá de la API) ---------- */
  var CATALOGO = [
    { slug: 'casa-zapote', name: 'Casa Zapote', zona: 'Supermanzana 50', zonaKey: 'sm-50', mapa: 'Supermanzana 50, Cancún', op: 'renta', price: 24000, rec: 3, banos: 2, m2: 150, est: 1, pets: false, amueblada: 'no', tipo: 'casa', asesor: 'Valeria Cruz', orden: 9 },
    { slug: 'casa-ceiba', name: 'Casa Ceiba', zona: 'Arbolada', zonaKey: 'arbolada', mapa: 'Residencial Arbolada, Cancún', op: 'renta', price: 28000, rec: 3, banos: 2, m2: 180, est: 2, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Mariana Solís', orden: 12 },
    { slug: 'casa-chaka', name: 'Casa Chaká', zona: 'Residencial Palmaris', zonaKey: 'palmaris', mapa: 'Residencial Palmaris, Cancún', op: 'renta', price: 32000, rec: 3, banos: 3, m2: 205, est: 2, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Mariana Solís', orden: 8 },
    { slug: 'casa-nativa', name: 'Casa Nativa', zona: 'Aqua Residencial', zonaKey: 'aqua', mapa: 'Residencial Aqua, Cancún', op: 'renta', price: 35000, rec: 3, banos: 3, m2: 215, est: 2, pets: true, amueblada: 'si', tipo: 'casa-condominio', asesor: 'Mariana Solís', orden: 10 },
    { slug: 'casa-ramon', name: 'Casa Ramón', zona: 'Residencial Cumbres', zonaKey: 'cumbres', mapa: 'Residencial Cumbres, Cancún', op: 'renta', price: 36500, rec: 3, banos: 3.5, m2: 240, est: 2, pets: true, amueblada: 'semi', tipo: 'casa', asesor: 'Diego Herrera', orden: 7 },
    { slug: 'casa-huano', name: 'Casa Huano', zona: 'Lagos del Sol', zonaKey: 'lagos-del-sol', mapa: 'Lagos del Sol, Cancún', op: 'renta', price: 38000, rec: 3, banos: 3.5, m2: 265, est: 3, pets: false, amueblada: 'no', tipo: 'casa', asesor: 'Diego Herrera', orden: 6 },
    { slug: 'casa-olivo', name: 'Casa Olivo', zona: 'Santa Fe', zonaKey: 'santa-fe', mapa: 'Fraccionamiento Santa Fe, Cancún', op: 'renta', price: 22500, rec: 2, banos: 2, m2: 135, est: 1, pets: false, amueblada: 'semi', tipo: 'casa', asesor: 'Valeria Cruz', orden: 5 },
    { slug: 'casa-del-patio', name: 'Casa del Patio', zona: 'Residencial Cumbres', zonaKey: 'cumbres', mapa: 'Residencial Cumbres, Cancún', op: 'venta', price: 4850000, rec: 3, banos: 3, m2: 240, est: 2, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Diego Herrera', orden: 11 },
    { slug: 'casa-de-la-luz', name: 'Casa de la Luz', zona: 'Lagos del Sol', zonaKey: 'lagos-del-sol', mapa: 'Lagos del Sol, Cancún', op: 'venta', price: 6200000, rec: 4, banos: 4, m2: 310, est: 3, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Diego Herrera', orden: 4 },
    { slug: 'casa-almendra', name: 'Casa Almendra', zona: 'Jardines del Sur', zonaKey: 'jardines-del-sur', mapa: 'Jardines del Sur, Cancún', op: 'venta', price: 3450000, rec: 3, banos: 2, m2: 165, est: 2, pets: false, amueblada: 'no', tipo: 'casa', asesor: 'Valeria Cruz', orden: 3 },
    { slug: 'casa-kanan', name: 'Casa Kanán', zona: 'Residencial Arbolada', zonaKey: 'arbolada', mapa: 'Residencial Arbolada, Cancún', op: 'venta', price: 4150000, rec: 3, banos: 3, m2: 190, est: 2, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Mariana Solís', orden: 2 },
    { slug: 'casa-huayacan', img: 'huayacan-01', name: 'Casa con jardín en Huayacán', zona: 'Huayacán', zonaKey: 'huayacan', mapa: 'Avenida Huayacán, Cancún', op: 'venta', price: 3900000, rec: 3, banos: 3, m2: 140, est: 2, pets: true, amueblada: 'no', tipo: 'casa-condominio', asesor: 'Mariana Solís', orden: 13 }
  ];
  /* Catálogo real de la API (api.js); si no hay servidor se queda el de arriba */
  if (window.ZugarAPI && ZugarAPI.catalogo && ZugarAPI.catalogo.length) CATALOGO = ZugarAPI.catalogo;
  var porSlug = {};
  CATALOGO.forEach(function (c) { porSlug[c.slug] = c; c.mapa += ', Quintana Roo'; });
  function fotoDe(c) { return c.foto || IMG + (c.img || c.slug) + '.jpg'; }

  /* Los botones de WhatsApp de Zugar llevan a la app Homiz (puerto 5600 del mismo servidor que el sitio:
     localhost, IP de la red o puerto reenviado de VS Code). Otra dirección: window.ZUGAR_APP_URL antes de main.js. */
  function appPorOmision() {
    if (!/^https?:$/.test(location.protocol)) return 'http://localhost:5600/'; // abierto con doble clic
    var host = location.hostname;
    if (/^[a-z0-9]+-\d+\./i.test(host) && /\.devtunnels\.ms$/i.test(host)) return location.protocol + '//' + host.replace(/-\d+\./, '-5600.') + '/';
    return location.protocol + '//' + host + ':5600/';
  }
  var APP_URL = window.ZUGAR_APP_URL || appPorOmision();
  function textoApp(t) {
    var s = t.trim();
    if (s === 'WhatsApp') return 'Usar la app';
    if (/^WhatsApp\s·/.test(s)) return 'App Homiz';
    if (s === 'Escríbenos por WhatsApp') return 'Usa la app Homiz';
    return s.replace(/por WhatsApp/g, 'en la app Homiz').replace(/WhatsApp/g, 'la app Homiz');
  }
  function enlacesAApp(ctx) {
    $$('a[href^="https://wa.me/' + WHATSAPP + '"]', ctx).forEach(function (a) {
      a.href = APP_URL;
      var use = a.querySelector('use'); if (use) use.setAttribute('href', '#i-phone');
      if (a.getAttribute('aria-label')) a.setAttribute('aria-label', 'Abrir la app Homiz');
      Array.prototype.forEach.call(a.childNodes, function (n) {
        if (n.nodeType === 3 && /WhatsApp/.test(n.textContent)) n.textContent = textoApp(n.textContent);
      });
    });
  }
  function fichaDe(c) { return PAGINAS + 'propiedad.html?slug=' + encodeURIComponent(c.slug); }

  function precioCorto(c) { return c.op === 'renta' ? money(c.price) : '$' + (c.price / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' M'; }
  function tarjeta(c) {
    var wa = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hola, me interesa ' + c.name + ' en ' + c.zona + '.');
    return '<article class="card">' +
      '<div class="card__media"><div class="photo"><img src="' + esc(fotoDe(c)) + '" alt="' + esc(c.name + ' en ' + c.zona + ', Cancún') + '" loading="lazy"></div>' +
      '<span class="badge badge--light">' + (c.op === 'renta' ? 'En renta' : 'En venta') + '</span>' +
      '<label class="fav"><input type="checkbox" aria-label="Guardar ' + esc(c.name) + ' en favoritos">' + icon('heart') + '</label></div>' +
      '<div class="card__price"><strong>' + money(c.price) + '</strong><span>' + (c.op === 'renta' ? 'MXN / mes' : 'MXN') + '</span></div>' +
      '<div class="card__body"><h3 class="card__title"><a class="card__link" href="' + fichaDe(c) + '">' + esc(c.name) + '</a></h3>' +
      '<p class="card__loc">' + esc(c.zona) + ', Cancún</p>' +
      '<ul class="card__specs"><li>' + icon('bed') + c.rec + ' rec.</li><li>' + icon('bath') + c.banos + ' baño' + (c.banos === 1 ? '' : 's') + '</li><li>' + icon('area') + c.m2 + ' m²</li></ul>' +
      '<p class="card__pets">' + icon('paw') + (c.pets ? 'Acepta mascotas' : 'No acepta mascotas') + '</p>' +
      '<div class="card__actions"><a class="btn" href="' + fichaDe(c) + '#contactar">Contactar</a>' +
      '<a class="btn btn--secondary" href="' + wa + '" target="_blank" rel="noopener">' + icon('wa') + 'WhatsApp</a></div></div></article>';
  }

  /* ======================================================================
     0. Ficha de cada casa (propiedad.html?slug=...) y enlaces a las fichas
     ====================================================================== */
  var casaFicha = null;
  var formFicha = $('.detail-layout .booking-form[data-casa]');
  if (formFicha && params.get('slug')) {
    var deApi = window.ZugarAPI && ZugarAPI.ficha && ZugarAPI.ficha.slug === params.get('slug') ? ZugarAPI.ficha : null;
    if (deApi && !porSlug[deApi.slug]) { deApi.mapa += ', Quintana Roo'; porSlug[deApi.slug] = deApi; }
    casaFicha = porSlug[params.get('slug')] || null;
    /* La ficha escrita en el HTML es la de su propia casa: solo se reemplaza con otra casa o con datos de la API */
    if (casaFicha && (deApi || casaFicha.slug !== formFicha.dataset.casa)) llenarFicha(casaFicha);
  }

  function llenarFicha(c) {
    var renta = c.op === 'renta', op = renta ? 'renta' : 'venta';
    var lugar = c.zona + ', Cancún';
    var unidad = renta ? 'MXN / mes' : 'MXN';
    var asesor = c.asesor || 'Tu asesora de Zugar';
    var fotos = c.photos && c.photos.length ? c.photos : [{ src: fotoDe(c), label: c.name }];
    var texto = function (sel, t) { var el = $(sel); if (el) el.textContent = t; return el; };
    var ultimoTexto = function (el, t) { if (el && el.lastChild) el.lastChild.textContent = t; };

    document.title = c.name + ' en ' + op + ', ' + lugar + ' · ' + money(c.price) + ' | Zugar';
    var meta = $('meta[name="description"]');
    if (meta) meta.setAttribute('content', c.name + ' en ' + op + ' en ' + lugar + ': ' + c.rec + ' recámaras, ' + c.banos + ' baños' + (c.m2 ? ', ' + c.m2 + ' m² de construcción' : '') + '. ' + money(c.price) + ' ' + unidad + '.');
    $('.breadcrumb ol').innerHTML = '<li><a href="../index.html">Inicio</a></li>' +
      '<li><a href="propiedades.html?operacion=' + op + '">' + (renta ? 'Renta' : 'Venta') + '</a></li>' +
      '<li><a href="propiedades.html?operacion=' + op + '&amp;zona=' + encodeURIComponent(c.zonaKey) + '">' + esc(c.zona) + '</a></li>' +
      '<li><span aria-current="page">' + esc(c.code || c.name) + '</span></li>';
    var tags = $('.detail-title .tags');
    if (tags) tags.innerHTML = '<span class="badge badge--dark">' + esc((c.tipoTexto || 'Casa') + ' en ' + op) + '</span>';
    texto('.detail-title h1', c.name + ', ' + lugar);

    /* Galería: las 4 fotos visibles y la galería completa */
    $$('.gallery img').forEach(function (img, i) {
      if (fotos[i]) { img.src = fotos[i].src; img.alt = fotos[i].label || c.name; } else { img.removeAttribute('src'); img.alt = ''; }
    });
    ultimoTexto($('.gallery__count'), '1 / ' + fotos.length + (fotos.length === 1 ? ' foto' : ' fotos'));
    ultimoTexto($('.gallery__all'), fotos.length === 1 ? 'Ver la foto' : 'Ver las ' + fotos.length + ' fotos');
    texto('#galeria-titulo', c.name);
    texto('#galeria-titulo + p', 'Cancún · ' + money(c.price) + ' ' + unidad + ' · ' + fotos.length + (fotos.length === 1 ? ' foto' : ' fotos'));
    var grid = $('.lightbox__grid');
    if (grid) grid.innerHTML = fotos.map(function (f, i) {
      return '<figure><div class="photo"><img src="' + esc(f.src) + '" alt="' + esc(f.label || c.name) + '" loading="lazy"></div><figcaption>' + String(i + 1).padStart(2, '0') + (f.label ? ' · ' + esc(f.label) : '') + '</figcaption></figure>';
    }).join('');

    /* Precio, ubicación y datos */
    texto('.price-block .eyebrow', (renta ? 'Renta mensual' : 'Venta') + ' · Precio en pesos mexicanos');
    $('.price-big').innerHTML = money(c.price) + ' <small>' + unidad + '</small>';
    var mant = $('.price-block > p.muted');
    if (mant) { mant.textContent = c.maintenance ? 'Mantenimiento: ' + c.maintenance : ''; mant.hidden = !c.maintenance; }
    ultimoTexto($('.price-block .address'), c.address || lugar + ', Quintana Roo');
    var datos = [c.m2 ? c.m2 + ' m²' : '—', c.terreno ? c.terreno + ' m²' : '—', String(c.rec), String(c.banos), String(c.est),
      c.age === 0 ? 'A estrenar' : c.age ? c.age + (c.age === 1 ? ' año' : ' años') : '—'];
    $$('.facts .fact strong').forEach(function (s, i) { if (datos[i] != null) ultimoTexto(s, datos[i]); });

    var parrafos = String(c.description || (c.name + ' es una casa en ' + op + ' en ' + lugar + ' con ' + c.rec + ' recámaras y ' + c.banos + ' baños' + (c.m2 ? ', en ' + c.m2 + ' m² de construcción' : '') + '. ' + (c.pets ? 'Acepta mascotas.' : 'No acepta mascotas.'))).split(/\n+/);
    var prosa = $('#desc-titulo + .prose');
    if (prosa) prosa.innerHTML = parrafos.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    var mas = $('#desc-titulo ~ details.more'); if (mas) mas.hidden = true;
    var amen = $('.amenities');
    if (amen) {
      amen.innerHTML = (c.amenities || []).map(function (a) { return '<li>' + icon('check-c') + esc(a) + '</li>'; }).join('');
      amen.hidden = !(c.amenities || []).length;
    }
    var hoja = $('.datasheet dl');
    if (hoja) hoja.innerHTML = [
      ['Tipo de inmueble', c.tipoTexto || (c.tipo === 'casa-condominio' ? 'Casa en condominio' : c.tipo === 'townhouse' ? 'Townhouse' : 'Casa')],
      ['Operación', renta ? 'Renta' : 'Venta'],
      ['Amueblada', { si: 'Sí', semi: 'Semiamueblada', no: 'No' }[c.amueblada] || 'No'],
      ['Mascotas', c.pets ? 'Se aceptan' : 'No se aceptan'],
      ['Clave del anuncio', c.code || '—']
    ].map(function (d) { return '<div><dt>' + d[0] + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('');

    /* Zona y mapa en vivo */
    texto('#zona-titulo + p', lugar + ' · Una zona para conectar con todo.');
    var mapa = $('.map--zone iframe');
    if (mapa) { mapa.src = mapaEmbebido(c.mapa, 14); mapa.title = 'Mapa de Google con la zona de ' + lugar; }
    var abrirMapa = $('.map-note a'); if (abrirMapa) abrirMapa.href = mapaEnlace(c.mapa);
    var distancias = $('.distances'); if (distancias) distancias.hidden = true;

    /* La calculadora de crédito solo aplica a casas en venta */
    if (renta) $$('#credito-titulo, #credito-titulo + p, form.calc').forEach(function (el) { el.hidden = true; });
    var publicado = c.publishedAt ? new Date(String(c.publishedAt).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    texto('.published', (publicado ? 'Publicado el ' + publicado + ' · ' : '') + 'Clave ' + (c.code || c.slug));

    /* Tarjeta de la asesora y solicitud de visita */
    texto('.agent strong', asesor);
    texto('#agente-titulo + p', 'Agenda una visita a esta casa. ' + asesor.split(' ')[0] + ' te confirmará el día y la hora.');
    var foto = $('.agent img');
    if (foto && !/Mariana/.test(asesor)) { foto.removeAttribute('src'); foto.alt = ''; }
    else if (foto) foto.alt = 'Fotografía de ' + asesor + ', asesora inmobiliaria';
    formFicha.dataset.casa = c.slug;
    var clave = formFicha.querySelector('input[name="propiedad"]');
    if (clave && c.code) clave.value = c.code; else if (clave) clave.remove();
    var ref = $('#b-casa-ref', formFicha); if (ref) ref.value = c.name + (c.code ? ' · ' + c.code : '');
    var pres = $('#b-presupuesto', formFicha); if (pres) pres.placeholder = money(c.price) + ' ' + unidad;
    var pago = $('#b-pago', formFicha);
    if (pago && renta) { pago.required = false; pago.closest('.field').hidden = true; }
    var ayudaMascotas = $('.pets-detail .field__help', formFicha);
    if (ayudaMascotas) ayudaMascotas.textContent = c.pets ? 'Esta casa acepta mascotas.' : 'Esta casa no acepta mascotas; cuéntanos si tienes alguna.';
    var wa = $('.form-actions a[href^="https://wa.me/"]', formFicha);
    if (wa) wa.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hola ' + asesor.split(' ')[0] + ', me interesa ' + c.name + (c.code ? ' (' + c.code + ')' : '') + ' en ' + c.zona + '.');
    var compartir = $('.detail-actions a[href^="https://wa.me/?text"]');
    if (compartir) compartir.href = 'https://wa.me/?text=' + encodeURIComponent('Mira esta casa en ' + lugar + ': ' + location.href.split('#')[0]);
  }

  /* Las tarjetas escritas en el HTML (inicio, casas similares) abren la ficha de su casa */
  $$('.card').forEach(function (card) {
    var link = $('.card__link', card);
    var c = link && CATALOGO.filter(function (x) { return x.name === link.textContent.trim(); })[0];
    if (!c) return;
    $$('a[href*="propiedad.html"]', card).forEach(function (a) {
      if (/[?&]slug=/.test(a.getAttribute('href'))) return;
      a.href = fichaDe(c) + (a.hash || '');
    });
  });

  /* ======================================================================
     1. Menú móvil
     ====================================================================== */
  var menu = $('#menu-toggle');
  if (menu) {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.checked) { menu.checked = false; menu.focus(); }
    });
    $$('.site-nav a').forEach(function (a) { a.addEventListener('click', function () { menu.checked = false; }); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1080) menu.checked = false; });
  }

  /* ======================================================================
     2. Favoritos (se recuerdan en este navegador)
     ====================================================================== */
  var FAV_KEY = 'zugar-favoritos';
  function favoritos() { return storage(FAV_KEY) || []; }
  function nombreFav(input) { return (input.getAttribute('aria-label') || '').replace(/^Guardar\s+/, '').replace(/\s+en favoritos$/, ''); }
  function aplicarFavoritos(ctx) {
    var favs = favoritos();
    $$('.fav input, .save-toggle input', ctx).forEach(function (i) { i.checked = favs.indexOf(nombreFav(i)) >= 0; });
  }
  document.addEventListener('change', function (e) {
    var i = e.target;
    if (!i.matches('.fav input, .save-toggle input')) return;
    var name = nombreFav(i), favs = favoritos().filter(function (n) { return n !== name; });
    if (i.checked) favs.push(name);
    storage(FAV_KEY, favs);
    toast(i.checked ? name + ' se guardó en tus favoritos.' : name + ' se quitó de tus favoritos.');
  });
  $$('.save-toggle input').forEach(function (i) { i.setAttribute('aria-label', 'Guardar ' + (casaFicha ? casaFicha.name : 'Casa con jardín en Huayacán') + ' en favoritos'); });
  aplicarFavoritos();

  /* ======================================================================
     3. Validación y envío de formularios
     ====================================================================== */
  /* Punto de conexión con el backend: envía a POST /public/leads (api.js) y devuelve el folio real.
     Sin servidor (o si no responde) simula una respuesta exitosa como antes. */
  function enviarFormulario(form, tipo) {
    var simulado = function () { return new Promise(function (resolve) { setTimeout(function () { resolve({ folio: folio() }); }, 700); }); };
    if (!window.ZugarAPI || !ZugarAPI.url) return simulado();
    return ZugarAPI.enviarSolicitud(form, tipo).catch(function (err) {
      if (err && err.sinConexion) return simulado();
      throw err;
    });
  }

  function mensajeError(el) {
    var v = el.value.trim();
    if (el.type === 'checkbox') return el.required && !el.checked ? 'Marca esta casilla para continuar.' : '';
    if (el.type === 'radio') {
      var group = el.form.querySelectorAll('input[name="' + el.name + '"]');
      return el.required && !Array.prototype.some.call(group, function (r) { return r.checked; }) ? 'Elige una opción.' : '';
    }
    if (el.required && !v) return el.tagName === 'SELECT' ? 'Elige una opción.' : 'Completa este campo.';
    if (v && el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    if (v && el.type === 'tel' && v.replace(/\D/g, '').length < 10) return 'El teléfono debe tener 10 dígitos.';
    if (v && el.type === 'date' && el.min && v < el.min) return 'Elige una fecha a partir de hoy.';
    return '';
  }
  function marcar(el, msg) {
    var field = el.closest('.field') || el.closest('.check') || el.parentNode;
    var err = field.querySelector('.field__error');
    if (msg) {
      if (!err) {
        err = document.createElement('p');
        err.className = 'field__error';
        err.dataset.auto = '';
        field.appendChild(err);
      }
      err.innerHTML = '<svg class="icon icon--sm" aria-hidden="true"><use href="#i-alert"/></svg>' + esc(msg);
      err.id = err.id || (el.id || el.name) + '-error';
      field.classList.add('is-error');
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', err.id);
    } else {
      field.classList.remove('is-error');
      el.removeAttribute('aria-invalid');
      if (err && err.dataset.auto != null) err.remove();
    }
  }
  function validar(form) {
    var errores = [];
    $$('input, select, textarea', form).forEach(function (el) {
      if (el.disabled || el.type === 'hidden' || el.type === 'submit' || el.closest('[hidden]')) return;
      if (el.type === 'radio' && errores.some(function (x) { return x.name === el.name; })) return;
      var msg = mensajeError(el);
      marcar(el, msg);
      if (msg) errores.push(el);
    });
    return errores;
  }
  function ocupado(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.texto = btn.innerHTML; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Enviando…'; }
    else { btn.disabled = false; btn.removeAttribute('aria-busy'); if (btn.dataset.texto) btn.innerHTML = btn.dataset.texto; }
  }
  function alertaExito(form, html) {
    var a = form.querySelector('.alert-success');
    if (!a) {
      a = document.createElement('div');
      a.className = 'alert alert-success'; a.setAttribute('role', 'status');
      form.insertBefore(a, form.firstChild);
    }
    a.tabIndex = -1;
    a.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check-c"/></svg><div>' + html + '</div>';
    a.classList.add('is-visible');
    a.scrollIntoView({ behavior: 'smooth', block: 'center' });
    a.focus({ preventScroll: true });
    return a;
  }
  function conectar(form, opciones) {
    if (!form) return;
    form.setAttribute('novalidate', '');
    var alertaError = form.querySelector('.alert-error');
    var revalidar = function (e) { if (e.target.getAttribute('aria-invalid')) marcar(e.target, mensajeError(e.target)); };
    form.addEventListener('input', revalidar);
    form.addEventListener('change', revalidar);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errores = validar(form);
      if (alertaError) alertaError.classList.toggle('is-visible', errores.length > 0);
      if (errores.length) {
        if (!alertaError) toast('Revisa ' + (errores.length === 1 ? 'el campo marcado' : 'los ' + errores.length + ' campos marcados') + '.');
        errores[0].focus();
        return;
      }
      var seguir = function () {
        var btn = form.querySelector('[type="submit"]');
        ocupado(btn, true);
        enviarFormulario(form, opciones.tipo()).then(function (r) {
          ocupado(btn, false);
          opciones.exito(r);
        }).catch(function (err) {
          if (!err || !err.mensaje) console.error(err);
          ocupado(btn, false);
          toast(err && err.mensaje ? err.mensaje : 'No pudimos enviar tu solicitud. Inténtalo de nuevo o escríbenos por WhatsApp.');
        });
      };
      if (opciones.revisar && opciones.revisar()) abrirRevision(form, seguir); else seguir();
    });
  }

  /* Diálogo de revisión: arma la lista con los campos visibles que tienen respuesta */
  function filasFormulario(form) {
    var filas = [];
    var motivo = form.querySelector('input[name="motivo"]:checked');
    if (motivo) filas.push(['Motivo', motivo.parentNode.textContent.trim()]);
    $$('.field', form).forEach(function (f) {
      if (f.closest('[hidden]') || f.querySelector('.field')) return;
      var lbl = f.querySelector('.field__label'); if (!lbl) return;
      var nombre = lbl.textContent.replace(/\(opcional\)|\*/g, '').trim();
      var valor = '';
      var radio = f.querySelector('input[type="radio"]:checked');
      var ctl = f.querySelector('input:not([type="radio"]):not([type="checkbox"]), select, textarea');
      if (radio) valor = radio.parentNode.textContent.trim();
      else if (ctl && ctl.tagName === 'SELECT') valor = ctl.value ? ctl.options[ctl.selectedIndex].text : '';
      else if (ctl && ctl.type === 'date') valor = fechaLarga(ctl.value);
      else if (ctl) valor = ctl.value.trim();
      if (valor) filas.push([nombre, valor]);
    });
    return filas;
  }
  function abrirRevision(form, seguir) {
    var filas = filasFormulario(form);
    abrirDialogo(
      '<h2 id="dlg-title">Revisa tu solicitud</h2><p class="dlg-lead">Confirma que tus datos estén bien antes de enviarlos.</p>' +
      '<dl class="review">' + filas.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="dlg-actions"><button class="btn btn--secondary" type="button" data-cerrar>Corregir datos</button><button class="btn" type="button" data-enviar>Enviar solicitud</button></div>',
      function (dlg) { dlg.querySelector('[data-enviar]').addEventListener('click', function () { dlg.close(); seguir(); }); }
    );
  }
  function abrirDialogo(html, alAbrir) {
    var dlg = document.createElement('dialog');
    dlg.className = 'site-dialog';
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    dlg.innerHTML = '<div class="site-dialog__body">' + html + '</div>';
    document.body.appendChild(dlg);
    var previo = document.activeElement;
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-cerrar]')) dlg.close(); });
    dlg.addEventListener('close', function () { dlg.remove(); if (previo) previo.focus(); });
    dlg.showModal();
    if (alAbrir) alAbrir(dlg);
    var b = dlg.querySelector('[data-enviar], button'); if (b) b.focus();
  }

  /* Muestra los bloques [data-show] del motivo elegido y vuelve obligatorios sus campos [data-req] */
  function aplicarMotivo(form, extras, motivo) {
    var bloques = $$('[data-show]', form).concat(extras || []);
    bloques.forEach(function (b) {
      if (b.matches('[data-show]')) b.hidden = b.dataset.show.split(' ').indexOf(motivo) < 0;
      $$('[data-show]', b).forEach(function (x) { x.hidden = x.dataset.show.split(' ').indexOf(motivo) < 0; });
    });
    $$('[data-req]', form).forEach(function (el) {
      el.required = !el.closest('[hidden]');
      if (!el.required) marcar(el, '');
    });
    /* Numerar los bloques visibles: 1. Tus datos, 2. ..., */
    var n = 0;
    $$('legend[data-n]', form).forEach(function (l) {
      if (l.closest('[hidden]')) return;
      n++; l.textContent = n + '. ' + l.textContent.replace(/^\d+\.\s*/, '');
    });
    /* Mensaje obligatorio solo cuando es lo único que nos cuenta la persona */
    var msg = $('[data-label-req]', form);
    if (msg) {
      var ta = document.getElementById(msg.htmlFor);
      var req = motivo === 'otro' || motivo === 'publicar';
      ta.required = req;
      msg.innerHTML = req ? 'Mensaje *' : 'Comentarios <span class="opt">(opcional)</span>';
      if (!req) marcar(ta, '');
    }
    /* Texto del botón */
    var btn = $('[type="submit"][data-label-visita]', form);
    if (btn) {
      var txt = motivo === 'visita' ? btn.dataset.labelVisita : btn.dataset.labelOtro;
      var span = btn.querySelector('span');
      if (span) span.textContent = txt;
      else { var nodo = Array.prototype.find.call(btn.childNodes, function (x) { return x.nodeType === 3; }); if (nodo) nodo.textContent = txt; }
    }
  }

  /* ======================================================================
     4. Solicitud de visita y contacto (inicio y Contáctanos)
     ====================================================================== */
  $$('.booking-form').forEach(function (form) {
    var summary = form.dataset.summary ? $(form.dataset.summary) : null;
    var extras = summary ? [summary] : [];
    var casaSel = $('#b-casa', form), opSel = $('#b-operacion', form);
    var fecha = $('#b-fecha', form), hora = $('#b-hora', form), cuales = $('#b-cuales', form);
    var presupuesto = $('#b-presupuesto', form);
    var conMotivo = !!form.querySelector('input[name="motivo"]');
    var motivoActual = function () { var r = form.querySelector('input[name="motivo"]:checked'); return r ? r.value : 'visita'; };
    var casaFija = porSlug[form.dataset.casa] || null;
    if (fecha) fecha.min = todayISO();

    /* La lista de casas solo muestra las de la operación elegida (renta o compra) */
    var filtrarCasas = function () {
      if (!casaSel || !opSel) return;
      var etiqueta = opSel.value === 'compra' ? 'En venta' : 'En renta';
      $$('optgroup', casaSel).forEach(function (g) {
        var ok = g.label === etiqueta;
        g.hidden = !ok; g.disabled = !ok;
      });
      var sel = casaSel.selectedOptions[0];
      if (sel && sel.parentNode.disabled) casaSel.value = casaSel.querySelector('option[value="sin-definir"]') && conMotivo ? 'sin-definir' : '';
      if (presupuesto) presupuesto.placeholder = opSel.value === 'compra' ? '$4,000,000 MXN' : '$30,000 MXN / mes';
    };
    /* En Contáctanos la operación la define el motivo: «Quiero comprar» = Compra */
    var operacionPorMotivo = function () {
      if (!conMotivo || !opSel) return;
      var m = motivoActual();
      if (m === 'rentar' || m === 'comprar') opSel.value = m === 'comprar' ? 'compra' : 'renta';
      opSel.closest('.field').hidden = true;
      opSel.required = false;
    };

    var dd = function (k) { return summary ? summary.querySelector('[data-r="' + k + '"]') : null; };
    var actualizarResumen = function () {
      if (!summary || !casaSel) return;
      var c = porSlug[casaSel.value];
      var titulo = summary.querySelector('h2, h3'), foto = summary.querySelector('.photo'), img = foto.querySelector('img');
      var precio = summary.querySelector('.summary__price');
      if (c) {
        titulo.textContent = c.name;
        summary.querySelector('.summary__loc').textContent = c.zona + ', Cancún';
        precio.innerHTML = '<strong>' + money(c.price) + '</strong> ' + (c.op === 'renta' ? 'MXN / mes' : 'MXN');
        precio.hidden = false;
        summary.querySelector('.summary__specs').textContent = c.rec + ' recámaras · ' + c.banos + ' baños · ' + c.m2 + ' m² · ' + (c.pets ? 'Acepta mascotas' : 'No acepta mascotas');
        img.src = fotoDe(c); img.alt = c.name + ' en ' + c.zona + ', Cancún';
        foto.hidden = false;
        if (!conMotivo) { opSel.value = c.op === 'renta' ? 'renta' : 'compra'; filtrarCasas(); }
        if (dd('asesor')) dd('asesor').textContent = c.asesor;
        if (dd('lugar')) dd('lugar').textContent = 'En la casa · ' + c.zona.replace(/^Residencial /, '');
      } else {
        titulo.textContent = casaSel.value === 'sin-definir' ? 'Te recomendamos opciones' : 'Elige una casa';
        summary.querySelector('.summary__loc').textContent = casaSel.value === 'sin-definir' ? 'Te propondremos casas según lo que buscas.' : 'Aquí verás los datos de la casa que elijas.';
        precio.hidden = true;
        summary.querySelector('.summary__specs').textContent = '';
        foto.hidden = true;
        if (dd('asesor')) dd('asesor').textContent = 'Tu asesora o asesor de Zugar';
        if (dd('lugar')) dd('lugar').textContent = 'En la casa que elijas';
      }
      if (dd('op')) dd('op').textContent = opSel.value === 'renta' ? 'Renta' : 'Compra';
      var eyebrow = summary.querySelector('.eyebrow');
      if (eyebrow && conMotivo) eyebrow.textContent = opSel.value === 'compra' ? 'Quieres comprar' : 'Quieres rentar';
    };
    var actualizarFecha = function () {
      if (!dd('fecha') || !fecha) return;
      dd('fecha').textContent = fecha.value ? fechaLarga(fecha.value) + (hora.value ? ' · ' + hora.value + ' h' : '') : 'Elige fecha y horario';
    };
    var actualizarMascotas = function () {
      var si = $('#mascotas-si', form);
      if (!si || !cuales) return;
      var visible = !cuales.closest('[hidden]');
      cuales.required = si.checked && visible;
      form.querySelector('label[for="b-cuales"]').textContent = '¿Cuáles y cuántas mascotas?' + (cuales.required ? ' *' : '');
      if (!cuales.required) marcar(cuales, '');
    };
    var cambiarMotivo = function () {
      aplicarMotivo(form, extras, motivoActual());
      operacionPorMotivo(); filtrarCasas(); actualizarResumen(); actualizarMascotas();
    };

    /* Valores que llegan en el enlace: ?motivo=comprar&casa=casa-ceiba */
    var MOTIVOS = { visita: 'rentar', rentar: 'rentar', comprar: 'comprar', publicar: 'publicar', otro: 'otro', 'alerta-busqueda': 'otro', 'asesoria-zona': 'otro' };
    var pm = params.get('motivo');
    var casaUrl = porSlug[params.get('casa')];
    if (casaUrl && conMotivo && !pm) pm = casaUrl.op === 'venta' ? 'comprar' : 'rentar';
    if (pm && MOTIVOS[pm]) {
      var radio = form.querySelector('input[name="motivo"][value="' + MOTIVOS[pm] + '"]');
      if (radio) radio.checked = true;
      var textos = {
        'alerta-busqueda': 'Hola, me gustaría recibir avisos cuando haya casas nuevas con los filtros de mi búsqueda.',
        'asesoria-zona': 'Hola, me gustaría que me ayuden a elegir la mejor zona de Cancún según mi rutina.'
      };
      var ta = $('#b-comentarios', form);
      if (ta && textos[pm] && !ta.value) ta.value = textos[pm];
    }
    if (casaSel && casaUrl) {
      if (opSel) { opSel.value = casaUrl.op === 'venta' ? 'compra' : 'renta'; }
      casaSel.value = casaUrl.slug;
    }

    if (casaSel) casaSel.addEventListener('change', actualizarResumen);
    if (opSel) opSel.addEventListener('change', function () { filtrarCasas(); actualizarResumen(); });
    if (fecha) { fecha.addEventListener('change', actualizarFecha); hora.addEventListener('change', actualizarFecha); }
    $$('input[name="mascotas"]', form).forEach(function (r) { r.addEventListener('change', actualizarMascotas); });
    $$('input[name="motivo"]', form).forEach(function (r) { r.addEventListener('change', cambiarMotivo); });
    cambiarMotivo(); actualizarResumen(); actualizarFecha();

    conectar(form, {
      tipo: function () { return motivoActual() === 'visita' ? 'cita' : 'contacto'; },
      revisar: function () { return motivoActual() !== 'otro'; },
      exito: function (r) {
        var m = motivoActual();
        var nombre = $('#b-nombre', form).value.trim().split(' ')[0];
        var correo = $('#b-correo', form).value.trim();
        var c = casaSel ? porSlug[casaSel.value] : casaFija;
        /* Desde la ficha de la casa: pasamos a la confirmación */
        if (form.dataset.exito === 'gracias') {
          try {
            sessionStorage.setItem('zugar-ultimo-contacto', JSON.stringify({
              nombre: $('#b-nombre', form).value.trim(), motivo: 'visita', folio: r.folio,
              fecha: fecha && fecha.value ? fechaLarga(fecha.value) : '', hora: hora ? hora.value : '', asesor: c ? c.asesor : ''
            }));
          } catch (e) { /* sin almacenamiento */ }
          location.href = PAGINAS + 'gracias.html';
          return;
        }
        var cuerpo = {
          visita: '<strong>¡Listo, ' + esc(nombre) + '! Recibimos tu solicitud de visita.</strong>' + (c ? esc(c.asesor) : 'Tu asesora') + ' te escribirá en menos de 24 horas para confirmar ' + esc((dd('fecha') ? dd('fecha').textContent : fecha ? fechaLarga(fecha.value) : 'tu visita').toLowerCase()) + '.',
          rentar: '<strong>¡Gracias, ' + esc(nombre) + '! Recibimos tu solicitud.</strong>En un día hábil te enviaremos a ' + esc(correo) + ' casas en renta que encajan contigo.',
          comprar: '<strong>¡Gracias, ' + esc(nombre) + '! Recibimos tu solicitud.</strong>En un día hábil te enviaremos a ' + esc(correo) + ' opciones de compra y cómo financiarlas.',
          publicar: '<strong>¡Gracias, ' + esc(nombre) + '! Queremos conocer tu casa.</strong>Te llamaremos para agendar una visita a tu inmueble y preparar la publicación.',
          otro: '<strong>¡Gracias, ' + esc(nombre) + '! Recibimos tu mensaje.</strong>Te responderemos en un día hábil a ' + esc(correo) + '.'
        }[m];
        var aviso = alertaExito(form, cuerpo + ' Tu folio es <b>' + r.folio + '</b>.');
        var ocultos = $$(':scope > fieldset, :scope > .form-actions', form).concat($$('.alert-error', form));
        ocultos.forEach(function (el) { el.hidden = true; });
        var otra = document.createElement('button');
        otra.type = 'button'; otra.className = 'btn btn--secondary'; otra.textContent = 'Enviar otra solicitud';
        aviso.insertAdjacentElement('afterend', otra);
        otra.addEventListener('click', function () {
          form.reset(); otra.remove(); aviso.classList.remove('is-visible');
          ocultos.forEach(function (el) { el.hidden = false; });
          cambiarMotivo(); actualizarResumen(); actualizarFecha();
          $('#b-nombre', form).focus();
        });
      }
    });
  });

  /* ======================================================================
     6. Portada: pestañas Todas / En renta / En venta y buscador
     ====================================================================== */
  var tabs = $$('#propiedades .tab');
  if (tabs.length) {
    var cardsHome = $$('#propiedades .cards .card');
    var meta = $('#propiedades .tabs-meta');
    var verTodas = $('#propiedades .section-foot a');
    var esRenta = function (c) { return /renta/i.test(c.querySelector('.badge').textContent); };
    var filtroHome = function (op) {
      var vis = 0;
      cardsHome.forEach(function (c) {
        var show = op === 'todas' || (op === 'renta') === esRenta(c);
        c.hidden = !show; if (show) vis++;
      });
      var renta = cardsHome.filter(esRenta).length;
      meta.textContent = op === 'todas' ? cardsHome.length + ' casas destacadas · ' + renta + ' en renta y ' + (cardsHome.length - renta) + ' en venta'
        : vis + ' casas destacadas ' + (op === 'renta' ? 'en renta' : 'en venta');
      verTodas.href = PAGINAS + 'propiedades.html' + (op === 'todas' ? '' : '?operacion=' + op);
      verTodas.firstChild.textContent = op === 'todas' ? 'Ver todas las casas' : 'Ver todas las casas ' + (op === 'renta' ? 'en renta' : 'en venta');
    };
    tabs.forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        var op = /renta/.test(t.href) ? 'renta' : /venta/.test(t.href) ? 'venta' : 'todas';
        tabs.forEach(function (x) { x.removeAttribute('aria-current'); });
        t.setAttribute('aria-current', 'page');
        filtroHome(op);
      });
    });
  }

  var heroOp = $('#h-operacion'), heroBudget = $('#h-presupuesto');
  if (heroOp && heroBudget) {
    var ajustarPresupuesto = function () {
      var renta = heroOp.value === 'renta';
      $$('option', heroBudget).forEach(function (o) {
        if (!o.value) return;
        var deRenta = num(o.value) > 0 && num(o.value) < 1e6;
        o.hidden = o.disabled = renta !== deRenta;
      });
      if (heroBudget.selectedOptions[0] && heroBudget.selectedOptions[0].disabled) heroBudget.value = '';
    };
    heroOp.addEventListener('change', ajustarPresupuesto);
    ajustarPresupuesto();
  }

  /* ======================================================================
     7. Listado de propiedades: filtros reales, orden, páginas y mapa en vivo
     ====================================================================== */
  var gridListado = $('.listing-layout .cards');
  var formFiltros = $('#filtros');
  if (gridListado && formFiltros) {
    var POR_PAGINA = 6;
    var q = {
      operacion: params.get('operacion') || '',
      tipo: params.get('tipo') || '',
      zona: params.get('zona') || '',
      precio_max: params.get('precio_max') || params.get('presupuesto') || '',
      recamaras: params.get('recamaras') || '',
      banos: params.get('banos') || '',
      estacionamientos: params.get('estacionamientos') || '',
      superficie: params.get('superficie') || '',
      mascotas: params.get('mascotas') || '',
      amueblada: params.get('amueblada') || '',
      orden: params.get('orden') || 'precio-asc',
      vista: params.get('vista') || 'cuadricula',
      pagina: Math.max(1, parseInt(params.get('pagina'), 10) || 1)
    };

    var tipoSel = $('#f-tipo');
    tipoSel.insertAdjacentHTML('afterbegin', '<option value="">Todos los tipos</option>');
    var precioSel = $('#f-precio'), precioLbl = $('label[for="f-precio"]');
    var RANGOS = {
      renta: [['20000', 'Hasta $20,000'], ['30000', 'Hasta $30,000'], ['40000', 'Hasta $40,000'], ['60000', 'Hasta $60,000']],
      venta: [['3500000', 'Hasta $3.5 millones'], ['4500000', 'Hasta $4.5 millones'], ['5500000', 'Hasta $5.5 millones'], ['7000000', 'Hasta $7 millones'], ['mas', 'Más de $5 millones']]
    };
    var grupo = function (lista) { return lista.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join(''); };
    precioSel.innerHTML = '<option value="">Cualquiera</option>' + (q.operacion ? grupo(RANGOS[q.operacion]) :
      '<optgroup label="Renta mensual">' + grupo(RANGOS.renta) + '</optgroup><optgroup label="Venta">' + grupo(RANGOS.venta) + '</optgroup>');
    precioLbl.textContent = q.operacion === 'renta' ? 'Precio mensual' : q.operacion === 'venta' ? 'Precio de venta' : 'Precio';

    var campos = { tipo: '#f-tipo', zona: '#f-zona', precio_max: '#f-precio', recamaras: '#f-rec', banos: '#f-banos', estacionamientos: '#f-est', superficie: '#f-sup', mascotas: '#f-mascotas', amueblada: '#f-amueblada' };
    Object.keys(campos).forEach(function (k) {
      var s = $(campos[k]);
      s.value = q[k];
      if (s.value !== q[k]) { s.value = ''; q[k] = ''; }
    });
    $('#orden').value = q.orden;
    var opInput = formFiltros.querySelector('input[name="operacion"]');
    opInput.value = q.operacion;
    opInput.disabled = !q.operacion;
    formFiltros.insertAdjacentHTML('beforeend', '<input type="hidden" name="vista" value="' + esc(q.vista) + '">');
    formFiltros.addEventListener('submit', function () {
      $$('select, input', formFiltros).forEach(function (el) { if (!el.value) el.disabled = true; });
      var orden = $('#orden'); if (orden.value === 'precio-asc') orden.disabled = true;
      if (q.vista === 'cuadricula') formFiltros.querySelector('input[name="vista"]').disabled = true;
    });
    $('#orden').addEventListener('change', function () { formFiltros.requestSubmit ? formFiltros.requestSubmit() : formFiltros.submit(); });

    var cumple = function (c) {
      var p = q.precio_max;
      return (!q.operacion || c.op === q.operacion) &&
        (!q.tipo || (q.tipo === 'casa' ? /^casa/.test(c.tipo) : c.tipo === q.tipo)) &&
        (!q.zona || c.zonaKey === q.zona) &&
        (!p || (p === 'mas' ? c.op === 'venta' && c.price > 5e6 : (num(p) >= 1e6) === (c.op === 'venta') && c.price <= num(p))) &&
        (!q.recamaras || (q.recamaras === '4' ? c.rec >= 4 : c.rec === +q.recamaras)) &&
        (!q.banos || c.banos >= +q.banos) &&
        (!q.estacionamientos || c.est >= +q.estacionamientos) &&
        (!q.superficie || c.m2 >= +q.superficie) &&
        (!q.mascotas || c.pets) &&
        (!q.amueblada || c.amueblada === q.amueblada);
    };
    var resultados = CATALOGO.filter(cumple).sort(function (a, b) {
      return q.orden === 'precio-desc' ? b.price - a.price : q.orden === 'recientes' ? b.orden - a.orden : a.price - b.price;
    });
    var total = resultados.length;
    var paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (q.pagina > paginas) q.pagina = paginas;
    var desde = (q.pagina - 1) * POR_PAGINA;
    var pagina = resultados.slice(desde, desde + POR_PAGINA);

    var url = function (cambios) {
      var u = new URLSearchParams(location.search);
      Object.keys(cambios).forEach(function (k) { if (cambios[k] === null || cambios[k] === '') u.delete(k); else u.set(k, cambios[k]); });
      if (cambios.precio_max === null) u.delete('presupuesto');
      var s = u.toString();
      return 'propiedades.html' + (s ? '?' + s : '');
    };

    var recTxt = q.recamaras ? (q.recamaras === '4' ? ' de 4 o más recámaras' : ' de ' + q.recamaras + ' recámara' + (q.recamaras === '1' ? '' : 's')) : '';
    var opTxt = q.operacion === 'renta' ? ' en renta' : q.operacion === 'venta' ? ' en venta' : ' en renta y venta';
    var titulo = 'Casas' + recTxt + opTxt + ' en Cancún';
    $('.listing-head h1').textContent = titulo;
    document.title = titulo + ' | Zugar Inmobiliaria';
    $('.listing-head p').textContent = total + ' casa' + (total === 1 ? '' : 's') + ' disponible' + (total === 1 ? '' : 's') + ' · ' +
      (q.operacion === 'renta' ? 'Rentas a largo plazo' : q.operacion === 'venta' ? 'Contado, crédito bancario o Infonavit' : 'Renta y venta') + ' · Precios en MXN';
    $('.breadcrumb ol').innerHTML = '<li><a href="' + ROOT + 'index.html">Inicio</a></li>' + (q.operacion
      ? '<li><a href="propiedades.html?operacion=' + q.operacion + '"' + (recTxt ? '' : ' aria-current="page"') + '>' + (q.operacion === 'renta' ? 'Rentas' : 'Ventas') + ' en Cancún</a></li>'
      : '<li><span aria-current="page">Propiedades</span></li>') +
      (q.operacion && recTxt ? '<li><span aria-current="page">' + recTxt.replace(/^ de /, '').replace(/^./, function (m) { return m.toUpperCase(); }) + '</span></li>' : '');
    $('.toolbar__count').textContent = total ? 'Mostrando ' + (desde + 1) + '–' + (desde + pagina.length) + ' de ' + total + ' casa' + (total === 1 ? '' : 's') : 'Sin resultados';

    var chips = [];
    if (q.operacion) chips.push([q.operacion === 'renta' ? 'En renta' : 'En venta', { operacion: null, precio_max: null }]);
    Object.keys(campos).forEach(function (k) {
      if (!q[k]) return;
      var s = $(campos[k]), t = s.options[s.selectedIndex].text;
      var pref = { banos: 'Baños: ', estacionamientos: 'Estacionamientos: ' }[k] || '';
      var cambio = {}; cambio[k] = null;
      chips.push([pref + t, cambio]);
    });
    var activos = $('.active-filters');
    activos.innerHTML = chips.map(function (c) {
      c[1].pagina = null;
      return '<a class="chip" href="' + esc(url(c[1])) + '" aria-label="Quitar filtro: ' + esc(c[0]) + '">' + esc(c[0]) + '<svg class="icon icon--sm" aria-hidden="true"><use href="#i-x"/></svg></a>';
    }).join('') + (chips.length ? '<a class="clear" href="propiedades.html">Limpiar filtros</a>' : '');
    activos.hidden = !chips.length;
    $('.filters__open').lastChild.textContent = 'Filtros' + (chips.length ? ' (' + chips.length + ')' : '');

    gridListado.innerHTML = pagina.length ? pagina.map(tarjeta).join('') :
      '<div class="listing-empty"><h3>No encontramos casas con esos filtros</h3><p>Prueba con otra zona o un presupuesto distinto. También podemos buscar por ti.</p>' +
      '<p class="listing-empty__actions"><a class="btn btn--secondary" href="propiedades.html">Limpiar filtros</a><a class="btn" href="contacto.html?motivo=alerta-busqueda">Avísenme cuando haya opciones</a></p></div>';
    aplicarFavoritos(gridListado);

    gridListado.classList.toggle('cards--list', q.vista === 'lista');
    $('.listing-layout').classList.toggle('is-map-view', q.vista === 'mapa');
    $$('.segmented a').forEach(function (a) {
      var v = /vista=(\w+)/.exec(a.getAttribute('href'))[1];
      a.href = url({ vista: v === 'cuadricula' ? null : v });
      if (v === q.vista) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });

    var pag = $('.pagination ul');
    var celda = function (n, label, txt, actual) {
      if (n < 1 || n > paginas) return '<li><span class="is-disabled" aria-label="' + label + ' (no disponible)">' + txt + '</span></li>';
      return '<li><a href="' + esc(url({ pagina: n === 1 ? null : n })) + '"' + (actual ? ' aria-current="page"' : '') + (label ? ' aria-label="' + label + '"' : '') + '>' + txt + '</a></li>';
    };
    var html = celda(q.pagina - 1, 'Página anterior', '<svg class="icon icon--sm" aria-hidden="true"><use href="#i-left"/></svg>');
    for (var i = 1; i <= paginas; i++) html += celda(i, '', String(i), i === q.pagina);
    html += celda(q.pagina + 1, 'Página siguiente', '<svg class="icon icon--sm" aria-hidden="true"><use href="#i-right"/></svg>');
    pag.innerHTML = html;
    $('.pagination').hidden = !total;

    /* Mapa de Google en vivo: cada botón centra el mapa en la zona de esa casa */
    var iframe = $('#mapa-listado'), lugares = $('#map-places'), abrir = $('#map-open');
    if (iframe && lugares) {
      var zonaInicial = q.zona && pagina[0] ? pagina[0].mapa : 'Cancún, Quintana Roo';
      iframe.src = mapaEmbebido(zonaInicial, q.zona ? 14 : 12);
      abrir.href = mapaEnlace(zonaInicial);
      lugares.innerHTML = pagina.map(function (c) {
        return '<li><button type="button" aria-pressed="false" data-slug="' + c.slug + '">' + icon('pin') + '<span>' + esc(c.name) + ' · ' + precioCorto(c) + ' · ' + esc(c.zona.replace(/^Residencial /, '')) + '</span></button></li>';
      }).join('') || '<li class="muted small">Sin casas para mostrar en el mapa.</li>';
      lugares.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var c = porSlug[b.dataset.slug];
        $$('button', lugares).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        iframe.src = mapaEmbebido(c.mapa, 15);
        iframe.title = 'Mapa de Google con la zona de ' + c.name;
        abrir.href = mapaEnlace(c.mapa);
      });
    }

    var togg = $('#filtros-toggle');
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && togg.checked) { togg.checked = false; $('.filters__open').focus(); } });
    window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });
  }

  /* ======================================================================
     8. Ficha de propiedad: compartir, galería, crédito y carrusel
     ====================================================================== */
  var share = $('.detail-actions a[href^="https://wa.me/?text"]');
  if (share) {
    share.addEventListener('click', function (e) {
      var data = { title: document.title, text: 'Mira esta casa en ' + (casaFicha ? casaFicha.zona : 'Huayacán') + ', Cancún', url: location.href.split('#')[0] };
      if (navigator.share) { e.preventDefault(); navigator.share(data).catch(function () { /* cancelado */ }); }
      else if (navigator.clipboard && window.isSecureContext) {
        e.preventDefault();
        navigator.clipboard.writeText(data.url).then(function () { toast('Copiamos el enlace de la casa. Ya puedes pegarlo donde quieras.'); });
      }
    });
  }

  var galeria = $('#galeria');
  if (galeria) {
    var posicion = 0, origen = null;
    var cerrarGaleria = function () {
      history.pushState(null, '', location.pathname + location.search);
      galeria.classList.add('is-closed');
      window.scrollTo(0, posicion);
      if (origen) origen.focus({ preventScroll: true });
    };
    var abrirGaleria = function () {
      galeria.classList.remove('is-closed');
      var cerrar = galeria.querySelector('.lightbox__close'); if (cerrar) cerrar.focus();
    };
    $$('a[href="#galeria"]').forEach(function (a) {
      a.addEventListener('click', function () { posicion = window.scrollY; origen = a; setTimeout(abrirGaleria, 0); });
    });
    galeria.querySelector('.lightbox__close').addEventListener('click', function (e) { e.preventDefault(); cerrarGaleria(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && location.hash === '#galeria') cerrarGaleria(); });
    if (location.hash === '#galeria') abrirGaleria();
  }

  var calc = $('form.calc');
  if (calc) {
    var precioCasa = num($('.price-big').textContent);
    var enganche = $('#cr-enganche'), plazo = $('#cr-plazo'), tasa = $('#cr-tasa');
    var lblEng = $('label[for="cr-enganche"]');
    var montoOut = $('.calc__row dd'), cuotaOut = $('.calc__result output'), pagosOut = $$('.calc__result p')[1];
    var aviso = document.createElement('p');
    aviso.className = 'field__hint'; aviso.id = 'cr-aviso';
    enganche.closest('.field').appendChild(aviso);
    enganche.setAttribute('aria-describedby', 'cr-aviso');
    cuotaOut.setAttribute('aria-live', 'polite');
    var calcular = function () {
      var eng = Math.min(num(enganche.value), precioCasa);
      var n = (+plazo.value || 20) * 12;
      var r = (parseFloat(String(tasa.value).replace(',', '.')) || 0) / 100 / 12;
      var monto = Math.max(precioCasa - eng, 0);
      var cuota = r ? monto * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : monto / n;
      var pct = precioCasa ? Math.round(eng / precioCasa * 100) : 0;
      lblEng.textContent = 'Enganche · ' + pct + ' % del precio';
      aviso.textContent = pct < 10 ? 'La mayoría de los bancos pide al menos 10 % de enganche.' : '';
      montoOut.textContent = money(monto) + ' MXN';
      cuotaOut.textContent = money(cuota) + ' MXN';
      pagosOut.textContent = n + ' pagos mensuales · capital e intereses';
    };
    enganche.addEventListener('input', calcular);
    tasa.addEventListener('input', calcular);
    plazo.addEventListener('change', calcular);
    enganche.addEventListener('blur', function () { enganche.value = money(Math.min(num(enganche.value), precioCasa)) + ' MXN'; });
    tasa.addEventListener('blur', function () { var t = parseFloat(String(tasa.value).replace(',', '.')); tasa.value = (isNaN(t) ? 10.5 : t) + ' %'; calcular(); });
    calc.addEventListener('submit', function (e) { e.preventDefault(); calcular(); });
    calcular();
  }

  var carrusel = $('.carousel');
  if (carrusel) {
    var nav = document.createElement('div');
    nav.className = 'carousel-nav';
    nav.innerHTML = '<button class="btn-icon" type="button" data-dir="-1" aria-label="Ver casas anteriores" aria-controls="carrusel-similares"><svg class="icon" aria-hidden="true"><use href="#i-left"/></svg></button>' +
      '<button class="btn-icon" type="button" data-dir="1" aria-label="Ver más casas" aria-controls="carrusel-similares"><svg class="icon" aria-hidden="true"><use href="#i-right"/></svg></button>';
    carrusel.id = 'carrusel-similares';
    $('.similar-head').appendChild(nav);
    var botones = $$('button', nav);
    var estado = function () {
      botones[0].disabled = carrusel.scrollLeft <= 4;
      botones[1].disabled = carrusel.scrollLeft + carrusel.clientWidth >= carrusel.scrollWidth - 4;
    };
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var card = carrusel.querySelector('.card');
      carrusel.scrollBy({ left: (+b.dataset.dir) * (card ? card.offsetWidth + 24 : carrusel.clientWidth), behavior: 'smooth' });
    });
    carrusel.addEventListener('scroll', estado, { passive: true });
    window.addEventListener('resize', estado);
    estado();
  }

  /* ======================================================================
     9. Confirmación: mensaje según lo que pidió la persona
     ====================================================================== */
  var gracias = $('.thanks__card');
  if (gracias) {
    var ultimo = null;
    try { ultimo = JSON.parse(sessionStorage.getItem('zugar-ultimo-contacto')); } catch (e) { /* nada */ }
    if (ultimo && ultimo.nombre) {
      var p = gracias.querySelector('h1 + p');
      var nombre = ultimo.nombre.split(' ')[0];
      p.textContent = ultimo.motivo === 'visita' && ultimo.fecha
        ? 'Gracias, ' + nombre + '. Tu solicitud para visitar la casa el ' + ultimo.fecha.toLowerCase() + (ultimo.hora ? ' a las ' + ultimo.hora + ' h' : '') + ' fue enviada a ' + (ultimo.asesor || 'tu asesora') + '. Te escribirá para confirmarla.' + (ultimo.folio ? ' Tu folio es ' + ultimo.folio + '.' : '')
        : 'Gracias, ' + nombre + '. ' + p.textContent;
    }
  }

  /* ======================================================================
     10. Preguntas frecuentes: una respuesta abierta a la vez
     ====================================================================== */
  var faqs = $$('.faq details');
  faqs.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) faqs.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });

  /* Al final, cuando ya están las tarjetas del listado y la ficha: WhatsApp de Zugar → app Homiz */
  enlacesAApp(document);
});
