/* Conexión del panel con la API de Homiz.
   Si la sesión se inició con la API, el panel carga sus datos desde el servidor y cada cambio se guarda ahí;
   si no (API_URL vacío o servidor apagado), todo sigue en memoria como en el entorno de diseño.
   Para cambiar el servidor sin tocar este archivo: <script>window.ZUGAR_API_URL = 'https://…/api/v1';</script> */
(function () {
  var API_URL = window.ZUGAR_API_URL !== undefined ? window.ZUGAR_API_URL : 'http://localhost:3000/api/v1';
  var ESPERA_MS = 8000;

  function sesion() { return window.ZAuth ? ZAuth.current() : null; }

  /* ---------- Peticiones con token y renovación automática ---------- */
  function fetchJson(path, init) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var reloj = ctrl ? setTimeout(function () { ctrl.abort(); }, ESPERA_MS) : null;
    if (ctrl) init.signal = ctrl.signal;
    return fetch(API_URL + path, init).then(function (r) {
      clearTimeout(reloj);
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (r.ok) return body;
        var e = body && body.error ? body.error : {};
        throw { status: r.status, codigo: e.code, mensaje: e.message || 'El servidor no pudo completar la acción.', detalles: e.details };
      });
    }, function () {
      clearTimeout(reloj);
      throw { sinConexion: true, mensaje: 'No hay conexión con el servidor de Zugar.' };
    });
  }

  var renovando = null;
  function renovar() {
    var s = sesion();
    if (!s || !s.refresh) return Promise.reject({ status: 401 });
    renovando = renovando || fetchJson('/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: s.refresh })
    }).then(function (r) { ZAuth.guardarTokens(r.accessToken, r.refreshToken); }).finally(function () { renovando = null; });
    return renovando;
  }

  function pedir(method, path, body, reintento) {
    var s = sesion();
    var headers = { Accept: 'application/json' };
    if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetchJson(path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) }).catch(function (e) {
      if (e.status === 401 && !reintento) {
        return renovar().then(function () { return pedir(method, path, body, true); }, function () {
          ZAuth.logout(); // la sesión del servidor terminó
          throw e;
        });
      }
      throw e;
    });
  }

  /* ---------- Fechas en hora de Cancún (UTC-5 todo el año) ---------- */
  var FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function enCancun(iso) {
    var p = {};
    FMT.formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }
  function aIso(date, time) { return date + 'T' + time + ':00-05:00'; }
  function cuando(iso) {
    var c = enCancun(iso);
    return (c.date === Z.TODAY ? 'Hoy' : Z.dateShort(c.date) + ' ' + c.date.slice(0, 4)) + ' · ' + c.time + ' h';
  }
  function hoy() { return enCancun(new Date().toISOString()).date; }
  function slug(s) { return Z.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  /* ---------- De la API al formato de Z.data ---------- */
  var uuid = { prop: {} }; // código ZUG-### → id de la base

  function aPropiedad(p) {
    uuid.prop[p.code] = p.id;
    var act = p.updatedAt ? enCancun(p.updatedAt) : null;
    return {
      id: p.code, _id: p.id, _zoneKey: p.zoneKey,
      name: p.name, type: p.type, zone: p.zone, city: p.city, address: p.address, street: p.street || '',
      op: p.operation, price: Number(p.price), rec: Number(p.rec), banos: Number(p.banos), m2: p.m2 == null ? '' : Number(p.m2),
      terreno: p.terreno == null ? '' : Number(p.terreno), est: p.est, age: p.age == null ? '' : p.age,
      status: p.status, visibility: p.visibility, broker: p.broker ? p.broker.id : '',
      maintenance: p.maintenance || '', deposit: p.deposit == null ? 0 : Number(p.deposit),
      availableFrom: p.availableFrom ? String(p.availableFrom).slice(0, 10) : '', furnished: p.furnished, desc: p.description || '',
      amenities: p.amenities || [],
      // Las fotos subidas llegan con URL firmada; las del sitio, con su nombre de archivo en assets/img.
      photos: (p.photos || []).map(function (f) { return { src: f.url || f.key, label: f.label || '', key: f.key }; }),
      published: p.publishedAt ? String(p.publishedAt).slice(0, 10) : '',
      updated: act ? (act.date === Z.TODAY ? 'Hoy a las ' + act.time + ' h' : Z.dateShort(act.date) + ' · ' + act.time + ' h') : '',
      updatedAt: p.updatedAt ? Date.parse(p.updatedAt) : 0
    };
  }
  function aPersona(c) {
    return {
      id: c.id, name: c.name, email: c.email || '', phone: c.phone || '', type: c.kind, label: c.label || undefined,
      property: c.property ? c.property.code : '', broker: c.broker ? c.broker.id : '', follow: c.followStatus,
      op: c.operation || 'Renta', budget: c.budget || '', needs: c.needs || '',
      job: [c.occupation, c.nationality ? 'Nacionalidad ' + c.nationality.toLowerCase() : ''].filter(Boolean).join(' · ')
    };
  }
  function aCita(a) {
    var c = enCancun(a.scheduledAt);
    return {
      id: a.code, _id: a.id, person: a.client ? a.client.id : '', property: a.property.code, broker: a.broker ? a.broker.id : '',
      date: c.date, start: c.time, end: Z.addMinutes(c.time, a.durationMin || 45), status: a.status, kind: a.kind || 'Presencial',
      note: a.note || a.reason || '', confirmedBy: a.confirmedBy || ''
    };
  }
  function aBroker(u, previos) {
    var antes = previos.filter(function (b) { return b.email && u.email && b.email.toLowerCase() === u.email.toLowerCase(); })[0];
    return {
      id: u.id, name: u.name, initials: u.initials || Z.norm(u.name).split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(),
      role: u.specialty || '', zones: u.zones || '', email: u.email || '', phone: u.phone || '',
      photo: antes ? antes.photo : '', active: u.active !== false
    };
  }
  function reemplazar(lista, nuevos) { lista.length = 0; Array.prototype.push.apply(lista, nuevos); }

  /* Estados que el servidor maneja y el diseño no tenía */
  function completarCatalogos() {
    Z.STATUS.vendida = Z.STATUS.vendida || { label: 'Vendida', tone: 'gris' };
    Z.APPT_STATUS.rechazada = Z.APPT_STATUS.rechazada || { label: 'Rechazada', tone: 'error' };
  }

  var api = window.ZApi = {
    url: API_URL,
    activo: function () { var s = sesion(); return !!(API_URL && s && s.api && s.token); },
    pedir: pedir,

    /* Inicio de sesión del panel (lo usa auth.js). Rechaza con { sinConexion } si no hay servidor. */
    login: function (email, password) {
      if (!API_URL) return Promise.reject({ sinConexion: true });
      return fetchJson('/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: String(email).trim(), password: password })
      });
    },
    olvide: function (email) {
      if (!API_URL) return Promise.resolve();
      return fetchJson('/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: String(email).trim() })
      }).catch(function () { /* el mensaje en pantalla es el mismo exista o no la cuenta */ });
    },
    salir: function () {
      var s = sesion();
      if (!api.activo() || !s.refresh) return;
      fetchJson('/auth/logout', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + s.token },
        body: JSON.stringify({ refreshToken: s.refresh })
      }).catch(function () { /* la sesión local se borra de todos modos */ });
    },

    /* Llena Z.data con los datos del servidor (mismas listas, para que las secciones las sigan viendo). */
    cargar: function () {
      if (!api.activo()) return Promise.resolve();
      completarCatalogos();
      Z.TODAY = hoy();
      var D = Z.data;
      var lista = function (path) { return pedir('GET', path).then(function (r) { return r.data || []; }); };
      return Promise.all([
        lista('/properties?limit=100&sort=updated'),
        lista('/clients?limit=100'),
        lista('/appointments?limit=100'),
        lista('/users?role=broker&limit=100').catch(function () { return null; }), // solo administración
        lista('/activity-log?limit=60').catch(function () { return []; })
      ]).then(function (r) {
        var props = r[0], people = r[1], appts = r[2], users = r[3], activity = r[4];
        if (!users) { // sin permiso para ver al personal: los brokers salen de las casas
          var vistos = {};
          users = [];
          props.forEach(function (p) { if (p.broker && !vistos[p.broker.id]) { vistos[p.broker.id] = 1; users.push(p.broker); } });
        }
        var previos = D.brokers.slice();
        reemplazar(D.brokers, users.map(function (u) { return aBroker(u, previos); }));
        reemplazar(D.properties, props.map(aPropiedad));
        D.people = people.map(aPersona);
        reemplazar(D.appointments, appts.map(aCita));
        D.properties.forEach(function (p) { if (Z.ZONES.indexOf(p.zone) < 0) Z.ZONES.push(p.zone); });

        D.activity = activity.slice(0, 20).map(function (a) { return { when: cuando(a.createdAt), text: a.description || a.action }; });
        D.history = {};
        activity.forEach(function (a) {
          if (!a.property) return;
          (D.history[a.property.code] = D.history[a.property.code] || []).push({ when: cuando(a.createdAt), text: a.description || a.action });
        });

        var sp = Z.state.people;
        if (sp && !D.people.some(function (x) { return x.id === sp.selected; })) sp.selected = D.people[0] ? D.people[0].id : null;
        var sc = Z.state.citas;
        if (sc && !Z.appt(sc.selected)) sc.selected = null;
      });
    },

    /* Después de guardar: recarga desde el servidor. Si falla, avisa y vuelve a los datos reales. */
    sincronizar: function (promesa, alTerminar) {
      if (!api.activo()) return;
      promesa.then(function (r) {
        return api.cargar().then(function () { if (alTerminar) alTerminar(r); Z.rerender(); });
      }, function (e) {
        Z.toast('No se guardó: ' + (e && e.mensaje ? e.mensaje : 'error del servidor') + ' Se restauraron los datos.');
        return api.cargar().then(Z.rerender);
      });
    },

    /* ---------- Escrituras: una por cada cambio del panel ---------- */
    citaEstado: function (a, status) {
      var accion = { confirmada: 'confirm', cancelada: 'cancel', realizada: 'complete' }[status];
      if (accion) api.sincronizar(pedir('POST', '/appointments/' + a._id + '/' + accion, {}));
    },
    citaReprogramar: function (a, motivo) {
      api.sincronizar(pedir('POST', '/appointments/' + a._id + '/reschedule', { scheduledAt: aIso(a.date, a.start), reason: motivo || undefined }));
    },
    citaNueva: function (a) {
      api.sincronizar(pedir('POST', '/appointments', { propertyId: uuid.prop[a.property], clientId: a.person, scheduledAt: aIso(a.date, a.start), note: a.note || null }),
        function (r) { if (Z.state.citas) Z.state.citas.selected = r.code; });
    },

    personaGuardar: function (p, nueva) {
      // «Ocupación y nacionalidad» del panel = ocupación + «Nacionalidad …» en la base
      var partes = String(p.job || '').split(/\s*·\s*/).filter(Boolean);
      var nac = partes.filter(function (x) { return /^nacionalidad\s+/i.test(x); })[0];
      var cuerpo = {
        name: p.name, email: p.email || null, phone: p.phone || null, kind: p.type, followStatus: p.follow,
        propertyId: uuid.prop[p.property] || null, brokerId: p.broker || null, operation: p.op || null,
        budget: p.budget || null, needs: p.needs || null,
        occupation: partes.filter(function (x) { return x !== nac; }).join(' · ') || null,
        nationality: nac ? Z.cap(nac.replace(/^nacionalidad\s+/i, '')) : null
      };
      api.sincronizar(nueva ? pedir('POST', '/clients', cuerpo) : pedir('PATCH', '/clients/' + p.id, cuerpo),
        function (r) { if (Z.state.people) Z.state.people.selected = r.id; });
    },
    personaEliminar: function (p) { api.sincronizar(pedir('DELETE', '/clients/' + p.id)); },

    brokerGuardar: function (b, nuevo) {
      if (nuevo) {
        // La cuenta se crea con una contraseña aleatoria; la persona entra con «¿Olvidaste tu contraseña?».
        var clave = 'Zg' + Math.random().toString(36).slice(2, 10) + 'A' + Math.floor(Math.random() * 90 + 10) + 'x';
        api.sincronizar(pedir('POST', '/users', { name: b.name, email: b.email, phone: b.phone || null, zones: b.zones || null, specialty: b.role || null, roles: ['broker'], password: clave }),
          function () { Z.toast(b.name + ' debe usar «¿Olvidaste tu contraseña?» en el acceso para crear su contraseña.'); });
      } else {
        api.sincronizar(pedir('PATCH', '/users/' + b.id, { name: b.name, phone: b.phone || null, zones: b.zones || null, specialty: b.role || null }));
      }
    },
    brokerActivo: function (b) { api.sincronizar(pedir('PATCH', '/users/' + b.id, { active: !!b.active })); },
    propiedadBroker: function (p) { api.sincronizar(pedir('PATCH', '/properties/' + uuid.prop[p.id] + '/broker', { brokerId: p.broker })); },

    propiedadEliminar: function (p) { api.sincronizar(pedir('DELETE', '/properties/' + (p._id || uuid.prop[p.id]))); },
    propiedadVisibilidad: function (p) {
      api.sincronizar(pedir('PATCH', '/properties/' + (p._id || uuid.prop[p.id]) + '/availability', { visibility: p.visibility }));
    },

    /* Archivos elegidos en el formulario (blob: → File) para subirlos al guardar */
    archivos: {},
    recordarArchivo: function (src, file) { api.archivos[src] = file; },

    propiedadGuardar: function (p, nueva, antes) {
      if (!api.activo()) return;
      var zonaPrevia = antes && antes.zone === p.zone ? antes._zoneKey : null;
      var mismaZona = Z.data.properties.filter(function (x) { return x.zone === p.zone && x._zoneKey; })[0];
      var datos = {
        name: p.name, type: p.type, description: p.desc || '', operation: p.op, price: p.price, rec: p.rec, banos: p.banos,
        m2: p.m2 || null, terreno: p.terreno || null, est: p.est || 0, age: p.age === '' || p.age == null ? null : +p.age,
        furnished: p.furnished || 'Sin amueblar', petsAllowed: p.amenities.indexOf('Se aceptan mascotas') >= 0,
        maintenance: p.maintenance || null, deposit: p.deposit || null, availableFrom: p.availableFrom || null,
        address: p.address || '', street: p.street || null, city: p.city, zone: p.zone,
        zoneKey: zonaPrevia || (mismaZona ? mismaZona._zoneKey : slug(p.zone)),
        mapQuery: p.zone + ', Cancún, Quintana Roo', amenities: p.amenities
      };
      var id = antes ? antes._id : null;
      var guardar = (nueva
        ? pedir('POST', '/properties', Object.assign({ brokerId: p.broker || undefined }, datos)).then(function (r) { id = r.id; p._code = r.code; })
        : pedir('PATCH', '/properties/' + id, datos)
      ).then(function () {
        return Promise.all(p.photos.map(function (f) { return subirFoto(id, f); }));
      }).then(function (fotos) {
        return pedir('PATCH', '/properties/' + id, { photos: fotos });
      }).then(function () {
        if (!nueva && antes.broker !== p.broker && p.broker) return pedir('PATCH', '/properties/' + id + '/broker', { brokerId: p.broker });
      }).then(function () {
        return pedir('PATCH', '/properties/' + id + '/availability', { status: p.status, visibility: p.visibility });
      });
      api.sincronizar(guardar, function () {
        if (nueva && p._code) location.hash = '#/propiedades/' + p._code;
      });
    }
  };

  /* Sube una foto nueva (blob:) con URL firmada; las existentes conservan su clave. */
  function subirFoto(propertyId, f) {
    var file = api.archivos[f.src];
    if (!file) return Promise.resolve({ storageKey: f.key || f.src, label: f.label || '' });
    return pedir('POST', '/documents/upload-url', { propertyId: propertyId, purpose: 'property_photo', mime: file.type, size: file.size }).then(function (r) {
      return fetch(r.upload.url, { method: 'PUT', headers: r.upload.headers || { 'Content-Type': file.type }, body: file }).then(function (res) {
        if (!res.ok) throw { mensaje: 'No se pudo subir la foto «' + f.label + '».' };
        return { storageKey: r.storageKey, label: f.label || '' };
      });
    });
  }
})();
