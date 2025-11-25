// File: server/loadEnv.cjs

// Usa require() perché questo file è CommonJS
const dotenvOriginal = require('dotenv');

console.log('--- [server/loadEnv.cjs] Tentativo di caricare .env (MODO CommonJS) ---');
const envConfigResult = dotenvOriginal.config(); // Carica variabili dal file .env

if (envConfigResult.error) {
  console.error('#########################################################################');
  console.error('## [loadEnv.cjs] ERRORE CRITICO: Impossibile caricare il file .env     ##');
  console.error('#########################################################################');
  console.error('Errore dettagliato:', envConfigResult.error);
  // Potresti voler terminare il processo qui se le variabili sono cruciali
  // process.exit(1);
} else {
  if (Object.keys(envConfigResult.parsed || {}).length === 0) {
    console.warn('#########################################################################');
    console.warn('## [loadEnv.cjs] AVVISO: File .env caricato ma è VUOTO o non ha parsato nulla. ##');
    console.warn('#########################################################################');
  } else {
    console.log('#########################################################################');
    console.log('## [loadEnv.cjs] OK: File .env caricato correttamente.                 ##');
    console.log('#########################################################################');
  }
}

// Log di verifica per le variabili chiave (aggiungi/rimuovi secondo necessità)
console.log('--- [loadEnv.cjs] Variabili d\'ambiente DOPO dotenv.config() ---');
console.log('FINNHUB_API_KEY da loadEnv.cjs:', process.env.FINNHUB_API_KEY ? `Presente (lunghezza: ${process.env.FINNHUB_API_KEY.length})` : 'NON PRESENTE');
console.log('DATABASE_URL da loadEnv.cjs:', process.env.DATABASE_URL ? `Presente (lunghezza: ${process.env.DATABASE_URL.length})` : 'NON PRESENTE');
// Aggiungi qui altri console.log per le variabili che vuoi verificare
// console.log('SESSION_SECRET da loadEnv.cjs:', process.env.SESSION_SECRET ? 'Presente' : 'NON PRESENTE');
console.log('--------------------------------------------------------------------');