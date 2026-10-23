import { IMG, type House } from './catalog';

/* ==========================================================================
   Conexión con la API de Homiz.
   Por omisión la API está en el puerto 3000 del mismo servidor que sirve el sitio:
   localhost:5500 → localhost:3000 · 192.168.1.68:5500 → 192.168.1.68:3000 ·
   VS Code https://abc-5500.usw2.devtunnels.ms → https://abc-3000.usw2.devtunnels.ms
   Otro servidor: VITE_API_URL en .env (vacío = sin API, todo simulado).
   ========================================================================== */
function defaultApiUrl(): string {
  const host = location.hostname;
  if (/^[a-z0-9]+-\d+\./i.test(host) && /\.devtunnels\.ms$/i.test(host)) return `${location.protocol}//${host.replace(/-\d+\./, '-3000.')}/api/v1`;
  return `${location.protocol}//${host}:3000/api/v1`;
}
const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
export const API_URL: string = fromEnv !== undefined ? fromEnv : defaultApiUrl();

/** Si la API no contesta en este tiempo, se usa el modo sin servidor. */
const WAIT_MS = 8000;

export interface ApiError {
  status?: number;
  codigo?: string;
  mensaje?: string;
  detalles?: unknown;
  sinConexion?: boolean;
}

/** fetch con tiempo límite; rechaza con { sinConexion: true } si no hay respuesta. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw { sinConexion: true } satisfies ApiError;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WAIT_MS);
  let res: Response;
  try {
    res = await fetch(API_URL + path, { ...init, headers: { Accept: 'application/json', ...(init.headers || {}) }, signal: ctrl.signal });
  } catch {
    throw { sinConexion: true } satisfies ApiError;
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as T;
  const err = body?.error ?? {};
  throw { status: res.status, codigo: err.code, mensaje: err.message, detalles: err.details } satisfies ApiError;
}

/* ---------- Catálogo público → formato del sitio ---------- */
const TYPES: Record<string, House['tipo']> = { 'Casa en condominio': 'casa-condominio', Townhouse: 'townhouse' };
const FURNISHED: Record<string, House['amueblada']> = { Amueblada: 'si', Semiamueblada: 'semi' };
const isUrl = (src: string) => /^(https?:|data:|blob:)/.test(src || '');

// La API devuelve JSON sin tipar; aquí se convierte al formato del sitio.
export function toHouse(p: any): House {
  const cover: string = p.photos?.[0]?.src ?? '';
  return {
    slug: p.slug,
    code: p.code,
    name: p.name,
    zona: p.zona,
    zonaKey: p.zonaKey,
    mapa: String(p.mapa || p.zona + ', Cancún').replace(/,\s*Quintana Roo\s*$/i, ''),
    lat: p.lat == null ? null : Number(p.lat),
    lng: p.lng == null ? null : Number(p.lng),
    op: p.op,
    price: Number(p.price),
    rec: Number(p.rec),
    banos: Number(p.banos),
    m2: Number(p.m2) || 0,
    est: Number(p.est) || 0,
    pets: !!p.pets,
    amueblada: FURNISHED[p.furnished] || 'no',
    tipo: TYPES[p.tipo] || 'casa',
    tipoTexto: p.tipo,
    asesor: p.asesor || '',
    orden: p.publishedAt ? Date.parse(p.publishedAt) / 864e5 : 0,
    img: cover && !isUrl(cover) ? cover.replace(/\.[a-z]+$/i, '') : undefined,
    foto: cover && isUrl(cover) ? cover : undefined,
    description: p.description || '',
    address: p.address || '',
    terreno: Number(p.terreno) || 0,
    age: p.age,
    maintenance: p.maintenance || '',
    amenities: p.amenities || [],
    photos: (p.photos || []).map((f: { src: string; label?: string }) => ({ src: isUrl(f.src) ? f.src : IMG + f.src, label: f.label || '' })),
    publishedAt: p.publishedAt || '',
  };
}

export async function fetchCatalog(): Promise<House[]> {
  const r = await request<{ data?: unknown[] }>('/public/properties?porPagina=50&orden=recientes');
  return (r.data || []).map(toHouse);
}

export async function fetchHouse(slug: string): Promise<House> {
  return toHouse(await request('/public/properties/' + encodeURIComponent(slug)));
}

/* ---------- Solicitudes del sitio (POST /public/leads) ---------- */
export type LeadReason = 'visita' | 'rentar' | 'comprar' | 'publicar' | 'otro';

export interface LeadInput {
  reason: LeadReason;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  propertySlug?: string;
  propertyCode?: string;
  preferredDate?: string;
  preferredTime?: string;
  /** Resto de respuestas del formulario (ocupación, presupuesto, mascotas…) */
  payload: Record<string, string>;
}

export async function sendLead(input: LeadInput): Promise<{ folio: string; cita: string | null }> {
  const body: Record<string, unknown> = {
    reason: input.reason,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    message: input.message || null,
    payload: Object.fromEntries(
      Object.entries(input.payload).filter(([, v]) => v && v.trim()).map(([k, v]) => [k.slice(0, 40), v.trim().slice(0, 500)]),
    ),
  };
  if (input.propertyCode) body.propertyCode = input.propertyCode;
  else if (input.propertySlug && input.reason !== 'publicar' && input.reason !== 'otro') body.propertySlug = input.propertySlug;
  if (input.reason === 'visita' && input.preferredDate) body.preferredDate = input.preferredDate;
  if (input.reason === 'visita' && input.preferredTime) body.preferredTime = input.preferredTime;
  const r = await request<{ folio: string; appointmentCode?: string }>('/public/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { folio: r.folio, cita: r.appointmentCode || null };
}
