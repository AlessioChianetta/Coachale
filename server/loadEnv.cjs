// File: server/loadEnv.cjs
// Questo file viene caricato PRIMA di tutto il resto tramite --require in package.json
// Usa require() perché questo file è CommonJS

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 [loadEnv.cjs] Caricamento variabili da .env...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const envPath = path.resolve(process.cwd(), '.env');
const envExists = fs.existsSync(envPath);

let result = { parsed: {} };

if (envExists) {
  result = dotenv.config({ override: true });
  
  if (result.error) {
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('⚠️  [loadEnv.cjs] Avviso: Impossibile caricare .env');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('Errore:', result.error.message);
    console.warn('Usando variabili di ambiente esistenti...');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
} else {
  console.log('ℹ️  [loadEnv.cjs] File .env non trovato, usando variabili di ambiente esistenti (Replit secrets)');
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
