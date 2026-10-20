/* Utilidades y componentes reutilizables del panel */
(function () {
  var D = Z.data;
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_SHORT = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  Z.state = {};
  Z.views = {};

  /* ---------- Texto y formato ---------- */
  Z.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  Z.cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };
  Z.money = function (n) { return '$' + Number(n || 0).toLocaleString('en-US'); };
  Z.priceLabel = function (p) { return Z.money(p.price) + (p.op === 'renta' ? ' MXN / mes' : ' MXN'); };
  Z.opLabel = function (p) { return p.op === 'renta' ? 'Renta' : 'Venta'; };
  Z.norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  Z.parseDate = function (iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  Z.isoDate = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  Z.dateShort = function (iso) { var d = Z.parseDate(iso); return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()]; };
  Z.dateLong = function (iso) { var d = Z.parseDate(iso); return Z.cap(DAYS[d.getDay()]) + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()]; };
  Z.dateFull = function (iso) { var d = Z.parseDate(iso); return d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear(); };
  Z.dayShort = function (d) { return DAYS_SHORT[d.getDay()]; };
  Z.monthName = function (d) { return Z.cap(MONTHS[d.getMonth()]); };
  Z.monthShort = function (d) { return MONTHS_SHORT[d.getMonth()]; };
  Z.nowTime = function () { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  Z.addMinutes = function (hhmm, min) {
    var p = hhmm.split(':'); var t = +p[0] * 60 + +p[1] + min;
    return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };

  /* ---------- Búsquedas en los datos ---------- */
  Z.prop = function (id) { return D.properties.find(function (p) { return p.id === id; }); };
  Z.broker = function (id) { return D.brokers.find(function (b) { return b.id === id; }) || { name: 'Sin asignar', initials: '—', phone: '', email: '' }; };
  Z.person = function (id) { return D.people.find(function (p) { return p.id === id; }) || { name: 'Contacto eliminado', email: '', phone: '' }; };
  Z.appt = function (id) { return D.appointments.find(function (a) { return a.id === id; }); };
  Z.isUpcoming = function (a) { return (a.status === 'confirmada' || a.status === 'por-confirmar') && a.date >= Z.TODAY; };
  Z.sortAppts = function (list) { return list.slice().sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); }); };
  Z.upcoming = function (filter) { return Z.sortAppts(D.appointments.filter(function (a) { return Z.isUpcoming(a) && (!filter || filter(a)); })); };
  Z.brokerStats = function (id) {
    return {
      props: D.properties.filter(function (p) { return p.broker === id; }).length,
      next: Z.upcoming(function (a) { return a.broker === id; }).length
    };
  };

  /* ---------- Componentes ---------- */
  Z.icon = function (id, cls) { return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; };
  Z.src = function (src) { return /^(blob:|data:|https?:|\.\.\/)/.test(src) ? src : Z.IMG + src; };
  Z.photo = function (src, alt, cls) {
    return '<div class="photo ' + (cls || '') + '">' + (src ? '<img src="' + Z.esc(Z.src(src)) + '" alt="' + Z.esc(alt || '') + '" loading="lazy">' : '') + '</div>';
  };
  Z.cover = function (p, cls, alt) { return Z.photo(p.photos[0] ? p.photos[0].src : '', alt == null ? 'Fachada de ' + p.name : alt, cls); };
  Z.avatar = function (b, cls) {
    return '<span class="avatar ' + (cls || '') + '">' + (b.photo ? Z.photo(b.photo, 'Fotografía de ' + b.name) : '<span aria-hidden="true">' + Z.esc(b.initials) + '</span>') + '</span>';
  };
  Z.badge = function (label, tone) { return '<span class="badge badge--' + tone + '">' + Z.esc(label) + '</span>'; };
  Z.statusBadge = function (s) { var x = Z.STATUS[s]; return Z.badge(x.label, x.tone); };
  Z.apptBadge = function (s) { var x = Z.APPT_STATUS[s]; return Z.badge(x.label, x.tone); };
  Z.followBadge = function (f) { return Z.badge(f, Z.FOLLOW[f] || 'gris'); };

  Z.crumbs = function (items) {
    return '<nav class="crumbs" aria-label="Ruta de navegación"><ol>' + items.map(function (it, i) {
      var last = i === items.length - 1;
      return '<li>' + (last ? '<span aria-current="page">' + Z.esc(it[0]) + '</span>' : '<a href="' + it[1] + '">' + Z.esc(it[0]) + '</a>') + '</li>';
    }).join('') + '</ol></nav>';
  };
  Z.pageHead = function (title, sub, actions) {
    return '<div class="page-head"><div><h1 tabindex="-1">' + Z.esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
  };
  Z.metric = function (label, value, note) {
    return '<dl class="card metric"><dt>' + Z.esc(label) + '</dt><dd>' + Z.esc(value) + '</dd><p>' + Z.esc(note) + '</p></dl>';
  };
  /* Pestañas accesibles: items = [[valor, etiqueta], ...] */
  Z.tabs = function (name, items, selected, label) {
    return '<div class="tabs" role="tablist" aria-label="' + Z.esc(label) + '">' + items.map(function (it) {
      var on = it[0] === selected;
      return '<button class="tab" type="button" role="tab" id="tab-' + name + '-' + it[0] + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-tab="' + name + '" data-value="' + it[0] + '"' + (it[2] ? ' aria-controls="' + it[2] + '"' : '') + '>' + Z.esc(it[1]) + '</button>';
    }).join('') + '</div>';
  };
  Z.options = function (list, selected, placeholder) {
    return (placeholder != null ? '<option value="">' + Z.esc(placeholder) + '</option>' : '') + list.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o, dis = Array.isArray(o) && o[2];
      return '<option value="' + Z.esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + Z.esc(l) + '</option>';
    }).join('');
  };
  Z.brokerOptions = function (selected, placeholder) {
    return Z.options(D.brokers.map(function (b) { return [b.id, b.name + (b.active ? '' : ' (inactivo)'), !b.active && b.id !== selected]; }), selected, placeholder);
  };
  Z.pager = function (shown, total, noun) {
    return '<div class="pager"><span>Mostrando ' + (shown ? '1–' + shown : '0') + ' de ' + total + ' ' + noun + '</span>' +
      '<div class="pager__nav"><button type="button" disabled>← Anterior</button><span aria-current="page">1</span><button type="button" disabled>Siguiente →</button></div></div>';
  };

  /* ---------- Registro de actividad ---------- */
  Z.log = function (text, propId) {
    D.activity.unshift({ when: 'Hoy · ' + Z.nowTime() + ' h', text: text });
    if (propId) {
      D.history[propId] = D.history[propId] || [];
      D.history[propId].unshift({ when: Z.dateShort(Z.TODAY) + ' 2026 · ' + Z.nowTime() + ' h', text: text });
      var p = Z.prop(propId); if (p) { p.updated = 'Hoy a las ' + Z.nowTime() + ' h'; p.updatedAt = Date.now(); }
    }
  };

  /* ---------- Avisos flotantes ---------- */
  Z.toast = function (msg) {
    var box = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = Z.icon('check-c') + '<span>' + Z.esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  };

  /* ---------- Diálogos (dialog nativo: foco atrapado y Escape) ---------- */
  var lastFocus = null;
  Z.openDialog = function (html, opts) {
    opts = opts || {};
    var dlg = document.getElementById('dialog');
    lastFocus = document.activeElement;
    dlg.className = opts.wide ? 'dialog--wide' : '';
    dlg.innerHTML = '<div class="dialog__body">' + html +
      '<button class="icon-btn dialog__close" type="button" data-close aria-label="Cerrar">' + Z.icon('x') + '</button></div>';
    dlg.onclick = function (e) {
      if (e.target === dlg || e.target.closest('[data-close]')) Z.closeDialog();
    };
    dlg.onclose = function () { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); };
    dlg.showModal();
    var first = dlg.querySelector('[autofocus]') || dlg.querySelector('input, select, textarea, button:not(.dialog__close)');
    if (first) first.focus();
    if (opts.onOpen) opts.onOpen(dlg);
    return dlg;
  };
  Z.closeDialog = function () { var dlg = document.getElementById('dialog'); if (dlg.open) dlg.close(); };

  /* Confirmación genérica. o: {title, lead, item, callout, check, confirm, cancel, onConfirm} */
  Z.confirm = function (o) {
    var html = '<span class="dialog__icon">' + Z.icon(o.icon || 'trash', 'icon--lg') + '</span>' +
      '<h2 id="dialog-title">' + Z.esc(o.title) + '</h2><p class="lead">' + o.lead + '</p>' + (o.item || '') + (o.callout || '') +
      (o.check ? '<label class="check"><input type="checkbox" id="confirm-check"> ' + Z.esc(o.check) + '</label>' : '') +
      '<div class="dialog__actions"><button class="btn btn--secondary" type="button" data-close>' + Z.esc(o.cancel || 'Cancelar') + '</button>' +
      '<button class="btn ' + (o.safe ? '' : 'btn--danger') + '" type="button" id="confirm-ok"' + (o.check ? ' disabled' : '') + '>' + Z.esc(o.confirm) + '</button></div>';
    Z.openDialog(html, {
      onOpen: function (dlg) {
        var ok = dlg.querySelector('#confirm-ok'), chk = dlg.querySelector('#confirm-check');
        if (chk) chk.addEventListener('change', function () { ok.disabled = !chk.checked; });
        ok.addEventListener('click', function () { Z.closeDialog(); o.onConfirm(); });
        dlg.querySelector('[data-close].btn').focus();
      }
    });
  };

  /* ---------- Validación de formularios ---------- */
  Z.validate = function (form, extra) {
    var errors = [];
    form.querySelectorAll('.field__error[data-auto]').forEach(function (e) { e.remove(); });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.disabled || el.type === 'hidden' || el.type === 'file') return;
      var msg = '';
      var v = el.value.trim();
      var label = (form.querySelector('label[for="' + el.id + '"]') || {}).textContent || el.name;
      label = label.replace(/\s*\*\s*$/, '').trim();
      if (el.required && el.type === 'checkbox' && !el.checked) msg = 'Marca esta casilla para continuar.';
      else if (el.required && !v) msg = 'Completa «' + label + '».';
      else if (v && el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
      else if (v && el.dataset.number != null && !/^\$?\s*[\d,]+(\.\d+)?$/.test(v)) msg = 'Escribe solo números en «' + label + '».';
      else if (v && el.type === 'tel' && v.replace(/\D/g, '').length < 10) msg = 'El teléfono debe tener al menos 10 dígitos.';
      if (msg) errors.push({ el: el, msg: msg });
    });
    (extra || []).forEach(function (e) { errors.push(e); });
    errors.forEach(function (e) {
      e.el.setAttribute('aria-invalid', 'true');
      var p = document.createElement('p');
      p.className = 'field__error'; p.dataset.auto = '';
      p.id = (e.el.id || e.el.name) + '-error';
      p.innerHTML = Z.icon('alert', 'icon--sm') + Z.esc(e.msg);
      var field = e.el.closest('.field') || e.el.parentNode;
      field.appendChild(p);
      e.el.setAttribute('aria-describedby', p.id);
    });
    if (errors.length) errors[0].el.focus();
    return errors;
  };
  Z.numberValue = function (v) { return Number(String(v).replace(/[^\d.]/g, '')) || 0; };

  /* ---------- Exportar CSV ---------- */
  Z.downloadCSV = function (filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    Z.toast('Se descargó ' + filename + '.');
  };

  /* ---------- Teclado en pestañas (flechas, Inicio, Fin) ---------- */
  document.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[role="tab"]');
    if (!tab) return;
    var tabs = Array.prototype.slice.call(tab.parentNode.querySelectorAll('[role="tab"]'));
    var i = tabs.indexOf(tab), n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n == null) return;
    e.preventDefault();
    tabs[n].click();
    var again = document.getElementById(tabs[n].id);
    if (again) again.focus();
  });
})();
