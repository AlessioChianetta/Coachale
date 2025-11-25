import crypto from 'crypto';

// Encryption utility for sensitive data (Vertex AI credentials, etc.)
// Uses AES-256-GCM for authenticated encryption

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get master encryption key - HARDCODED for simplicity with fallback support
 * Generated with: openssl rand -hex 32
 * NOTE: This key is hardcoded in the source code instead of environment variables
 * for easier deployment and to avoid dependency on Replit Secrets.
 * Keep this project private to maintain security.
 */
function getMasterEncryptionKey(): string {
  // HARDCODED ENCRYPTION KEY - Generated with openssl rand -hex 32
  const HARDCODED_KEY = "69b2b2390d8e1c028a61c6dc928085dcb2ee3558d2625dedf58769043530995a";
  
  // Validation (keep for safety)
  if (!HARDCODED_KEY || HARDCODED_KEY.length < 32) {
    throw new Error('CRITICAL: Hardcoded encryption key is invalid');
  }
  
  return HARDCODED_KEY;
}

/**
 * Get legacy encryption key from environment (for migration/fallback)
 * Returns null if not set
 */
function getLegacyEncryptionKey(): string | null {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey.length < 32) {
    return null;
  }
  return envKey;
}

/**
 * Generate a random encryption salt for a new consultant
 * This salt is stored in the database and used to derive the consultant's unique encryption key
 */
export function generateEncryptionSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Derive a key from the master key using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Derive a consultant-specific encryption key from master key + consultant salt
 * This creates a unique encryption key for each consultant
 * @param consultantSalt - Unique salt for the consultant (stored in database)
 * @returns Derived encryption key for this consultant
 */
export function deriveConsultantKey(consultantSalt: string): Buffer {
  const masterKey = getMasterEncryptionKey();
  const salt = Buffer.from(consultantSalt, 'hex');
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt sensitive data using consultant-specific key
 * @param plaintext - The data to encrypt
 * @param consultantSalt - Unique salt for the consultant
 * @returns Encrypted data as string (iv:encrypted:tag)
 */
export function encryptForConsultant(plaintext: string, consultantSalt: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty data');
  }
  
  if (!consultantSalt) {
    throw new Error('Consultant salt is required for encryption');
  }

  const key = deriveConsultantKey(consultantSalt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Format: iv:encrypted:tag (all in hex)
  // Note: We don't need to store consultantSalt here, it's in the database
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Encrypt sensitive data (e.g., Vertex AI service account JSON)
 * @deprecated Use encryptForConsultant instead for consultant-specific encryption
 * @param plaintext - The data to encrypt
 * @returns Encrypted data as base64 string (salt:iv:encrypted:tag)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty data');
  }

  const masterKey = getMasterEncryptionKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(masterKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Format: salt:iv:encrypted:tag (all in hex)
  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Decrypt sensitive data using consultant-specific key
 * @param encryptedData - Encrypted data in format iv:encrypted:tag
 * @param consultantSalt - Unique salt for the consultant
 * @returns Decrypted plaintext string
 */
export function decryptForConsultant(encryptedData: string, consultantSalt: string): string {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty data');
  }
  
  if (!consultantSalt) {
    throw new Error('Consultant salt is required for decryption');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format (expected iv:encrypted:tag)');
  }

  const [ivHex, encrypted, tagHex] = parts;
  
  const key = deriveConsultantKey(consultantSalt);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Decrypt sensitive data with automatic fallback to legacy key
 * @deprecated Use decryptForConsultant instead for consultant-specific decryption
 * @param encryptedData - Encrypted data in format salt:iv:encrypted:tag
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty data');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [saltHex, ivHex, encrypted, tagHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  // Try with new hardcoded key first
  try {
    const masterKey = getMasterEncryptionKey();
    const key = deriveKey(masterKey, salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (newKeyError: any) {
    // If decryption with new key fails, try with legacy key (for migration)
    const legacyKey = getLegacyEncryptionKey();
    
    if (!legacyKey) {
      // No legacy key available, re-throw original error
      throw newKeyError;
    }
    
    try {
      console.log('⚠️ Decryption with new key failed, attempting with legacy key (migration)...');
      const key = deriveKey(legacyKey, salt);
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('✅ Successfully decrypted with legacy key - please re-save this configuration to migrate to new key');
      return decrypted;
    } catch (legacyKeyError: any) {
      // Both keys failed
      throw new Error(`Decryption failed with both new and legacy keys. Original error: ${newKeyError.message}`);
    }
  }
}

/**
 * Encrypt JSON object using consultant-specific key
 * @param jsonData - Object to encrypt
 * @param consultantSalt - Unique salt for the consultant
 * @returns Encrypted string
 */
export function encryptJSONForConsultant(jsonData: object, consultantSalt: string): string {
  const jsonString = JSON.stringify(jsonData);
  return encryptForConsultant(jsonString, consultantSalt);
}

/**
 * Decrypt JSON object using consultant-specific key
 * @param encryptedData - Encrypted string
 * @param consultantSalt - Unique salt for the consultant
 * @returns Decrypted object
 */
export function decryptJSONForConsultant<T = any>(encryptedData: string, consultantSalt: string): T {
  const decrypted = decryptForConsultant(encryptedData, consultantSalt);
  return JSON.parse(decrypted) as T;
}

/**
 * Encrypt JSON object (for Vertex AI credentials)
 * @deprecated Use encryptJSONForConsultant instead
 * @param jsonData - Object to encrypt
 * @returns Encrypted string
 */
export function encryptJSON(jsonData: object): string {
  const jsonString = JSON.stringify(jsonData);
  return encrypt(jsonString);
}

/**
 * Decrypt JSON object
 * @deprecated Use decryptJSONForConsultant instead
 * @param encryptedData - Encrypted string
 * @returns Decrypted object
 */
export function decryptJSON<T = any>(encryptedData: string): T {
  const decrypted = decrypt(encryptedData);
  return JSON.parse(decrypted) as T;
}

/**
 * Test encryption/decryption to verify it's working
 */
export function testEncryption(): boolean {
  try {
    // Test old system (for backward compatibility)
    const testData = 'test-data-123';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    
    if (decrypted !== testData) {
      console.error('❌ Legacy encryption test failed: decrypted data does not match');
      return false;
    }
    
    // Test new per-consultant system
    const testSalt = generateEncryptionSalt();
    const testConsultantData = 'consultant-secret-data';
    const encryptedConsultant = encryptForConsultant(testConsultantData, testSalt);
    const decryptedConsultant = decryptForConsultant(encryptedConsultant, testSalt);
    
    if (decryptedConsultant !== testConsultantData) {
      console.error('❌ Per-consultant encryption test failed: decrypted data does not match');
      return false;
    }
    
    console.log('✅ Encryption tests passed (legacy + per-consultant)');
    return true;
  } catch (error) {
    console.error('❌ Encryption test failed:', error);
    return false;
  }
}

/**
 * Verify encryption configuration on startup
 * Call this at server initialization to validate encryption setup
 */
export function verifyEncryptionConfig(): void {
  try {
    // Verify master key is set
    const masterKey = getMasterEncryptionKey();
    if (!masterKey || masterKey.length < 32) {
      throw new Error('Master encryption key is not properly configured');
    }
    
    // Run encryption/decryption tests
    if (!testEncryption()) {
      throw new Error('Encryption self-test failed');
    }
    
    console.log('✅ Encryption configuration verified successfully (per-consultant system active)');
  } catch (error) {
    console.error('❌ CRITICAL: Encryption configuration failed:', error);
    throw error;
  }
}
