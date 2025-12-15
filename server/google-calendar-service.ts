// Google Calendar Service
// Uses OAuth 2.0 authentication for secure access to consultant's Google Calendar
// Each consultant uses their own credentials (stored in database)

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from './db';
import { consultantAvailabilitySettings, consultantCalendarSync, systemSettings } from '../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { Request } from 'express';

function extractJsonbString(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
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
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

// Scopes needed for Google Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

/**
 * Build base URL from Express request
 * Extracts protocol and host to construct the correct redirect URI for OAuth
 * Handles proxied requests correctly (Replit uses X-Forwarded-Proto)
 */
export function buildBaseUrlFromRequest(req: Request): string {
  // Get protocol - handle proxied requests (X-Forwarded-Proto from Replit proxy)
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto || req.protocol || (req.secure ? 'https' : 'http');
  
  // Get host (includes port if non-standard)
  const host = req.get('host') || req.hostname;
  
  return `${protocol}://${host}`;
}

/**
 * Get global OAuth credentials from system_settings (SuperAdmin centralized credentials)
 */
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

  // Extract and trim values - treat empty strings as not configured
  const clientId = extractJsonbString(clientIdSetting?.value)?.trim();
  const clientSecret = extractJsonbString(clientSecretSetting?.value)?.trim();

  if (clientId && clientSecret) {
    console.log(`✅ [GOOGLE CALENDAR] Found global OAuth credentials. Client ID: ${clientId.substring(0, 20)}...`);
    return { clientId, clientSecret };
  }
  
  console.log(`⚠️ [GOOGLE CALENDAR] No global OAuth credentials found in system_settings (or empty strings)`);
  return null;
}

/**
 * Check if global OAuth credentials are configured
 */
export async function isGlobalCalendarOAuthConfigured(): Promise<boolean> {
  const globalCredentials = await getGlobalOAuthCredentials();
  return globalCredentials !== null;
}

/**
 * Get consultant's OAuth credentials from database
 * Uses global (SuperAdmin) credentials first, falls back to consultant-specific credentials
 * @param consultantId - The consultant's ID
 * @param redirectBaseUrl - Optional base URL from current request (e.g., 'https://coachale.replit.app')
 */
async function getConsultantOAuthCredentials(consultantId: string, redirectBaseUrl?: string) {
  // Try global OAuth credentials first (SuperAdmin centralized)
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
    
    const finalRedirectUri = `${baseUrl}/api/calendar-settings/oauth/callback`;
    
    console.log(`🔗 [GOOGLE CALENDAR] Using GLOBAL OAuth credentials. Redirect URI: ${finalRedirectUri}`);
    
    return {
      clientId: globalCredentials.clientId,
      clientSecret: globalCredentials.clientSecret,
      redirectUri: finalRedirectUri
    };
  }

  // Fallback to consultant-specific credentials (legacy behavior)
  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);

  // Check consultant credentials - treat empty strings as not configured
  const consultantClientId = settings?.googleOAuthClientId?.trim();
  const consultantClientSecret = settings?.googleOAuthClientSecret?.trim();

  if (!consultantClientId || !consultantClientSecret) {
    throw new Error('Credenziali OAuth Google non configurate. L\'amministratore deve configurare le credenziali globali OAuth nelle impostazioni.');
  }

  // ✅ Build correct redirect URI with fallback chain:
  // 1. Consultant's manual override (googleOAuthRedirectUri in DB)
  // 2. Base URL from current request (passed from route)
  // 3. REPLIT_DOMAINS (production deployment)
  // 4. localhost (local development fallback)
  
  let baseUrl = 'http://localhost:5000';
  
  // Priority 3: Use REPLIT_DOMAINS if available (production)
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    baseUrl = `https://${domains[0]}`;
  }
  
  // Priority 2: Use base URL from current request if provided (most accurate)
  if (redirectBaseUrl) {
    baseUrl = redirectBaseUrl;
    console.log(`📍 [OAUTH] Using request-derived base URL: ${baseUrl}`);
  }
  
  // Priority 1: Manual override always wins (if consultant configured it)
  const finalRedirectUri = settings.googleOAuthRedirectUri || `${baseUrl}/api/calendar-settings/oauth/callback`;
  
  console.log(`🔗 [GOOGLE CALENDAR] Using consultant-specific OAuth. Redirect URI for consultant ${consultantId}: ${finalRedirectUri}`);
  
  return {
    clientId: settings.googleOAuthClientId,
    clientSecret: settings.googleOAuthClientSecret,
    redirectUri: finalRedirectUri
  };
}

/**
 * Create OAuth2 client for specific consultant
 * @param consultantId - The consultant's ID
 * @param redirectBaseUrl - Optional base URL from current request
 */
async function createOAuth2Client(consultantId: string, redirectBaseUrl?: string): Promise<OAuth2Client> {
  const credentials = await getConsultantOAuthCredentials(consultantId, redirectBaseUrl);

  return new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri
  );
}

/**
 * Generate authorization URL to start OAuth flow
 * @param consultantId - The consultant's ID
 * @param redirectBaseUrl - Optional base URL from current request (e.g., 'https://coachale.replit.app')
 */
export async function getAuthorizationUrl(consultantId: string, redirectBaseUrl?: string): Promise<string> {
  const oauth2Client = await createOAuth2Client(consultantId, redirectBaseUrl);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Gets refresh token
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
    state: consultantId // Pass consultant ID to identify who's authenticating
  });
}

/**
 * Exchange authorization code for tokens
 * @param code - Authorization code from Google
 * @param consultantId - The consultant's ID
 * @param redirectBaseUrl - MUST match the base URL used in getAuthorizationUrl
 */
export async function exchangeCodeForTokens(code: string, consultantId: string, redirectBaseUrl?: string) {
  const oauth2Client = await createOAuth2Client(consultantId, redirectBaseUrl);
  
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000)
  };
}

/**
 * Identify the cause of OAuth token refresh failure
 */
function identifyTokenError(error: any): { cause: string; userMessage: string; recommendation: string } {
  const errorMessage = error?.message || '';
  const errorCode = error?.code || error?.response?.data?.error;

  // Check for common OAuth error patterns
  if (errorCode === 'invalid_grant' || errorMessage.includes('invalid_grant')) {
    // Token has been expired or revoked
    if (errorMessage.includes('expired') || errorMessage.includes('Token has been expired')) {
      return {
        cause: 'testing_mode_7_days',
        userMessage: 'Il token OAuth è scaduto dopo 7 giorni (app in modalità Testing)',
        recommendation: 'Passa l\'app Google Cloud da "Testing" a "Production" per evitare scadenze automatiche'
      };
    } else if (errorMessage.includes('revoked')) {
      return {
        cause: 'user_revoked',
        userMessage: 'L\'accesso a Google Calendar è stato revocato manualmente',
        recommendation: 'Riconnetti Google Calendar per ripristinare l\'accesso'
      };
    } else {
      return {
        cause: 'invalid_grant_generic',
        userMessage: 'Il refresh token non è più valido',
        recommendation: 'Riconnetti Google Calendar. Possibili cause: password cambiata, app revocata, limite 100 token superato'
      };
    }
  } else if (errorCode === 'invalid_client' || errorMessage.includes('invalid_client')) {
    return {
      cause: 'invalid_credentials',
      userMessage: 'Credenziali OAuth non valide (Client ID o Client Secret errati)',
      recommendation: 'Verifica Client ID e Client Secret nella Google Cloud Console'
    };
  } else if (errorCode === 403 || error?.status === 403) {
    return {
      cause: 'permission_denied',
      userMessage: 'Permessi insufficienti per accedere a Google Calendar',
      recommendation: 'Riconnetti Google Calendar e assicurati di concedere tutti i permessi richiesti'
    };
  } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
    return {
      cause: 'network_error',
      userMessage: 'Errore di rete durante la connessione a Google',
      recommendation: 'Riprova tra qualche minuto. Se persiste, verifica la connessione internet'
    };
  } else {
    return {
      cause: 'unknown_error',
      userMessage: `Errore sconosciuto: ${errorMessage}`,
      recommendation: 'Riconnetti Google Calendar. Se il problema persiste, contatta il supporto'
    };
  }
}

/**
 * Get valid access token for consultant (auto-refreshes if expired with retry logic)
 */
export async function getValidAccessToken(consultantId: string): Promise<string | null> {
  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);

  if (!settings || !settings.googleRefreshToken) {
    return null;
  }

  const now = new Date();
  
  // If token is still valid, return it
  if (settings.googleAccessToken && settings.googleTokenExpiresAt && settings.googleTokenExpiresAt > now) {
    return settings.googleAccessToken;
  }

  // Token expired, refresh it with retry logic (3 attempts)
  const MAX_RETRIES = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 [OAUTH REFRESH] Attempt ${attempt}/${MAX_RETRIES} for consultant ${consultantId}`);
      
      const oauth2Client = await createOAuth2Client(consultantId);
      oauth2Client.setCredentials({
        refresh_token: settings.googleRefreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      
      const newAccessToken = credentials.access_token!;
      const newExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600000);

      // Update database with new token
      await db
        .update(consultantAvailabilitySettings)
        .set({
          googleAccessToken: newAccessToken,
          googleTokenExpiresAt: newExpiresAt,
          updatedAt: new Date()
        })
        .where(eq(consultantAvailabilitySettings.consultantId, consultantId));

      console.log(`✅ [OAUTH REFRESH] Token refreshed successfully on attempt ${attempt}`);
      return newAccessToken;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ [OAUTH REFRESH] Attempt ${attempt}/${MAX_RETRIES} failed:`, error);

      // Identify error type
      const errorInfo = identifyTokenError(error);
      console.error(`📋 [OAUTH ERROR DETAILS]`);
      console.error(`   Consultant ID: ${consultantId}`);
      console.error(`   Error Cause: ${errorInfo.cause}`);
      console.error(`   User Message: ${errorInfo.userMessage}`);
      console.error(`   Recommendation: ${errorInfo.recommendation}`);
      console.error(`   Technical Error: ${error.message || 'Unknown'}`);

      // Don't retry if it's a permanent error (invalid_grant, invalid_client)
      if (errorInfo.cause === 'testing_mode_7_days' || 
          errorInfo.cause === 'user_revoked' || 
          errorInfo.cause === 'invalid_grant_generic' ||
          errorInfo.cause === 'invalid_credentials') {
        console.error(`⏹️  [OAUTH REFRESH] Permanent error detected, skipping remaining retries`);
        break;
      }

      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      if (attempt < MAX_RETRIES) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ [OAUTH REFRESH] Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  console.error(`🔴 [OAUTH REFRESH] All ${MAX_RETRIES} attempts failed for consultant ${consultantId}`);
  const errorInfo = identifyTokenError(lastError);
  console.error(`   Final diagnosis: ${errorInfo.cause}`);
  console.error(`   User should: ${errorInfo.recommendation}`);
  
  return null;
}

/**
 * Check OAuth token status and attempt refresh if needed
 * Returns: { isValid: boolean, needsReconnection: boolean, error?: string }
 * 
 * Logic:
 * - If token valid and not expired: isValid=true, needsReconnection=false
 * - If token expired BUT refresh succeeds: isValid=true, needsReconnection=false
 * - If token expired AND refresh fails (all 3 retries): isValid=false, needsReconnection=true
 */
export async function checkOAuthTokenStatus(consultantId: string): Promise<{
  isValid: boolean;
  needsReconnection: boolean;
  error?: string;
}> {
  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);

  // No refresh token = never connected or disconnected
  if (!settings || !settings.googleRefreshToken) {
    return { isValid: false, needsReconnection: false };
  }

  const now = new Date();

  // Token still valid and not expired - no action needed
  if (settings.googleAccessToken && settings.googleTokenExpiresAt && settings.googleTokenExpiresAt > now) {
    console.log(`✅ [OAUTH STATUS] Consultant ${consultantId}: Token valid, expires at ${settings.googleTokenExpiresAt}`);
    return { isValid: true, needsReconnection: false };
  }

  // Token expired or missing - attempt refresh with retry logic
  console.log(`⏰ [OAUTH STATUS] Consultant ${consultantId}: Token expired or missing, attempting refresh...`);
  
  try {
    const accessToken = await getValidAccessToken(consultantId);
    
    if (accessToken) {
      // Refresh succeeded (either immediately or after retries)
      console.log(`✅ [OAUTH STATUS] Consultant ${consultantId}: Token refresh successful`);
      return { isValid: true, needsReconnection: false };
    } else {
      // Refresh failed after all retries - needs user reconnection
      console.log(`❌ [OAUTH STATUS] Consultant ${consultantId}: Token refresh failed after retries, needs reconnection`);
      return { 
        isValid: false, 
        needsReconnection: true,
        error: 'Token OAuth scaduto o revocato. Riconnetti Google Calendar.'
      };
    }
  } catch (error: any) {
    console.error(`❌ [OAUTH STATUS] Consultant ${consultantId}: Error checking token status:`, error);
    return { 
      isValid: false, 
      needsReconnection: true,
      error: 'Impossibile verificare lo stato del token OAuth'
    };
  }
}

/**
 * Get authenticated calendar client using OAuth 2.0
 */
export async function getCalendarClient(consultantId: string) {
  const accessToken = await getValidAccessToken(consultantId);
  
  if (!accessToken) {
    throw new Error('Google Calendar non connesso. Completa l\'autenticazione OAuth.');
  }

  const oauth2Client = await createOAuth2Client(consultantId);
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Get consultant's primary calendar ID
 */
export async function getPrimaryCalendarId(consultantId: string): Promise<string | null> {
  try {
    // STEP 1: Check if consultant has saved a preferred calendarId in settings
    const [settings] = await db
      .select()
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);
    
    if (settings?.googleCalendarId) {
      console.log(`✅ Using saved calendar ID from settings: ${settings.googleCalendarId}`);
      return settings.googleCalendarId;
    }
    
    // STEP 2: Auto-detect calendar using Google API
    const calendar = await getCalendarClient(consultantId);
    const { data } = await calendar.calendarList.list();
    
    // STEP 2a: Try to find primary calendar first
    const primaryCalendar = data.items?.find(cal => cal.primary);
    if (primaryCalendar?.id) {
      console.log(`✅ Using primary calendar: ${primaryCalendar.id}`);
      return primaryCalendar.id;
    }
    
    // STEP 2b: Fallback - find first calendar with owner/writer access
    const ownedCalendar = data.items?.find(cal => 
      cal.accessRole === 'owner' || cal.accessRole === 'writer'
    );
    
    if (ownedCalendar?.id) {
      console.log(`⚠️  Primary calendar not found. Using first calendar with write access: ${ownedCalendar.id} (${ownedCalendar.summary})`);
      console.log(`💡 TIP: Save this calendar ID in settings to avoid auto-detection`);
      return ownedCalendar.id;
    }
    
    // STEP 3: Final fallback
    console.warn('⚠️  No suitable calendar found, falling back to "primary"');
    return 'primary';
  } catch (error: any) {
    // Handle Google Calendar API not enabled error gracefully
    if (error.code === 403 && error.message?.includes('Calendar API has not been used')) {
      console.log('⚠️  Google Calendar API not enabled - skipping calendar operations');
      console.log('💡 Enable it at: https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview');
      return null;
    }
    console.error('❌ Error getting primary calendar:', error);
    return null;
  }
}

/**
 * Create event in Google Calendar
 * FIX: Accepts date/time as strings with timezone, let Google Calendar handle DST correctly
 */
export async function createGoogleCalendarEvent(
  consultantId: string,
  eventData: {
    summary: string;
    description?: string;
    startDate: string;  // YYYY-MM-DD
    startTime: string;  // HH:MM
    duration: number;   // minutes
    timezone: string;   // IANA timezone like 'Europe/Rome'
    attendees?: string[];
  }
) {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📅 [GOOGLE CALENDAR] Creating Calendar Event');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Consultant ID: ${consultantId}`);
    console.log(`📝 Event title: ${eventData.summary}`);
    
    // FIX TIMEZONE: Build datetime strings WITHOUT offset + use timeZone field
    // This lets Google Calendar handle DST correctly (Europe/Rome changes UTC+1 ↔ UTC+2)
    // Parse date/time components
    const [startHours, startMinutes] = eventData.startTime.split(':').map(Number);
    const [year, month, day] = eventData.startDate.split('-').map(Number);
    
    // Build datetime string for start time (NO 'Z' suffix, NO offset)
    const startDateTime = `${eventData.startDate}T${eventData.startTime}:00`;
    
    // Calculate end time (handle midnight crossing)
    const totalMinutes = startHours * 60 + startMinutes + eventData.duration;
    const endHourRaw = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    
    // Check if crosses midnight
    const daysToAdd = Math.floor(endHourRaw / 24);
    const endHour = endHourRaw % 24;
    
    // Calculate end date (may be next day if crossing midnight)
    let endDate = eventData.startDate;
    if (daysToAdd > 0) {
      // Use UTC date manipulation to avoid timezone issues
      const dateObj = new Date(Date.UTC(year, month - 1, day));
      dateObj.setUTCDate(dateObj.getUTCDate() + daysToAdd);
      endDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    
    // Build datetime string for end time (NO 'Z' suffix, NO offset)
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    const endDateTime = `${endDate}T${endTime}:00`;
    
    console.log(`📅 Start: ${startDateTime} (${eventData.timezone})`);
    console.log(`📅 End: ${endDateTime} (${eventData.timezone})`);
    console.log(`⏱️ Duration: ${eventData.duration} minutes`);
    if (daysToAdd > 0) {
      console.log(`🌙 [MIDNIGHT CROSS] Appointment crosses midnight (+${daysToAdd} day${daysToAdd > 1 ? 's' : ''})`);
    }
    if (eventData.attendees && eventData.attendees.length > 0) {
      console.log(`👥 Attendees (${eventData.attendees.length}):`);
      eventData.attendees.forEach(email => console.log(`   - ${email}`));
    }
    
    console.log(`\n🔐 Authenticating with Google Calendar API...`);
    const calendar = await getCalendarClient(consultantId);
    
    console.log(`📋 Getting primary calendar ID...`);
    const calendarId = await getPrimaryCalendarId(consultantId);
    
    if (!calendarId) {
      throw new Error('Calendar ID not found');
    }
    console.log(`✅ Using calendar: ${calendarId}`);

    const event = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: startDateTime,  // CRITICAL: NO toISOString() to avoid UTC conversion
        timeZone: eventData.timezone
      },
      end: {
        dateTime: endDateTime,    // CRITICAL: NO toISOString() to avoid UTC conversion
        timeZone: eventData.timezone
      },
      attendees: eventData.attendees?.map(email => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    console.log(`\n🎥 Requesting Google Meet link creation...`);
    console.log(`🌐 Calling Google Calendar API...`);
    
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
      conferenceDataVersion: 1
    });

    const googleEventId = response.data.id!;
    const googleMeetLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;

    console.log(`\n✅ Event created successfully!`);
    console.log(`   🆔 Google Event ID: ${googleEventId}`);
    console.log(`   🎥 Google Meet Link: ${googleMeetLink || '⚠️ Not available'}`);
    console.log(`   📧 Calendar invites sent to: ${eventData.attendees?.join(', ') || 'No attendees'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return {
      googleEventId,
      googleMeetLink
    };
  } catch (error: any) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [GOOGLE CALENDAR] Error creating event');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`   Error type: ${error.name || 'Unknown'}`);
    console.error(`   Error message: ${error.message || error}`);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    throw error;
  }
}

/**
 * List events from Google Calendar (exported for calendar appointments endpoint)
 */
export async function listEvents(
  consultantId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ start: Date; end: Date; summary: string; status: string }>> {
  try {
    const calendar = await getCalendarClient(consultantId);
    if (!calendar) {
      // Silently return empty if calendar not configured
      return [];
    }

    // Get correct calendar ID (not hardcoded 'primary')
    const calendarId = await getPrimaryCalendarId(consultantId);
    if (!calendarId) {
      // Silently return empty if calendar not found
      return [];
    }

    console.log(`📅 Fetching events from calendar: ${calendarId}`);

    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true, // Expand recurring events
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    
    // Normalize events to simple format
    return events
      .filter(event => event.status !== 'cancelled')
      .filter(event => event.transparency !== 'transparent') // Skip "free" events
      .map(event => ({
        start: new Date(event.start?.dateTime || event.start?.date || ''),
        end: new Date(event.end?.dateTime || event.end?.date || ''),
        summary: event.summary || 'Busy',
        status: event.status || 'confirmed'
      }))
      .filter(event => !isNaN(event.start.getTime()) && !isNaN(event.end.getTime()));
  } catch (error: any) {
    console.error('❌ Error listing calendar events:', error.message);
    return [];
  }
}

/**
 * Update event in Google Calendar
 * FIX: Accepts date/time as strings with timezone (same approach as create)
 */
export async function updateGoogleCalendarEvent(
  consultantId: string,
  googleEventId: string,
  eventData: {
    summary?: string;
    description?: string;
    startDate?: string;  // YYYY-MM-DD
    startTime?: string;  // HH:MM
    duration?: number;   // minutes
    timezone?: string;   // IANA timezone like 'Europe/Rome'
  }
) {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 [GOOGLE CALENDAR] Updating Calendar Event');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Consultant ID: ${consultantId}`);
    console.log(`🆔 Event ID: ${googleEventId}`);
    
    const calendar = await getCalendarClient(consultantId);
    const calendarId = await getPrimaryCalendarId(consultantId);
    
    if (!calendarId) {
      throw new Error('Calendar ID not found');
    }

    const event: any = {};
    
    if (eventData.summary) {
      event.summary = eventData.summary;
      console.log(`📝 New title: ${eventData.summary}`);
    }
    if (eventData.description) {
      event.description = eventData.description;
    }
    
    // FIX TIMEZONE: Use same approach as createGoogleCalendarEvent
    if (eventData.startDate && eventData.startTime && eventData.duration && eventData.timezone) {
      const [startHours, startMinutes] = eventData.startTime.split(':').map(Number);
      const [year, month, day] = eventData.startDate.split('-').map(Number);
      
      // Build datetime string for start time (NO 'Z' suffix, NO offset)
      const startDateTime = `${eventData.startDate}T${eventData.startTime}:00`;
      
      // Calculate end time (handle midnight crossing)
      const totalMinutes = startHours * 60 + startMinutes + eventData.duration;
      const endHourRaw = Math.floor(totalMinutes / 60);
      const endMinute = totalMinutes % 60;
      
      const daysToAdd = Math.floor(endHourRaw / 24);
      const endHour = endHourRaw % 24;
      
      let endDate = eventData.startDate;
      if (daysToAdd > 0) {
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        dateObj.setUTCDate(dateObj.getUTCDate() + daysToAdd);
        endDate = dateObj.toISOString().split('T')[0];
      }
      
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      const endDateTime = `${endDate}T${endTime}:00`;
      
      event.start = {
        dateTime: startDateTime,
        timeZone: eventData.timezone
      };
      event.end = {
        dateTime: endDateTime,
        timeZone: eventData.timezone
      };
      
      console.log(`📅 New Start: ${startDateTime} (${eventData.timezone})`);
      console.log(`📅 New End: ${endDateTime} (${eventData.timezone})`);
      console.log(`⏱️ Duration: ${eventData.duration} minutes`);
    }

    console.log(`🌐 Calling Google Calendar API to update event...`);
    await calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      requestBody: event
    });

    console.log(`✅ Event updated successfully!`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return true;
  } catch (error: any) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [GOOGLE CALENDAR] Error updating event');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`   Error message: ${error.message || error}`);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return false;
  }
}

/**
 * Add attendees to existing Google Calendar event
 */
export async function addAttendeesToGoogleCalendarEvent(
  consultantId: string,
  googleEventId: string,
  newAttendees: string[]
) {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 [GOOGLE CALENDAR] Adding Attendees to Event');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Consultant ID: ${consultantId}`);
    console.log(`🆔 Event ID: ${googleEventId}`);
    console.log(`📧 New Attendees: ${newAttendees.join(', ')}`);
    
    const calendar = await getCalendarClient(consultantId);
    const calendarId = await getPrimaryCalendarId(consultantId);
    
    if (!calendarId) {
      throw new Error('Calendar ID not found');
    }

    // First, get the existing event to retrieve current attendees
    console.log(`🔍 Fetching existing event...`);
    const existingEvent = await calendar.events.get({
      calendarId,
      eventId: googleEventId
    });

    // Merge existing and new attendees (avoid duplicates)
    const existingAttendees = existingEvent.data.attendees || [];
    const existingEmails = new Set(existingAttendees.map(a => a.email?.toLowerCase()));
    
    // First, deduplicate within newAttendees array itself (normalize to lowercase)
    const normalizedNewAttendees = new Set<string>();
    const deduplicatedNew: string[] = [];
    
    for (const email of newAttendees) {
      const normalized = email.trim().toLowerCase();
      if (!normalizedNewAttendees.has(normalized)) {
        normalizedNewAttendees.add(normalized);
        deduplicatedNew.push(email.trim()); // Keep original casing, just trimmed
      }
    }
    
    // Then, filter out attendees that already exist in the event
    const uniqueNewAttendees = deduplicatedNew.filter(
      email => !existingEmails.has(email.toLowerCase())
    );

    if (uniqueNewAttendees.length === 0) {
      console.log(`⚠️ All attendees already invited - no changes needed`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return { added: 0, skipped: newAttendees.length };
    }

    const updatedAttendees = [
      ...existingAttendees,
      ...uniqueNewAttendees.map(email => ({ email }))
    ];

    console.log(`✅ Adding ${uniqueNewAttendees.length} new attendee(s)`);
    console.log(`📋 Total attendees: ${updatedAttendees.length}`);

    // Update the event with new attendees
    await calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      requestBody: {
        attendees: updatedAttendees
      },
      sendUpdates: 'all' // Send email invites to new attendees
    });

    console.log(`✅ Attendees added successfully! Calendar invites sent.`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return { added: uniqueNewAttendees.length, skipped: newAttendees.length - uniqueNewAttendees.length };
  } catch (error: any) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [GOOGLE CALENDAR] Error adding attendees');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`   Error message: ${error.message || error}`);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    throw error;
  }
}

/**
 * Delete event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  consultantId: string,
  googleEventId: string
) {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️ [GOOGLE CALENDAR] Deleting Calendar Event');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Consultant ID: ${consultantId}`);
    console.log(`🆔 Event ID: ${googleEventId}`);
    
    if (!googleEventId || googleEventId.trim() === '') {
      console.log('❌ [GOOGLE CALENDAR] Invalid or empty event ID');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return false;
    }
    
    const calendar = await getCalendarClient(consultantId);
    const calendarId = await getPrimaryCalendarId(consultantId);
    
    if (!calendarId) {
      console.log('❌ [GOOGLE CALENDAR] Calendar ID not found');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      throw new Error('Calendar ID not found');
    }

    console.log(`🌐 Calling Google Calendar API to delete event...`);
    await calendar.events.delete({
      calendarId,
      eventId: googleEventId,
      sendUpdates: 'all' // Notify attendees of cancellation
    });

    console.log(`✅ Event deleted successfully from Google Calendar!`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return true;
  } catch (error: any) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [GOOGLE CALENDAR] Error deleting event');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`   Event ID attempted: ${googleEventId}`);
    console.error(`   Error message: ${error.message || error}`);
    console.error(`   Error code: ${error.code || 'N/A'}`);
    if (error.response?.data) {
      console.error(`   API Response: ${JSON.stringify(error.response.data)}`);
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return false;
  }
}

/**
 * Fetch events from Google Calendar (for sync)
 */
export async function fetchGoogleCalendarEvents(
  consultantId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const calendar = await getCalendarClient(consultantId);
    const calendarId = await getPrimaryCalendarId(consultantId);
    
    if (!calendarId) {
      throw new Error('Calendar ID not found');
    }

    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    return [];
  }
}

/**
 * Sync events from Google Calendar to local database
 */
export async function syncGoogleCalendarToLocal(consultantId: string) {
  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90); // Sync next 90 days

    const googleEvents = await fetchGoogleCalendarEvents(consultantId, now, futureDate);

    for (const gEvent of googleEvents) {
      if (!gEvent.id || !gEvent.start?.dateTime || !gEvent.end?.dateTime) {
        continue; // Skip all-day events or events without proper times
      }

      // Check if event already exists in sync table
      const [existing] = await db
        .select()
        .from(consultantCalendarSync)
        .where(
          and(
            eq(consultantCalendarSync.consultantId, consultantId),
            eq(consultantCalendarSync.googleEventId, gEvent.id)
          )
        )
        .limit(1);

      if (existing) {
        // Update if changed
        await db
          .update(consultantCalendarSync)
          .set({
            title: gEvent.summary || 'Untitled Event',
            startTime: new Date(gEvent.start.dateTime),
            endTime: new Date(gEvent.end.dateTime),
            syncedAt: new Date()
          })
          .where(eq(consultantCalendarSync.id, existing.id));
      } else {
        // Insert new event
        await db
          .insert(consultantCalendarSync)
          .values({
            consultantId,
            googleEventId: gEvent.id,
            title: gEvent.summary || 'Untitled Event',
            startTime: new Date(gEvent.start.dateTime),
            endTime: new Date(gEvent.end.dateTime),
            source: 'google',
            isAvailable: false, // Events from Google mark time as unavailable
            syncedAt: new Date()
          });
      }
    }

    // Update last sync time
    await db
      .update(consultantAvailabilitySettings)
      .set({ lastSyncAt: new Date() })
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId));

    return { success: true, eventCount: googleEvents.length };
  } catch (error) {
    console.error('Error syncing Google Calendar to local:', error);
    throw error;
  }
}

/**
 * Check if consultant has Google Calendar connected via OAuth
 */
export async function isGoogleCalendarConnected(consultantId: string): Promise<boolean> {
  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);

  // Check OAuth credentials and refresh token
  return !!(settings?.googleRefreshToken && settings?.googleOAuthClientId && settings?.googleOAuthClientSecret);
}

/**
 * Validate consultant's OAuth credentials
 */
export async function validateOAuthCredentials(consultantId: string): Promise<boolean> {
  try {
    await getConsultantOAuthCredentials(consultantId);
    return true;
  } catch (error) {
    return false;
  }
}
