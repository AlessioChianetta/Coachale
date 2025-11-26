import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  maxUses: 100,
  allowExitOnIdle: true,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
};

export const pool = new Pool(poolConfig);

// Funzione di retry con exponential backoff
class DatabaseRetryError extends Error {
  constructor(message: string, public readonly isRetryable: boolean = true) {
    super(message);
    this.name = 'DatabaseRetryError';
  }
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  // Codici di errore PostgreSQL che beneficiano del retry
  const retryableCodes = [
    'XX000', // Internal error (Supabase disconnections)
    '57P01', // Admin shutdown
    '57P03', // Cannot connect now
    '08006', // Connection failure
    '53300', // Too many connections
    '53200', // Out of memory
    '53400', // Configuration limit exceeded
  ];
  
  // Messaggi di errore che indicano problemi temporanei
  const retryableMessages = [
    'db_termination',
    'connection timeout',
    'connection terminated',
    'server closed the connection',
    'connection reset',
    'network error',
    'econnreset',
    'etimedout',
    'socket hang up'
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code;
  
  // Controlla codici di errore
  if (retryableCodes.includes(errorCode)) {
    return true;
  }
  
  // Controlla messaggi di errore
  return retryableMessages.some(retryableMessage => 
    errorMessage.includes(retryableMessage.toLowerCase())
  );
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Wrapper per operazioni database con retry logic
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Se non è un errore che può essere riprovato, lancia subito
      if (!isRetryableError(error)) {
        console.error('Non-retryable database error:', error.message);
        throw error;
      }
      
      // Se è l'ultimo tentativo, lancia l'errore
      if (attempt === maxRetries) {
        console.error(`Database operation failed after ${maxRetries + 1} attempts:`, error.message);
        throw new DatabaseRetryError(
          `Database operation failed after ${maxRetries + 1} attempts: ${error.message}`,
          false
        );
      }
      
      // Calcola il delay con exponential backoff + jitter
      const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`Database error (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying in ${Math.round(delayMs)}ms...`);
      
      await delay(delayMs);
    }
  }
  
  throw lastError!;
}

// Database principale - mantiene compatibilità totale con il codice esistente
export const db = drizzle({ client: pool, schema });

// Helper functions con retry automatico per operazioni critiche
export const dbWithRetry = {
  // Query dirette con retry
  execute: (query: any) => withRetry(() => db.execute(query)),
  
  // Transazioni con retry
  transaction: <T>(fn: (tx: any) => Promise<T>): Promise<T> => 
    withRetry(() => db.transaction(fn)),

  // Select con retry
  selectWithRetry: (query: any) => withRetry(() => query),
  
  // Insert con retry
  insertWithRetry: (query: any) => withRetry(() => query),
  
  // Update con retry
  updateWithRetry: (query: any) => withRetry(() => query),
  
  // Delete con retry
  deleteWithRetry: (query: any) => withRetry(() => query)
};

// Alias per compatibilità
export const safeDb = dbWithRetry;

// Gestione graceful degli errori di connessione (sanitized logging)
pool.on('error', (err: any) => {
  console.error('Unexpected database pool error:', {
    code: err.code || 'unknown',
    message: err.message || 'unknown error',
    severity: err.severity || 'unknown'
  });
  // Non crashiamo l'app, loggiamo solo l'errore (senza esporre credenziali)
});

// Health check per il database
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await withRetry(async () => {
      const result = await pool.query('SELECT 1');
      return result;
    }, 2, 500); // Retry più veloce per health check
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Cleanup graceful delle connessioni
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});
