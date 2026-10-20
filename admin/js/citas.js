/* Módulo 5 · Citas */
(function () {
  var D = Z.data;
  var S = Z.state.citas = { offset: 0, day: null, tab: 'todas', q: '', broker: '', selected: 'CIT-024' };
  var TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '16:00', '16:30', '17:00', '17:30', '18:00'];

  function weekDays() {
    var start = Z.parseDate(Z.TODAY); start.setDate(start.getDate() + S.offset * 7);
    var days = [];
    for (var i = 0; i < 7; i++) { var d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    return days;
  }
  function rangeLabel(days) {
    var a = days[0], b = days[6];
    return a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + Z.monthShort(b) : a.getDate() + ' ' + Z.monthShort(a) + '–' + b.getDate() + ' ' + Z.monthShort(b);
  }
  function inWeek(a, days) { return a.date >= Z.isoDate(days[0]) && a.date <= Z.isoDate(days[6]); }
  function brokerClash(brokerId, date, start, exceptId) {
    return D.appointments.some(function (a) { return a.id !== exceptId && a.broker === brokerId && a.date === date && a.start === start && a.status !== 'cancelada'; });
  }

  function reschedule(a) {
    var p = Z.prop(a.property);
    Z.openDialog(
      '<span class="dialog__icon dialog__icon--info">' + Z.icon('cal-clock', 'icon--lg') + '</span>' +
      '<h2 id="dialog-title">Reprogramar cita</h2>' +
      '<p class="lead">' + Z.esc(Z.person(a.person).name) + ' · ' + Z.esc(p ? p.name : '') + '. La cita quedará por confirmar hasta que el cliente acepte el nuevo horario.</p>' +
      '<form id="rs-form" novalidate><div class="form-grid">' +
        '<div class="field"><label class="field__label" for="rs-date">Nueva fecha *</label><input class="input" id="rs-date" type="date" required min="' + Z.TODAY + '" value="' + a.date + '"></div>' +
        '<div class="field"><label class="field__label" for="rs-time">Horario *</label><select class="select" id="rs-time" required>' + Z.options(TIMES, a.start) + '</select></div>' +
        '<div class="field span-all"><label class="field__label" for="rs-why">Motivo del cambio</label><input class="input" id="rs-why" placeholder="Por ejemplo: el cliente pidió más temprano"></div>' +
      '</div><div class="dialog__actions"><button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn" type="submit">Guardar nuevo horario</button></div></form>',
      {
        onOpen: function (dlg) {
          var form = dlg.querySelector('#rs-form');
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var date = dlg.querySelector('#rs-date'), time = dlg.querySelector('#rs-time');
            var extra = [];
            if (date.value && date.value < Z.TODAY) extra.push({ el: date, msg: 'Elige una fecha a partir de hoy.' });
            else if (date.value && brokerClash(a.broker, date.value, time.value, a.id)) extra.push({ el: time, msg: Z.broker(a.broker).name + ' ya tiene una cita a esa hora.' });
            if (Z.validate(form, extra).length) return;
            a.date = date.value; a.start = time.value; a.end = Z.addMinutes(a.start, 45);
            a.status = 'por-confirmar'; a.confirmedBy = '';
            var why = dlg.querySelector('#rs-why').value.trim();
            Z.log('Lucía reprogramó la visita de ' + Z.person(a.person).name + ' para el ' + Z.dateShort(a.date) + ', ' + a.start + ' h' + (why ? ' (' + why + ')' : '') + '.', a.property);
            Z.toast('Cita reprogramada: ' + Z.dateLong(a.date) + ', ' + a.start + ' h.');
            S.selected = a.id; S.day = null;
            Z.closeDialog(); goToWeekOf(a.date); Z.rerender();
          });
        }
      }
    );
  }
  function goToWeekOf(iso) {
    var diff = Math.floor((Z.parseDate(iso) - Z.parseDate(Z.TODAY)) / 86400000);
    S.offset = Math.floor(diff / 7);
  }

  function setStatus(a, status) {
    var name = Z.person(a.person).name, p = Z.prop(a.property);
    a.status = status;
    if (status === 'confirmada') a.confirmedBy = 'Confirmada por Lucía · ' + Z.dateShort(Z.TODAY) + ', ' + Z.nowTime() + ' h.';
    var msg = { confirmada: 'confirmó', realizada: 'marcó como realizada', cancelada: 'canceló' }[status];
    Z.log('Lucía ' + msg + ' la visita de ' + name + ' a ' + (p ? p.name : 'la propiedad') + '.', a.property);
    Z.toast({ confirmada: 'Cita confirmada con ' + name + '.', realizada: 'La visita de ' + name + ' quedó como realizada.', cancelada: 'Se canceló la visita de ' + name + '.' }[status]);
    Z.rerender();
  }

  function newAppointment(personId) {
    var person = personId ? D.people.find(function (x) { return x.id === personId; }) : null;
    var prop0 = person ? person.property : '';
    Z.openDialog(
      '<h2 id="dialog-title">Nueva cita</h2><p class="lead">Agenda una visita presencial de 45 minutos. Quedará por confirmar hasta que el cliente acepte.</p>' +
      '<form id="nc-form" novalidate><div class="form-grid">' +
        '<div class="field"><label class="field__label" for="nc-person">Cliente *</label><select class="select" id="nc-person" required>' + Z.options(D.people.map(function (p) { return [p.id, p.name]; }), personId || '', 'Elige a una persona') + '</select></div>' +
        '<div class="field"><label class="field__label" for="nc-prop">Propiedad *</label><select class="select" id="nc-prop" required>' + Z.options(D.properties.filter(function (p) { return p.status !== 'borrador'; }).map(function (p) { return [p.id, p.name + ' · ' + p.id]; }), prop0, 'Elige una casa') + '</select></div>' +
        '<div class="field"><label class="field__label" for="nc-date">Fecha *</label><input class="input" id="nc-date" type="date" required min="' + Z.TODAY + '"></div>' +
        '<div class="field"><label class="field__label" for="nc-time">Horario *</label><select class="select" id="nc-time" required>' + Z.options(TIMES, '', 'Elige un horario') + '</select></div>' +
        '<div class="field span-all"><label class="field__label" for="nc-broker">Broker responsable *</label><select class="select" id="nc-broker" required>' + Z.brokerOptions(prop0 && Z.prop(prop0) ? Z.prop(prop0).broker : '', 'Elige un broker') + '</select><p class="field__hint">Por defecto, el responsable de la casa.</p></div>' +
        '<div class="field span-all"><label class="field__label" for="nc-note">Nota del cliente</label><textarea class="textarea" id="nc-note" placeholder="Lo que le interesa ver en la visita"></textarea></div>' +
      '</div><div class="dialog__actions"><button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn" type="submit">Agendar cita</button></div></form>',
      {
        wide: true,
        onOpen: function (dlg) {
          var form = dlg.querySelector('#nc-form');
          dlg.querySelector('#nc-person').addEventListener('change', function (e) {
            var pr = D.people.find(function (x) { return x.id === e.target.value; });
            if (pr && Z.prop(pr.property) && Z.prop(pr.property).status !== 'borrador') { dlg.querySelector('#nc-prop').value = pr.property; dlg.querySelector('#nc-broker').value = Z.prop(pr.property).broker; }
          });
          dlg.querySelector('#nc-prop').addEventListener('change', function (e) { var pr = Z.prop(e.target.value); if (pr) dlg.querySelector('#nc-broker').value = pr.broker; });
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var v = function (id) { return dlg.querySelector(id).value; };
            var extra = [];
            if (v('#nc-date') && v('#nc-date') < Z.TODAY) extra.push({ el: dlg.querySelector('#nc-date'), msg: 'Elige una fecha a partir de hoy.' });
            else if (v('#nc-date') && v('#nc-time') && v('#nc-broker') && brokerClash(v('#nc-broker'), v('#nc-date'), v('#nc-time'))) extra.push({ el: dlg.querySelector('#nc-time'), msg: Z.broker(v('#nc-broker')).name + ' ya tiene una cita a esa hora.' });
            if (Z.validate(form, extra).length) return;
            var a = { id: 'CIT-' + String(D.nextNumbers.appointment++).padStart(3, '0'), person: v('#nc-person'), property: v('#nc-prop'), broker: v('#nc-broker'), date: v('#nc-date'), start: v('#nc-time'), end: Z.addMinutes(v('#nc-time'), 45), status: 'por-confirmar', kind: 'Presencial', note: v('#nc-note').trim() };
            D.appointments.push(a);
            Z.log('Lucía agendó una visita de ' + Z.person(a.person).name + ' a ' + Z.prop(a.property).name + ' para el ' + Z.dateShort(a.date) + ', ' + a.start + ' h.', a.property);
            Z.toast('Cita ' + a.id + ' agendada · ' + Z.dateLong(a.date) + ', ' + a.start + ' h.');
            S.selected = a.id; S.day = null; S.tab = 'todas';
            Z.closeDialog(); goToWeekOf(a.date); location.hash = '#/citas'; Z.rerender();
          });
        }
      }
    );
  }

  Z.views.citas = {
    render: function (root, segs, params) {
      if (params.cita && Z.appt(params.cita)) { S.selected = params.cita; S.day = null; S.tab = 'todas'; goToWeekOf(Z.appt(params.cita).date); }
      var days = weekDays();
      var week = D.appointments.filter(function (a) { return inWeek(a, days); });
      var c = function (s) { return week.filter(function (a) { return a.status === s; }).length; };

      root.innerHTML =
        Z.crumbs([['Administración', '#/resumen'], ['Citas']]) +
        Z.pageHead('Cada visita, bien acompañada.', 'Coordina clientes, casas y brokers sin perder de vista el siguiente paso.',
          '<button class="btn btn--secondary" type="button" data-action="export">' + Z.icon('download') + 'Exportar agenda</button><button class="btn" type="button" data-action="new">' + Z.icon('plus') + 'Nueva cita</button>') +
        '<div class="metrics">' +
          Z.metric('Citas de la semana', week.length, days[0].getDate() + '–' + days[6].getDate() + ' de ' + Z.monthName(days[6]).toLowerCase()) +
          Z.metric('Confirmadas', c('confirmada'), 'Listas para la visita') +
          Z.metric('Por confirmar', c('por-confirmar'), 'Pendiente de contacto') +
          Z.metric('Realizadas / canceladas', c('realizada') + ' / ' + c('cancelada'), 'Historial de la semana') +
        '</div>' +
        '<div class="grid-2 grid-2--wide-side"><div>' +
          '<div class="week-head"><h2>' + Z.monthName(days[0]) + ' ' + days[0].getFullYear() + '</h2><div class="week-nav">' +
            '<button class="icon-btn" type="button" data-week="-1" aria-label="Semana anterior">' + Z.icon('left') + '</button><span aria-live="polite">' + rangeLabel(days) + '</span>' +
            '<button class="icon-btn" type="button" data-week="1" aria-label="Semana siguiente">' + Z.icon('right') + '</button></div></div>' +
          '<div class="days" role="group" aria-label="Días de la semana"></div>' +
          '<div id="ct-tabs"></div>' +
          '<div class="filters filters--2" role="search" aria-label="Filtrar citas">' +
            '<div class="field"><label class="field__label" for="ct-q">Buscar cita</label><input class="input input-search" id="ct-q" type="search" placeholder="Cliente o propiedad" value="' + Z.esc(S.q) + '"></div>' +
            '<div class="field"><label class="field__label" for="ct-broker">Broker</label><select class="select" id="ct-broker">' + Z.brokerOptions(S.broker, 'Todos') + '</select></div>' +
          '</div>' +
          '<p class="small muted" id="ct-dayline" style="margin-block:1rem .5rem"></p>' +
          '<div class="table-wrap"><table class="table"><caption class="sr-only">Citas de la semana</caption><thead><tr><th scope="col">Fecha / Hora</th><th scope="col">Cliente / Propiedad</th><th scope="col">Broker</th><th scope="col">Estado</th></tr></thead><tbody id="ct-rows"></tbody></table></div>' +
          '<p class="small muted" id="ct-meta" style="margin-top:.75rem"></p>' +
          '<div id="ct-pending" style="margin-top:1.5rem"></div>' +
        '</div><div id="ct-panel"></div></div>';

      function filtered() {
        var q = Z.norm(S.q);
        return Z.sortAppts(week.filter(function (a) {
          var p = Z.prop(a.property);
          return (!S.day || a.date === S.day) && (S.tab === 'todas' || a.status === S.tab) && (!S.broker || a.broker === S.broker) &&
            (!q || Z.norm(Z.person(a.person).name + ' ' + (p ? p.name : '')).indexOf(q) >= 0);
        }));
      }

      function update() {
        var active = document.activeElement && document.activeElement.id;
        var sel = Z.appt(S.selected);
        root.querySelector('.days').innerHTML = days.map(function (d) {
          var iso = Z.isoDate(d), n = week.filter(function (a) { return a.date === iso; }).length;
          var pressed = S.day === iso || (!S.day && sel && sel.date === iso);
          return '<button class="day' + (iso === Z.TODAY ? ' is-today' : '') + '" type="button" id="day-' + iso + '" data-day="' + iso + '" aria-pressed="' + pressed + '" aria-label="' + Z.dateLong(iso) + ', ' + n + ' cita' + (n === 1 ? '' : 's') + (iso === Z.TODAY ? ', hoy' : '') + '">' +
            '<span>' + Z.dayShort(d) + '</span><strong>' + d.getDate() + '</strong><small>' + n + ' cita' + (n === 1 ? '' : 's') + '</small></button>';
        }).join('');
        document.getElementById('ct-tabs').innerHTML = Z.tabs('ct', [['todas', 'Todas · ' + week.length], ['confirmada', 'Confirmadas · ' + c('confirmada')], ['por-confirmar', 'Por confirmar · ' + c('por-confirmar')]], S.tab, 'Filtrar por estado');
        var list = filtered();
        document.getElementById('ct-dayline').innerHTML = S.day ? 'Mostrando las citas del ' + Z.dateLong(S.day).toLowerCase() + ' · <button class="link" type="button" data-action="all-week">Ver toda la semana</button>' : '';
        document.getElementById('ct-rows').innerHTML = list.length ? list.map(function (a) {
          var p = Z.prop(a.property);
          return '<tr class="' + (a.id === S.selected ? 'is-selected' : '') + '"><td><span class="strong">' + Z.dateShort(a.date) + '</span><span class="sub">' + a.start + '–' + a.end + ' h</span></td>' +
            '<td><button class="link strong" type="button" data-select="' + a.id + '" style="color:var(--marino)" aria-pressed="' + (a.id === S.selected) + '">' + Z.esc(Z.person(a.person).name) + '</button><span class="sub">' + Z.esc(p ? p.name : 'Propiedad eliminada') + ' · ' + a.kind + '</span></td>' +
            '<td>' + Z.esc(Z.broker(a.broker).name) + '</td><td>' + Z.apptBadge(a.status) + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="table-empty">' + (week.length ? 'No hay citas con estos filtros.' : 'No hay citas registradas esta semana.') + '</td></tr>';
        document.getElementById('ct-meta').textContent = list.length + ' cita' + (list.length === 1 ? '' : 's') + ' · Zona horaria de Cancún (UTC-5)';

        var pend = Z.upcoming(function (a) { return a.status === 'por-confirmar'; })[0];
        document.getElementById('ct-pending').innerHTML = '<section class="card card--pad" aria-labelledby="sp-title"><h2 class="card__title" id="sp-title" style="margin-bottom:.75rem">Seguimiento pendiente</h2>' +
          (pend ? '<p>' + Z.esc(Z.person(pend.person).name) + ' aún no confirma su visita a ' + Z.esc(Z.prop(pend.property) ? Z.prop(pend.property).name : 'la propiedad') + ' (' + Z.dateShort(pend.date) + ', ' + pend.start + ' h).</p>' +
            '<div class="page-actions" style="margin-top:1rem"><button class="btn" type="button" data-confirm="' + pend.id + '">Confirmar cita</button><button class="btn btn--secondary" type="button" data-reschedule="' + pend.id + '">Reprogramar</button></div>'
            : '<p class="muted">Todas las visitas próximas están confirmadas.</p>') + '</section>';

        renderPanel(sel);
        if (active) { var el = document.getElementById(active); if (el && (active.indexOf('tab-ct-') === 0 || active.indexOf('day-') === 0)) el.focus(); }
      }

      function renderPanel(a) {
        var box = document.getElementById('ct-panel');
        if (!a) { box.innerHTML = '<section class="card card--pad appt-panel"><p class="muted">Elige una cita para ver su detalle.</p></section>'; return; }
        var p = Z.prop(a.property), per = Z.person(a.person), b = Z.broker(a.broker);
        var first = per.name.split(' ')[0];
        var actions = '';
        if (a.status === 'confirmada') actions = '<button class="btn btn--block" type="button" data-done="' + a.id + '">Marcar como realizada</button>';
        else if (a.status === 'por-confirmar') actions = '<button class="btn btn--block" type="button" data-confirm="' + a.id + '">Confirmar cita</button>';
        if (a.status === 'confirmada' || a.status === 'por-confirmar') actions += '<button class="btn btn--secondary btn--block" type="button" data-reschedule="' + a.id + '">Reprogramar cita</button><button class="link link--danger" type="button" data-cancel="' + a.id + '">Cancelar cita</button>';
        else actions = '<button class="btn btn--secondary btn--block" type="button" data-action="new-for" data-person="' + a.person + '">Agendar otra visita</button>';

        box.innerHTML = '<section class="card appt-panel" aria-labelledby="ap-title" aria-live="polite">' +
          '<div class="appt-panel__top">' + Z.apptBadge(a.status) + '<span>' + a.id + '</span></div>' +
          '<h2 id="ap-title" tabindex="-1">Una visita a ' + Z.esc(p ? p.name : 'una propiedad eliminada') + '</h2>' +
          '<p class="when">' + Z.dateLong(a.date) + '</p><p>' + a.start + '–' + a.end + ' h · Visita ' + a.kind.toLowerCase() + '</p>' +
          (p ? Z.cover(p) + '<p class="strong" style="font-weight:600;color:var(--marino)"><a href="#/propiedades/' + p.id + '" style="color:inherit">' + Z.esc(p.name) + ' · ' + p.id + '</a></p><p class="small muted" style="margin-top:.5rem">' + Z.esc(p.street) + ', ' + Z.esc(p.zone) + ', Cancún</p>' : '') +
          '<hr><span class="label-xs">Cliente</span><p class="strong" style="font-weight:600;color:var(--marino)">' + Z.esc(per.name) + '</p>' +
          '<p class="small muted"><a href="mailto:' + Z.esc(per.email) + '" style="color:inherit">' + Z.esc(per.email) + '</a> · ' + Z.esc(per.phone) + '</p>' +
          '<span class="label-xs" style="margin-top:1rem">Broker responsable</span><p class="strong" style="font-weight:600;color:var(--marino)">' + Z.esc(b.name) + '</p><p class="small muted">' + Z.esc(b.phone) + '</p>' +
          (a.note ? '<div class="note-box"><strong>Nota de ' + Z.esc(first) + '</strong>' + Z.esc(a.note) + '</div>' : '') +
          '<div class="appt-actions">' + actions + '</div></section>' +
          '<p class="small muted" style="margin-top:.75rem">' + Z.esc(a.confirmedBy || (a.status === 'por-confirmar' ? 'Pendiente de confirmación del cliente.' : 'Estado: ' + Z.APPT_STATUS[a.status].label.toLowerCase() + '.')) + ' Se conserva el historial de cada cambio.</p>';
      }

      root.oninput = function (e) { if (e.target.id === 'ct-q') { S.q = e.target.value; update(); } };
      root.onchange = function (e) { if (e.target.id === 'ct-broker') { S.broker = e.target.value; update(); } };
      root.onclick = function (e) {
        var t = e.target.closest('button'); if (!t) return;
        var a;
        if (t.dataset.tab === 'ct') { S.tab = t.dataset.value; update(); }
        else if (t.dataset.day) {
          S.day = S.day === t.dataset.day ? null : t.dataset.day;
          if (S.day) { var f = filtered()[0] || Z.sortAppts(week.filter(function (x) { return x.date === S.day; }))[0]; S.selected = f ? f.id : null; }
          update();
        }
        else if (t.dataset.action === 'all-week') { S.day = null; update(); root.querySelector('#ct-q').focus(); }
        else if (t.dataset.week) { S.offset += +t.dataset.week; S.day = null; S.selected = null; Z.views.citas.render(root, [], {}); root.querySelector('[data-week="' + t.dataset.week + '"]').focus(); }
        else if (t.dataset.select) {
          S.selected = t.dataset.select; update();
          var h = document.getElementById('ap-title'); if (h) h.focus({ preventScroll: true });
        }
        else if ((a = Z.appt(t.dataset.done))) setStatus(a, 'realizada');
        else if ((a = Z.appt(t.dataset.confirm))) { S.selected = a.id; setStatus(a, 'confirmada'); }
        else if ((a = Z.appt(t.dataset.reschedule))) reschedule(a);
        else if ((a = Z.appt(t.dataset.cancel))) {
          var ap = a, p = Z.prop(ap.property);
          Z.confirm({
            icon: 'cal-clock',
            title: '¿Cancelar la visita de ' + Z.person(ap.person).name + '?',
            lead: Z.esc(p ? p.name : '') + ' · ' + Z.dateLong(ap.date) + ', ' + ap.start + ' h. La cita quedará cancelada en el historial; avisa al cliente por teléfono o WhatsApp.',
            cancel: 'Conservar cita', confirm: 'Sí, cancelar cita',
            onConfirm: function () { setStatus(ap, 'cancelada'); }
          });
        }
        else if (t.dataset.action === 'new') newAppointment(null);
        else if (t.dataset.action === 'new-for') newAppointment(t.dataset.person);
        else if (t.dataset.action === 'export') {
          var rows = [['Clave', 'Fecha', 'Inicio', 'Fin', 'Cliente', 'Correo', 'Teléfono', 'Propiedad', 'Broker', 'Estado', 'Nota']];
          Z.sortAppts(D.appointments).forEach(function (x) {
            var pr = Z.prop(x.property), pe = Z.person(x.person);
            rows.push([x.id, x.date, x.start, x.end, pe.name, pe.email, pe.phone, pr ? pr.name : '', Z.broker(x.broker).name, Z.APPT_STATUS[x.status].label, x.note]);
          });
          Z.downloadCSV('zugar-agenda-citas.csv', rows);
        }
      };
      update();
      if (params.nueva) newAppointment(params.nueva);
    }
  };
})();
