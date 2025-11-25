// server/db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg'; // Importa l'oggetto principale del modulo 'pg'
import * as schema from "@shared/schema";

// Accedi a Pool come proprietà dell'oggetto importato
const { Pool: PgPool } = pg; // Oppure semplicemente const Pool = pg.Pool;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database or load .env file?",
  );
}

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

export const pool = new PgPool(poolConfig); // Usa PgPool (o Pool se hai usato const Pool = pg.Pool)

pool.on('connect', () => {
  console.log('[DB] Nuova connessione al database (pg) stabilita dal pool.');
});

pool.on('error', (err, client) => {
  console.error('[DB] Errore idle client nel pool PostgreSQL (pg):', err.message, err.stack);
});

const enableDrizzleLogger = process.env.NODE_ENV === 'development';
console.log(`[DB] Drizzle logger (node-postgres) abilitato: ${enableDrizzleLogger}`);

export const db = drizzle(pool, { schema, logger: enableDrizzleLogger });

console.log('[DB] Istanza Drizzle (node-postgres) creata e configurata.');