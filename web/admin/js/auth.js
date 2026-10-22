/* Sesión del panel administrativo.
   Con la API disponible (admin/js/api.js), ZAuth.login() usa POST /auth/login y guarda el token del servidor.
   Si no hay servidor, se usa la validación de demostración de abajo (solo para el entorno de diseño). */
(function () {
  var KEY = 'zugar-admin-sesion';
  var LOCK_KEY = 'zugar-admin-intentos';
  var HOURS = 8;
  var MAX_TRIES = 5, LOCK_SECONDS = 30;

  /* Usuarios de demostración */
  var USERS = [
    { email: 'lucia@zugar.example', password: 'Zugar2026!', name: 'Lucía Méndez', role: 'Administradora' }
  ];

  function store(remember) { return remember ? localStorage : sessionStorage; }
  function read(s) { try { return JSON.parse(s.getItem(KEY)); } catch (e) { return null; } }

  window.ZAuth = {
    current: function () {
      var s = null;
      try { s = read(sessionStorage) || read(localStorage); } catch (e) { return null; }
      if (!s || !s.exp || Date.now() > s.exp) { this.clear(); return null; }
      return s;
    },
    clear: function () {
      try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) { /* almacenamiento bloqueado */ }
    },
    /* Devuelve una promesa con { ok: true, user } o { ok: false, error, left, lockedFor } */
    login: function (email, password, remember) {
      var self = this;
      var lock = this.lockState();
      if (lock.lockedFor) return Promise.resolve({ ok: false, error: 'locked', lockedFor: lock.lockedFor });
      if (!window.ZApi || !ZApi.url) return Promise.resolve(this.loginDemo(email, password, remember));
      return ZApi.login(email, password).then(function (r) {
        var u = r.user;
        if (u.type !== 'staff') return { ok: false, error: 'noaccess' }; // las cuentas de cliente usan la app
        return self.iniciar({
          email: u.email, name: u.name, role: u.roles.indexOf('admin') >= 0 ? 'Administración' : 'Broker',
          api: true, token: r.accessToken, refresh: r.refreshToken, roles: u.roles, permissions: u.permissions
        }, remember);
      }, function (e) {
        if (e && e.sinConexion) return self.loginDemo(email, password, remember); // sin servidor: modo de diseño
        if (e && e.status === 423) {
          var min = (e.detalles && e.detalles.retryAfterMinutes) || 15;
          try { sessionStorage.setItem(LOCK_KEY, JSON.stringify({ tries: 0, until: Date.now() + min * 60000 })); } catch (x) { /* sin almacenamiento */ }
          return { ok: false, error: 'locked', lockedFor: min * 60 };
        }
        return self.fallo();
      });
    },
    /* Validación de demostración (sin servidor) */
    loginDemo: function (email, password, remember) {
      var u = USERS.find(function (x) { return x.email.toLowerCase() === String(email).trim().toLowerCase() && x.password === password; });
      if (!u) return this.fallo();
      return this.iniciar({ email: u.email, name: u.name, role: u.role }, remember);
    },
    fallo: function () {
      var tries = this.lockState().tries + 1;
      var until = tries >= MAX_TRIES ? Date.now() + LOCK_SECONDS * 1000 : 0;
      try { sessionStorage.setItem(LOCK_KEY, JSON.stringify({ tries: until ? 0 : tries, until: until })); } catch (e) { /* sin almacenamiento */ }
      return until ? { ok: false, error: 'locked', lockedFor: LOCK_SECONDS } : { ok: false, error: 'invalid', left: MAX_TRIES - tries };
    },
    iniciar: function (session, remember) {
      session.exp = Date.now() + HOURS * 3600 * 1000;
      try {
        sessionStorage.removeItem(LOCK_KEY);
        this.clear();
        store(remember).setItem(KEY, JSON.stringify(session));
      } catch (e) { /* sin almacenamiento: la sesión dura lo que dure la página */ }
      return { ok: true, user: session };
    },
    /* La API renueva el token cada 15 minutos: se guarda donde ya estaba la sesión */
    guardarTokens: function (token, refresh) {
      [sessionStorage, localStorage].forEach(function (s) {
        var cur = null;
        try { cur = read(s); } catch (e) { return; }
        if (!cur) return;
        cur.token = token; cur.refresh = refresh;
        try { s.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* sin almacenamiento */ }
      });
    },
    lockState: function () {
      var l = null;
      try { l = JSON.parse(sessionStorage.getItem(LOCK_KEY)); } catch (e) { /* nada */ }
      l = l || { tries: 0, until: 0 };
      var left = Math.ceil((l.until - Date.now()) / 1000);
      return { tries: l.tries || 0, lockedFor: left > 0 ? left : 0 };
    },
    logout: function () {
      if (window.ZApi) ZApi.salir();
      this.clear();
      location.replace('login.html?salida=1');
    },
    /* Protege el panel: si no hay sesión, manda al login y recuerda a dónde se quería ir */
    require: function () {
      if (this.current()) return true;
      var back = location.hash && location.hash !== '#' ? '?volver=' + encodeURIComponent(location.hash) : '';
      location.replace('login.html' + back);
      return false;
    }
  };
})();
