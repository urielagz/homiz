/*
 * Ejecuta scripts SQL en orden: npm run db:setup
 * Sin argumentos ejecuta todos los archivos .sql de db/ por nombre (001_schema, 002_seed, 003_..., ...).
 * También acepta archivos específicos: tsx src/config/run-sql.ts db/003_fase2.sql
 * Solo necesita DATABASE_URL (no exige el resto de la configuración del servidor).
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

async function sqlFiles(dir = 'db'): Promise<string[]> {
  const names = (await readdir(dir)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  return names.map((n) => path.join(dir, n));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const args = process.argv.slice(2);
    for (const file of args.length ? args : await sqlFiles()) {
      process.stdout.write(`Ejecutando ${file}... `);
      await client.query(await readFile(path.resolve(file), 'utf8'));
      console.log('listo');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nError al ejecutar SQL:', err.message);
  process.exit(1);
});
