/* Sesión del panel administrativo.
   IMPORTANTE: esta validación vive en el navegador y sirve solo para el entorno de diseño.
   Al conectar el backend, reemplaza ZAuth.login() por una llamada a tu API (POST /api/login)
   y guarda el token que devuelva el servidor; nunca dejes contraseñas en el front-end. */
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
    /* Devuelve { ok: true, user } o { ok: false, error, lockedFor } */
    login: function (email, password, remember) {
      var lock = this.lockState();
      if (lock.lockedFor) return { ok: false, error: 'locked', lockedFor: lock.lockedFor };
      var u = USERS.find(function (x) { return x.email.toLowerCase() === String(email).trim().toLowerCase() && x.password === password; });
      if (!u) {
        var tries = lock.tries + 1;
        var until = tries >= MAX_TRIES ? Date.now() + LOCK_SECONDS * 1000 : 0;
        try { sessionStorage.setItem(LOCK_KEY, JSON.stringify({ tries: until ? 0 : tries, until: until })); } catch (e) { /* sin almacenamiento */ }
        return until ? { ok: false, error: 'locked', lockedFor: LOCK_SECONDS } : { ok: false, error: 'invalid', left: MAX_TRIES - tries };
      }
      var session = { email: u.email, name: u.name, role: u.role, exp: Date.now() + HOURS * 3600 * 1000 };
      try {
        sessionStorage.removeItem(LOCK_KEY);
        this.clear();
        store(remember).setItem(KEY, JSON.stringify(session));
      } catch (e) { /* sin almacenamiento: la sesión dura lo que dure la página */ }
      return { ok: true, user: session };
    },
    lockState: function () {
      var l = null;
      try { l = JSON.parse(sessionStorage.getItem(LOCK_KEY)); } catch (e) { /* nada */ }
      l = l || { tries: 0, until: 0 };
      var left = Math.ceil((l.until - Date.now()) / 1000);
      return { tries: l.tries || 0, lockedFor: left > 0 ? left : 0 };
    },
    logout: function () {
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
