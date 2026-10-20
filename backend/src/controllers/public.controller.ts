import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as Properties from '../models/property.model.js';
import * as Svc from '../services/property.service.js';
import { createLead } from '../services/lead.service.js';
import { AppError } from '../middlewares/error-handler.js';
import { emailField, nameField, paged } from '../middlewares/validate.js';

/* Parámetros con los mismos nombres que el listado del sitio (web/paginas/propiedades.html). */
export const catalogQueryDto = z.object({
  operacion: z.enum(['renta', 'venta']).optional(),
  tipo: z.enum(['casa', 'casa-condominio', 'townhouse']).optional(),
  zona: z.string().max(60).optional(),
  precio_max: z.string().regex(/^(\d+|mas)$/).optional(),
  presupuesto: z.string().regex(/^(\d+|mas)$/).optional(),
  recamaras: z.coerce.number().int().min(1).max(10).optional(),
  banos: z.coerce.number().min(1).max(10).optional(),
  estacionamientos: z.coerce.number().int().min(1).max(10).optional(),
  superficie: z.coerce.number().min(1).optional(),
  mascotas: z.enum(['si']).optional(),
  amueblada: z.enum(['si', 'semi', 'no']).optional(),
  orden: z.enum(['precio-asc', 'precio-desc', 'recientes']).default('precio-asc'),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(6),
});

const FURNISHED = { si: 'Amueblada', semi: 'Semiamueblada', no: 'Sin amueblar' } as const;
const TYPES = { casa: ['Casa', 'Casa en condominio'], 'casa-condominio': ['Casa en condominio'], townhouse: ['Townhouse'] } as const;

/** GET /public/properties — catálogo publicado, sin datos de contacto del broker. */
export const catalog: RequestHandler = async (_req, res) => {
  const q = res.locals.query as z.infer<typeof catalogQueryDto>;
  const price = q.precio_max ?? q.presupuesto;
  const filters: Properties.PropertyFilters = {
    visibility: ['publicada'],
    status: ['disponible', 'reservada'],
    operation: q.operacion,
    types: q.tipo ? [...TYPES[q.tipo]] : undefined,
    zoneKey: q.zona,
    banosMin: q.banos,
    estMin: q.estacionamientos,
    m2Min: q.superficie,
    pets: q.mascotas ? true : undefined,
    furnished: q.amueblada ? FURNISHED[q.amueblada] : undefined,
    sort: q.orden === 'precio-desc' ? 'price_desc' : q.orden === 'recientes' ? 'recent' : 'price_asc',
    page: q.pagina,
    limit: q.porPagina,
  };
  // En el sitio, «4» recámaras significa «4 o más».
  if (q.recamaras !== undefined) Object.assign(filters, q.recamaras >= 4 ? { recMin: 4 } : { recExact: q.recamaras });
  if (price === 'mas') Object.assign(filters, { priceMin: 5_000_001, operation: 'venta' });
  else if (price) {
    const n = Number(price);
    // Los rangos de millones son de venta; los demás, rentas mensuales (igual que el sitio).
    Object.assign(filters, { priceMax: n, operation: q.operacion ?? (n >= 1_000_000 ? 'venta' : 'renta') });
  }
  const { rows, total } = await Properties.list(filters);
  const extras = await Svc.loadExtras(rows);
  const data = await Promise.all(rows.map((r) => Svc.presentPublic(r, extras.amenities(r.id), extras.photos(r.id))));
  res.json(paged(data, total, { page: q.pagina, limit: q.porPagina }));
};

/** GET /public/properties/:slug — ficha pública. */
export const bySlug: RequestHandler = async (req, res) => {
  const slug = String(req.params.slug ?? '');
  const row = /^[a-z0-9-]{2,80}$/.test(slug) ? await Properties.findBySlug(slug) : null;
  if (!row || row.visibility !== 'publicada') throw new AppError(404, 'NOT_FOUND', 'Esta casa ya no está publicada.');
  const extras = await Svc.loadExtras([row]);
  res.json(await Svc.presentPublic(row, extras.amenities(row.id), extras.photos(row.id)));
};

const textField = (max: number) => z.string().trim().max(max);
export const leadDto = z
  .object({
    reason: z.enum(['visita', 'rentar', 'comprar', 'publicar', 'otro'], { error: 'Indica el motivo de tu solicitud.' }),
    name: nameField,
    email: emailField,
    phone: textField(30).optional().nullable(),
    message: textField(2000).optional().nullable(),
    propertySlug: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
    propertyCode: z.string().regex(/^[A-Z]{3}-[A-Z0-9-]{2,12}$/).optional(),
    preferredDate: z.iso.date({ error: 'Usa el formato AAAA-MM-DD.' }).optional(),
    preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa la hora en formato HH:MM.').optional(),
    payload: z.record(z.string().max(40), z.union([z.string().max(500), z.number(), z.boolean()])).optional(),
  })
  .refine((v) => !v.preferredDate || v.preferredDate >= new Date().toISOString().slice(0, 10), {
    message: 'Elige una fecha a partir de hoy.',
    path: ['preferredDate'],
  });

/** POST /public/leads — formularios del sitio. Devuelve el folio real. */
export const postLead: RequestHandler = async (_req, res) => {
  const result = await createLead(res.locals.body as z.infer<typeof leadDto>);
  res.status(201).json({ ...result, message: 'Recibimos tu solicitud. Te responderemos en un día hábil.' });
};
