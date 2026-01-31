import { db } from '../db';
import { users, clients, voiceNumbers } from '@shared/schema';
import { eq, and, or, ilike } from 'drizzle-orm';
import { buildUserContext } from '../ai-context-builder';

interface CallerInfo {
  userId: string;
  clientId: string | null;
  consultantId: string;
  name: string;
  email: string | null;
  phoneNumber: string;
  isRecognized: boolean;
  isClient: boolean;
}

interface CallerContext {
  callerInfo: CallerInfo;
  userContext: any;
  greeting: string;
}

export class VoiceCallerLookup {
  async lookupCaller(callerId: string, voiceNumberId: string): Promise<CallerContext | null> {
    const normalizedPhone = this.normalizePhoneNumber(callerId);
    console.log(`[CallerLookup] Looking up caller: ${callerId} → ${normalizedPhone}`);

    const voiceNumber = await this.getVoiceNumber(voiceNumberId);
    if (!voiceNumber) {
      console.error(`[CallerLookup] Voice number not found: ${voiceNumberId}`);
      return null;
    }

    const consultantId = voiceNumber.consultantId;

    const user = await this.findUserByPhone(normalizedPhone);
    
    if (user) {
      console.log(`[CallerLookup] Found registered user: ${user.id} (${user.name})`);
      
      const client = await this.findClientByUserId(user.id, consultantId);
      
      const callerInfo: CallerInfo = {
        userId: user.id,
        clientId: client?.id.toString() || null,
        consultantId,
        name: user.name || 'Cliente',
        email: user.email,
        phoneNumber: normalizedPhone,
        isRecognized: true,
        isClient: !!client,
      };

      let userContext = null;
      if (client) {
        try {
          userContext = await buildUserContext(client.id.toString(), consultantId);
          console.log(`[CallerLookup] Built full context for client ${client.id}`);
        } catch (error) {
          console.error(`[CallerLookup] Error building context:`, error);
        }
      }

      const greeting = this.buildPersonalizedGreeting(callerInfo, voiceNumber);

      return {
        callerInfo,
        userContext,
        greeting,
      };
    }

    console.log(`[CallerLookup] Unknown caller: ${normalizedPhone}`);
    
    const callerInfo: CallerInfo = {
      userId: '',
      clientId: null,
      consultantId,
      name: 'Visitatore',
      email: null,
      phoneNumber: normalizedPhone,
      isRecognized: false,
      isClient: false,
    };

    const greeting = voiceNumber.welcomeMessage || 
      'Buongiorno, sono Alessia, l\'assistente virtuale. Come posso aiutarti?';

    return {
      callerInfo,
      userContext: null,
      greeting,
    };
  }

  private normalizePhoneNumber(phone: string): string {
    let normalized = phone.replace(/[\s\-\(\)\.]/g, '');

    if (normalized.startsWith('00')) {
      normalized = '+' + normalized.substring(2);
    }

    if (!normalized.startsWith('+')) {
      if (/^3[0-9]{8,9}$/.test(normalized)) {
        normalized = '+39' + normalized;
      }
    }

    return normalized;
  }

  private async getVoiceNumber(voiceNumberId: string) {
    try {
      const result = await db
        .select()
        .from(voiceNumbers)
        .where(eq(voiceNumbers.id, voiceNumberId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('[CallerLookup] Error getting voice number:', error);
      return null;
    }
  }

  private async findUserByPhone(phoneNumber: string) {
    const phoneVariants = this.generatePhoneVariants(phoneNumber);

    try {
      for (const variant of phoneVariants) {
        const result = await db
          .select()
          .from(users)
          .where(eq(users.phoneNumber, variant))
          .limit(1);

        if (result.length > 0) {
          return result[0];
        }
      }

      return null;
    } catch (error) {
      console.error('[CallerLookup] Error finding user by phone:', error);
      return null;
    }
  }

  private generatePhoneVariants(phone: string): string[] {
    const variants: string[] = [phone];

    if (phone.startsWith('+39')) {
      variants.push(phone.substring(3));
      variants.push('0039' + phone.substring(1));
    }

    if (phone.startsWith('+')) {
      variants.push(phone.substring(1));
      variants.push('00' + phone.substring(1));
    }

    return [...new Set(variants)];
  }

  private async findClientByUserId(userId: string, consultantId: string) {
    try {
      const result = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.userId, userId),
            eq(clients.consultantId, consultantId)
          )
        )
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('[CallerLookup] Error finding client:', error);
      return null;
    }
  }

  private buildPersonalizedGreeting(callerInfo: CallerInfo, voiceNumber: any): string {
    const hour = new Date().getHours();
    let timeGreeting: string;

    if (hour < 12) {
      timeGreeting = 'Buongiorno';
    } else if (hour < 18) {
      timeGreeting = 'Buon pomeriggio';
    } else {
      timeGreeting = 'Buonasera';
    }

    if (callerInfo.isClient) {
      const firstName = callerInfo.name.split(' ')[0];
      return `${timeGreeting} ${firstName}! Sono Alessia, l'assistente di ${voiceNumber.displayName || 'il tuo consulente'}. Come posso aiutarti oggi?`;
    }

    if (callerInfo.isRecognized) {
      return `${timeGreeting}! Sono Alessia. Vedo che hai già un account. Come posso esserti utile?`;
    }

    return voiceNumber.welcomeMessage || 
      `${timeGreeting}! Sono Alessia, l'assistente virtuale. Come posso aiutarti?`;
  }

  async createLeadFromCall(callerId: string, consultantId: string): Promise<string | null> {
    const normalizedPhone = this.normalizePhoneNumber(callerId);

    console.log(`[CallerLookup] Would create lead for: ${normalizedPhone}`);
    return null;
  }
}

export const callerLookup = new VoiceCallerLookup();
