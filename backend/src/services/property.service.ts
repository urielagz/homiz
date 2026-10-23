import { pool, withTransaction } from '../config/database.js';
import { createDownloadUrl, fileSize, keyBelongsTo } from '../config/storage.js';
import { AppError } from '../middlewares/error-handler.js';
import type { AuthUser } from '../middlewares/authenticate.js';
import * as Properties from '../models/property.model.js';
import { insertActivity } from '../models/activity.model.js';
import { isAdmin, assertPropertyAccess } from './access.service.js';
import { nextCode, slugify, uniqueSlug } from './codes.service.js';
import { notify, userOfClient } from './notification.service.js';

/* ---------- Presentación ---------- */

/** Las fotos del sitio (sin carpeta, p. ej. "casa-ceiba.jpg") viven en web/assets/img; las subidas, en el almacenamiento. */
async function photoUrl(key: string): Promise<string | null> {
  if (!key.includes('/')) return null;
  const mime = key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return (await createDownloadUrl(key, mime, key.split('/').pop()!)).url;
}

async function presentPhotos(photos: Properties.PhotoRow[]) {
  return Promise.all(photos.map(async (p) => ({ id: p.id, key: p.storage_key, label: p.label, position: p.position, url: await photoUrl(p.storage_key) })));
}

export async function present(row: Properties.PropertyRow, amenities: string[], photos: Properties.PhotoRow[], user: AuthUser) {
  const base = {
    id: row.id,
    code: row.code,
    slug: row.slug,
    name: row.name,
    type: row.type,
    description: row.description,
    operation: row.operation,
    price: row.price,
    rec: row.rec,
    banos: row.banos,
    m2: row.m2,
    terreno: row.terreno,
    est: row.est,
    age: row.age,
    furnished: row.furnished,
    petsAllowed: row.pets_allowed,
    maintenance: row.maintenance,
    deposit: row.deposit,
    availableFrom: row.available_from,
    address: row.address,
    street: row.street,
    city: row.city,
    zone: row.zone,
    zoneKey: row.zone_key,
    mapQuery: row.map_query,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    visibility: row.visibility,
    publishedAt: row.published_at,
    amenities,
    photos: await presentPhotos(photos),
  };
  if (user.type !== 'staff') return base; // al cliente nunca se le envía el broker
  return {
    ...base,
    broker: row.broker_id ? { id: row.broker_id, name: row.broker_name, phone: row.broker_phone, email: row.broker_email } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const approx = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 1000);

/** Formato del catálogo público (mismos nombres que usa el sitio en assets/js/main.js). */
export async function presentPublic(row: Properties.PropertyRow, amenities: string[], photos: Properties.PhotoRow[]) {
  return {
    slug: row.slug,
    code: row.code,
    name: row.name,
    tipo: row.type,
    description: row.description,
    op: row.operation,
    price: row.price,
    rec: row.rec,
    banos: row.banos,
    m2: row.m2,
    terreno: row.terreno,
    est: row.est,
    age: row.age,
    pets: row.pets_allowed,
    furnished: row.furnished,
    maintenance: row.maintenance,
    zona: row.zone,
    zonaKey: row.zone_key,
    mapa: row.map_query,
    // Ubicación aproximada (3 decimales ≈ 100 m): el sitio público no revela la dirección exacta.
    lat: approx(row.lat),
    lng: approx(row.lng),
    address: row.address,
    status: row.status,
    publishedAt: row.published_at,
    amenities,
    photos: await Promise.all(photos.map(async (p) => ({ src: (await photoUrl(p.storage_key)) ?? p.storage_key, label: p.label }))),
    // El sitio muestra «Te acompaña: …» en la solicitud de visita: solo el nombre, sin datos de contacto.
    asesor: row.broker_name,
  };
}

export async function loadExtras(rows: Properties.PropertyRow[]) {
  const ids = rows.map((r) => r.id);
  const [amenities, photos] = await Promise.all([Properties.amenitiesFor(ids), Properties.photosFor(ids)]);
  return { amenities: (id: string) => amenities.get(id) ?? [], photos: (id: string) => photos.get(id) ?? [] };
}

/* ---------- Reglas de negocio ---------- */

async function assertBroker(brokerId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1 AND u.active AND r.code = 'broker'`,
    [brokerId],
  );
  if (!rows.length) throw new AppError(400, 'INVALID_BROKER', 'El responsable debe ser un broker activo.');
}

async function validatePhotoKeys(code: string, propertyId: string, photos: { storageKey: string }[]): Promise<void> {
  const current = new Set((await Properties.photosFor([propertyId])).get(propertyId)?.map((p) => p.storage_key) ?? []);
  for (const p of photos) {
    if (current.has(p.storageKey)) continue;
    if (!keyBelongsTo(p.storageKey, code, 'property_photo') || (await fileSize(p.storageKey)) === null) {
      throw new AppError(400, 'INVALID_FILE', 'Una de las fotos no se subió correctamente. Vuelve a subirla.', { storageKey: p.storageKey });
    }
  }
}

type CreateInput = Properties.PropertyWrite & {
  name: string;
  operation: 'renta' | 'venta';
  price: number;
  zone: string;
  amenities?: string[];
  brokerId?: string;
};

/** Alta: un broker queda asignado a la casa que registra; el administrador puede elegir el broker. */
export async function create(user: AuthUser, data: CreateInput): Promise<string> {
  let brokerId: string | null = user.id;
  if (isAdmin(user) && data.brokerId) brokerId = data.brokerId;
  else if (!user.roles.includes('broker')) brokerId = data.brokerId ?? null;
  if (brokerId) await assertBroker(brokerId);

  return withTransaction(async (db) => {
    const code = await nextCode(db, 'properties', 'ZUG');
    const slug = await uniqueSlug(db, data.name);
    const zoneKey = data.zoneKey ?? slugify(data.zone);
    const id = await Properties.insert(db, { ...data, zoneKey, code, slug, brokerId, status: 'borrador', visibility: 'borrador' });
    if (data.amenities) await Properties.replaceAmenities(db, id, data.amenities);
    await insertActivity({ userId: user.id, propertyId: id, entity: 'property', entityId: id, action: 'create', description: `${user.name} registró ${data.name} (${code}).`, newValues: data }, db);
    return id;
  });
}

export async function update(
  user: AuthUser,
  id: string,
  data: Properties.PropertyWrite & { amenities?: string[]; photos?: { storageKey: string; label: string }[] },
): Promise<void> {
  await assertPropertyAccess(user, id);
  const before = await Properties.findById(id);
  if (!before) throw new AppError(404, 'NOT_FOUND', 'La propiedad no existe.');
  if (data.photos) await validatePhotoKeys(before.code, id, data.photos);
  await withTransaction(async (db) => {
    const slug = data.name && data.name !== before.name ? await uniqueSlug(db, data.name, id) : undefined;
    await Properties.update(db, id, { ...data, slug });
    if (data.amenities) await Properties.replaceAmenities(db, id, data.amenities);
    if (data.photos) await Properties.replacePhotos(db, id, data.photos);
    if (data.photos && !data.photos.length && before.visibility === 'publicada') {
      await db.query(`UPDATE properties SET visibility = 'pausada' WHERE id = $1`, [id]);
    }
    await insertActivity({ userId: user.id, propertyId: id, entity: 'property', entityId: id, action: 'update', description: `${user.name} actualizó la información de ${data.name ?? before.name}.`, newValues: data }, db);
  });
}

export async function setAvailability(user: AuthUser, id: string, data: { status?: Properties.PropertyRow['status']; visibility?: Properties.PropertyRow['visibility'] }): Promise<void> {
  await assertPropertyAccess(user, id);
  const p = await Properties.findById(id);
  if (!p) throw new AppError(404, 'NOT_FOUND', 'La propiedad no existe.');
  const status = data.status ?? p.status;
  const visibility = data.visibility ?? p.visibility;
  if (visibility === 'publicada' && status === 'borrador') {
    throw new AppError(409, 'CANNOT_PUBLISH_DRAFT', 'Una casa en borrador no puede publicarse. Cambia primero su estado.');
  }
  if (visibility === 'publicada' && (await Properties.photoCount(id)) === 0) {
    throw new AppError(409, 'PHOTOS_REQUIRED', 'Agrega al menos una fotografía antes de publicar la casa.');
  }
  await pool.query(
    `UPDATE properties SET status = $2::property_status, visibility = $3::property_visibility, updated_at = now(),
            published_at = CASE WHEN $3::text = 'publicada' AND published_at IS NULL THEN CURRENT_DATE ELSE published_at END
      WHERE id = $1`,
    [id, status, visibility],
  );
  await insertActivity({
    userId: user.id, propertyId: id, entity: 'property', entityId: id, action: 'availability',
    description: `${user.name} cambió ${p.name} a ${status} · ${visibility}.`,
    oldValues: { status: p.status, visibility: p.visibility }, newValues: { status, visibility },
  });
}

/** Reasigna el broker y sus citas próximas (regla del panel). Solo administrador (properties.reassign). */
export async function reassignBroker(user: AuthUser, id: string, brokerId: string): Promise<number> {
  const p = await Properties.findById(id);
  if (!p) throw new AppError(404, 'NOT_FOUND', 'La propiedad no existe.');
  await assertBroker(brokerId);
  if (p.broker_id === brokerId) return 0;
  try {
    return await withTransaction(async (db) => {
      await db.query('UPDATE properties SET broker_id = $2, updated_at = now() WHERE id = $1', [id, brokerId]);
      const moved = await db.query(
        `UPDATE appointments SET broker_id = $2
          WHERE property_id = $1 AND status IN ('por-confirmar', 'confirmada') AND scheduled_at > now()`,
        [id, brokerId],
      );
      const { rows } = await db.query<{ name: string }>('SELECT name FROM users WHERE id = $1', [brokerId]);
      await insertActivity({
        userId: user.id, propertyId: id, entity: 'property', entityId: id, action: 'reassign_broker',
        description: `${user.name} asignó ${p.name} a ${rows[0].name}${moved.rowCount ? ` y se reasignaron ${moved.rowCount} citas` : ''}.`,
        oldValues: { brokerId: p.broker_id }, newValues: { brokerId },
      }, db);
      await notify([brokerId], { type: 'property_assigned', title: 'Nueva casa asignada', message: `Ahora eres responsable de ${p.name} (${p.code}).`, entity: 'property', entityId: id }, db);
      return moved.rowCount ?? 0;
    });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new AppError(409, 'SCHEDULE_CONFLICT', 'El nuevo broker ya tiene una cita a la misma hora que una de esta casa. Reprograma esa cita primero.');
    }
    throw err;
  }
}

/** Baja lógica. Cancela sus citas próximas (quedan en historial) y avisa a los clientes. */
export async function remove(user: AuthUser, id: string): Promise<number> {
  await assertPropertyAccess(user, id);
  const p = await Properties.findById(id);
  if (!p) throw new AppError(404, 'NOT_FOUND', 'La propiedad no existe.');
  const { rowCount: contracts } = await pool.query(`SELECT 1 FROM contracts WHERE property_id = $1 AND status = 'active'`, [id]);
  if (contracts) throw new AppError(409, 'HAS_ACTIVE_CONTRACT', 'La casa tiene un contrato vigente. Finalízalo antes de darla de baja.');

  return withTransaction(async (db) => {
    await db.query(`UPDATE properties SET active = FALSE, visibility = 'pausada', updated_at = now() WHERE id = $1`, [id]);
    const { rows } = await db.query<{ id: string; client_id: string; scheduled_at: Date }>(
      `UPDATE appointments SET status = 'cancelada', reason = 'La propiedad se retiró del inventario.'
        WHERE property_id = $1 AND status IN ('por-confirmar', 'confirmada') AND scheduled_at > now()
        RETURNING id, client_id, scheduled_at`,
      [id],
    );
    for (const a of rows) {
      await notify([await userOfClient(a.client_id, db)], {
        type: 'appointment_cancelled', title: 'Cita cancelada', message: `Tu cita en ${p.name} se canceló porque la casa ya no está disponible.`,
        entity: 'appointment', entityId: a.id,
      }, db);
    }
    await insertActivity({
      userId: user.id, propertyId: id, entity: 'property', entityId: id, action: 'delete',
      description: `${user.name} dio de baja ${p.name} (${p.code})${rows.length ? ` y se cancelaron ${rows.length} citas` : ''}.`,
    }, db);
    return rows.length;
  });
}
