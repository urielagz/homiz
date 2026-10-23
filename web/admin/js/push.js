/* ==========================================================================
   Avisos del panel en el navegador (Firebase Cloud Messaging).
   - Solo con sesión de la API y en una página segura (https o localhost): así lo exigen los navegadores.
   - El permiso se pide con un botón del menú de usuario («Activar avisos en este navegador»).
   - El navegador queda registrado en POST /devices; al cerrar sesión se da de baja.
   - Con la pestaña abierta el aviso aparece como mensaje flotante y se recargan los datos;
     cerrada, lo muestra firebase-messaging-sw.js.
   ========================================================================== */
(function () {
  var F = window.ZUGAR_FIREBASE;
  var CLAVE = 'zugar_push_token';
  var cargaSdk = null, messaging = null;

  function soportado() {
    return !!(F && window.ZApi && ZApi.activo() && window.isSecureContext && 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window);
  }
  function guardado(v) {
    try { if (v === undefined) return localStorage.getItem(CLAVE); if (v) localStorage.setItem(CLAVE, v); else localStorage.removeItem(CLAVE); } catch (e) { return null; }
  }
  function script(src) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s);
    });
  }
  function sdk() {
    if (!cargaSdk) cargaSdk = script(F.sdk + 'firebase-app-compat.js').then(function () { return script(F.sdk + 'firebase-messaging-compat.js'); }).then(function () {
      if (!firebase.apps.length) firebase.initializeApp(F.config);
      messaging = firebase.messaging();
      messaging.onMessage(function (m) {
        var n = m.notification || {};
        Z.toast((n.title ? n.title + ': ' : '') + (n.body || 'Tienes un aviso nuevo.'));
        ZApi.cargar().then(Z.rerender, function () {});
      });
      return messaging;
    });
    return cargaSdk;
  }

  /* La primera vez el service worker tarda en activarse; sin esperar, Firebase no puede suscribirse. */
  function activo(reg) {
    if (reg.active) return Promise.resolve(reg);
    var sw = reg.installing || reg.waiting;
    return new Promise(function (ok) {
      sw.addEventListener('statechange', function () { if (sw.state === 'activated') ok(reg); });
    });
  }

  /* Pide el token a Firebase y lo registra en el servidor (si cambió). */
  function registrar() {
    return Promise.all([sdk(), navigator.serviceWorker.register('firebase-messaging-sw.js').then(activo)]).then(function (r) {
      return r[0].getToken({ vapidKey: F.vapidKey, serviceWorkerRegistration: r[1] });
    }).then(function (token) {
      if (!token) throw new Error('sin token');
      return ZApi.pedir('POST', '/devices', { fcmToken: token, platform: 'web' }).then(function () { guardado(token); return token; });
    });
  }

  function pintarBoton() {
    var menu = document.getElementById('user-menu');
    if (!menu) return;
    var b = document.getElementById('push-btn');
    if (!soportado() || Notification.permission === 'granted') { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('button');
      b.id = 'push-btn'; b.type = 'button'; b.className = 'btn btn--sm';
      b.style.marginBottom = '.5rem';
      menu.insertBefore(b, menu.querySelector('[data-action="logout"]'));
      b.addEventListener('click', activar);
    }
    var bloqueado = Notification.permission === 'denied';
    b.disabled = bloqueado;
    b.textContent = bloqueado ? 'Avisos bloqueados en este navegador' : 'Activar avisos en este navegador';
    b.title = bloqueado ? 'Permite las notificaciones de este sitio en la configuración del navegador.' : 'Recibe nuevas solicitudes, citas y reportes aunque el panel esté cerrado.';
  }

  function activar() {
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { pintarBoton(); Z.toast('No se activaron los avisos. Puedes permitirlos en la configuración del navegador.'); return; }
      return registrar().then(function () { pintarBoton(); Z.toast('Listo: recibirás los avisos del panel en este navegador.'); });
    }).catch(function (e) { console.warn('Avisos: no se activaron', e); Z.toast('No se pudieron activar los avisos. Intenta de nuevo.'); });
  }

  window.ZPush = {
    /* Al entrar al panel: si ya hay permiso, vuelve a registrar el token en silencio (Firebase puede renovarlo). */
    iniciar: function () {
      if (!soportado()) return;
      pintarBoton();
      if (Notification.permission === 'granted') registrar().catch(function (e) { console.warn('Avisos: no se registró este navegador', e); /* se reintenta en la próxima visita */ });
    },
    /* Al cerrar sesión: este navegador deja de recibir los avisos de esa cuenta. */
    salir: function (token) {
      var t = guardado();
      if (!t || !token || !window.ZApi) return;
      fetch(ZApi.url + '/devices/' + encodeURIComponent(t), { method: 'DELETE', keepalive: true, headers: { Authorization: 'Bearer ' + token } }).catch(function () {});
      guardado(null);
    }
  };
})();
