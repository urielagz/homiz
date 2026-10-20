/* Módulo 4 · Brokers */
(function () {
  var D = Z.data;
  var S = Z.state.brokers = { q: '', broker: '', status: '', prop: 'ZUG-001' };

  function initials(name) { return name.split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }

  function brokerForm(b) {
    var x = b || { name: '', zones: '', role: '', email: '', phone: '' };
    Z.openDialog(
      '<h2 id="dialog-title">' + (b ? 'Editar perfil' : 'Agregar broker') + '</h2>' +
      '<p class="lead">' + (b ? 'Actualiza los datos de contacto y zonas de ' + Z.esc(b.name) + '.' : 'Suma a una persona del equipo para asignarle casas y citas.') + '</p>' +
      '<form id="broker-form" novalidate><div class="form-grid">' +
        '<div class="field span-all"><label class="field__label" for="bf-name">Nombre completo *</label><input class="input" id="bf-name" required value="' + Z.esc(x.name) + '"></div>' +
        '<div class="field span-all"><label class="field__label" for="bf-zones">Zonas que atiende *</label><input class="input" id="bf-zones" required value="' + Z.esc(x.zones) + '" placeholder="Arbolada · Aqua Residencial"></div>' +
        '<div class="field span-all"><label class="field__label" for="bf-role">Especialidad</label><input class="input" id="bf-role" value="' + Z.esc(x.role) + '" placeholder="Rentas · Arbolada y Aqua"></div>' +
        '<div class="field"><label class="field__label" for="bf-email">Correo electrónico *</label><input class="input" id="bf-email" type="email" required value="' + Z.esc(x.email) + '"></div>' +
        '<div class="field"><label class="field__label" for="bf-phone">Teléfono *</label><input class="input" id="bf-phone" type="tel" required value="' + Z.esc(x.phone) + '" placeholder="+52 998 000 0000"></div>' +
      '</div><div class="dialog__actions"><button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn" type="submit">' + (b ? 'Guardar perfil' : 'Agregar broker') + '</button></div></form>',
      {
        wide: true,
        onOpen: function (dlg) {
          var form = dlg.querySelector('#broker-form');
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (Z.validate(form).length) return;
            var v = function (id) { return dlg.querySelector(id).value.trim(); };
            var data = { name: v('#bf-name'), zones: v('#bf-zones'), role: v('#bf-role'), email: v('#bf-email'), phone: v('#bf-phone') };
            data.initials = initials(data.name);
            if (b) {
              Object.assign(b, data);
              Z.toast('Se actualizó el perfil de ' + b.name + '.');
            } else {
              data.id = Z.norm(data.name).replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
              data.active = true; data.photo = '';
              D.brokers.push(data);
              Z.log('Lucía agregó a ' + data.name + ' al equipo de brokers.');
              Z.toast(data.name + ' ya forma parte del equipo.');
            }
            Z.closeDialog(); Z.rerender();
          });
        }
      }
    );
  }

  function toggleActive(b) {
    if (!b.active) {
      b.active = true; Z.log('Lucía reactivó a ' + b.name + '.'); Z.toast(b.name + ' está activo de nuevo.'); Z.rerender(); return;
    }
    var st = Z.brokerStats(b.id);
    Z.confirm({
      icon: 'user-key', safe: false,
      title: '¿Desactivar a ' + b.name + '?',
      lead: 'Ya no podrá recibir nuevas casas ni citas. Su historial se conserva y puedes reactivarlo cuando quieras.',
      callout: st.props || st.next ? '<div class="callout"><strong>Tiene trabajo asignado</strong>' + st.props + ' propiedad' + (st.props === 1 ? '' : 'es') + ' y ' + st.next + ' cita' + (st.next === 1 ? '' : 's') + ' próxima' + (st.next === 1 ? '' : 's') + '. Seguirán a su nombre hasta que las reasignes en «Asignación por propiedad».</div>' : '',
      cancel: 'Mantener activo',
      confirm: 'Sí, desactivar',
      onConfirm: function () {
        b.active = false; Z.log('Lucía desactivó a ' + b.name + '.'); Z.toast(b.name + ' quedó inactivo.'); Z.rerender();
      }
    });
  }

  Z.views.brokers = {
    render: function (root, segs, params) {
      if (params.prop && Z.prop(params.prop)) S.prop = params.prop;
      if (!Z.prop(S.prop)) S.prop = D.properties[0] ? D.properties[0].id : null;
      var current = S.prop ? Z.prop(S.prop) : null;

      var cards = D.brokers.map(function (b) {
        var st = Z.brokerStats(b.id);
        var sel = current && current.broker === b.id;
        return '<article class="card broker-card' + (sel ? ' card--selected' : '') + (b.active ? '' : ' is-inactive') + '" aria-label="' + Z.esc(b.name) + (sel ? ', responsable de ' + Z.esc(current.name) : '') + '">' +
          '<div class="broker-card__top">' + Z.avatar(b, 'avatar--lg') + '<div><strong>' + Z.esc(b.name) + '</strong>' + (b.active ? Z.badge('Activo', 'ok') : Z.badge('Inactivo', 'gris')) + '</div></div>' +
          '<dl><div><dt class="sr-only">Zonas</dt><dd>' + Z.esc(b.zones) + '</dd></div>' +
          '<div><dt class="sr-only">Correo</dt><dd><a href="mailto:' + Z.esc(b.email) + '" style="color:inherit">' + Z.esc(b.email) + '</a></dd></div>' +
          '<div><dt class="sr-only">Teléfono</dt><dd><a href="tel:' + b.phone.replace(/\s/g, '') + '" style="color:inherit">' + Z.esc(b.phone) + '</a></dd></div></dl>' +
          '<p class="broker-card__sum">' + st.props + ' propiedad' + (st.props === 1 ? '' : 'es') + ' · ' + (st.next ? st.next + ' próxima' + (st.next === 1 ? '' : 's') + ' cita' + (st.next === 1 ? '' : 's') : 'Sin citas próximas') + '</p>' +
          '<div class="broker-card__actions"><button class="link" type="button" data-edit="' + b.id + '">Editar perfil</button>' +
          '<button class="link link--muted" type="button" data-toggle="' + b.id + '">' + (b.active ? 'Desactivar' : 'Activar') + '</button></div></article>';
      }).join('');

      var withBroker = D.properties.filter(function (p) { return D.brokers.some(function (b) { return b.id === p.broker; }); }).length;

      root.innerHTML =
        Z.crumbs([['Administración', '#/resumen'], ['Brokers']]) +
        Z.pageHead('Un equipo cerca de cada casa.', 'Administra los perfiles y asigna un responsable a cada propiedad.',
          '<button class="btn" type="button" data-action="add">' + Z.icon('plus') + 'Agregar broker</button>') +
        '<div class="broker-cards">' + cards + '</div>' +
        '<section aria-labelledby="as-title"><div class="section-head"><h2 id="as-title">Asignación por propiedad</h2><span class="small muted">' + withBroker + ' de ' + D.properties.length + ' casas con responsable</span></div>' +
        '<div class="filters filters--3" role="search" aria-label="Filtrar asignaciones">' +
          '<div class="field"><label class="field__label" for="bk-q">Buscar casa</label><input class="input input-search" id="bk-q" type="search" placeholder="Nombre o clave" value="' + Z.esc(S.q) + '"></div>' +
          '<div class="field"><label class="field__label" for="bk-broker">Broker asignado</label><select class="select" id="bk-broker">' + Z.brokerOptions(S.broker, 'Todos los brokers') + '</select></div>' +
          '<div class="field"><label class="field__label" for="bk-status">Disponibilidad</label><select class="select" id="bk-status">' + Z.options(Object.keys(Z.STATUS).map(function (k) { return [k, Z.STATUS[k].label]; }), S.status, 'Todos los estados') + '</select></div>' +
        '</div>' +
        '<div class="table-wrap" style="margin-top:1.25rem"><table class="table"><caption class="sr-only">Broker responsable de cada propiedad</caption><thead><tr><th scope="col">Propiedad</th><th scope="col">Operación</th><th scope="col">Broker responsable</th><th scope="col">Estado</th><th scope="col">Administrar</th></tr></thead><tbody id="bk-rows"></tbody></table></div></section>' +
        (current ? '<section class="card card--pad assign" id="assign" aria-labelledby="ch-title">' +
          '<h2 class="card__title" id="ch-title" style="margin-bottom:1.25rem">Cambiar responsable · ' + Z.esc(current.name) + '</h2>' +
          '<form id="assign-form" novalidate><div class="assign__row"><div class="assign__current"><span>Responsable actual</span><strong>' + Z.esc(Z.broker(current.broker).name) + '</strong><span>' + (function () {
            var l = Z.upcoming(function (a) { return a.property === current.id; });
            var c = l.filter(function (a) { return a.status === 'confirmada'; }).length;
            return l.length ? l.length + ' cita' + (l.length === 1 ? '' : 's') + (c === l.length ? ' confirmada' + (l.length === 1 ? '' : 's') : '') + ' vinculada' + (l.length === 1 ? '' : 's') : 'Sin citas próximas';
          })() + '</span></div>' +
          '<div class="field"><label class="field__label" for="as-broker">Broker responsable *</label><select class="select" id="as-broker" required>' + Z.brokerOptions(current.broker) + '</select></div>' +
          '<button class="btn" type="submit">Guardar asignación</button></div>' +
          '<p class="form-note">Al cambiar el broker, las próximas citas de esta casa se reasignarán al nuevo responsable. El historial se conserva.</p></form></section>' : '');

      function update() {
        var q = Z.norm(S.q);
        var list = D.properties.filter(function (p) {
          return (!S.broker || p.broker === S.broker) && (!S.status || p.status === S.status) && (!q || Z.norm(p.name + ' ' + p.id).indexOf(q) >= 0);
        });
        document.getElementById('bk-rows').innerHTML = list.length ? list.map(function (p) {
          return '<tr class="' + (p.id === S.prop ? 'is-selected' : '') + '"><td><div class="thumb-cell">' + Z.cover(p, 'photo--thumb', '') + '<div><a class="strong" href="#/propiedades/' + p.id + '">' + Z.esc(p.name) + '</a><span class="sub">' + p.id + ' · ' + Z.esc(p.zone) + '</span></div></div></td>' +
            '<td>' + Z.opLabel(p) + '</td><td class="strong">' + Z.esc(Z.broker(p.broker).name) + '</td><td>' + Z.statusBadge(p.status) + '</td>' +
            '<td><button class="link" type="button" data-change="' + p.id + '" aria-label="Cambiar broker de ' + Z.esc(p.name) + '">Cambiar broker ' + Z.icon('arrow', 'icon--sm') + '</button></td></tr>';
        }).join('') : '<tr><td colspan="5" class="table-empty">Ninguna casa coincide con estos filtros.</td></tr>';
      }

      root.oninput = function (e) { if (e.target.id === 'bk-q') { S.q = e.target.value; update(); } };
      root.onchange = function (e) {
        if (e.target.id === 'bk-broker') S.broker = e.target.value;
        else if (e.target.id === 'bk-status') S.status = e.target.value;
        else return;
        update();
      };
      root.onclick = function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.dataset.action === 'add') brokerForm(null);
        else if (t.dataset.edit) brokerForm(D.brokers.find(function (b) { return b.id === t.dataset.edit; }));
        else if (t.dataset.toggle) toggleActive(D.brokers.find(function (b) { return b.id === t.dataset.toggle; }));
        else if (t.dataset.change) {
          S.prop = t.dataset.change;
          Z.views.brokers.render(root, [], {});
          var panel = document.getElementById('assign');
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          document.getElementById('as-broker').focus({ preventScroll: true });
        }
      };
      root.onsubmit = function (e) {
        if (e.target.id !== 'assign-form') return;
        e.preventDefault();
        var sel = document.getElementById('as-broker');
        if (Z.validate(e.target).length) return;
        if (sel.value === current.broker) { Z.toast(Z.broker(sel.value).name + ' ya es responsable de ' + current.name + '.'); return; }
        var moved = Z.upcoming(function (a) { return a.property === current.id; });
        moved.forEach(function (a) { a.broker = sel.value; });
        current.broker = sel.value;
        var nb = Z.broker(sel.value).name;
        Z.log('Lucía asignó ' + current.name + ' a ' + nb + (moved.length ? ' y se reasignaron ' + moved.length + ' cita' + (moved.length === 1 ? '' : 's') + '.' : '.'), current.id);
        Z.toast(current.name + ' ahora está a cargo de ' + nb + '.');
        Z.views.brokers.render(root, [], {});
        document.getElementById('as-broker').focus();
      };
      update();
    }
  };
})();
