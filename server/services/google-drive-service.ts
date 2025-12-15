import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db';
import { consultantAvailabilitySettings, systemSettings, users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

export function buildBaseUrlFromRequest(req: Request): string {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto || req.protocol || (req.secure ? 'https' : 'http');
  const host = req.get('host') || req.hostname;
  return `${protocol}://${host}`;
}

// Helper function to extract clean string value from jsonb
function extractJsonbString(value: any): string | null {
  if (!value) return null;
  
  // If it's already a string, check if it's JSON-escaped
  if (typeof value === 'string') {
    // Remove extra quotes if present (from double serialization)
    let cleaned = value;
    while (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
      try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'string') {
          cleaned = parsed;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    return cleaned;
  }
  
  // If it's an object/array, stringify it
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

async function getGlobalOAuthCredentials() {
  const [clientIdSetting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "google_oauth_client_id"))
    .limit(1);

  const [clientSecretSetting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "google_oauth_client_secret"))
    .limit(1);

  const clientId = extractJsonbString(clientIdSetting?.value);
  const clientSecret = extractJsonbString(clientSecretSetting?.value);

  if (clientId && clientSecret) {
    console.log(`✅ [GOOGLE DRIVE] Found global OAuth credentials. Client ID: ${clientId.substring(0, 20)}...`);
    return {
      clientId,
      clientSecret
    };
  }
  
  console.log(`⚠️ [GOOGLE DRIVE] No global OAuth credentials found in system_settings`);
  return null;
}

async function getConsultantOAuthCredentials(consultantId: string, redirectBaseUrl?: string) {
  const globalCredentials = await getGlobalOAuthCredentials();
  
  if (globalCredentials) {
    let baseUrl = 'http://localhost:5000';
    
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',');
      baseUrl = `https://${domains[0]}`;
    }
    
    if (redirectBaseUrl) {
      baseUrl = redirectBaseUrl;
    }
    
    const finalRedirectUri = `${baseUrl}/api/consultant/google-drive/callback`;
    
    console.log(`🔗 [GOOGLE DRIVE] Using GLOBAL OAuth credentials. Redirect URI: ${finalRedirectUri}`);
    
    return {
      clientId: globalCredentials.clientId,
      clientSecret: globalCredentials.clientSecret,
      redirectUri: finalRedirectUri
    };
  }

  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);

  if (!settings?.googleOAuthClientId || !settings?.googleOAuthClientSecret) {
    throw new Error('Google OAuth credentials not configured. Please ask the administrator to configure global Google OAuth settings.');
  }

  let baseUrl = 'http://localhost:5000';
  
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    baseUrl = `https://${domains[0]}`;
  }
  
  if (redirectBaseUrl) {
    baseUrl = redirectBaseUrl;
  }
  
  const finalRedirectUri = `${baseUrl}/api/consultant/google-drive/callback`;
  
  console.log(`🔗 [GOOGLE DRIVE] Using consultant-specific OAuth. Redirect URI for consultant ${consultantId}: ${finalRedirectUri}`);
  
  return {
    clientId: settings.googleOAuthClientId,
    clientSecret: settings.googleOAuthClientSecret,
    redirectUri: finalRedirectUri
  };
}

async function createOAuth2Client(consultantId: string, redirectBaseUrl?: string): Promise<OAuth2Client> {
  const credentials = await getConsultantOAuthCredentials(consultantId, redirectBaseUrl);
  return new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri
  );
}

export async function getDriveAuthorizationUrl(consultantId: string, redirectBaseUrl?: string): Promise<string> {
  const oauth2Client = await createOAuth2Client(consultantId, redirectBaseUrl);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: DRIVE_SCOPES,
    prompt: 'consent',
    state: consultantId
  });
}

export async function exchangeDriveCodeForTokens(code: string, consultantId: string, redirectBaseUrl?: string) {
  const oauth2Client = await createOAuth2Client(consultantId, redirectBaseUrl);
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000)
  };
}

export async function refreshDriveTokenIfNeeded(consultantId: string): Promise<string | null> {
  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);

  if (!settings || !settings.googleDriveRefreshToken) {
    return null;
  }

  const now = new Date();
  
  if (settings.googleDriveAccessToken && settings.googleDriveTokenExpiresAt && settings.googleDriveTokenExpiresAt > now) {
    return settings.googleDriveAccessToken;
  }

  try {
    console.log(`🔄 [GOOGLE DRIVE] Refreshing token for consultant ${consultantId}`);
    
    const oauth2Client = await createOAuth2Client(consultantId);
    oauth2Client.setCredentials({
      refresh_token: settings.googleDriveRefreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    const newAccessToken = credentials.access_token!;
    const newExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600000);

    await db
      .update(consultantAvailabilitySettings)
      .set({
        googleDriveAccessToken: newAccessToken,
        googleDriveTokenExpiresAt: newExpiresAt,
        updatedAt: new Date()
      })
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId));

    console.log(`✅ [GOOGLE DRIVE] Token refreshed successfully`);
    return newAccessToken;
  } catch (error: any) {
    console.error(`❌ [GOOGLE DRIVE] Token refresh failed:`, error.message);
    return null;
  }
}

async function getDriveClient(consultantId: string) {
  const accessToken = await refreshDriveTokenIfNeeded(consultantId);
  
  if (!accessToken) {
    throw new Error('Google Drive not connected. Please complete the OAuth authentication.');
  }

  const oauth2Client = await createOAuth2Client(consultantId);
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function getDriveUserEmail(consultantId: string): Promise<string | null> {
  try {
    const drive = await getDriveClient(consultantId);
    
    const { data } = await drive.about.get({
      fields: 'user'
    });
    
    const email = data.user?.emailAddress || null;
    
    if (email) {
      console.log(`✅ [GOOGLE DRIVE] Retrieved user email: ${email}`);
    }
    
    return email;
  } catch (error: any) {
    console.error(`❌ [GOOGLE DRIVE] Error getting user email:`, error.message);
    return null;
  }
}

export async function listDriveFolders(
  consultantId: string,
  parentId?: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const drive = await getDriveClient(consultantId);
  
  let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += " and 'root' in parents";
  }
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
    pageSize: 100
  });
  
  return (response.data.files || []).map(file => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!
  }));
}

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet'
];

export async function listDriveFiles(
  consultantId: string,
  parentId?: string,
  mimeTypes?: string[]
): Promise<Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }>> {
  const drive = await getDriveClient(consultantId);
  
  const typesToFilter = mimeTypes || SUPPORTED_MIME_TYPES;
  const mimeTypeQuery = typesToFilter.map(t => `mimeType = '${t}'`).join(' or ');
  
  let query = `(${mimeTypeQuery}) and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += " and 'root' in parents";
  }
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 100
  });
  
  return (response.data.files || []).map(file => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    size: file.size || undefined,
    modifiedTime: file.modifiedTime || undefined
  }));
}

export async function downloadDriveFile(
  consultantId: string,
  fileId: string
): Promise<{ filePath: string; fileName: string; mimeType: string }> {
  const drive = await getDriveClient(consultantId);
  
  const fileMetadata = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size'
  });
  
  const fileName = fileMetadata.data.name || 'unknown';
  const mimeType = fileMetadata.data.mimeType || 'application/octet-stream';
  const fileSize = parseInt(fileMetadata.data.size || '0', 10);
  
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  const tempDir = path.join(os.tmpdir(), 'google-drive-imports');
  await fs.mkdir(tempDir, { recursive: true });
  
  let finalFileName = fileName;
  let filePath: string;
  
  if (mimeType.startsWith('application/vnd.google-apps.')) {
    let exportMimeType: string;
    let extension: string;
    
    if (mimeType === 'application/vnd.google-apps.document') {
      exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      extension = '.docx';
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = '.xlsx';
    } else {
      throw new Error(`Unsupported Google Apps file type: ${mimeType}`);
    }
    
    finalFileName = fileName.replace(/\.[^/.]+$/, '') + extension;
    filePath = path.join(tempDir, `${fileId}${extension}`);
    
    const response = await drive.files.export(
      { fileId, mimeType: exportMimeType },
      { responseType: 'arraybuffer' }
    );
    
    await fs.writeFile(filePath, Buffer.from(response.data as ArrayBuffer));
  } else {
    const extension = path.extname(fileName) || getExtensionFromMimeType(mimeType);
    filePath = path.join(tempDir, `${fileId}${extension}`);
    
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    
    await fs.writeFile(filePath, Buffer.from(response.data as ArrayBuffer));
  }
  
  console.log(`✅ [GOOGLE DRIVE] Downloaded file: ${finalFileName} to ${filePath}`);
  
  return {
    filePath,
    fileName: finalFileName,
    mimeType: mimeType.startsWith('application/vnd.google-apps.') 
      ? (mimeType === 'application/vnd.google-apps.document' 
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      : mimeType
  };
}

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/csv': '.csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls'
  };
  return mimeToExt[mimeType] || '';
}

export async function isDriveConnected(consultantId: string): Promise<boolean> {
  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);
  
  return !!(settings?.googleDriveRefreshToken);
}

export async function disconnectDrive(consultantId: string): Promise<void> {
  await db
    .update(consultantAvailabilitySettings)
    .set({
      googleDriveRefreshToken: null,
      googleDriveAccessToken: null,
      googleDriveTokenExpiresAt: null,
      googleDriveConnectedAt: null,
      googleDriveEmail: null,
      updatedAt: new Date()
    })
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId));
  
  console.log(`✅ [GOOGLE DRIVE] Disconnected for consultant ${consultantId}`);
}

// ============================================
// CLIENT-SPECIFIC GOOGLE DRIVE FUNCTIONS
// ============================================

async function getClientOAuthCredentials(clientId: string, redirectBaseUrl?: string) {
  const globalCredentials = await getGlobalOAuthCredentials();
  
  if (!globalCredentials) {
    throw new Error('Google OAuth credentials not configured. Please ask the administrator to configure global Google OAuth settings.');
  }
  
  let baseUrl = 'http://localhost:5000';
  
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    baseUrl = `https://${domains[0]}`;
  }
  
  if (redirectBaseUrl) {
    baseUrl = redirectBaseUrl;
  }
  
  const finalRedirectUri = `${baseUrl}/api/client/google-drive/callback`;
  
  console.log(`🔗 [CLIENT GOOGLE DRIVE] Using GLOBAL OAuth credentials. Redirect URI: ${finalRedirectUri}`);
  
  return {
    clientId: globalCredentials.clientId,
    clientSecret: globalCredentials.clientSecret,
    redirectUri: finalRedirectUri
  };
}

async function createClientOAuth2Client(clientId: string, redirectBaseUrl?: string): Promise<OAuth2Client> {
  const credentials = await getClientOAuthCredentials(clientId, redirectBaseUrl);
  return new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri
  );
}

export async function getClientDriveAuthorizationUrl(clientId: string, redirectBaseUrl?: string): Promise<string> {
  const oauth2Client = await createClientOAuth2Client(clientId, redirectBaseUrl);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: DRIVE_SCOPES,
    prompt: 'consent',
    state: clientId
  });
}

export async function exchangeClientDriveCodeForTokens(code: string, clientId: string, redirectBaseUrl?: string) {
  const oauth2Client = await createClientOAuth2Client(clientId, redirectBaseUrl);
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000)
  };
}

export async function refreshClientDriveTokenIfNeeded(clientId: string): Promise<string | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);

  if (!user || !user.googleDriveRefreshToken) {
    return null;
  }

  const now = new Date();
  
  if (user.googleDriveAccessToken && user.googleDriveTokenExpiresAt && user.googleDriveTokenExpiresAt > now) {
    return user.googleDriveAccessToken;
  }

  try {
    console.log(`🔄 [CLIENT GOOGLE DRIVE] Refreshing token for client ${clientId}`);
    
    const oauth2Client = await createClientOAuth2Client(clientId);
    oauth2Client.setCredentials({
      refresh_token: user.googleDriveRefreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    const newAccessToken = credentials.access_token!;
    const newExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600000);

    await db
      .update(users)
      .set({
        googleDriveAccessToken: newAccessToken,
        googleDriveTokenExpiresAt: newExpiresAt
      })
      .where(eq(users.id, clientId));

    console.log(`✅ [CLIENT GOOGLE DRIVE] Token refreshed successfully`);
    return newAccessToken;
  } catch (error: any) {
    console.error(`❌ [CLIENT GOOGLE DRIVE] Token refresh failed:`, error.message);
    return null;
  }
}

async function getClientDriveClient(clientId: string) {
  const accessToken = await refreshClientDriveTokenIfNeeded(clientId);
  
  if (!accessToken) {
    throw new Error('Google Drive not connected. Please complete the OAuth authentication.');
  }

  const oauth2Client = await createClientOAuth2Client(clientId);
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function getClientDriveUserEmail(clientId: string): Promise<string | null> {
  try {
    const drive = await getClientDriveClient(clientId);
    
    const { data } = await drive.about.get({
      fields: 'user'
    });
    
    const email = data.user?.emailAddress || null;
    
    if (email) {
      console.log(`✅ [CLIENT GOOGLE DRIVE] Retrieved user email: ${email}`);
    }
    
    return email;
  } catch (error: any) {
    console.error(`❌ [CLIENT GOOGLE DRIVE] Error getting user email:`, error.message);
    return null;
  }
}

export async function listClientDriveFolders(
  clientId: string,
  parentId?: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const drive = await getClientDriveClient(clientId);
  
  let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += " and 'root' in parents";
  }
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
    pageSize: 100
  });
  
  return (response.data.files || []).map(file => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!
  }));
}

export async function listClientDriveFiles(
  clientId: string,
  parentId?: string,
  mimeTypes?: string[]
): Promise<Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }>> {
  const drive = await getClientDriveClient(clientId);
  
  const typesToFilter = mimeTypes || SUPPORTED_MIME_TYPES;
  const mimeTypeQuery = typesToFilter.map(t => `mimeType = '${t}'`).join(' or ');
  
  let query = `(${mimeTypeQuery}) and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += " and 'root' in parents";
  }
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 100
  });
  
  return (response.data.files || []).map(file => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    size: file.size || undefined,
    modifiedTime: file.modifiedTime || undefined
  }));
}

export async function downloadClientDriveFile(
  clientId: string,
  fileId: string
): Promise<{ filePath: string; fileName: string; mimeType: string }> {
  const drive = await getClientDriveClient(clientId);
  
  const fileMetadata = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size'
  });
  
  const fileName = fileMetadata.data.name || 'unknown';
  const mimeType = fileMetadata.data.mimeType || 'application/octet-stream';
  const fileSize = parseInt(fileMetadata.data.size || '0', 10);
  
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  const tempDir = path.join(os.tmpdir(), 'google-drive-imports');
  await fs.mkdir(tempDir, { recursive: true });
  
  let finalFileName = fileName;
  let filePath: string;
  
  if (mimeType.startsWith('application/vnd.google-apps.')) {
    let exportMimeType: string;
    let extension: string;
    
    if (mimeType === 'application/vnd.google-apps.document') {
      exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      extension = '.docx';
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = '.xlsx';
    } else {
      throw new Error(`Unsupported Google Apps file type: ${mimeType}`);
    }
    
    finalFileName = fileName.replace(/\.[^/.]+$/, '') + extension;
    filePath = path.join(tempDir, `${fileId}${extension}`);
    
    const response = await drive.files.export(
      { fileId, mimeType: exportMimeType },
      { responseType: 'arraybuffer' }
    );
    
    await fs.writeFile(filePath, Buffer.from(response.data as ArrayBuffer));
  } else {
    const extension = path.extname(fileName) || getExtensionFromMimeType(mimeType);
    filePath = path.join(tempDir, `${fileId}${extension}`);
    
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    
    await fs.writeFile(filePath, Buffer.from(response.data as ArrayBuffer));
  }
  
  console.log(`✅ [CLIENT GOOGLE DRIVE] Downloaded file: ${finalFileName} to ${filePath}`);
  
  return {
    filePath,
    fileName: finalFileName,
    mimeType: mimeType.startsWith('application/vnd.google-apps.') 
      ? (mimeType === 'application/vnd.google-apps.document' 
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      : mimeType
  };
}

export async function isClientDriveConnected(clientId: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  
  return !!(user?.googleDriveRefreshToken);
}

export async function disconnectClientDrive(clientId: string): Promise<void> {
  await db
    .update(users)
    .set({
      googleDriveRefreshToken: null,
      googleDriveAccessToken: null,
      googleDriveTokenExpiresAt: null,
      googleDriveConnectedAt: null,
      googleDriveEmail: null
    })
    .where(eq(users.id, clientId));
  
  console.log(`✅ [CLIENT GOOGLE DRIVE] Disconnected for client ${clientId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED DRIVES & SHARED WITH ME - Extended Drive access
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List all Shared Drives (Team Drives) accessible to the user
 */
export async function listSharedDrives(
  consultantId: string
): Promise<Array<{ id: string; name: string; kind: string }>> {
  const drive = await getDriveClient(consultantId);
  
  try {
    const response = await drive.drives.list({
      pageSize: 100,
      fields: 'drives(id, name, kind)'
    });
    
    console.log(`✅ [GOOGLE DRIVE] Found ${response.data.drives?.length || 0} shared drives`);
    
    return (response.data.drives || []).map(d => ({
      id: d.id!,
      name: d.name!,
      kind: 'shared_drive'
    }));
  } catch (error: any) {
    console.error(`❌ [GOOGLE DRIVE] Error listing shared drives:`, error.message);
    return [];
  }
}

/**
 * List folders in a Shared Drive
 */
export async function listSharedDriveFolders(
  consultantId: string,
  driveId: string,
  parentId?: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const drive = await getDriveClient(consultantId);
  
  let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const response = await drive.files.list({
    q: query,
    driveId: driveId,
    corpora: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
    pageSize: 100
  });
  
  return (response.data.files || []).map(file => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!
  }));
}

/**
 * List files in a Shared Drive
 */
export async function listSharedDriveFiles(
  consultantId: string,
  driveId: string,
  parentId?: string,
  mimeTypes?: string[]
): Promise<Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }>> {
  const drive = await getDriveClient(consultantId);
  
  const typesToFilter = mimeTypes || SUPPORTED_MIME_TYPES;
  const mimeTypeQuery = typesToFilter.map(t => `mimeType = '${t}'`).join(' or ');
  
  let query = `(${mimeTypeQuery}) and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const response = await drive.files.list({
    q: query,
    driveId: driveId,
    corpora: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 100
  });
  
  return (response.data.files || []).map(file => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    size: file.size || undefined,
    modifiedTime: file.modifiedTime || undefined
  }));
}

/**
 * List items shared with the user (sharedWithMe)
 * Returns folders first for navigation, then files
 */
export async function listSharedWithMe(
  consultantId: string,
  onlyFolders: boolean = false
): Promise<Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; sharedBy?: string }>> {
  const drive = await getDriveClient(consultantId);
  
  let query = "sharedWithMe = true and trashed = false";
  
  if (onlyFolders) {
    query += " and mimeType = 'application/vnd.google-apps.folder'";
  }
  
  try {
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, sharingUser)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    console.log(`✅ [GOOGLE DRIVE] Found ${response.data.files?.length || 0} shared-with-me items`);
    
    return (response.data.files || []).map(file => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size || undefined,
      modifiedTime: file.modifiedTime || undefined,
      sharedBy: file.sharingUser?.displayName || file.sharingUser?.emailAddress || undefined
    }));
  } catch (error: any) {
    console.error(`❌ [GOOGLE DRIVE] Error listing shared-with-me:`, error.message);
    return [];
  }
}

/**
 * List items shared with the client (sharedWithMe) - Client version
 */
export async function listClientSharedWithMe(
  clientId: string,
  onlyFolders: boolean = false
): Promise<Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; sharedBy?: string }>> {
  const drive = await getClientDriveClient(clientId);
  
  let query = "sharedWithMe = true and trashed = false";
  
  if (onlyFolders) {
    query += " and mimeType = 'application/vnd.google-apps.folder'";
  }
  
  try {
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, sharingUser)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    return (response.data.files || []).map(file => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size || undefined,
      modifiedTime: file.modifiedTime || undefined,
      sharedBy: file.sharingUser?.displayName || file.sharingUser?.emailAddress || undefined
    }));
  } catch (error: any) {
    console.error(`❌ [CLIENT GOOGLE DRIVE] Error listing shared-with-me:`, error.message);
    return [];
  }
}

/**
 * List client Shared Drives
 */
export async function listClientSharedDrives(
  clientId: string
): Promise<Array<{ id: string; name: string; kind: string }>> {
  const drive = await getClientDriveClient(clientId);
  
  try {
    const response = await drive.drives.list({
      pageSize: 100,
      fields: 'drives(id, name, kind)'
    });
    
    return (response.data.drives || []).map(d => ({
      id: d.id!,
      name: d.name!,
      kind: 'shared_drive'
    }));
  } catch (error: any) {
    console.error(`❌ [CLIENT GOOGLE DRIVE] Error listing shared drives:`, error.message);
    return [];
  }
}
