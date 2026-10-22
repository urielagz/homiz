/* ==========================================================================
   Zugar Inmobiliaria · Conexión del sitio público con la API de Homiz
   Si API_URL está vacío o el servidor no responde, el sitio sigue con su
   catálogo y envíos simulados de siempre (funciona con doble clic).
   Para cambiar el servidor sin tocar este archivo, define antes de cargarlo:
     <script>window.ZUGAR_API_URL = 'https://api.zugar.mx/api/v1';</script>
   y para desactivarlo: window.ZUGAR_API_URL = '';
   ========================================================================== */
(function () {
  'use strict';

  var API_URL = window.ZUGAR_API_URL !== undefined ? window.ZUGAR_API_URL : 'http://localhost:3000/api/v1';
  /* Si la API no contesta en este tiempo, se usa el modo sin servidor. Con el servidor apagado la conexión
     se rechaza al instante; el límite solo cuenta cuando responde lento. */
  var ESPERA_MS = 8000;

  var script = document.currentScript || document.querySelector('script[src*="api.js"]');
  var IMG = new URL('../img/', script.src).href;

  /* fetch con tiempo límite. Rechaza con { sinConexion: true } si no hay respuesta. */
  function pedir(path, opciones) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var reloj = ctrl ? setTimeout(function () { ctrl.abort(); }, ESPERA_MS) : null;
    var init = Object.assign({ headers: { Accept: 'application/json' } }, opciones || {});
    if (ctrl) init.signal = ctrl.signal;
    return fetch(API_URL + path, init).then(function (r) {
      clearTimeout(reloj);
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (r.ok) return body;
        var err = body && body.error ? body.error : {};
        throw { status: r.status, codigo: err.code, mensaje: err.message, detalles: err.details };
      });
    }, function () {
      clearTimeout(reloj);
      throw { sinConexion: true };
    });
  }

  /* ---------- Catálogo con los nombres de campos de main.js ---------- */
  var TIPOS = { 'Casa en condominio': 'casa-condominio', Townhouse: 'townhouse' };
  var AMUEBLADA = { Amueblada: 'si', Semiamueblada: 'semi' };
  function esUrl(src) { return /^(https?:|data:|blob:)/.test(src || ''); }

  function aCasa(p) {
    var portada = p.photos && p.photos[0] ? p.photos[0].src : '';
    return {
      slug: p.slug,
      code: p.code,
      name: p.name,
      zona: p.zona,
      zonaKey: p.zonaKey,
      // main.js agrega ", Quintana Roo" al armar el mapa
      mapa: String(p.mapa || p.zona + ', Cancún').replace(/,\s*Quintana Roo\s*$/i, ''),
      op: p.op,
      price: Number(p.price),
      rec: Number(p.rec),
      banos: Number(p.banos),
      m2: Number(p.m2) || 0,
      est: Number(p.est) || 0,
      pets: !!p.pets,
      amueblada: AMUEBLADA[p.furnished] || 'no',
      tipo: TIPOS[p.tipo] || 'casa',
      tipoTexto: p.tipo,
      asesor: p.asesor || '',
      orden: p.publishedAt ? Date.parse(p.publishedAt) / 864e5 : 0,
      img: portada && !esUrl(portada) ? portada.replace(/\.[a-z]+$/i, '') : undefined,
      foto: portada && esUrl(portada) ? portada : undefined,
      // Datos extra para la ficha
      description: p.description || '',
      address: p.address || '',
      terreno: Number(p.terreno) || 0,
      age: p.age,
      maintenance: p.maintenance || '',
      amenities: p.amenities || [],
      photos: (p.photos || []).map(function (f) { return { src: esUrl(f.src) ? f.src : IMG + f.src, label: f.label || '' }; }),
      publishedAt: p.publishedAt || ''
    };
  }

  var params = new URLSearchParams(location.search);
  var api = window.ZugarAPI = {
    url: API_URL,
    disponible: false,
    catalogo: null, // arreglo de casas de la API (null = usar el de main.js)
    ficha: null,    // casa pedida con ?slug= en propiedad.html

    /* Ejecuta fn cuando el catálogo ya se intentó cargar (con o sin servidor).
       Solo esperan las páginas que lo muestran (listado y ficha); las demás arrancan de inmediato. */
    listo: function (fn) {
      var esFicha = /propiedad\.html$/.test(location.pathname);
      if (!API_URL || !(esFicha || document.querySelector('.listing-layout'))) { fn(); return; }
      // Mientras carga, ningún formulario se envía sin la validación de main.js
      var detener = function (e) { e.preventDefault(); };
      document.addEventListener('submit', detener, true);
      var arrancar = fn;
      fn = function () { document.removeEventListener('submit', detener, true); arrancar(); };
      var slug = params.get('slug');
      var catalogo = pedir('/public/properties?porPagina=50&orden=recientes').then(function (r) {
        api.catalogo = (r.data || []).map(aCasa);
        api.disponible = true;
      });
      var ficha = slug && esFicha
        ? pedir('/public/properties/' + encodeURIComponent(slug)).then(function (p) { api.ficha = aCasa(p); })
        : Promise.resolve();
      var avisar = function (e) { if (!e || !e.sinConexion) console.warn('Zugar: no se usó la API', e); };
      Promise.all([catalogo.catch(avisar), ficha.catch(avisar)]).then(function () { fn(); });
    },

    /* Envía un formulario del sitio a POST /public/leads y devuelve { folio }. */
    enviarSolicitud: function (form, tipo) {
      if (!API_URL) return Promise.reject({ sinConexion: true });
      var fd = new FormData(form);
      var v = function (k) { var x = fd.get(k); return x == null ? '' : String(x).trim(); };
      var motivo = v('motivo');
      var casa = v('casa') && v('casa') !== 'sin-definir' ? v('casa') : (form.dataset.casa || '');
      var reason = tipo === 'cita' ? 'visita' : (motivo || 'otro');
      // Una visita necesita casa; si no eligió ninguna, es una solicitud de renta o compra.
      if (reason === 'visita' && !casa && !v('propiedad')) reason = v('operacion') === 'compra' ? 'comprar' : 'rentar';

      var usados = ['motivo', 'nombre', 'correo', 'telefono', 'comentarios', 'mensaje', 'fecha', 'horario', 'casa', 'propiedad'];
      var payload = {};
      fd.forEach(function (valor, clave) {
        if (usados.indexOf(clave) >= 0 || typeof valor !== 'string' || !valor.trim()) return;
        payload[clave.slice(0, 40)] = valor.trim().slice(0, 500);
      });
      var cuerpo = {
        reason: reason,
        name: v('nombre'),
        email: v('correo'),
        phone: v('telefono') || null,
        message: v('comentarios') || v('mensaje') || null,
        payload: payload
      };
      if (v('propiedad')) cuerpo.propertyCode = v('propiedad');
      else if (casa && reason !== 'publicar' && reason !== 'otro') cuerpo.propertySlug = casa;
      if (reason === 'visita' && v('fecha')) cuerpo.preferredDate = v('fecha');
      if (reason === 'visita' && v('horario')) cuerpo.preferredTime = v('horario');

      return pedir('/public/leads', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      }).then(function (r) { return { folio: r.folio, cita: r.appointmentCode || null }; });
    }
  };
})();
