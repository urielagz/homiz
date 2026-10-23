/* Enrutador por hash y comportamiento global */
(function () {
  var root = document.getElementById('view');
  var first = true;

  function parse() {
    var hash = location.hash.replace(/^#\/?/, '') || 'resumen';
    var parts = hash.split('?');
    var segs = parts[0].split('/').filter(Boolean);
    var params = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { segs: segs, params: params };
  }

  function route() {
    var r = parse();
    var mod = r.segs[0];
    if (!Z.views[mod]) { location.replace('#/resumen'); return; }

    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.dataset.nav === mod) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    root.onclick = root.oninput = root.onchange = root.onsubmit = root.onkeydown = null;
    Z.views[mod].render(root, r.segs.slice(1), r.params);
    if (location.hash.indexOf('?') >= 0) history.replaceState(null, '', location.hash.split('?')[0]);

    var h1 = root.querySelector('h1');
    document.title = (h1 ? h1.textContent + ' · ' : '') + 'Panel administrativo | Zugar';
    if (!first) {
      window.scrollTo(0, 0);
      if (h1) h1.focus({ preventScroll: true });
    }
    first = false;
  }
  Z.rerender = route;
  Z.go = function (hash) { if (location.hash === hash) route(); else location.hash = hash; };

  window.addEventListener('hashchange', route);

  /* Conectado a la API: los datos son reales y se guardan en el servidor */
  var conectado = !!(window.ZApi && ZApi.activo());
  if (conectado) {
    document.querySelectorAll('.badge, .footer span').forEach(function (el) {
      if (el.textContent === 'Entorno de diseño') el.textContent = 'Conectado al servidor';
      else if (el.textContent === 'Diseño estático · Datos ilustrativos') el.textContent = 'Datos en vivo';
    });
  }

  /* Menú de usuario con los datos de la sesión */
  var userBtn = document.querySelector('[data-action="toggle-user"]');
  var userMenu = document.getElementById('user-menu');
  var session = window.ZAuth && ZAuth.current();
  if (session) {
    var exp = new Date(session.exp);
    userBtn.textContent = session.name + ' · ' + session.role;
    document.getElementById('user-name').textContent = session.name;
    document.getElementById('user-meta').textContent = session.role + ' · ' + session.email;
    document.getElementById('user-exp').textContent = 'Tu sesión vence a las ' + String(exp.getHours()).padStart(2, '0') + ':' + String(exp.getMinutes()).padStart(2, '0') + ' h.';
  }
  document.querySelector('[data-action="logout"]').addEventListener('click', function () {
    Z.confirm({
      icon: 'arrow-ur', safe: true,
      title: '¿Cerrar sesión?',
      lead: conectado ? 'Tus cambios ya están guardados en el servidor de Zugar.' : 'Los cambios que hiciste en este entorno de diseño se perderán al salir.',
      cancel: 'Seguir en el panel', confirm: 'Cerrar sesión',
      onConfirm: function () { ZAuth.logout(); }
    });
  });
  function setUser(open) { userMenu.hidden = !open; userBtn.setAttribute('aria-expanded', String(open)); }
  userBtn.addEventListener('click', function (e) { e.stopPropagation(); setUser(userMenu.hidden); });
  document.addEventListener('click', function (e) { if (!userMenu.hidden && !e.target.closest('.user')) setUser(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !userMenu.hidden) { setUser(false); userBtn.focus(); } });

  /* Ayuda */
  document.querySelector('[data-action="open-help"]').addEventListener('click', function (e) {
    e.preventDefault();
    Z.openDialog(
      '<span class="dialog__icon dialog__icon--info">' + Z.icon('info', 'icon--lg') + '</span>' +
      '<h2 id="dialog-title">¿Cómo usar el panel?</h2>' +
      '<p class="lead">Todo lo que cambies aquí se refleja al momento en las demás secciones.</p>' +
      '<ul class="activity">' +
      '<li><strong>Propiedades.</strong> Da de alta casas, edita sus datos, fotos y amenidades, o pausa su publicación.</li>' +
      '<li><strong>Clientes e inquilinos.</strong> Consulta el expediente de cada persona y su próxima visita.</li>' +
      '<li><strong>Brokers.</strong> Asigna un responsable a cada casa; sus próximas citas se reasignan solas.</li>' +
      '<li><strong>Citas.</strong> Confirma, reprograma o cancela visitas desde la agenda semanal.</li>' +
      '</ul><p class="small muted" style="margin-top:1rem">' + (conectado ? 'Conectado al servidor: cada cambio se guarda al momento.' : 'Entorno de diseño: los datos son ilustrativos y se restablecen al recargar la página.') + ' Soporte: soporte@zugar.example</p>' +
      '<div class="dialog__actions"><button class="btn" type="button" data-close>Entendido</button></div>'
    );
  });

  /* Con la API, primero se cargan los datos del servidor; sin ella, los de ejemplo */
  if (conectado) {
    root.innerHTML = '<p class="muted" role="status">Cargando datos de Zugar…</p>';
    if (window.ZPush) ZPush.iniciar(); // avisos en el navegador (Firebase)
    ZApi.cargar().then(route, function (e) {
      Z.toast('No se pudieron cargar los datos del servidor' + (e && e.mensaje ? ': ' + e.mensaje : '.'));
      route();
    });
  } else route();
})();
