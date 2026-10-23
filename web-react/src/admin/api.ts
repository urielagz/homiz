import { API_URL } from '../lib/api';
import { clearSession, currentSession, saveTokens } from './auth';
import { pushLogout } from './push';
import { addMinutes, D, dateShort, norm, cap, rerender, viewState, Z, type Appointment, type Broker, type Person, type Property } from './store';

/* ==========================================================================
   Conexión del panel con la API de Homiz.
   Con sesión de la API, el panel carga los datos del servidor y cada cambio se guarda ahí;
   sin servidor, todo sigue en memoria como en el entorno de diseño.
   ========================================================================== */
const WAIT_MS = 8000;

export interface ApiFailure {
  status?: number;
  codigo?: string;
  mensaje?: string;
  detalles?: unknown;
  sinConexion?: boolean;
}

/** Avisos flotantes del panel (los registra el Shell) */
export const notify = { toast: (_msg: string) => {} };

async function fetchJson<T>(path: string, init: RequestInit): Promise<T> {
  if (!API_URL) throw { sinConexion: true, mensaje: 'No hay conexión con el servidor de Zugar.' } satisfies ApiFailure;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WAIT_MS);
  let res: Response;
  try {
    res = await fetch(API_URL + path, { ...init, signal: ctrl.signal });
  } catch {
    throw { sinConexion: true, mensaje: 'No hay conexión con el servidor de Zugar.' } satisfies ApiFailure;
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as T;
  const e = body?.error ?? {};
  throw { status: res.status, codigo: e.code, mensaje: e.message || 'El servidor no pudo completar la acción.', detalles: e.details } satisfies ApiFailure;
}

let renewing: Promise<void> | null = null;
function renew(): Promise<void> {
  const s = currentSession();
  if (!s?.refresh) return Promise.reject({ status: 401 });
  renewing ??= fetchJson<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken: s.refresh }),
  })
    .then((r) => saveTokens(r.accessToken, r.refreshToken))
    .finally(() => (renewing = null));
  return renewing;
}

export async function request<T = any>(method: string, path: string, body?: unknown, retry = false): Promise<T> {
  const s = currentSession();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (s?.token) headers.Authorization = 'Bearer ' + s.token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetchJson<T>(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    const e = err as ApiFailure;
    if (e.status === 401 && !retry) {
      try {
        await renew();
      } catch {
        clearSession(); // la sesión del servidor terminó
        location.replace('#/login');
        throw e;
      }
      return request<T>(method, path, body, true);
    }
    throw e;
  }
}

export const apiActive = () => {
  const s = currentSession();
  return !!(API_URL && s?.api && s.token);
};

export function apiLogin(email: string, password: string) {
  return fetchJson<{ user: { type: string; email: string; name: string; roles: string[]; permissions: string[] }; accessToken: string; refreshToken: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
}

export function apiForgot(email: string) {
  return fetchJson('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  }).catch(() => {
    /* el mensaje en pantalla es el mismo exista o no la cuenta */
  });
}

export function apiLogout() {
  const s = currentSession();
  if (!apiActive() || !s?.refresh) return;
  pushLogout(s.token!); // este navegador deja de recibir los avisos de la cuenta
  fetchJson('/auth/logout', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + s.token },
    body: JSON.stringify({ refreshToken: s.refresh }),
  }).catch(() => {});
}

/* ---------- Fechas en hora de Cancún (UTC-5 todo el año) ---------- */
const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function inCancun(iso: string) {
  const p: Record<string, string> = {};
  FMT.formatToParts(new Date(iso)).forEach((x) => (p[x.type] = x.value));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const toIso = (date: string, time: string) => `${date}T${time}:00-05:00`;
function when(iso: string) {
  const c = inCancun(iso);
  return (c.date === Z.TODAY ? 'Hoy' : dateShort(c.date) + ' ' + c.date.slice(0, 4)) + ' · ' + c.time + ' h';
}
const today = () => inCancun(new Date().toISOString()).date;
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- De la API al formato del panel ---------- */
const uuid: { prop: Record<string, string> } = { prop: {} }; // código ZUG-### → id de la base

function toProperty(p: any): Property {
  uuid.prop[p.code] = p.id;
  const act = p.updatedAt ? inCancun(p.updatedAt) : null;
  return {
    id: p.code, _id: p.id, _zoneKey: p.zoneKey, slug: p.slug, lat: p.lat == null ? null : Number(p.lat), lng: p.lng == null ? null : Number(p.lng),
    name: p.name, type: p.type, zone: p.zone, city: p.city, address: p.address, street: p.street || '',
    op: p.operation, price: Number(p.price), rec: Number(p.rec), banos: Number(p.banos), m2: p.m2 == null ? '' : Number(p.m2),
    terreno: p.terreno == null ? '' : Number(p.terreno), est: p.est, age: p.age == null ? '' : p.age,
    status: p.status, visibility: p.visibility, broker: p.broker ? p.broker.id : '',
    maintenance: p.maintenance || '', deposit: p.deposit == null ? 0 : Number(p.deposit),
    availableFrom: p.availableFrom ? String(p.availableFrom).slice(0, 10) : '', furnished: p.furnished, desc: p.description || '',
    amenities: p.amenities || [],
    // Las fotos subidas llegan con URL firmada; las del sitio, con su nombre de archivo en assets/img.
    photos: (p.photos || []).map((f: any) => ({ src: f.url || f.key, label: f.label || '', key: f.key })),
    published: p.publishedAt ? String(p.publishedAt).slice(0, 10) : '',
    updated: act ? (act.date === Z.TODAY ? 'Hoy a las ' + act.time + ' h' : dateShort(act.date) + ' · ' + act.time + ' h') : '',
    updatedAt: p.updatedAt ? Date.parse(p.updatedAt) : 0,
  };
}
function toPerson(c: any): Person {
  return {
    id: c.id, name: c.name, email: c.email || '', phone: c.phone || '', type: c.kind, label: c.label || undefined,
    property: c.property ? c.property.code : '', broker: c.broker ? c.broker.id : '', follow: c.followStatus,
    op: c.operation || 'Renta', budget: c.budget || '', needs: c.needs || '',
    job: [c.occupation, c.nationality ? 'Nacionalidad ' + c.nationality.toLowerCase() : ''].filter(Boolean).join(' · '),
  };
}
function toAppointment(a: any): Appointment {
  const c = inCancun(a.scheduledAt);
  return {
    id: a.code, _id: a.id, person: a.client ? a.client.id : '', property: a.property.code, broker: a.broker ? a.broker.id : '',
    date: c.date, start: c.time, end: addMinutes(c.time, a.durationMin || 45), status: a.status, kind: a.kind || 'Presencial',
    note: a.note || a.reason || '', confirmedBy: a.confirmedBy || '',
  };
}
function toBroker(u: any, before: Broker[]): Broker {
  const prev = before.find((b) => b.email && u.email && b.email.toLowerCase() === u.email.toLowerCase());
  return {
    id: u.id, name: u.name, initials: u.initials || norm(u.name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
    role: u.specialty || '', zones: u.zones || '', email: u.email || '', phone: u.phone || '', photo: prev ? prev.photo : '', active: u.active !== false,
  };
}

/** Llena los datos del panel con los del servidor */
export async function load() {
  if (!apiActive()) return;
  // Estados que el servidor maneja y el diseño no tenía
  Z.STATUS.vendida ??= { label: 'Vendida', tone: 'gris' };
  Z.APPT_STATUS.rechazada ??= { label: 'Rechazada', tone: 'error' };
  Z.TODAY = today();
  const list = (path: string) => request<{ data?: any[] }>('GET', path).then((r) => r.data || []);
  const [props, people, appts, usersOrNull, activity] = await Promise.all([
    list('/properties?limit=100&sort=updated'),
    list('/clients?limit=100'),
    list('/appointments?limit=100'),
    list('/users?role=broker&limit=100').catch(() => null), // solo administración
    list('/activity-log?limit=60').catch(() => []),
  ]);
  let users = usersOrNull;
  if (!users) {
    // sin permiso para ver al personal: los brokers salen de las casas
    const seen = new Set<string>();
    users = props.filter((p) => p.broker && !seen.has(p.broker.id) && seen.add(p.broker.id)).map((p) => p.broker);
  }
  const before = D.brokers.slice();
  D.brokers = users.map((u) => toBroker(u, before));
  D.properties = props.map(toProperty);
  D.people = people.map(toPerson);
  D.appointments = appts.map(toAppointment);
  D.properties.forEach((p) => !Z.ZONES.includes(p.zone) && Z.ZONES.push(p.zone));
  D.activity = activity.slice(0, 20).map((a: any) => ({ when: when(a.createdAt), text: a.description || a.action }));
  D.history = {};
  activity.forEach((a: any) => {
    if (a.property) (D.history[a.property.code] ??= []).push({ when: when(a.createdAt), text: a.description || a.action });
  });
  const sp = viewState.people;
  if (!D.people.some((x) => x.id === sp.selected)) sp.selected = D.people[0]?.id ?? null;
  const sc = viewState.citas;
  if (!D.appointments.some((a) => a.id === sc.selected)) sc.selected = null;
}

/** Después de guardar: recarga desde el servidor. Si falla, avisa y vuelve a los datos reales. */
function sync<T>(promise: Promise<T>, done?: (r: T) => void) {
  if (!apiActive()) return;
  promise.then(
    async (r) => {
      await load();
      done?.(r);
      rerender();
    },
    async (e: ApiFailure) => {
      notify.toast('No se guardó: ' + (e?.mensaje || 'error del servidor') + ' Se restauraron los datos.');
      await load().catch(() => {});
      rerender();
    },
  );
}

/* ---------- Escrituras: una por cada cambio del panel ---------- */
export const ZApi = {
  appointmentStatus(a: Appointment, status: string) {
    const action = ({ confirmada: 'confirm', cancelada: 'cancel', realizada: 'complete' } as Record<string, string>)[status];
    if (action) sync(request('POST', `/appointments/${a._id}/${action}`, {}));
  },
  appointmentReschedule(a: Appointment, reason?: string) {
    sync(request('POST', `/appointments/${a._id}/reschedule`, { scheduledAt: toIso(a.date, a.start), reason: reason || undefined }));
  },
  appointmentNew(a: Appointment) {
    sync(request<{ code: string }>('POST', '/appointments', { propertyId: uuid.prop[a.property], clientId: a.person, scheduledAt: toIso(a.date, a.start), note: a.note || null }), (r) => (viewState.citas.selected = r.code));
  },

  personSave(p: Person, isNew: boolean) {
    // «Ocupación y nacionalidad» del panel = ocupación + «Nacionalidad …» en la base
    const parts = String(p.job || '').split(/\s*·\s*/).filter(Boolean);
    const nat = parts.find((x) => /^nacionalidad\s+/i.test(x));
    const body = {
      name: p.name, email: p.email || null, phone: p.phone || null, kind: p.type, followStatus: p.follow,
      propertyId: uuid.prop[p.property] || null, brokerId: p.broker || null, operation: p.op || null,
      budget: p.budget || null, needs: p.needs || null,
      occupation: parts.filter((x) => x !== nat).join(' · ') || null,
      nationality: nat ? cap(nat.replace(/^nacionalidad\s+/i, '')) : null,
    };
    sync(isNew ? request<{ id: string }>('POST', '/clients', body) : request<{ id: string }>('PATCH', '/clients/' + p.id, body), (r) => (viewState.people.selected = r.id));
  },
  personDelete(p: Person) {
    sync(request('DELETE', '/clients/' + p.id));
  },

  brokerSave(b: Broker, isNew: boolean) {
    if (isNew) {
      // La cuenta se crea con una contraseña aleatoria; la persona entra con «¿Olvidaste tu contraseña?».
      const password = 'Zg' + Math.random().toString(36).slice(2, 10) + 'A' + Math.floor(Math.random() * 90 + 10) + 'x';
      sync(request('POST', '/users', { name: b.name, email: b.email, phone: b.phone || null, zones: b.zones || null, specialty: b.role || null, roles: ['broker'], password }), () =>
        notify.toast(b.name + ' debe usar «¿Olvidaste tu contraseña?» en el acceso para crear su contraseña.'),
      );
    } else {
      sync(request('PATCH', '/users/' + b.id, { name: b.name, phone: b.phone || null, zones: b.zones || null, specialty: b.role || null }));
    }
  },
  brokerActive(b: Broker) {
    sync(request('PATCH', '/users/' + b.id, { active: !!b.active }));
  },
  propertyBroker(p: Property) {
    sync(request('PATCH', `/properties/${uuid.prop[p.id]}/broker`, { brokerId: p.broker }));
  },
  propertyDelete(p: Property) {
    sync(request('DELETE', '/properties/' + (p._id || uuid.prop[p.id])));
  },
  propertyVisibility(p: Property) {
    sync(request('PATCH', `/properties/${p._id || uuid.prop[p.id]}/availability`, { visibility: p.visibility }));
  },

  /** Enlace de Google Maps → { lat, lng, address } (lo procesa el servidor; sin clave usa OpenStreetMap) */
  locate(url: string) {
    return request<{ lat: number; lng: number; address: string | null }>('POST', '/properties/locate', { url });
  },

  /** Archivos elegidos en el formulario (blob: → File) para subirlos al guardar */
  files: {} as Record<string, File>,
  rememberFile(src: string, file: File) {
    ZApi.files[src] = file;
  },

  propertySave(p: Property, isNew: boolean, before: Property | null, onCreated?: (code: string) => void) {
    if (!apiActive()) return;
    const prevZone = before && before.zone === p.zone ? before._zoneKey : null;
    const sameZone = D.properties.find((x) => x.zone === p.zone && x._zoneKey);
    const data: Record<string, unknown> = {
      name: p.name, type: p.type, description: p.desc || '', operation: p.op, price: p.price, rec: p.rec, banos: p.banos,
      m2: p.m2 || null, terreno: p.terreno || null, est: p.est || 0, age: p.age === '' || p.age == null ? null : +p.age,
      furnished: p.furnished || 'Sin amueblar', petsAllowed: p.amenities.includes('Se aceptan mascotas'),
      maintenance: p.maintenance || null, deposit: p.deposit || null, availableFrom: p.availableFrom || null,
      address: p.address || '', street: p.street || null, city: p.city, zone: p.zone,
      zoneKey: prevZone || (sameZone ? sameZone._zoneKey : slug(p.zone)),
      mapQuery: p.zone + ', Cancún, Quintana Roo', amenities: p.amenities,
    };
    // Ubicación del enlace de Google Maps (solo se envía si se conoce: no borra la que ya tenga)
    if (p.lat != null && p.lng != null) Object.assign(data, { lat: p.lat, lng: p.lng });
    let id = before ? before._id! : '';
    let code = '';
    const save = (isNew
      ? request<{ id: string; code: string }>('POST', '/properties', { brokerId: p.broker || undefined, ...data }).then((r) => { id = r.id; code = r.code; })
      : request('PATCH', '/properties/' + id, data)
    )
      .then(() => Promise.all(p.photos.map((f) => uploadPhoto(id, f))))
      .then((photos) => request('PATCH', '/properties/' + id, { photos }))
      .then(() => { if (!isNew && before!.broker !== p.broker && p.broker) return request('PATCH', `/properties/${id}/broker`, { brokerId: p.broker }); })
      .then(() => request('PATCH', `/properties/${id}/availability`, { status: p.status, visibility: p.visibility }));
    sync(save, () => { if (isNew && code) onCreated?.(code); });
  },
};

/** Sube una foto nueva (blob:) con URL firmada; las existentes conservan su clave. */
async function uploadPhoto(propertyId: string, f: { src: string; label: string; key?: string }) {
  const file = ZApi.files[f.src];
  if (!file) return { storageKey: f.key || f.src, label: f.label || '' };
  const r = await request<{ upload: { url: string; headers?: Record<string, string> }; storageKey: string }>('POST', '/documents/upload-url', { propertyId, purpose: 'property_photo', mime: file.type, size: file.size });
  const res = await fetch(r.upload.url, { method: 'PUT', headers: r.upload.headers || { 'Content-Type': file.type }, body: file });
  if (!res.ok) throw { mensaje: `No se pudo subir la foto «${f.label}».` };
  return { storageKey: r.storageKey, label: f.label || '' };
}
