/* Módulo 2 · Propiedades: listado, detalle, alta/edición y eliminación */
(function () {
  var D = Z.data;
  var S = Z.state.props = { tab: 'todas', q: '', op: '', zone: '', broker: '', amen: [], more: false };
  var MAX_PHOTOS = 20, MAX_MB = 10;

  function specsLine(p) { return p.rec + ' rec. · ' + p.banos + ' baño' + (p.banos == 1 ? '' : 's') + ' · ' + p.m2 + ' m²'; }
  function allAmenities() {
    var set = Z.AMENITIES.slice();
    D.properties.forEach(function (p) { p.amenities.forEach(function (a) { if (set.indexOf(a) < 0) set.push(a); }); });
    return set;
  }

  /* ======================= Eliminar ======================= */
  Z.deleteProperty = function (id, after) {
    var p = Z.prop(id); if (!p) return;
    var linked = Z.upcoming(function (a) { return a.property === id; });
    var b = Z.broker(p.broker);
    var callout = '';
    if (linked.length) {
      var a = linked[0], conf = a.status === 'confirmada';
      callout = '<div class="callout"><strong>' + (linked.length === 1 ? 'Hay una cita ' + (conf ? 'confirmada' : 'por confirmar') + ' vinculada' : 'Hay ' + linked.length + ' citas vinculadas') + '</strong>' +
        Z.esc(Z.person(a.person).name) + ' · ' + Z.dateShort(a.date) + ', ' + a.start + ' h' + (linked.length > 1 ? ' y ' + (linked.length - 1) + ' más' : '') +
        '. ' + (linked.length === 1 ? 'La cita se cancelará' : 'Las citas se cancelarán') + ' y quedará' + (linked.length === 1 ? '' : 'n') + ' en el historial. El cliente y ' + Z.esc(b.name) + ' no se eliminarán.</div>';
    }
    Z.confirm({
      title: '¿Eliminar ' + p.name + '?',
      lead: 'La propiedad dejará de aparecer en el inventario y en el catálogo público. Esta acción no se puede deshacer.',
      item: '<div class="dialog__item">' + Z.cover(p, '', '') + '<div><strong>' + Z.esc(p.name) + ' · ' + p.id + '</strong><span>' + Z.esc(p.zone) + ', Cancún</span><span>' + Z.opLabel(p) + ' · ' + Z.priceLabel(p) + '</span></div></div>',
      callout: callout,
      check: linked.length ? 'Entiendo que se eliminará la propiedad y se cancelará' + (linked.length === 1 ? ' su próxima cita.' : 'n sus próximas citas.') : 'Entiendo que se eliminará la propiedad del inventario.',
      cancel: 'Conservar propiedad',
      confirm: 'Sí, eliminar propiedad',
      onConfirm: function () {
        linked.forEach(function (a) { a.status = 'cancelada'; a.note = (a.note ? a.note + ' ' : '') + 'Cancelada porque la propiedad se retiró del inventario.'; });
        D.properties = D.properties.filter(function (x) { return x.id !== id; });
        if (window.ZApi) ZApi.propiedadEliminar(p);
        Z.log('Lucía eliminó ' + p.name + ' (' + p.id + ')' + (linked.length ? ' y se canceló ' + (linked.length === 1 ? 'su próxima cita.' : 'sus próximas citas.') : '.'));
        Z.toast(p.name + ' se eliminó del inventario.');
        if (after) after(); else Z.rerender();
      }
    });
  };

  /* ======================= Listado ======================= */
  function listView(root) {
    var counts = function (s) { return D.properties.filter(function (p) { return !s || p.status === s; }).length; };
    var zones = Z.ZONES;

    root.innerHTML =
      Z.crumbs([['Administración', '#/resumen'], ['Propiedades']]) +
      Z.pageHead('Cada casa, al día.', 'Administra tu inventario, disponibilidad y equipo asignado.',
        '<button class="btn btn--secondary" type="button" data-action="export">' + Z.icon('download') + 'Exportar</button><a class="btn" href="#/propiedades/nueva">' + Z.icon('plus') + 'Nueva propiedad</a>') +
      '<div id="prop-tabs"></div>' +
      '<div class="filters" role="search" aria-label="Filtrar propiedades">' +
        '<div class="field"><label class="field__label" for="f-q">Buscar propiedad</label><input class="input input-search" id="f-q" type="search" placeholder="Nombre, clave o dirección" value="' + Z.esc(S.q) + '"></div>' +
        '<div class="field"><label class="field__label" for="f-op">Operación</label><select class="select" id="f-op">' + Z.options([['renta', 'Renta'], ['venta', 'Venta']], S.op, 'Todas') + '</select></div>' +
        '<div class="field"><label class="field__label" for="f-zone">Zona de Cancún</label><select class="select" id="f-zone">' + Z.options(zones, S.zone, 'Todas las zonas') + '</select></div>' +
        '<div class="field"><label class="field__label" for="f-broker">Broker asignado</label><select class="select" id="f-broker">' + Z.brokerOptions(S.broker, 'Todos los brokers') + '</select></div>' +
      '</div>' +
      '<div class="filters-meta"><span id="prop-meta" aria-live="polite"></span>' +
        '<button class="btn btn--secondary" type="button" data-action="more" aria-expanded="' + S.more + '" aria-controls="more-filters">' + Z.icon('sliders') + 'Más filtros<span id="more-count"></span></button></div>' +
      '<fieldset class="card card--pad" id="more-filters" style="margin-bottom:1rem"' + (S.more ? '' : ' hidden') + '>' +
        '<legend class="sr-only">Filtrar por amenidades</legend><p class="field__label" style="margin-bottom:.75rem" aria-hidden="true">Amenidades</p>' +
        '<div class="amenity-grid" style="max-width:none;grid-template-columns:repeat(4,minmax(0,1fr))">' + allAmenities().map(function (a, i) {
          return '<label class="amenity-option"><input type="checkbox" data-amen value="' + Z.esc(a) + '"' + (S.amen.indexOf(a) >= 0 ? ' checked' : '') + '><span>' + Z.esc(a) + '</span></label>';
        }).join('') + '</div>' +
        '<div style="margin-top:1rem"><button class="link" type="button" data-action="clear-more">Quitar filtros de amenidades</button></div>' +
      '</fieldset>' +
      '<div class="table-wrap"><table class="table"><caption class="sr-only">Inventario de propiedades</caption><thead><tr>' +
        '<th scope="col">Propiedad</th><th scope="col">Operación / Precio</th><th scope="col">Disponibilidad</th><th scope="col">Broker</th><th scope="col">Acciones</th>' +
      '</tr></thead><tbody id="prop-rows"></tbody></table></div><div id="prop-pager"></div>';

    function update() {
      var active = document.activeElement && document.activeElement.id;
      document.getElementById('prop-tabs').innerHTML = Z.tabs('prop', [
        ['todas', 'Todas las propiedades · ' + counts()], ['disponible', 'Disponibles · ' + counts('disponible')],
        ['reservada', 'Reservadas · ' + counts('reservada')], ['rentada', 'Rentadas · ' + counts('rentada')], ['borrador', 'Borradores · ' + counts('borrador')]
      ], S.tab, 'Filtrar por disponibilidad');

      var q = Z.norm(S.q);
      var list = D.properties.filter(function (p) {
        return (S.tab === 'todas' || p.status === S.tab) && (!S.op || p.op === S.op) && (!S.zone || p.zone === S.zone) && (!S.broker || p.broker === S.broker) &&
          (!q || Z.norm(p.name + ' ' + p.id + ' ' + p.address + ' ' + p.zone).indexOf(q) >= 0) &&
          S.amen.every(function (a) { return p.amenities.indexOf(a) >= 0; });
      }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });

      document.getElementById('prop-rows').innerHTML = list.length ? list.map(function (p) {
        return '<tr><td><div class="thumb-cell">' + Z.cover(p, 'photo--thumb', '') + '<div><a class="strong" href="#/propiedades/' + p.id + '">' + Z.esc(p.name) + '</a>' +
          '<span class="sub">' + p.id + ' · ' + Z.esc(p.zone) + '</span><span class="sub">' + specsLine(p) + '</span></div></div></td>' +
          '<td><span class="strong">' + Z.money(p.price) + '</span><span class="sub">' + Z.opLabel(p) + ' · MXN' + (p.op === 'renta' ? ' / mes' : '') + '</span></td>' +
          '<td>' + Z.statusBadge(p.status) + '</td><td>' + Z.esc(Z.broker(p.broker).name) + '</td>' +
          '<td><div class="actions"><a class="icon-btn" href="#/propiedades/' + p.id + '" aria-label="Ver ' + Z.esc(p.name) + '" title="Ver">' + Z.icon('eye') + '</a>' +
          '<a class="icon-btn" href="#/propiedades/' + p.id + '/editar" aria-label="Editar ' + Z.esc(p.name) + '" title="Editar">' + Z.icon('pencil') + '</a>' +
          '<button class="icon-btn icon-btn--danger" type="button" data-delete="' + p.id + '" aria-label="Eliminar ' + Z.esc(p.name) + '" title="Eliminar">' + Z.icon('trash') + '</button></div></td></tr>';
      }).join('') : '<tr><td colspan="5" class="table-empty">No hay propiedades con estos filtros. <button class="link" type="button" data-action="reset">Limpiar filtros</button></td></tr>';

      document.getElementById('prop-meta').textContent = list.length + ' propiedad' + (list.length === 1 ? '' : 'es') + ' · Ordenadas por última actualización';
      document.getElementById('more-count').textContent = S.amen.length ? ' (' + S.amen.length + ')' : '';
      document.getElementById('prop-pager').innerHTML = Z.pager(list.length, list.length, 'propiedades');
      if (active && active.indexOf('tab-prop-') === 0) { var t = document.getElementById('tab-prop-' + S.tab); if (t) t.focus(); }
    }

    root.oninput = function (e) {
      if (e.target.id === 'f-q') { S.q = e.target.value; update(); }
    };
    root.onchange = function (e) {
      var t = e.target;
      if (t.id === 'f-op') S.op = t.value;
      else if (t.id === 'f-zone') S.zone = t.value;
      else if (t.id === 'f-broker') S.broker = t.value;
      else if (t.matches('[data-amen]')) S.amen = Array.prototype.map.call(root.querySelectorAll('[data-amen]:checked'), function (c) { return c.value; });
      else return;
      update();
    };
    root.onclick = function (e) {
      var t = e.target.closest('button, a'); if (!t) return;
      if (t.dataset.tab === 'prop') { S.tab = t.dataset.value; update(); }
      else if (t.dataset.delete) Z.deleteProperty(t.dataset.delete);
      else if (t.dataset.action === 'more') {
        S.more = !S.more; t.setAttribute('aria-expanded', S.more);
        document.getElementById('more-filters').hidden = !S.more;
      } else if (t.dataset.action === 'clear-more') {
        S.amen = []; root.querySelectorAll('[data-amen]').forEach(function (c) { c.checked = false; }); update();
      } else if (t.dataset.action === 'reset') {
        S.tab = 'todas'; S.q = S.op = S.zone = S.broker = ''; S.amen = []; Z.rerender();
      } else if (t.dataset.action === 'export') {
        var rows = [['Clave', 'Propiedad', 'Zona', 'Dirección', 'Operación', 'Precio (MXN)', 'Recámaras', 'Baños', 'm² construcción', 'Disponibilidad', 'Broker', 'Amenidades']];
        D.properties.forEach(function (p) {
          rows.push([p.id, p.name, p.zone, p.address, Z.opLabel(p), p.price, p.rec, p.banos, p.m2, Z.STATUS[p.status].label, Z.broker(p.broker).name, p.amenities.join('; ')]);
        });
        Z.downloadCSV('zugar-propiedades.csv', rows);
      }
    };
    update();
  }

  /* ======================= Detalle ======================= */
  function detailView(root, id) {
    var p = Z.prop(id);
    if (!p) {
      root.innerHTML = Z.crumbs([['Administración', '#/resumen'], ['Propiedades', '#/propiedades'], [id]]) +
        Z.pageHead('Propiedad no encontrada', 'Es posible que se haya eliminado del inventario.', '<a class="btn" href="#/propiedades">Volver al listado</a>');
      return;
    }
    var b = Z.broker(p.broker);
    var appts = Z.sortAppts(D.appointments.filter(function (a) { return a.property === p.id; }));
    var next = Z.upcoming(function (a) { return a.property === p.id; })[0];
    var hist = D.history[p.id] || [];
    if (S.detailId !== p.id) { S.detailId = p.id; S.detailTab = 'general'; }

    var visText = {
      publicada: 'Visible en el catálogo público desde el ' + (p.published ? Z.dateFull(p.published).replace(' de 2026', '') : 'día de hoy') + '.',
      pausada: 'Oculta del catálogo público. Las citas y el historial se conservan.',
      borrador: 'Aún no se publica. Completa la información y las fotografías para mostrarla en el catálogo.'
    }[p.visibility];
    var visBtn = p.visibility === 'publicada' ? '<button class="btn btn--secondary btn--block" type="button" data-action="pause">Pausar publicación</button>'
      : p.visibility === 'pausada' ? '<button class="btn btn--secondary btn--block" type="button" data-action="resume">Reanudar publicación</button>'
      : '<a class="btn btn--secondary btn--block" href="#/propiedades/' + p.id + '/editar">Completar y publicar</a>';

    var g = p.photos;
    var gallery = '<div class="gallery">' + [0, 1, 2].map(function (i) {
      return Z.photo(g[i] ? g[i].src : '', g[i] ? g[i].label + ' de ' + p.name : '');
    }).join('') + '</div>';

    var general =
      '<div class="grid-2"><div class="stack">' +
        '<section class="card card--pad" aria-labelledby="g-title">' +
          '<h2 class="card__title" id="g-title">Un espacio para lo que viene</h2>' +
          '<p class="price-xl">' + Z.priceLabel(p) + '</p>' +
          '<p class="small muted">' + (p.op === 'renta' ? 'Mantenimiento: ' + Z.esc(p.maintenance.toLowerCase()) + ' · Depósito: ' + Z.money(p.deposit) + ' MXN' : 'Mantenimiento: ' + Z.esc(p.maintenance)) + '</p>' +
          '<dl class="facts">' +
            '<div><dt class="sr-only">Construcción</dt><dd><strong>' + p.m2 + ' m²</strong><span>Construcción</span></dd></div>' +
            '<div><dt class="sr-only">Terreno</dt><dd><strong>' + p.terreno + ' m²</strong><span>Terreno</span></dd></div>' +
            '<div><dt class="sr-only">Recámaras</dt><dd><strong>' + p.rec + '</strong><span>Recámaras</span></dd></div>' +
            '<div><dt class="sr-only">Baños</dt><dd><strong>' + p.banos + '</strong><span>Baños</span></dd></div>' +
            '<div><dt class="sr-only">Cochera</dt><dd><strong>' + p.est + '</strong><span>Cochera</span></dd></div>' +
          '</dl>' +
          '<p>' + Z.esc(p.desc) + '</p>' +
          '<p class="small muted" style="margin-top:1rem">' + Z.esc(p.furnished) + ' · ' + (p.age ? p.age + ' año' + (p.age == 1 ? '' : 's') + ' de antigüedad' : 'A estrenar') +
            (p.amenities.indexOf('Se aceptan mascotas') >= 0 ? ' · Se aceptan mascotas' : ' · Sin mascotas') + '</p>' +
        '</section>' +
        '<section class="card card--pad" aria-labelledby="am-title">' +
          '<div class="card__head"><h2 class="card__title" id="am-title">Amenidades</h2><a class="link" href="#/propiedades/' + p.id + '/editar?seccion=amenidades">Editar amenidades ' + Z.icon('arrow', 'icon--sm') + '</a></div>' +
          (p.amenities.length ? '<ul class="amenity-list">' + p.amenities.map(function (a) { return '<li>' + Z.icon('check') + Z.esc(a) + '</li>'; }).join('') + '</ul>'
            : '<p class="muted">Esta casa todavía no tiene amenidades registradas.</p>') +
        '</section>' +
        '<section class="card card--pad" aria-labelledby="nc-title">' +
          '<div class="card__head"><h2 class="card__title" id="nc-title">Próxima cita</h2><a class="link" href="#/citas' + (next ? '?cita=' + next.id : '') + '">Ver agenda ' + Z.icon('arrow', 'icon--sm') + '</a></div>' +
          (next ? '<div class="next-appt"><p class="next-appt__date">' + Z.dateShort(next.date) + '<small>' + next.start + '–' + next.end + ' h</small></p>' +
            '<div><strong class="strong" style="color:var(--marino)">' + Z.esc(Z.person(next.person).name) + '</strong><p class="small muted">Visita ' + next.kind.toLowerCase() + ' · ' + Z.esc(Z.broker(next.broker).name) + '</p><div style="margin-top:.5rem">' + Z.apptBadge(next.status) + '</div></div></div>'
            : '<p class="muted">No hay visitas programadas para esta casa.</p>') +
        '</section>' +
      '</div>' +
      '<div class="stack">' +
        '<section class="card card--pad" aria-labelledby="br-title"><h2 class="card__title" id="br-title" style="margin-bottom:1rem">Broker asignado</h2>' +
          '<div class="person-mini">' + Z.avatar(b, 'avatar--lg') + '<div><strong>' + Z.esc(b.name) + '</strong><span>' + Z.esc(b.role || '') + '</span></div></div>' +
          '<div class="contact-lines"><a href="mailto:' + Z.esc(b.email) + '">' + Z.esc(b.email) + '</a><a href="tel:' + b.phone.replace(/\s/g, '') + '">' + Z.esc(b.phone) + '</a></div>' +
          '<a class="btn btn--secondary btn--block" href="#/brokers?prop=' + p.id + '">Cambiar broker</a></section>' +
        '<section class="card card--pad" aria-labelledby="pub-title"><h2 class="card__title" id="pub-title" style="margin-bottom:1rem">Publicación</h2>' +
          '<p class="small muted">Disponibilidad</p><p style="margin:.5rem 0 .75rem">' + Z.statusBadge(p.status) + (p.visibility === 'pausada' ? ' ' + Z.badge('Pausada', 'warn') : '') + '</p>' +
          '<p class="small" style="margin-bottom:1rem">' + visText + '</p>' + visBtn + '</section>' +
        '<section class="card card--pad card--danger" aria-labelledby="del-title"><h2 id="del-title" style="font-family:var(--font-sans);font-size:.875rem;font-weight:600;color:var(--error-tx)">Eliminar propiedad</h2>' +
          '<p class="small muted" style="margin-block:.5rem .75rem">Retira esta casa del inventario y del catálogo.</p>' +
          '<button class="link link--danger" type="button" data-action="delete">Eliminar ' + Z.esc(p.name) + ' ' + Z.icon('arrow', 'icon--sm') + '</button></section>' +
      '</div></div>';

    var photos = '<section class="card card--pad" aria-label="Fotografías">' +
      (g.length ? '<div class="photos-grid">' + g.map(function (ph, i) {
        return '<figure>' + Z.photo(ph.src, ph.label + ' de ' + p.name, 'photo--4x3') + '<figcaption>' + (i === 0 ? 'Portada · ' : '') + Z.esc(ph.label) + '</figcaption></figure>';
      }).join('') + '</div>' : '<p class="muted">Aún no hay fotografías.</p>') +
      '<p style="margin-top:1.25rem"><a class="link" href="#/propiedades/' + p.id + '/editar?seccion=fotografias">Administrar fotografías ' + Z.icon('arrow', 'icon--sm') + '</a></p></section>';

    var citas = '<div class="table-wrap"><table class="table"><caption class="sr-only">Citas de ' + Z.esc(p.name) + '</caption><thead><tr><th scope="col">Fecha / Hora</th><th scope="col">Cliente</th><th scope="col">Broker</th><th scope="col">Estado</th></tr></thead><tbody>' +
      (appts.length ? appts.map(function (a) {
        return '<tr><td><span class="strong">' + Z.dateShort(a.date) + '</span><span class="sub">' + a.start + '–' + a.end + ' h</span></td><td><a class="strong" href="#/citas?cita=' + a.id + '">' + Z.esc(Z.person(a.person).name) + '</a><span class="sub">' + a.id + '</span></td><td>' + Z.esc(Z.broker(a.broker).name) + '</td><td>' + Z.apptBadge(a.status) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="table-empty">Sin citas registradas.</td></tr>') + '</tbody></table></div>';

    var historial = '<section class="card card--pad" aria-label="Historial">' + (hist.length ? '<ul class="history">' + hist.map(function (h) {
      return '<li><time>' + Z.esc(h.when) + '</time><span>' + Z.esc(h.text) + '</span></li>';
    }).join('') + '</ul>' : '<p class="muted">Sin movimientos registrados.</p>') + '</section>';

    var panels = { general: general, fotos: photos, citas: citas, historial: historial };

    root.innerHTML =
      Z.crumbs([['Administración', '#/resumen'], ['Propiedades', '#/propiedades'], [p.id]]) +
      Z.pageHead(p.name, Z.esc(p.zone) + ', Cancún · ' + Z.esc(p.street) + ' · ' + p.id,
        '<a class="btn btn--secondary" href="../paginas/propiedad.html" target="_blank" rel="noopener">Ver publicación ' + Z.icon('arrow-ur', 'icon--sm') + '</a><a class="btn" href="#/propiedades/' + p.id + '/editar">Editar propiedad</a>') +
      '<div class="status-line"><span class="badge badge--marino">Casa en ' + Z.opLabel(p).toLowerCase() + '</span>' + Z.statusBadge(p.status) +
        '<span>' + (p.published ? 'Publicada el ' + Z.dateShort(p.published) + ' 2026 · ' : 'Sin publicar · ') + 'Actualizada ' + Z.esc(p.updated.charAt(0).toLowerCase() + p.updated.slice(1)) + '</span></div>' +
      gallery +
      Z.tabs('det', [['general', 'Información general', 'det-panel'], ['fotos', 'Fotografías · ' + g.length, 'det-panel'], ['citas', 'Citas · ' + appts.length, 'det-panel'], ['historial', 'Historial', 'det-panel']], S.detailTab, 'Secciones de la propiedad') +
      '<div id="det-panel" role="tabpanel" aria-labelledby="tab-det-' + S.detailTab + '">' + panels[S.detailTab] + '</div>';

    root.onclick = function (e) {
      var t = e.target.closest('button, a'); if (!t) return;
      if (t.dataset.tab === 'det') {
        S.detailTab = t.dataset.value;
        var focusTab = document.activeElement === t;
        detailView(root, id);
        if (focusTab) document.getElementById('tab-det-' + S.detailTab).focus();
      } else if (t.dataset.action === 'delete') {
        Z.deleteProperty(p.id, function () { location.hash = '#/propiedades'; });
      } else if (t.dataset.action === 'pause' || t.dataset.action === 'resume') {
        var pause = t.dataset.action === 'pause';
        p.visibility = pause ? 'pausada' : 'publicada';
        if (!pause && !p.published) p.published = Z.TODAY;
        if (window.ZApi) ZApi.propiedadVisibilidad(p);
        Z.log('Lucía ' + (pause ? 'pausó' : 'reanudó') + ' la publicación de ' + p.name + '.', p.id);
        Z.toast(pause ? p.name + ' ya no aparece en el catálogo público.' : p.name + ' vuelve a estar visible en el catálogo.');
        detailView(root, id);
        var again = root.querySelector('[data-action="' + (pause ? 'resume' : 'pause') + '"]'); if (again) again.focus();
      }
    };
  }

  /* ======================= Alta y edición ======================= */
  function formView(root, id, params) {
    var editing = !!id;
    var src = editing ? Z.prop(id) : null;
    if (editing && !src) { detailView(root, id); return; }

    var f = src ? JSON.parse(JSON.stringify(src)) : {
      name: '', type: 'Casa', zone: '', city: 'Cancún, Quintana Roo', address: '', desc: '', m2: '', terreno: '', age: '',
      rec: 3, banos: 2, est: 2, op: 'renta', price: '', status: 'disponible', availableFrom: Z.TODAY, maintenance: 'Incluido en la renta',
      deposit: '', visibility: 'publicada', broker: '', amenities: [], photos: []
    };
    var custom = f.amenities.filter(function (a) { return Z.AMENITIES.indexOf(a) < 0; });
    var title = editing ? 'Editar ' + src.name : 'Una nueva casa en Zugar.';
    var dirty = false;

    function num(list, sel) { return Z.options(list.map(String), String(sel)); }

    root.innerHTML =
      Z.crumbs(editing ? [['Administración', '#/resumen'], ['Propiedades', '#/propiedades'], [src.id, '#/propiedades/' + src.id], ['Editar']] : [['Administración', '#/resumen'], ['Propiedades', '#/propiedades'], ['Nueva propiedad']]) +
      Z.pageHead(title, editing ? 'Actualiza la información, fotografías y amenidades de ' + Z.esc(src.name) + '.' : 'Alta de propiedad · Datos completos para su primera publicación.') +
      (editing ? '<div class="notice notice--info">' + Z.icon('info') + '<span>Estás editando ' + src.id + '. Los cambios se publicarán al guardar; las citas y el broker se conservan.</span></div>'
        : '<div class="notice notice--warn">' + Z.icon('file-edit') + '<span>Nueva propiedad · <span id="notice-name">' + 'Sin nombre' + '</span>. Revisa los datos antes de crear y publicar el registro.</span></div>') +
      '<div class="notice notice--error" id="form-errors" role="alert" hidden></div>' +
      '<form id="prop-form" novalidate><div class="form-layout"><div class="stack">' +

      '<section class="card card--pad form-section" aria-labelledby="s1"><h2 id="s1">01 / Información inmobiliaria</h2><div class="form-grid">' +
        '<div class="field"><label class="field__label" for="p-name">Nombre de la propiedad *</label><input class="input" id="p-name" name="name" required value="' + Z.esc(f.name) + '" placeholder="Por ejemplo: Casa Ceiba"></div>' +
        '<div class="field"><label class="field__label" for="p-type">Tipo de inmueble *</label><select class="select" id="p-type" name="type" required>' + Z.options(Z.TYPES, f.type) + '</select></div>' +
        '<div class="field"><label class="field__label" for="p-zone">Zona *</label><select class="select" id="p-zone" name="zone" required>' + Z.options(Z.ZONES, f.zone, 'Elige una zona') + '</select></div>' +
        '<div class="field"><label class="field__label" for="p-city">Ciudad *</label><input class="input" id="p-city" name="city" required value="' + Z.esc(f.city) + '"></div>' +
        '<div class="field span-all"><label class="field__label" for="p-address">Dirección completa *</label><input class="input" id="p-address" name="address" required value="' + Z.esc(f.address) + '" placeholder="Calle, número, residencial y código postal" autocomplete="off"></div>' +
        '<div class="field span-all"><label class="field__label" for="p-maps">Enlace de Google Maps</label>' +
          '<div class="locate-row"><input class="input" id="p-maps" inputmode="url" autocomplete="off" placeholder="https://maps.app.goo.gl/…" aria-describedby="p-maps-hint">' +
          '<button class="btn btn--secondary" type="button" data-action="locate">' + Z.icon('pin') + 'Ubicar</button></div>' +
          '<p class="field__hint" id="p-maps-hint" aria-live="polite"></p><div class="locate-preview" id="p-maps-preview" hidden></div></div>' +
        '<div class="field span-all"><label class="field__label" for="p-desc">Descripción pública *</label><textarea class="textarea" id="p-desc" name="desc" required placeholder="Cuenta cómo se vive en esta casa.">' + Z.esc(f.desc) + '</textarea><p class="field__hint">Aparece en la publicación del sitio.</p></div>' +
      '</div><div class="form-grid form-grid--3" style="margin-top:1rem">' +
        '<div class="field"><label class="field__label" for="p-m2">Construcción (m²) *</label><input class="input" id="p-m2" name="m2" required data-number inputmode="numeric" value="' + Z.esc(f.m2) + '"></div>' +
        '<div class="field"><label class="field__label" for="p-terreno">Terreno (m²) *</label><input class="input" id="p-terreno" name="terreno" required data-number inputmode="numeric" value="' + Z.esc(f.terreno) + '"></div>' +
        '<div class="field"><label class="field__label" for="p-age">Antigüedad (años)</label><input class="input" id="p-age" name="age" data-number inputmode="numeric" value="' + Z.esc(f.age) + '" placeholder="0 si es nueva"></div>' +
        '<div class="field"><label class="field__label" for="p-rec">Recámaras *</label><select class="select" id="p-rec" name="rec" required>' + num([1, 2, 3, 4, 5, 6], f.rec) + '</select></div>' +
        '<div class="field"><label class="field__label" for="p-banos">Baños *</label><select class="select" id="p-banos" name="banos" required>' + num([1, 1.5, 2, 2.5, 3, 3.5, 4, 5], f.banos) + '</select></div>' +
        '<div class="field"><label class="field__label" for="p-est">Estacionamientos</label><select class="select" id="p-est" name="est">' + num([0, 1, 2, 3, 4], f.est) + '</select></div>' +
      '</div></section>' +

      '<section class="card card--pad form-section" aria-labelledby="s2"><h2 id="s2">02 / Operación y disponibilidad</h2><div class="form-grid">' +
        '<div class="field"><label class="field__label" for="p-op">Operación *</label><select class="select" id="p-op" name="op" required>' + Z.options([['renta', 'Renta'], ['venta', 'Venta']], f.op) + '</select></div>' +
        '<div class="field"><label class="field__label" for="p-price" id="price-label">' + (f.op === 'renta' ? 'Precio mensual (MXN) *' : 'Precio de venta (MXN) *') + '</label><input class="input" id="p-price" name="price" required data-number inputmode="numeric" value="' + (f.price ? Z.money(f.price) : '') + '" placeholder="$0"></div>' +
        '<div class="field"><label class="field__label" for="p-status">Estado *</label><select class="select" id="p-status" name="status" required>' + Z.options(Object.keys(Z.STATUS).map(function (k) { return [k, Z.STATUS[k].label]; }), f.status) + '</select></div>' +
        '<div class="field"><label class="field__label" for="p-from">Disponible desde *</label><input class="input" id="p-from" name="availableFrom" type="date" required value="' + Z.esc(f.availableFrom) + '"></div>' +
        '<div class="field"><label class="field__label" for="p-maint">Mantenimiento</label><input class="input" id="p-maint" name="maintenance" value="' + Z.esc(f.maintenance) + '"></div>' +
        '<div class="field"><label class="field__label" for="p-deposit">Depósito (MXN)</label><input class="input" id="p-deposit" name="deposit" data-number inputmode="numeric" value="' + (f.deposit ? Z.money(f.deposit) : '') + '" placeholder="$0"></div>' +
      '</div><p class="form-note" id="op-note">' + (f.op === 'renta' ? 'Renta a largo plazo · Contrato mínimo de 12 meses.' : 'Venta · Acepta contado, crédito bancario e Infonavit.') + '</p></section>' +

      '<section class="card card--pad form-section" id="fotografias" aria-labelledby="s3"><h2 id="s3">03 / Fotografías</h2>' +
        '<p class="small muted" style="margin-bottom:1rem" id="photo-meta"></p><div class="photo-tiles" id="photo-tiles"></div>' +
        '<div class="dropzone" id="dropzone"><div><strong>' + Z.icon('upload') + 'Agregar fotografías</strong><p>JPG o PNG · Hasta ' + MAX_MB + ' MB por imagen · Máximo ' + MAX_PHOTOS + ' fotos. También puedes soltarlas aquí.</p></div>' +
          '<div class="field"><input type="file" id="p-files" accept="image/jpeg,image/png" multiple class="sr-only"><button class="btn btn--secondary" type="button" id="p-files-btn" data-action="pick">Seleccionar archivos</button></div></div>' +
      '</section>' +

      '<section class="card card--pad form-section" id="amenidades" aria-labelledby="s4"><h2 id="s4">04 / Amenidades y equipamiento</h2>' +
        '<fieldset><legend class="sr-only">Amenidades de esta propiedad</legend><div class="amenity-grid" id="amenity-grid"></div></fieldset>' +
        '<div class="amenity-add"><div class="field"><label class="field__label" for="p-new-amen">Agregar otra amenidad</label><input class="input" id="p-new-amen" placeholder="Por ejemplo: Paneles solares" maxlength="40"></div>' +
        '<button class="btn btn--secondary" type="button" data-action="add-amen">' + Z.icon('plus') + 'Agregar</button></div>' +
        '<p class="form-note">Las amenidades se administran al registrar o editar cada propiedad.</p>' +
      '</section>' +

      '<div class="card savebar" id="savebar"><div><strong id="save-title"></strong><p>* Campos obligatorios · Revisa la información antes de publicar.</p></div>' +
        '<div class="page-actions"><a class="btn btn--secondary" href="' + (editing ? '#/propiedades/' + src.id : '#/propiedades') + '">Cancelar</a>' +
        '<button class="btn" type="submit">' + (editing ? 'Guardar cambios' : 'Crear y publicar') + '</button></div></div>' +
      '</div>' +

      '<aside class="form-aside">' +
        '<section class="card card--pad summary" aria-labelledby="sum-title" aria-live="polite"><h2 class="card__title" id="sum-title" style="margin-bottom:1rem">Resumen</h2><div id="summary"></div></section>' +
        '<section class="card card--pad" aria-labelledby="ab-title"><h2 class="card__title" id="ab-title" style="margin-bottom:1rem">Broker asignado</h2>' +
          '<div class="field"><label class="field__label" for="p-broker">Responsable *</label><select class="select" id="p-broker" name="broker" required>' + Z.brokerOptions(f.broker, 'Elige un broker') + '</select>' +
          '<p class="field__hint">Recibirá las solicitudes y coordinará las visitas de esta casa.</p></div></section>' +
        '<section class="card card--pad" aria-labelledby="ap-title"><h2 class="card__title" id="ap-title" style="margin-bottom:1rem">Publicación</h2>' +
          '<div class="field"><label class="field__label" for="p-vis">Visibilidad *</label><select class="select" id="p-vis" name="visibility" required>' +
          Z.options([['publicada', 'Publicada'], ['pausada', 'Pausada'], ['borrador', 'Borrador']], f.visibility) + '</select><p class="field__hint" id="vis-hint"></p></div>' +
          '<ul class="checklist" id="checklist"></ul></section>' +
      '</aside></div></form>';

    var form = root.querySelector('#prop-form');
    var el = function (sel) { return root.querySelector(sel); };

    function read() {
      f.name = el('#p-name').value.trim(); f.type = el('#p-type').value; f.zone = el('#p-zone').value; f.city = el('#p-city').value.trim();
      f.address = el('#p-address').value.trim(); f.desc = el('#p-desc').value.trim();
      f.m2 = Z.numberValue(el('#p-m2').value) || ''; f.terreno = Z.numberValue(el('#p-terreno').value) || ''; f.age = Z.numberValue(el('#p-age').value);
      f.rec = +el('#p-rec').value; f.banos = +el('#p-banos').value; f.est = +el('#p-est').value;
      f.op = el('#p-op').value; f.price = Z.numberValue(el('#p-price').value); f.status = el('#p-status').value;
      f.availableFrom = el('#p-from').value; f.maintenance = el('#p-maint').value.trim(); f.deposit = Z.numberValue(el('#p-deposit').value);
      f.broker = el('#p-broker').value; f.visibility = el('#p-vis').value;
    }
    function complete() {
      return Array.prototype.every.call(form.querySelectorAll('[required]'), function (c) { return c.value.trim() !== ''; }) && f.price > 0;
    }
    function refresh() {
      read();
      var nn = el('#notice-name'); if (nn) nn.textContent = f.name || 'Sin nombre';
      var b = f.broker ? Z.broker(f.broker) : null;
      el('#summary').innerHTML = Z.photo(f.photos[0] ? f.photos[0].src : '', f.photos[0] ? 'Portada de ' + (f.name || 'la propiedad') : '') +
        '<p class="summary__name">' + Z.esc(f.name || 'Nombre de la propiedad') + '</p><p class="small muted" style="margin-top:.5rem">' + Z.esc(f.zone || 'Zona') + ', Cancún</p>' +
        '<p class="summary__price">' + (f.price ? Z.money(f.price) + (f.op === 'renta' ? ' MXN / mes' : ' MXN') : 'Precio por definir') + '</p>' +
        '<p>' + Z.statusBadge(f.status) + '</p><p class="small muted" style="margin-top:.75rem">' + f.rec + ' recámara' + (f.rec == 1 ? '' : 's') + ' · ' + f.banos + ' baño' + (f.banos == 1 ? '' : 's') + (f.m2 ? ' · ' + f.m2 + ' m²' : '') + '</p>' +
        (b ? '<p class="small muted" style="margin-top:.25rem">Broker: ' + Z.esc(b.name) + '</p>' : '');
      var ok = complete();
      el('#checklist').innerHTML = [
        [ok, 'Información completa'],
        [f.photos.length > 0, f.photos.length ? f.photos.length + ' fotografía' + (f.photos.length === 1 ? '' : 's') + ' cargada' + (f.photos.length === 1 ? '' : 's') : 'Sin fotografías cargadas'],
        [!!f.broker, f.broker ? 'Broker asignado' : 'Falta asignar broker']
      ].map(function (c) { return '<li class="' + (c[0] ? 'is-done' : '') + '">' + Z.icon(c[0] ? 'check' : 'alert', 'icon--sm') + c[1] + '</li>'; }).join('');
      el('#vis-hint').textContent = { publicada: 'La casa aparecerá en el catálogo de Zugar al guardar.', pausada: 'La casa se guarda, pero no aparece en el catálogo.', borrador: 'Se guarda como borrador; nadie la verá hasta publicarla.' }[f.visibility];
      el('#price-label').textContent = f.op === 'renta' ? 'Precio mensual (MXN) *' : 'Precio de venta (MXN) *';
      el('#op-note').textContent = f.op === 'renta' ? 'Renta a largo plazo · Contrato mínimo de 12 meses.' : 'Venta · Acepta contado, crédito bancario e Infonavit.';
      var ready = ok && f.photos.length > 0 && !!f.broker;
      el('#save-title').textContent = editing ? (dirty ? (ok ? 'Cambios listos para guardar' : 'Completa los campos obligatorios') : 'Sin cambios por guardar')
        : (ready ? 'Todo listo para crear la propiedad' : 'Completa los datos para crear la propiedad');
    }

    function renderPhotos() {
      el('#photo-meta').textContent = f.photos.length ? f.photos.length + ' fotografía' + (f.photos.length === 1 ? '' : 's') + ' · La primera imagen será la portada. Arrastra para ordenar.' : 'Aún no hay fotografías. La primera que agregues será la portada.';
      el('#photo-tiles').innerHTML = f.photos.map(function (ph, i) {
        return '<figure class="photo-tile" draggable="true" data-index="' + i + '">' + Z.photo(ph.src, ph.label) +
          '<figcaption><span>' + (i === 0 ? 'Portada · ' : '') + Z.esc(ph.label) + '</span><span>' +
          (i > 0 ? '<button class="icon-btn" type="button" data-move="' + i + '" aria-label="Mover ' + Z.esc(ph.label) + ' una posición antes" title="Mover antes">' + Z.icon('left', 'icon--sm') + '</button>' : '') +
          '<button class="icon-btn icon-btn--danger" type="button" data-remove-photo="' + i + '" aria-label="Quitar fotografía ' + Z.esc(ph.label) + '" title="Quitar">' + Z.icon('trash', 'icon--sm') + '</button></span></figcaption></figure>';
      }).join('');
      refresh();
    }
    function renderAmenities() {
      el('#amenity-grid').innerHTML = Z.AMENITIES.concat(custom).map(function (a) {
        var isCustom = Z.AMENITIES.indexOf(a) < 0;
        return '<label class="amenity-option"><input type="checkbox" name="amenity" value="' + Z.esc(a) + '"' + (f.amenities.indexOf(a) >= 0 ? ' checked' : '') + '><span>' + Z.esc(a) + '</span>' +
          (isCustom ? '<button class="icon-btn icon-btn--danger" type="button" data-remove-amen="' + Z.esc(a) + '" aria-label="Quitar la amenidad ' + Z.esc(a) + '">' + Z.icon('x', 'icon--sm') + '</button>' : '') + '</label>';
      }).join('');
    }
    function addFiles(files) {
      var rejected = [];
      Array.prototype.forEach.call(files, function (file) {
        if (!/^image\/(jpeg|png)$/.test(file.type)) { rejected.push(file.name + ' (formato no permitido)'); return; }
        if (file.size > MAX_MB * 1024 * 1024) { rejected.push(file.name + ' (pesa más de ' + MAX_MB + ' MB)'); return; }
        if (f.photos.length >= MAX_PHOTOS) { rejected.push(file.name + ' (límite de ' + MAX_PHOTOS + ' fotos)'); return; }
        var url = URL.createObjectURL(file);
        f.photos.push({ src: url, label: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
        if (window.ZApi) ZApi.recordarArchivo(url, file); // se sube al guardar
      });
      dirty = true; renderPhotos();
      if (rejected.length) Z.toast('No se agregaron: ' + rejected.join(', ') + '.');
    }
    /* Ubicación: el enlace de Google Maps se convierte en latitud y longitud en el servidor */
    function renderLocation(address) {
      var hint = el('#p-maps-hint'), box = el('#p-maps-preview');
      if (f.lat == null || f.lng == null) {
        hint.textContent = 'En Google Maps abre la casa, toca «Compartir» y pega aquí el enlace. En el sitio solo se muestra la zona aproximada.';
        box.hidden = true; box.innerHTML = '';
        return;
      }
      var d = 0.004, bbox = [f.lng - d, f.lat - d, f.lng + d, f.lat + d].join(',');
      hint.innerHTML = Z.icon('check', 'icon--sm') + (address ? Z.esc(address) + ' · ' : 'Ubicación guardada · ') + f.lat.toFixed(6) + ', ' + f.lng.toFixed(6);
      box.hidden = false;
      box.innerHTML = '<iframe title="Vista previa de la ubicación de ' + Z.esc(f.name || 'la propiedad') + '" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=' +
        encodeURIComponent(bbox) + '&layer=mapnik&marker=' + encodeURIComponent(f.lat + ',' + f.lng) + '"></iframe>';
    }
    function locate(btn) {
      var input = el('#p-maps'), hint = el('#p-maps-hint'), url = input.value.trim();
      input.removeAttribute('aria-invalid');
      var fallo = function (msg) { input.setAttribute('aria-invalid', 'true'); hint.innerHTML = Z.icon('alert', 'icon--sm') + Z.esc(msg); input.focus(); };
      if (!url) return fallo('Pega el enlace de Google Maps de la casa.');
      if (!window.ZApi || !ZApi.activo()) return fallo('Para ubicar la casa se necesita la conexión con el servidor de Zugar.');
      btn.disabled = true; hint.textContent = 'Buscando la ubicación…';
      ZApi.ubicar(url).then(function (r) {
        f.lat = r.lat; f.lng = r.lng; dirty = true;
        renderLocation(r.address); refresh();
      }, function (e) { fallo(e && e.mensaje ? e.mensaje : 'No pudimos leer ese enlace.'); })
        .finally(function () { btn.disabled = false; });
    }

    function addAmenity() {
      var input = el('#p-new-amen'), v = input.value.trim().replace(/\s+/g, ' ');
      var field = input.closest('.field'); var old = field.querySelector('.field__error'); if (old) old.remove(); input.removeAttribute('aria-invalid');
      var exists = Z.AMENITIES.concat(custom).some(function (a) { return Z.norm(a) === Z.norm(v); });
      var msg = !v ? 'Escribe el nombre de la amenidad.' : exists ? 'Esa amenidad ya está en la lista.' : '';
      if (msg) {
        input.setAttribute('aria-invalid', 'true');
        field.insertAdjacentHTML('beforeend', '<p class="field__error" id="p-new-amen-error">' + Z.icon('alert', 'icon--sm') + msg + '</p>');
        input.setAttribute('aria-describedby', 'p-new-amen-error'); input.focus(); return;
      }
      v = Z.cap(v); custom.push(v); f.amenities.push(v); dirty = true;
      input.value = ''; input.removeAttribute('aria-describedby');
      renderAmenities(); Z.toast('Se agregó «' + v + '» a esta propiedad.'); input.focus();
    }

    root.oninput = function (e) {
      if (e.target.id === 'p-new-amen') return;
      dirty = true;
      if (e.target.getAttribute('aria-invalid') && e.target.value.trim()) {
        e.target.removeAttribute('aria-invalid');
        var er = e.target.closest('.field').querySelector('.field__error[data-auto]'); if (er) er.remove();
      }
      refresh();
    };
    root.onchange = function (e) {
      if (e.target.name === 'amenity') {
        f.amenities = Array.prototype.map.call(root.querySelectorAll('input[name="amenity"]:checked'), function (c) { return c.value; });
        dirty = true; refresh();
      } else if (e.target.id === 'p-files') { addFiles(e.target.files); e.target.value = ''; }
      else if (e.target.id === 'p-status' && e.target.value === 'borrador') { el('#p-vis').value = 'borrador'; refresh(); }
    };
    root.onkeydown = function (e) {
      if (e.target.id === 'p-new-amen' && e.key === 'Enter') { e.preventDefault(); addAmenity(); }
      if (e.target.id === 'p-maps' && e.key === 'Enter') { e.preventDefault(); locate(el('[data-action="locate"]')); }
    };
    root.onclick = function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.action === 'pick') el('#p-files').click();
      else if (t.dataset.action === 'add-amen') addAmenity();
      else if (t.dataset.action === 'locate') locate(t);
      else if (t.dataset.removeAmen != null) {
        var a = t.dataset.removeAmen; e.preventDefault();
        custom = custom.filter(function (x) { return x !== a; });
        f.amenities = f.amenities.filter(function (x) { return x !== a; });
        dirty = true; renderAmenities(); refresh(); el('#p-new-amen').focus();
      } else if (t.dataset.removePhoto != null) {
        var removed = f.photos.splice(+t.dataset.removePhoto, 1)[0];
        dirty = true; renderPhotos(); Z.toast('Se quitó la fotografía «' + removed.label + '».');
        (el('#photo-tiles button') || el('#p-files-btn')).focus();
      } else if (t.dataset.move != null) {
        var i = +t.dataset.move, item = f.photos.splice(i, 1)[0];
        f.photos.splice(i - 1, 0, item); dirty = true; renderPhotos();
        var back = el('[data-move="' + (i - 1) + '"]') || el('[data-remove-photo="0"]'); if (back) back.focus();
      }
    };

    /* Arrastrar para ordenar fotos y soltar archivos */
    var dragIndex = null, tiles = el('#photo-tiles'), zone = el('#dropzone');
    tiles.addEventListener('dragstart', function (e) {
      var tile = e.target.closest('.photo-tile'); if (!tile) return;
      dragIndex = +tile.dataset.index; tile.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragIndex));
    });
    tiles.addEventListener('dragover', function (e) {
      if (dragIndex == null) return;
      var tile = e.target.closest('.photo-tile'); if (!tile) return;
      e.preventDefault();
      tiles.querySelectorAll('.is-over').forEach(function (x) { x.classList.remove('is-over'); });
      tile.classList.add('is-over');
    });
    tiles.addEventListener('drop', function (e) {
      var tile = e.target.closest('.photo-tile'); if (dragIndex == null || !tile) return;
      e.preventDefault();
      var to = +tile.dataset.index, item = f.photos.splice(dragIndex, 1)[0];
      f.photos.splice(to, 0, item); dragIndex = null; dirty = true; renderPhotos();
    });
    tiles.addEventListener('dragend', function () { dragIndex = null; tiles.querySelectorAll('.is-dragging, .is-over').forEach(function (x) { x.classList.remove('is-dragging', 'is-over'); }); });
    zone.addEventListener('dragover', function (e) { if (dragIndex != null) return; e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
    zone.addEventListener('drop', function (e) { if (dragIndex != null) return; e.preventDefault(); zone.classList.remove('is-over'); addFiles(e.dataTransfer.files); });

    form.onsubmit = function (e) {
      e.preventDefault();
      read();
      var extra = [];
      if (el('#p-price').value.trim() && !f.price) extra.push({ el: el('#p-price'), msg: 'El precio debe ser mayor a cero.' });
      if (f.visibility === 'publicada' && !f.photos.length) extra.push({ el: el('#p-files-btn'), msg: 'Agrega al menos una fotografía para publicar la casa, o guárdala como borrador.' });
      if (f.visibility === 'publicada' && f.status === 'borrador') extra.push({ el: el('#p-status'), msg: 'Una casa en borrador no puede publicarse. Cambia el estado o la visibilidad.' });
      var errors = Z.validate(form, extra);
      var box = el('#form-errors');
      if (errors.length) {
        box.hidden = false;
        box.innerHTML = Z.icon('alert') + '<div><strong>Revisa ' + (errors.length === 1 ? 'el campo marcado' : 'los ' + errors.length + ' campos marcados') + '</strong>Tus datos se conservan; corrige lo señalado y vuelve a intentarlo.</div>';
        el('#savebar').classList.add('is-invalid'); el('#save-title').textContent = 'Revisa los campos marcados';
        return;
      }
      box.hidden = true;
      var data = {
        name: f.name, type: f.type, zone: f.zone, city: f.city, address: f.address, street: f.address.split(',')[0],
        desc: f.desc, m2: f.m2, terreno: f.terreno, age: f.age, rec: f.rec, banos: f.banos, est: f.est,
        op: f.op, price: f.price, status: f.status, availableFrom: f.availableFrom, maintenance: f.maintenance || 'No aplica',
        deposit: f.deposit, visibility: f.visibility, broker: f.broker, amenities: f.amenities.slice(), photos: f.photos.slice(),
        lat: f.lat == null ? null : f.lat, lng: f.lng == null ? null : f.lng,
        furnished: f.amenities.indexOf('Amueblada') >= 0 ? 'Amueblada' : (src && src.furnished !== 'Amueblada' ? src.furnished : 'Sin amueblar')
      };
      if (editing) {
        var prevBroker = src.broker;
        var antes = Object.assign({}, src);
        Object.assign(src, data);
        if (window.ZApi) ZApi.propiedadGuardar(src, false, antes);
        if (src.visibility === 'publicada' && !src.published) src.published = Z.TODAY;
        if (prevBroker !== src.broker) {
          Z.upcoming(function (a) { return a.property === src.id; }).forEach(function (a) { a.broker = src.broker; });
          Z.log('Lucía asignó ' + src.name + ' a ' + Z.broker(src.broker).name + '.', src.id);
        }
        Z.log('Lucía actualizó la información de ' + src.name + '.', src.id);
        Z.toast('Se guardaron los cambios de ' + src.name + '.');
        location.hash = '#/propiedades/' + src.id;
      } else {
        var nid = 'ZUG-' + String(D.nextNumbers.property++).padStart(3, '0');
        data.id = nid; data.published = f.visibility === 'publicada' ? Z.TODAY : '';
        D.properties.push(data);
        if (window.ZApi) ZApi.propiedadGuardar(data, true, null);
        Z.log('Lucía creó ' + data.name + ' (' + nid + ') y la asignó a ' + Z.broker(data.broker).name + '.', nid);
        Z.toast(data.name + ' se creó' + (data.visibility === 'publicada' ? ' y ya está publicada.' : ' como ' + data.visibility + '.'));
        location.hash = '#/propiedades/' + nid;
      }
    };

    renderAmenities(); renderPhotos(); renderLocation();
    var target = params.seccion && root.querySelector('#' + params.seccion);
    if (target) setTimeout(function () { target.scrollIntoView({ block: 'start' }); var fi = target.querySelector('input, button'); if (fi) fi.focus({ preventScroll: true }); }, 0);
  }

  Z.views.propiedades = {
    render: function (root, segs, params) {
      if (!segs.length) listView(root);
      else if (segs[0] === 'nueva') formView(root, null, params);
      else if (segs[1] === 'editar') formView(root, segs[0], params);
      else detailView(root, segs[0]);
    }
  };
})();
