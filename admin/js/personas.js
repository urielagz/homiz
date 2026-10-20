/* Módulo 3 · Clientes e inquilinos */
(function () {
  var D = Z.data;
  var S = Z.state.people = { tab: 'todas', q: '', follow: '', broker: '', selected: 'p1' };

  function typeLabel(p) { return p.type === 'cliente' ? 'Cliente' : (p.label || 'Inquilino'); }
  function nextFor(person) { return Z.upcoming(function (a) { return a.person === person.id; })[0]; }

  function personForm(person) {
    var p = person || { name: '', email: '', phone: '', type: 'cliente', property: '', broker: '', follow: 'Nuevo contacto', op: 'Renta', budget: '', needs: '', job: '' };
    var props = D.properties.map(function (x) { return [x.id, x.name + ' · ' + x.id]; });
    Z.openDialog(
      '<h2 id="dialog-title">' + (person ? 'Editar expediente' : 'Agregar persona') + '</h2>' +
      '<p class="lead">' + (person ? 'Actualiza los datos de ' + Z.esc(p.name) + '.' : 'Registra a un cliente o inquilino y asígnale una casa y un broker.') + ' Los campos con * son obligatorios.</p>' +
      '<form id="person-form" novalidate><div class="form-grid">' +
        '<div class="field span-all"><label class="field__label" for="pf-name">Nombre completo *</label><input class="input" id="pf-name" required value="' + Z.esc(p.name) + '" autocomplete="off"></div>' +
        '<div class="field"><label class="field__label" for="pf-email">Correo electrónico *</label><input class="input" id="pf-email" type="email" required value="' + Z.esc(p.email) + '"></div>' +
        '<div class="field"><label class="field__label" for="pf-phone">Teléfono *</label><input class="input" id="pf-phone" type="tel" required value="' + Z.esc(p.phone) + '" placeholder="998 000 0000"></div>' +
        '<div class="field"><label class="field__label" for="pf-type">Tipo *</label><select class="select" id="pf-type" required>' + Z.options([['cliente', 'Cliente'], ['inquilino', 'Inquilino o inquilina']], p.type) + '</select></div>' +
        '<div class="field"><label class="field__label" for="pf-follow">Seguimiento *</label><select class="select" id="pf-follow" required>' + Z.options(Object.keys(Z.FOLLOW), p.follow) + '</select></div>' +
        '<div class="field"><label class="field__label" for="pf-prop">Propiedad de interés *</label><select class="select" id="pf-prop" required>' + Z.options(props, p.property, 'Elige una casa') + '</select></div>' +
        '<div class="field"><label class="field__label" for="pf-broker">Broker *</label><select class="select" id="pf-broker" required>' + Z.brokerOptions(p.broker, 'Elige un broker') + '</select></div>' +
        '<div class="field"><label class="field__label" for="pf-op">Operación</label><select class="select" id="pf-op">' + Z.options(['Renta', 'Compra'], p.op) + '</select></div>' +
        '<div class="field"><label class="field__label" for="pf-budget">Presupuesto</label><input class="input" id="pf-budget" value="' + Z.esc(p.budget) + '" placeholder="$30,000 MXN / mes"></div>' +
        '<div class="field span-all"><label class="field__label" for="pf-needs">Lo que busca</label><input class="input" id="pf-needs" value="' + Z.esc(p.needs) + '" placeholder="3 recámaras · 2 personas · 1 perro pequeño"></div>' +
        '<div class="field span-all"><label class="field__label" for="pf-job">Ocupación y nacionalidad</label><input class="input" id="pf-job" value="' + Z.esc(p.job) + '" placeholder="Diseño de interiores · Nacionalidad mexicana"></div>' +
      '</div><div class="dialog__actions"><button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn" type="submit">' + (person ? 'Guardar expediente' : 'Agregar persona') + '</button></div></form>',
      {
        wide: true,
        onOpen: function (dlg) {
          var form = dlg.querySelector('#person-form');
          dlg.querySelector('#pf-prop').addEventListener('change', function (e) {
            var pr = Z.prop(e.target.value); if (pr) dlg.querySelector('#pf-broker').value = pr.broker;
          });
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (Z.validate(form).length) return;
            var v = function (id) { return dlg.querySelector(id).value.trim(); };
            var data = { name: v('#pf-name'), email: v('#pf-email'), phone: v('#pf-phone'), type: v('#pf-type'), follow: v('#pf-follow'), property: v('#pf-prop'), broker: v('#pf-broker'), op: v('#pf-op'), budget: v('#pf-budget'), needs: v('#pf-needs'), job: v('#pf-job') };
            if (person) {
              if (data.type !== person.type) delete person.label;
              Object.assign(person, data);
              Z.log('Lucía actualizó el expediente de ' + person.name + '.');
              Z.toast('Se guardó el expediente de ' + person.name + '.');
              S.selected = person.id;
            } else {
              data.id = 'p' + D.nextNumbers.person++;
              D.people.push(data);
              Z.log('Lucía agregó a ' + data.name + ' como ' + (data.type === 'cliente' ? 'cliente' : 'inquilino') + '.');
              Z.toast(data.name + ' se agregó al directorio.');
              S.selected = data.id;
            }
            Z.closeDialog(); Z.rerender();
          });
        }
      }
    );
  }

  function deletePerson(id) {
    var p = D.people.find(function (x) { return x.id === id; }); if (!p) return;
    var linked = Z.upcoming(function (a) { return a.person === id; });
    var pr = Z.prop(p.property);
    Z.confirm({
      title: '¿Eliminar a ' + p.name + '?',
      lead: 'Su expediente dejará de aparecer en el directorio. Esta acción no se puede deshacer.',
      item: '<div class="dialog__item"><span class="avatar" aria-hidden="true">' + Z.esc(p.name.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('')) + '</span><div><strong>' + Z.esc(p.name) + '</strong><span>' + typeLabel(p) + ' · ' + Z.esc(pr ? pr.name : 'Sin propiedad') + '</span><span>' + Z.esc(p.email) + '</span></div></div>',
      callout: linked.length ? '<div class="callout"><strong>Tiene ' + (linked.length === 1 ? 'una visita próxima' : linked.length + ' visitas próximas') + '</strong>' + Z.esc(Z.prop(linked[0].property) ? Z.prop(linked[0].property).name : '') + ' · ' + Z.dateShort(linked[0].date) + ', ' + linked[0].start + ' h. Se cancelará' + (linked.length === 1 ? '' : 'n') + ' y quedará' + (linked.length === 1 ? '' : 'n') + ' en el historial.</div>' : '',
      check: linked.length ? 'Entiendo que se eliminará el expediente y se cancelarán sus visitas.' : null,
      cancel: 'Conservar expediente',
      confirm: 'Sí, eliminar',
      onConfirm: function () {
        linked.forEach(function (a) { a.status = 'cancelada'; });
        D.people = D.people.filter(function (x) { return x.id !== id; });
        if (S.selected === id) S.selected = D.people[0] ? D.people[0].id : null;
        Z.log('Lucía eliminó el expediente de ' + p.name + '.');
        Z.toast('Se eliminó el expediente de ' + p.name + '.');
        Z.rerender();
      }
    });
  }

  Z.views.personas = {
    render: function (root, segs, params) {
      var people = D.people;
      var clientes = people.filter(function (p) { return p.type === 'cliente'; }).length;
      var inq = people.filter(function (p) { return p.type === 'inquilino'; });
      var byProp = {};
      inq.forEach(function (p) { if (p.follow === 'Contrato vigente') byProp[p.property] = (byProp[p.property] || 0) + 1; });
      var shared = Object.keys(byProp).filter(function (k) { return byProp[k] > 1; }).length;
      var up = Z.upcoming();
      var upConf = up.filter(function (a) { return a.status === 'confirmada'; }).length;
      if (params.persona) S.selected = params.persona;

      root.innerHTML =
        Z.crumbs([['Administración', '#/resumen'], ['Clientes e inquilinos']]) +
        Z.pageHead('Personas, no expedientes.', 'Contactos, intereses y contratos en un mismo lugar.',
          '<button class="btn btn--secondary" type="button" data-action="export">' + Z.icon('download') + 'Exportar</button><button class="btn" type="button" data-action="add">' + Z.icon('plus') + 'Agregar persona</button>') +
        '<div class="metrics">' +
          Z.metric('Total de personas', people.length, 'Directorio actualizado') +
          Z.metric('Clientes', clientes, 'Buscan comprar o rentar') +
          Z.metric('Inquilinos', inq.length, shared ? shared + ' contrato' + (shared === 1 ? '' : 's') + ' compartido' + (shared === 1 ? '' : 's') + ' vigente' + (shared === 1 ? '' : 's') : 'Contratos individuales') +
          Z.metric('Visitas próximas', up.length, upConf + ' confirmada' + (upConf === 1 ? '' : 's') + ' · ' + (up.length - upConf) + ' pendiente' + (up.length - upConf === 1 ? '' : 's')) +
        '</div>' +
        '<div id="pp-tabs"></div>' +
        '<div class="filters filters--3" role="search" aria-label="Filtrar personas">' +
          '<div class="field"><label class="field__label" for="pp-q">Buscar contacto</label><input class="input input-search" id="pp-q" type="search" placeholder="Nombre, correo o teléfono" value="' + Z.esc(S.q) + '"></div>' +
          '<div class="field"><label class="field__label" for="pp-follow">Estado de seguimiento</label><select class="select" id="pp-follow">' + Z.options(Object.keys(Z.FOLLOW), S.follow, 'Todos') + '</select></div>' +
          '<div class="field"><label class="field__label" for="pp-broker">Broker</label><select class="select" id="pp-broker">' + Z.brokerOptions(S.broker, 'Todos los brokers') + '</select></div>' +
        '</div>' +
        '<div class="table-wrap" style="margin-top:1.25rem"><table class="table"><caption class="sr-only">Directorio de clientes e inquilinos</caption><thead><tr>' +
          '<th scope="col">Persona / Contacto</th><th scope="col">Tipo</th><th scope="col">Propiedad</th><th scope="col">Broker</th><th scope="col">Seguimiento</th><th scope="col">Acciones</th>' +
        '</tr></thead><tbody id="pp-rows"></tbody></table></div><div id="pp-pager"></div>' +
        '<div id="pp-detail" style="margin-top:1.5rem" aria-live="polite"></div>';

      function update() {
        var active = document.activeElement && document.activeElement.id;
        document.getElementById('pp-tabs').innerHTML = Z.tabs('pp', [['todas', 'Todas las personas · ' + people.length], ['cliente', 'Clientes · ' + clientes], ['inquilino', 'Inquilinos · ' + inq.length]], S.tab, 'Filtrar por tipo');
        var q = Z.norm(S.q);
        var list = people.filter(function (p) {
          return (S.tab === 'todas' || p.type === S.tab) && (!S.follow || p.follow === S.follow) && (!S.broker || p.broker === S.broker) &&
            (!q || Z.norm(p.name + ' ' + p.email + ' ' + p.phone).indexOf(q) >= 0 || p.phone.replace(/\D/g, '').indexOf(S.q.replace(/\D/g, '') || '¬') >= 0);
        });
        document.getElementById('pp-rows').innerHTML = list.length ? list.map(function (p) {
          var pr = Z.prop(p.property);
          return '<tr class="' + (p.id === S.selected ? 'is-selected' : '') + '"><td><button class="link strong" type="button" data-view="' + p.id + '" style="color:var(--marino)">' + Z.esc(p.name) + '</button><span class="sub">' + Z.esc(p.email) + ' · ' + Z.esc(p.phone) + '</span></td>' +
            '<td>' + Z.badge(typeLabel(p), p.type === 'cliente' ? 'info' : 'ok') + '</td><td>' + (pr ? '<a href="#/propiedades/' + pr.id + '">' + Z.esc(pr.name) + '</a>' : '<span class="muted">Propiedad eliminada</span>') + '</td>' +
            '<td>' + Z.esc(Z.broker(p.broker).name) + '</td><td>' + Z.followBadge(p.follow) + '</td>' +
            '<td><div class="actions"><button class="icon-btn" type="button" data-view="' + p.id + '" aria-label="Ver expediente de ' + Z.esc(p.name) + '" title="Ver">' + Z.icon('eye') + '</button>' +
            '<button class="icon-btn" type="button" data-edit="' + p.id + '" aria-label="Editar expediente de ' + Z.esc(p.name) + '" title="Editar">' + Z.icon('pencil') + '</button>' +
            '<button class="icon-btn icon-btn--danger" type="button" data-delete="' + p.id + '" aria-label="Eliminar a ' + Z.esc(p.name) + '" title="Eliminar">' + Z.icon('trash') + '</button></div></td></tr>';
        }).join('') : '<tr><td colspan="6" class="table-empty">No encontramos personas con estos filtros.</td></tr>';
        document.getElementById('pp-pager').innerHTML = Z.pager(list.length, list.length, 'personas');
        renderDetail();
        if (active && active.indexOf('tab-pp-') === 0) document.getElementById('tab-pp-' + S.tab).focus();
      }

      function renderDetail() {
        var p = D.people.find(function (x) { return x.id === S.selected; });
        var box = document.getElementById('pp-detail');
        if (!p) { box.innerHTML = ''; return; }
        var a = nextFor(p), pr = a ? Z.prop(a.property) : Z.prop(p.property);
        box.innerHTML = '<div class="grid-2 grid-2--wide-side">' +
          '<section class="card card--pad" aria-labelledby="pd-title"><div class="card__head"><h2 class="card__title" id="pd-title">' + Z.esc(p.name) + '</h2>' +
            '<button class="link" type="button" data-edit="' + p.id + '">Editar expediente ' + Z.icon('arrow', 'icon--sm') + '</button></div>' +
            '<div class="profile"><div>' + Z.badge(typeLabel(p) + ' · ' + p.op, p.type === 'cliente' ? 'info' : 'ok') +
              '<div class="profile__lines">' + (p.budget ? '<p>Presupuesto: ' + Z.esc(p.budget) + '</p>' : '') + (p.needs ? '<p>' + Z.esc(p.needs) + '</p>' : '') + (p.job ? '<p class="muted small">' + Z.esc(p.job) + '</p>' : '') + '</div></div>' +
            '<div>' + (a ? '<p class="strong" style="font-weight:600;color:var(--marino)">' + Z.esc(pr ? pr.name : '') + ' · ' + Z.dateShort(a.date) + ', ' + a.start + ' h</p>' +
              '<p class="small muted" style="margin-top:.375rem">' + Z.esc(Z.broker(a.broker).name) + ' · Visita ' + a.kind.toLowerCase() + ' ' + Z.APPT_STATUS[a.status].label.toLowerCase() + '</p>' +
              (a.note ? '<p class="quote">“' + Z.esc(a.note) + '”</p>' : '') +
              '<a class="btn btn--secondary" href="#/citas?cita=' + a.id + '">Ver cita</a>'
              : '<p class="strong" style="font-weight:600;color:var(--marino)">' + Z.esc(pr ? pr.name : 'Sin propiedad asignada') + '</p><p class="small muted" style="margin-block:.375rem 1rem">Sin visitas próximas.</p>' +
              '<a class="btn btn--secondary" href="#/citas?nueva=' + p.id + '">Agendar visita</a>') + '</div></div></section>' +
          '<section class="card card--pad" aria-label="Datos de contacto"><p class="field__label">Correo electrónico</p>' +
            '<p class="input" style="margin-top:.5rem;display:flex;align-items:center">' + Z.esc(p.email) + '</p>' +
            '<p class="small muted" style="margin-block:.5rem 1rem">Contacto preferido para seguimiento.</p>' +
            '<p class="small">Teléfono · <a href="tel:+52' + p.phone.replace(/\D/g, '') + '">' + Z.esc(p.phone) + '</a></p>' +
            '<p style="margin-top:1rem"><a class="link" href="mailto:' + Z.esc(p.email) + '">Enviar correo ' + Z.icon('arrow-ur', 'icon--sm') + '</a></p></section></div>';
      }

      root.oninput = function (e) { if (e.target.id === 'pp-q') { S.q = e.target.value; update(); } };
      root.onchange = function (e) {
        if (e.target.id === 'pp-follow') S.follow = e.target.value;
        else if (e.target.id === 'pp-broker') S.broker = e.target.value;
        else return;
        update();
      };
      root.onclick = function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.dataset.tab === 'pp') { S.tab = t.dataset.value; update(); }
        else if (t.dataset.view) {
          S.selected = t.dataset.view; update();
          var d = document.getElementById('pp-detail'); d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          var h = d.querySelector('h2'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
        }
        else if (t.dataset.edit) personForm(D.people.find(function (x) { return x.id === t.dataset.edit; }));
        else if (t.dataset.delete) deletePerson(t.dataset.delete);
        else if (t.dataset.action === 'add') personForm(null);
        else if (t.dataset.action === 'export') {
          var rows = [['Nombre', 'Correo', 'Teléfono', 'Tipo', 'Propiedad', 'Broker', 'Seguimiento', 'Presupuesto']];
          D.people.forEach(function (p) { var pr = Z.prop(p.property); rows.push([p.name, p.email, p.phone, typeLabel(p), pr ? pr.name : '', Z.broker(p.broker).name, p.follow, p.budget]); });
          Z.downloadCSV('zugar-clientes-e-inquilinos.csv', rows);
        }
      };
      update();
    }
  };
})();
