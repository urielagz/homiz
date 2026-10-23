import { money } from './format';

/* Casa con los nombres de campos del sitio (los mismos que usaba main.js). */
export interface House {
  slug: string;
  code?: string;
  name: string;
  zona: string;
  zonaKey: string;
  mapa: string;
  lat?: number | null;
  lng?: number | null;
  op: 'renta' | 'venta';
  price: number;
  rec: number;
  banos: number;
  m2: number;
  terreno?: number;
  est: number;
  pets: boolean;
  amueblada: 'si' | 'semi' | 'no';
  tipo: 'casa' | 'casa-condominio' | 'townhouse';
  tipoTexto?: string;
  asesor: string;
  orden: number;
  img?: string;
  foto?: string;
  description?: string;
  address?: string;
  age?: number | null;
  maintenance?: string;
  amenities?: string[];
  photos?: { src: string; label: string }[];
  publishedAt?: string;
}

export const IMG = '/assets/img/';
export const WHATSAPP = '529985550142';

/* Catálogo de respaldo: se usa cuando la API no responde (mismas casas que el sitio original). */
export const FALLBACK_CATALOG: House[] = [
  { slug: 'casa-zapote', name: 'Casa Zapote', zona: 'Supermanzana 50', zonaKey: 'sm-50', mapa: 'Supermanzana 50, Cancún', op: 'renta', price: 24000, rec: 3, banos: 2, m2: 150, est: 1, pets: false, amueblada: 'no', tipo: 'casa', asesor: 'Valeria Cruz', orden: 9 },
  { slug: 'casa-ceiba', name: 'Casa Ceiba', zona: 'Arbolada', zonaKey: 'arbolada', mapa: 'Residencial Arbolada, Cancún', op: 'renta', price: 28000, rec: 3, banos: 2, m2: 180, est: 2, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Mariana Solís', orden: 12 },
  { slug: 'casa-chaka', name: 'Casa Chaká', zona: 'Residencial Palmaris', zonaKey: 'palmaris', mapa: 'Residencial Palmaris, Cancún', op: 'renta', price: 32000, rec: 3, banos: 3, m2: 205, est: 2, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Mariana Solís', orden: 8 },
  { slug: 'casa-nativa', name: 'Casa Nativa', zona: 'Aqua Residencial', zonaKey: 'aqua', mapa: 'Residencial Aqua, Cancún', op: 'renta', price: 35000, rec: 3, banos: 3, m2: 215, est: 2, pets: true, amueblada: 'si', tipo: 'casa-condominio', asesor: 'Mariana Solís', orden: 10 },
  { slug: 'casa-ramon', name: 'Casa Ramón', zona: 'Residencial Cumbres', zonaKey: 'cumbres', mapa: 'Residencial Cumbres, Cancún', op: 'renta', price: 36500, rec: 3, banos: 3.5, m2: 240, est: 2, pets: true, amueblada: 'semi', tipo: 'casa', asesor: 'Diego Herrera', orden: 7 },
  { slug: 'casa-huano', name: 'Casa Huano', zona: 'Lagos del Sol', zonaKey: 'lagos-del-sol', mapa: 'Lagos del Sol, Cancún', op: 'renta', price: 38000, rec: 3, banos: 3.5, m2: 265, est: 3, pets: false, amueblada: 'no', tipo: 'casa', asesor: 'Diego Herrera', orden: 6 },
  { slug: 'casa-olivo', name: 'Casa Olivo', zona: 'Santa Fe', zonaKey: 'santa-fe', mapa: 'Fraccionamiento Santa Fe, Cancún', op: 'renta', price: 22500, rec: 2, banos: 2, m2: 135, est: 1, pets: false, amueblada: 'semi', tipo: 'casa', asesor: 'Valeria Cruz', orden: 5 },
  { slug: 'casa-del-patio', name: 'Casa del Patio', zona: 'Residencial Cumbres', zonaKey: 'cumbres', mapa: 'Residencial Cumbres, Cancún', op: 'venta', price: 4850000, rec: 3, banos: 3, m2: 240, est: 2, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Diego Herrera', orden: 11 },
  { slug: 'casa-de-la-luz', name: 'Casa de la Luz', zona: 'Lagos del Sol', zonaKey: 'lagos-del-sol', mapa: 'Lagos del Sol, Cancún', op: 'venta', price: 6200000, rec: 4, banos: 4, m2: 310, est: 3, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Diego Herrera', orden: 4 },
  { slug: 'casa-almendra', name: 'Casa Almendra', zona: 'Jardines del Sur', zonaKey: 'jardines-del-sur', mapa: 'Jardines del Sur, Cancún', op: 'venta', price: 3450000, rec: 3, banos: 2, m2: 165, est: 2, pets: false, amueblada: 'no', tipo: 'casa', asesor: 'Valeria Cruz', orden: 3 },
  { slug: 'casa-kanan', name: 'Casa Kanán', zona: 'Residencial Arbolada', zonaKey: 'arbolada', mapa: 'Residencial Arbolada, Cancún', op: 'venta', price: 4150000, rec: 3, banos: 3, m2: 190, est: 2, pets: true, amueblada: 'no', tipo: 'casa', asesor: 'Mariana Solís', orden: 2 },
  { slug: 'casa-huayacan', img: 'huayacan-01', name: 'Casa con jardín en Huayacán', zona: 'Huayacán', zonaKey: 'huayacan', mapa: 'Avenida Huayacán, Cancún', op: 'venta', price: 3900000, rec: 3, banos: 3, m2: 140, est: 2, pets: true, amueblada: 'no', tipo: 'casa-condominio', asesor: 'Mariana Solís', orden: 13 },
];

export const photoOf = (c: House) => c.foto || IMG + (c.img || c.slug) + '.jpg';
export const fichaOf = (c: Pick<House, 'slug'>) => '/propiedad/' + encodeURIComponent(c.slug);
export const shortPrice = (c: House) => (c.op === 'renta' ? money(c.price) : '$' + (c.price / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' M');
export const priceUnit = (c: House) => (c.op === 'renta' ? 'MXN / mes' : 'MXN');
