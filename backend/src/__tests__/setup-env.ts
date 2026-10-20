/* Configuración de entorno para las pruebas: se ejecuta antes de importar la app. */
import 'dotenv/config';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error('Define TEST_DATABASE_URL (base dedicada para pruebas; se borra en cada corrida).');
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === testUrl) {
  throw new Error('TEST_DATABASE_URL no puede ser la misma base que DATABASE_URL: las pruebas la borran.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testUrl;
process.env.JWT_ACCESS_SECRET ||= 'prueba-secreto-de-acceso-con-mas-de-32-caracteres';
process.env.JWT_REFRESH_SECRET ||= 'prueba-secreto-de-refresh-con-mas-de-32-caracteres';
process.env.RATE_LIMIT_MAX = '10000';
process.env.RATE_LIMIT_LOGIN_MAX = '10000';
