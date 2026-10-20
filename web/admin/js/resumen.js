/* Módulo 1 · Resumen */
(function () {
  var D = Z.data;

  function count(list, fn) { return list.filter(fn).length; }

  Z.views.resumen = {
    render: function (root) {
      var props = D.properties, appts = D.appointments;
      var renta = count(props, function (p) { return p.op === 'renta'; });
      var st = function (s) { return count(props, function (p) { return p.status === s; }); };
      var clientes = count(D.people, function (p) { return p.type === 'cliente'; });
      var aStatus = function (s) { return count(appts, function (a) { return a.status === s; }); };
      var next = Z.upcoming().slice(0, 3);
      var drafts = props.filter(function (p) { return p.status === 'borrador'; });
      var pending = Z.upcoming(function (a) { return a.status === 'por-confirmar'; });
      var featured = Z.prop('ZUG-001') || props.find(function (p) { return p.status === 'disponible'; }) || props[0];

      var attention = drafts.map(function (p) {
        return '<li>' + Z.icon('file-edit') + '<div><strong>' + Z.esc(p.name) + ' está en borrador</strong><p>' +
          (p.photos.length ? 'Revisa la información antes de publicar.' : 'Completa las fotografías antes de publicar.') + '</p></div>' +
          '<a class="link" href="#/propiedades/' + p.id + '/editar">Completar ' + Z.icon('arrow', 'icon--sm') + '</a></li>';
      }).concat(pending.map(function (a) {
        return '<li>' + Z.icon('cal-clock') + '<div><strong>Una visita pendiente de confirmación</strong><p>' +
          Z.esc(Z.person(a.person).name) + ' · ' + Z.dateShort(a.date) + ', ' + a.start + ' h</p></div>' +
          '<a class="link" href="#/citas?cita=' + a.id + '">Revisar ' + Z.icon('arrow', 'icon--sm') + '</a></li>';
      })).join('');

      var fb = featured ? Z.broker(featured.broker) : null;
      var fNext = featured ? Z.upcoming(function (a) { return a.property === featured.id; }).length : 0;

      root.innerHTML =
        Z.crumbs([['Administración', '#/resumen'], ['Resumen']]) +
        Z.pageHead('Todo en su lugar.', 'Buen día, Lucía. Así se mueve Zugar esta semana.',
          '<button class="btn btn--secondary" type="button" data-action="export">Exportar resumen</button>' +
          '<a class="btn" href="#/propiedades/nueva">Nueva propiedad</a>') +
        '<div class="meta-row"><strong>20–26 de octubre de 2026</strong><span>Martes 20 de octubre · Actualizado a las 09:00 h</span></div>' +

        '<div class="metrics">' +
        Z.metric('Propiedades en cartera', props.length, renta + ' en renta · ' + (props.length - renta) + ' en venta') +
        Z.metric('Casas disponibles', st('disponible'), st('reservada') + ' reservada' + (st('reservada') === 1 ? '' : 's') + ' · ' + st('rentada') + ' rentada' + (st('rentada') === 1 ? '' : 's') + ' · ' + st('borrador') + ' borrador' + (st('borrador') === 1 ? '' : 'es')) +
        Z.metric('Clientes e inquilinos', D.people.length, clientes + ' clientes · ' + (D.people.length - clientes) + ' inquilinos') +
        Z.metric('Citas esta semana', appts.length, aStatus('confirmada') + ' confirmadas · ' + aStatus('por-confirmar') + ' por confirmar') +
        '</div>' +

        '<div class="grid-2"><div class="stack">' +
          '<section class="card card--pad" aria-labelledby="prox-title">' +
            '<div class="card__head"><h2 class="card__title" id="prox-title">Próximas visitas</h2><a class="link" href="#/citas">Ver agenda ' + Z.icon('arrow', 'icon--sm') + '</a></div>' +
            '<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Fecha</th><th scope="col">Cliente / Propiedad</th><th scope="col">Broker</th></tr></thead><tbody>' +
            (next.length ? next.map(function (a) {
              var p = Z.prop(a.property);
              return '<tr data-row-select data-href="#/citas?cita=' + a.id + '"><td><span class="strong">' + Z.dateShort(a.date) + '</span><span class="sub">' + a.start + ' h</span></td>' +
                '<td><a class="strong" href="#/citas?cita=' + a.id + '">' + Z.esc(Z.person(a.person).name) + '</a><span class="sub">' + Z.esc(p ? p.name + ' · ' + p.zone.replace('Residencial ', '').replace(' Residencial', '') : 'Propiedad eliminada') + '</span><div style="margin-top:.375rem">' + Z.apptBadge(a.status) + '</div></td>' +
                '<td>' + Z.esc(Z.broker(a.broker).name) + '</td></tr>';
            }).join('') : '<tr><td colspan="3" class="table-empty">No hay visitas próximas.</td></tr>') +
            '</tbody></table></div></section>' +

          '<section class="card card--pad" aria-labelledby="att-title">' +
            '<h2 class="card__title" id="att-title" style="margin-bottom:.5rem">Requieren tu atención</h2>' +
            (attention ? '<ul class="attention">' + attention + '</ul>' : '<p class="muted">Nada pendiente por ahora. Todo en su lugar.</p>') +
          '</section>' +
        '</div>' +

        '<div class="stack">' +
          (featured ?
          '<section class="feature" aria-label="Propiedad destacada">' +
            '<p class="feature__eyebrow">En tu cartera · ' + featured.id + '</p>' +
            '<div class="feature__card"><div class="feature__media">' + Z.cover(featured) + '<span class="badge badge--dorado">En ' + Z.opLabel(featured).toLowerCase() + '</span></div>' +
            '<div class="feature__body"><p class="feature__price">' + Z.priceLabel(featured) + '</p><p class="feature__name">' + Z.esc(featured.name) + '</p>' +
            '<p class="feature__loc">' + Z.esc(featured.zone) + ', Cancún</p>' +
            '<ul class="specs"><li>' + Z.icon('bed') + featured.rec + '<span class="sr-only"> recámaras</span></li><li>' + Z.icon('bath') + featured.banos + '<span class="sr-only"> baños</span></li><li>' + Z.icon('area') + featured.m2 + ' m²</li></ul></div></div>' +
            '<div class="feature__foot"><span>' + Z.esc(fb.name) + ' · ' + fNext + ' próxima' + (fNext === 1 ? '' : 's') + ' visita' + (fNext === 1 ? '' : 's') + '</span>' +
            '<a href="#/propiedades/' + featured.id + '">Administrar propiedad ' + Z.icon('arrow-ur', 'icon--sm') + '</a></div>' +
          '</section>' : '') +
          '<section class="card card--pad" aria-labelledby="act-title"><h2 class="card__title" id="act-title" style="margin-bottom:.25rem">Actividad reciente</h2>' +
            '<ul class="activity">' + D.activity.slice(0, 4).map(function (e) {
              return '<li><time>' + Z.esc(e.when) + '</time><p>' + Z.esc(e.text) + '</p></li>';
            }).join('') + '</ul></section>' +
        '</div></div>';

      root.onclick = function (e) {
        if (e.target.closest('[data-action="export"]')) {
          var rows = [['Indicador', 'Valor', 'Detalle'],
            ['Propiedades en cartera', props.length, renta + ' en renta · ' + (props.length - renta) + ' en venta'],
            ['Casas disponibles', st('disponible'), st('reservada') + ' reservadas · ' + st('rentada') + ' rentadas · ' + st('borrador') + ' borradores'],
            ['Clientes e inquilinos', D.people.length, clientes + ' clientes · ' + (D.people.length - clientes) + ' inquilinos'],
            ['Citas esta semana', appts.length, aStatus('confirmada') + ' confirmadas · ' + aStatus('por-confirmar') + ' por confirmar'],
            [], ['Fecha', 'Hora', 'Cliente', 'Propiedad', 'Broker', 'Estado']];
          Z.upcoming().forEach(function (a) {
            var p = Z.prop(a.property);
            rows.push([Z.dateShort(a.date), a.start, Z.person(a.person).name, p ? p.name : '', Z.broker(a.broker).name, Z.APPT_STATUS[a.status].label]);
          });
          Z.downloadCSV('zugar-resumen-20-26-oct-2026.csv', rows);
          return;
        }
        var row = e.target.closest('tr[data-href]');
        if (row && !e.target.closest('a')) location.hash = row.dataset.href;
      };
    }
  };
})();
