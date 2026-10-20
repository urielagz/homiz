/* Ejecuta scripts SQL en orden: npm run db:setup (esquema + datos de ejemplo). */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './database.js';

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Uso: tsx src/config/run-sql.ts db/001_schema.sql [db/002_seed.sql ...]');
    process.exit(1);
  }
  for (const file of files) {
    const sql = await readFile(path.resolve(file), 'utf8');
    process.stdout.write(`Ejecutando ${file}... `);
    await pool.query(sql);
    console.log('listo');
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error('\nError al ejecutar SQL:', err.message);
  await pool.end();
  process.exit(1);
});
