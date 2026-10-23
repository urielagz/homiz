import { env } from '../config/env.js';
import * as Maps from '../services/maps.service.js';
import { api, bearer, closeDatabase, EMAILS, login, resetDatabase } from './helpers.js';

/* Respuestas falsas de fetch: las pruebas nunca salen a internet. */
type Fake = { url?: string; status?: number; body?: unknown };
const calls: string[] = [];
function fakeFetch(route: (url: string, method: string) => Fake) {
  Maps.mapsDeps.fetch = async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const r = route(url, init?.method ?? 'GET');
    const status = r.status ?? 200;
    return { url: r.url ?? url, status, ok: status < 400, json: async () => r.body } as Response;
  };
}
const realFetch = Maps.mapsDeps.fetch;

beforeEach(() => {
  calls.length = 0;
  env.GOOGLE_MAPS_API_KEY = '';
});
afterAll(() => {
  Maps.mapsDeps.fetch = realFetch;
});

const PLACE = 'https://www.google.com/maps/place/Residencial+Arbolada,+Canc%C3%BAn/@21.08,-86.86,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d21.0868!4d-86.8532';

describe('lectura del enlace de Google Maps', () => {
  test('solo acepta enlaces de Google Maps', () => {
    expect(Maps.isGoogleMapsUrl('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(Maps.isGoogleMapsUrl('https://www.google.com/maps/place/x')).toBe(true);
    expect(Maps.isGoogleMapsUrl('https://maps.google.com.mx/?q=21,-86')).toBe(true);
    expect(Maps.isGoogleMapsUrl('https://www.google.com/search?q=casas')).toBe(false);
    expect(Maps.isGoogleMapsUrl('https://evil.com/maps/place/x')).toBe(false);
    expect(Maps.isGoogleMapsUrl('https://maps.google.com.evil.io/x')).toBe(false);
    expect(Maps.isGoogleMapsUrl('http://127.0.0.1/maps')).toBe(false);
    expect(Maps.isGoogleMapsUrl('file:///etc/passwd')).toBe(false);
  });

  test('completa el protocolo de los enlaces sin https', () => {
    expect(Maps.normalizeUrl(' maps.app.goo.gl/abc ')).toBe('https://maps.app.goo.gl/abc');
    expect(Maps.normalizeUrl('//www.google.com/maps')).toBe('https://www.google.com/maps');
  });

  test('prefiere el marcador del lugar (!3d!4d) al centro de la vista (@)', () => {
    expect(Maps.extractCoordinates(PLACE)).toEqual({ lat: 21.0868, lng: -86.8532 });
    expect(Maps.extractCoordinates('https://www.google.com/maps/@21.1,-86.85,14z')).toEqual({ lat: 21.1, lng: -86.85 });
    expect(Maps.extractCoordinates('https://maps.google.com/?q=21.16,-86.84')).toEqual({ lat: 21.16, lng: -86.84 });
    expect(Maps.extractCoordinates('https://www.google.com/maps/search/21.16,+-86.84')).toEqual({ lat: 21.16, lng: -86.84 });
    expect(Maps.extractCoordinates('https://www.google.com/maps/@95,-86.85,14z')).toBeNull(); // fuera de rango
  });

  test('extrae place_id y el nombre del lugar', () => {
    expect(Maps.extractPlaceId('https://www.google.com/maps/place/?q=place_id:ChIJ_abc-1')).toBe('ChIJ_abc-1');
    expect(Maps.extractPlaceText(PLACE)).toBe('Residencial Arbolada, Cancún');
    expect(Maps.extractPlaceText('https://maps.google.com/?q=21.16,-86.84')).toBeNull();
  });
});

describe('locateFromMapsUrl', () => {
  test('enlace corto: lo expande y usa las coordenadas; la dirección viene de Nominatim', async () => {
    fakeFetch((url) => (url.includes('goo.gl') ? { url: PLACE } : { body: { display_name: 'Arbolada, Cancún, Quintana Roo' } }));
    const r = await Maps.locateFromMapsUrl('https://maps.app.goo.gl/abc123');
    expect(r).toMatchObject({ lat: 21.0868, lng: -86.8532, address: 'Arbolada, Cancún, Quintana Roo', expandedUrl: PLACE });
    expect(calls[0]).toBe('HEAD https://maps.app.goo.gl/abc123');
    expect(calls.some((c) => c.includes('/reverse?'))).toBe(true);
  });

  test('si el enlace corto no lleva a Google Maps, se rechaza', async () => {
    fakeFetch(() => ({ url: 'https://evil.com/x' }));
    await expect(Maps.locateFromMapsUrl('https://maps.app.goo.gl/abc')).rejects.toMatchObject({ status: 422 });
  });

  test('si nadie responde la dirección, se guardan solo las coordenadas', async () => {
    fakeFetch(() => ({ status: 503 }));
    const r = await Maps.locateFromMapsUrl(PLACE);
    expect(r).toMatchObject({ lat: 21.0868, lng: -86.8532, address: null });
  });

  test('sin coordenadas busca el nombre del lugar en Nominatim', async () => {
    fakeFetch(() => ({ body: [{ lat: '21.1104', lon: '-86.7661', display_name: 'Isla Dorada, Cancún' }] }));
    const r = await Maps.locateFromMapsUrl('https://www.google.com/maps/search/Isla+Dorada+Canc%C3%BAn');
    expect(r).toMatchObject({ lat: 21.1104, lng: -86.7661, address: 'Isla Dorada, Cancún' });
    expect(calls[0]).toContain('/search?format=json');
  });

  test('con clave de Google usa place_id', async () => {
    env.GOOGLE_MAPS_API_KEY = 'clave-de-prueba';
    fakeFetch(() => ({ body: { status: 'OK', result: { formatted_address: 'Av. Huayacán, Cancún', geometry: { location: { lat: 21.1121, lng: -86.8502 } } } } }));
    const r = await Maps.locateFromMapsUrl('https://www.google.com/maps/place/?q=place_id:ChIJabc');
    expect(r).toMatchObject({ lat: 21.1121, lng: -86.8502, placeId: 'ChIJabc', address: 'Av. Huayacán, Cancún' });
    expect(calls[0]).toContain('maps.googleapis.com/maps/api/place/details');
  });

  test('una clave de ejemplo («tu_api_key») se ignora', async () => {
    env.GOOGLE_MAPS_API_KEY = 'TU_API_KEY';
    fakeFetch(() => ({ body: { display_name: 'Cancún' } }));
    await Maps.locateFromMapsUrl(PLACE);
    expect(calls.some((c) => c.includes('googleapis'))).toBe(false);
  });

  test('un enlace sin ubicación da un mensaje claro', async () => {
    fakeFetch(() => ({ body: {} }));
    await expect(Maps.locateFromMapsUrl('https://www.google.com/maps')).rejects.toMatchObject({ status: 422, code: 'MAPS_URL_INVALID' });
  });
});

describe('POST /properties/locate', () => {
  let mariana: string, laura: string;
  beforeAll(async () => {
    await resetDatabase();
    mariana = (await login(EMAILS.mariana)).accessToken;
    laura = (await login(EMAILS.laura)).accessToken;
  });
  afterAll(closeDatabase);

  test('broker: devuelve las coordenadas del enlace', async () => {
    fakeFetch(() => ({ body: { display_name: 'Arbolada, Cancún' } }));
    const res = await api().post('/api/v1/properties/locate').set(bearer(mariana)).send({ url: PLACE });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ lat: 21.0868, lng: -86.8532, address: 'Arbolada, Cancún' });
  });

  test('enlace que no es de Google Maps: 422', async () => {
    const res = await api().post('/api/v1/properties/locate').set(bearer(mariana)).send({ url: 'http://169.254.169.254/latest' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MAPS_URL_INVALID');
  });

  test('cliente: 403', async () => {
    const res = await api().post('/api/v1/properties/locate').set(bearer(laura)).send({ url: PLACE });
    expect(res.status).toBe(403);
  });

  test('el catálogo público ya trae lat y lng', async () => {
    const res = await api().get('/api/v1/public/properties');
    const ceiba = (res.body.data ?? res.body).find((p: { slug: string }) => p.slug === 'casa-ceiba');
    expect(ceiba).toHaveProperty('lat');
    expect(ceiba).toHaveProperty('lng');
  });
});
