// File: server/loadEnv.cjs
// Questo file viene caricato PRIMA di tutto il resto tramite --require in package.json
// Usa require() perché questo file è CommonJS

const dotenv = require('dotenv');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 [loadEnv.cjs] Caricamento variabili da .env...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 🆕 FIX: Set REPLIT_DEV_DOMAIN for Vite HMR (dev mode only)
if (process.env.REPL_ID && !process.env.REPLIT_DEV_DOMAIN) {
  // In Replit dev environment, construct the domain from REPL_ID and Replit defaults
  // If REPLIT_DEV_DOMAIN is not set, we're likely in dev and need to prevent HMR errors
  // Setting a placeholder to make Vite HMR work (will connect via window.location.host in prod)
  if (process.env.NODE_ENV === 'development') {
    process.env.VITE_HMR_PROTOCOL = 'wss';
    process.env.VITE_HMR_HOST = '0.0.0.0';
    process.env.VITE_HMR_PORT = '443';
  }
}

// IMPORTANTE: override: true forza le variabili del .env a sovrascrivere
// quelle già presenti nell'ambiente (es. DATABASE_URL di Replit)
const result = dotenv.config({ override: true });

if (result.error) {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ [loadEnv.cjs] ERRORE CRITICO: Impossibile caricare .env');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Errore:', result.error.message);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
}

const parsed = result.parsed || {};
const varCount = Object.keys(parsed).length;

if (varCount === 0) {
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('⚠️  [loadEnv.cjs] ATTENZIONE: .env caricato ma è vuoto!');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
} else {
  console.log('✅ [loadEnv.cjs] File .env caricato con successo!');
  console.log(`   Variabili caricate: ${varCount}`);
}

// Log di verifica per le variabili critiche
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 [loadEnv.cjs] Verifica variabili chiave:');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? `Presente (lunghezza: ${process.env.DATABASE_URL.length})` : '❌ NON PRESENTE');
console.log('   ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? `Presente (lunghezza: ${process.env.ENCRYPTION_KEY.length})` : '❌ NON PRESENTE');
console.log('   SESSION_SECRET:', process.env.SESSION_SECRET ? `Presente (lunghezza: ${process.env.SESSION_SECRET.length})` : '❌ NON PRESENTE');

// Mostra un preview mascherato del DATABASE_URL per debug
if (process.env.DATABASE_URL) {
  const maskedUrl = process.env.DATABASE_URL.replace(/:(.*?)@/, ':***@');
  console.log('   DATABASE_URL preview:', maskedUrl);
  console.log('   Contiene "supabase.com"?', process.env.DATABASE_URL.includes('supabase.com') ? '✅ Sì' : '❌ No');
  console.log('   Contiene "helium"?', process.env.DATABASE_URL.includes('helium') ? '⚠️  Sì (database Replit!)' : '✅ No');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
