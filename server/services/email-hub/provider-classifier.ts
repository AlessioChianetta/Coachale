export type ProviderType = 'send_only' | 'full_service' | 'hosting' | 'unknown';

export interface ProviderClassification {
  providerType: ProviderType;
  providerName: string;
  requiresManualImap: boolean;
  suggestedImapHost: string | null;
  suggestedImapPort: number | null;
  warningText: string | null;
  description: string;
}

export interface ItalianProviderPreset {
  name: string;
  imapHost: string;
  imapPort: number;
  smtpHost?: string;
  smtpPort?: number;
}

export const ITALIAN_PROVIDERS: Record<string, ItalianProviderPreset> = {
  'register.it': {
    name: 'Register.it',
    imapHost: 'imap.securemail.pro',
    imapPort: 993,
    smtpHost: 'authsmtp.securemail.pro',
    smtpPort: 587,
  },
  'aruba': {
    name: 'Aruba',
    imapHost: 'imap.aruba.it',
    imapPort: 993,
    smtpHost: 'smtp.aruba.it',
    smtpPort: 465,
  },
  'aruba_pec': {
    name: 'Aruba PEC',
    imapHost: 'imaps.pec.aruba.it',
    imapPort: 993,
    smtpHost: 'smtps.pec.aruba.it',
    smtpPort: 465,
  },
  'mailserver.it': {
    name: 'Mailserver.it',
    imapHost: 'imap.mailserver.it',
    imapPort: 993,
    smtpHost: 'smtp.mailserver.it',
    smtpPort: 465,
  },
  'ovh': {
    name: 'OVH',
    imapHost: 'ssl0.ovh.net',
    imapPort: 993,
    smtpHost: 'ssl0.ovh.net',
    smtpPort: 465,
  },
  'libero': {
    name: 'Libero Mail',
    imapHost: 'imapmail.libero.it',
    imapPort: 993,
    smtpHost: 'smtp.libero.it',
    smtpPort: 465,
  },
  'virgilio': {
    name: 'Virgilio Mail',
    imapHost: 'imap.virgilio.it',
    imapPort: 993,
    smtpHost: 'smtp.virgilio.it',
    smtpPort: 465,
  },
  'tiscali': {
    name: 'Tiscali',
    imapHost: 'imap.tiscali.it',
    imapPort: 993,
    smtpHost: 'smtp.tiscali.it',
    smtpPort: 465,
  },
  'fastwebnet': {
    name: 'Fastweb',
    imapHost: 'imap.fastwebnet.it',
    imapPort: 993,
    smtpHost: 'smtp.fastwebnet.it',
    smtpPort: 465,
  },
};

interface ProviderPattern {
  pattern: RegExp;
  providerName: string;
  providerType: ProviderType;
  suggestedImapHost: string | null;
  suggestedImapPort: number | null;
  description: string;
}

const PROVIDER_PATTERNS: ProviderPattern[] = [
  // Send-only providers (transactional email services)
  {
    pattern: /email-smtp\..*\.amazonaws\.com/i,
    providerName: 'Amazon SES',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Amazon Simple Email Service - servizio di invio email transazionali',
  },
  {
    pattern: /smtp\.sendgrid\.net/i,
    providerName: 'SendGrid',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'SendGrid - piattaforma di email marketing e transazionali',
  },
  {
    pattern: /smtp\.mailgun\.org/i,
    providerName: 'Mailgun',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Mailgun - servizio di invio email per sviluppatori',
  },
  {
    pattern: /smtp\.postmarkapp\.com/i,
    providerName: 'Postmark',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Postmark - servizio di email transazionali ad alta deliverability',
  },
  {
    pattern: /in(-v\d+)?\.mailjet\.com/i,
    providerName: 'Mailjet',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Mailjet - piattaforma di email marketing e transazionali',
  },
  {
    pattern: /(smtp(?:-relay)?\.brevo\.com|smtp(?:-relay)?\.sendinblue\.com)/i,
    providerName: 'Brevo (Sendinblue)',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Brevo - piattaforma all-in-one per email transazionali e marketing',
  },
  {
    pattern: /smtp\.mailersend\.(com|net)/i,
    providerName: 'MailerSend',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'MailerSend - servizio di email transazionali per sviluppatori',
  },
  {
    pattern: /mail\.smtp2go\.com/i,
    providerName: 'SMTP2GO',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'SMTP2GO - servizio SMTP relay affidabile',
  },
  {
    pattern: /(live|sandbox)\.smtp\.mailtrap\.io/i,
    providerName: 'Mailtrap',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Mailtrap - piattaforma di test e invio email',
  },
  {
    pattern: /smtp\.zeptomail\.com/i,
    providerName: 'Zoho ZeptoMail',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'ZeptoMail - servizio email transazionali di Zoho',
  },
  {
    pattern: /smtp\.elasticemail\.com/i,
    providerName: 'Elastic Email',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Elastic Email - servizio SMTP economico per grandi volumi',
  },
  {
    pattern: /smtp\.resend\.(com|dev)/i,
    providerName: 'Resend',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Resend - API email moderna per sviluppatori',
  },
  {
    pattern: /smtp\.mandrillapp\.com/i,
    providerName: 'Mandrill (Mailchimp)',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'Mandrill - servizio email transazionali di Mailchimp',
  },
  {
    pattern: /smtp\.sendpulse\.com/i,
    providerName: 'SendPulse',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'SendPulse - piattaforma multi-canale per marketing',
  },
  {
    pattern: /smtp\.sparkpostmail\.com/i,
    providerName: 'SparkPost',
    providerType: 'send_only',
    suggestedImapHost: null,
    suggestedImapPort: null,
    description: 'SparkPost - servizio email per grandi volumi',
  },
  
  // Full-service providers (IMAP + SMTP)
  {
    pattern: /smtp\.gmail\.com/i,
    providerName: 'Gmail',
    providerType: 'full_service',
    suggestedImapHost: 'imap.gmail.com',
    suggestedImapPort: 993,
    description: 'Google Gmail - servizio email completo con IMAP e SMTP',
  },
  {
    pattern: /(smtp\.office365\.com|smtp-mail\.outlook\.com)/i,
    providerName: 'Microsoft 365 / Outlook',
    providerType: 'full_service',
    suggestedImapHost: 'outlook.office365.com',
    suggestedImapPort: 993,
    description: 'Microsoft 365 / Outlook - servizio email aziendale completo',
  },
  {
    pattern: /smtp\.mail\.yahoo\.com/i,
    providerName: 'Yahoo Mail',
    providerType: 'full_service',
    suggestedImapHost: 'imap.mail.yahoo.com',
    suggestedImapPort: 993,
    description: 'Yahoo Mail - servizio email completo con IMAP e SMTP',
  },
  {
    pattern: /smtp\.mail\.me\.com/i,
    providerName: 'iCloud Mail',
    providerType: 'full_service',
    suggestedImapHost: 'imap.mail.me.com',
    suggestedImapPort: 993,
    description: 'Apple iCloud Mail - servizio email completo',
  },
  
  // Hosting providers (likely has IMAP)
  {
    pattern: /(smtpout\.secureserver\.net|smtp\.secureserver\.net)/i,
    providerName: 'GoDaddy',
    providerType: 'hosting',
    suggestedImapHost: 'imap.secureserver.net',
    suggestedImapPort: 993,
    description: 'GoDaddy - hosting email con supporto IMAP',
  },
  {
    pattern: /(out\.aruba\.it|smtps?\.aruba\.it)/i,
    providerName: 'Aruba',
    providerType: 'hosting',
    suggestedImapHost: 'imap.aruba.it',
    suggestedImapPort: 993,
    description: 'Aruba - provider italiano con hosting email',
  },
  {
    pattern: /smtps?\.pec\.aruba\.it/i,
    providerName: 'Aruba PEC',
    providerType: 'hosting',
    suggestedImapHost: 'imaps.pec.aruba.it',
    suggestedImapPort: 993,
    description: 'Aruba PEC - posta elettronica certificata',
  },
  {
    pattern: /smtp\.libero\.it/i,
    providerName: 'Libero Mail',
    providerType: 'full_service',
    suggestedImapHost: 'imapmail.libero.it',
    suggestedImapPort: 993,
    description: 'Libero Mail - provider email italiano',
  },
  {
    pattern: /smtp\.virgilio\.it/i,
    providerName: 'Virgilio Mail',
    providerType: 'full_service',
    suggestedImapHost: 'imap.virgilio.it',
    suggestedImapPort: 993,
    description: 'Virgilio Mail - provider email italiano',
  },
  {
    pattern: /smtp\.tiscali\.it/i,
    providerName: 'Tiscali',
    providerType: 'full_service',
    suggestedImapHost: 'imap.tiscali.it',
    suggestedImapPort: 993,
    description: 'Tiscali - provider email italiano',
  },
  {
    pattern: /smtp\.fastwebnet\.it/i,
    providerName: 'Fastweb',
    providerType: 'full_service',
    suggestedImapHost: 'imap.fastwebnet.it',
    suggestedImapPort: 993,
    description: 'Fastweb - provider email italiano',
  },
  {
    pattern: /(smtp\.register\.it|authsmtp\.securemail\.pro)/i,
    providerName: 'Register.it',
    providerType: 'hosting',
    suggestedImapHost: 'imap.securemail.pro',
    suggestedImapPort: 993,
    description: 'Register.it - provider italiano con hosting email',
  },
  {
    pattern: /smtp\.mailserver\.it/i,
    providerName: 'Mailserver.it',
    providerType: 'hosting',
    suggestedImapHost: 'imap.mailserver.it',
    suggestedImapPort: 993,
    description: 'Mailserver.it - servizio email italiano',
  },
  {
    pattern: /(ssl0\.ovh\.net|smtp\..*\.ovh\.net)/i,
    providerName: 'OVH',
    providerType: 'hosting',
    suggestedImapHost: 'ssl0.ovh.net',
    suggestedImapPort: 993,
    description: 'OVH - hosting europeo con servizio email',
  },
  {
    pattern: /smtp\.ionos\.(com|it|de)/i,
    providerName: 'IONOS (1&1)',
    providerType: 'hosting',
    suggestedImapHost: 'imap.ionos.com',
    suggestedImapPort: 993,
    description: 'IONOS - hosting con servizio email',
  },
  {
    pattern: /smtp\.hostinger\.(com|it)/i,
    providerName: 'Hostinger',
    providerType: 'hosting',
    suggestedImapHost: 'imap.hostinger.com',
    suggestedImapPort: 993,
    description: 'Hostinger - hosting con servizio email',
  },
  {
    pattern: /mail\.protonmail\.ch/i,
    providerName: 'ProtonMail Bridge',
    providerType: 'full_service',
    suggestedImapHost: '127.0.0.1',
    suggestedImapPort: 1143,
    description: 'ProtonMail via Bridge - email sicura con crittografia end-to-end',
  },
];

const WARNING_MESSAGES = {
  send_only: "Questo servizio è solo per l'invio di email. Per ricevere email, devi configurare un provider IMAP separato.",
  transactional_detected: "Rilevato servizio di invio transazionale. Verifica se supporta IMAP.",
  unknown: "Provider non riconosciuto. Potrebbe essere necessario configurare manualmente le impostazioni IMAP.",
};

export function classifyEmailProvider(smtpHost: string): ProviderClassification {
  if (!smtpHost || typeof smtpHost !== 'string') {
    return {
      providerType: 'unknown',
      providerName: 'Sconosciuto',
      requiresManualImap: true,
      suggestedImapHost: null,
      suggestedImapPort: null,
      warningText: WARNING_MESSAGES.unknown,
      description: 'Impossibile determinare il provider email',
    };
  }

  const normalizedHost = smtpHost.toLowerCase().trim();

  for (const providerPattern of PROVIDER_PATTERNS) {
    if (providerPattern.pattern.test(normalizedHost)) {
      const isSendOnly = providerPattern.providerType === 'send_only';
      
      return {
        providerType: providerPattern.providerType,
        providerName: providerPattern.providerName,
        requiresManualImap: isSendOnly || providerPattern.suggestedImapHost === null,
        suggestedImapHost: providerPattern.suggestedImapHost,
        suggestedImapPort: providerPattern.suggestedImapPort,
        warningText: isSendOnly ? WARNING_MESSAGES.send_only : null,
        description: providerPattern.description,
      };
    }
  }

  // Check for transactional email patterns that weren't explicitly matched
  const transactionalPatterns = [
    /ses\./i,
    /sendgrid/i,
    /mailgun/i,
    /postmark/i,
    /mailjet/i,
    /mandrill/i,
    /sparkpost/i,
    /mailchimp/i,
    /sendinblue/i,
    /brevo/i,
  ];

  for (const pattern of transactionalPatterns) {
    if (pattern.test(normalizedHost)) {
      return {
        providerType: 'send_only',
        providerName: 'Servizio Transazionale',
        requiresManualImap: true,
        suggestedImapHost: null,
        suggestedImapPort: null,
        warningText: WARNING_MESSAGES.transactional_detected,
        description: 'Servizio di invio email transazionale rilevato',
      };
    }
  }

  // Try to guess IMAP from SMTP host for unknown providers
  const guessedImapHost = guessImapFromSmtp(normalizedHost);

  return {
    providerType: 'unknown',
    providerName: extractProviderNameFromHost(normalizedHost),
    requiresManualImap: true,
    suggestedImapHost: guessedImapHost,
    suggestedImapPort: guessedImapHost ? 993 : null,
    warningText: WARNING_MESSAGES.unknown,
    description: 'Provider non riconosciuto - verifica le impostazioni IMAP',
  };
}

function guessImapFromSmtp(smtpHost: string): string | null {
  // Common patterns: smtp.domain.com -> imap.domain.com
  if (smtpHost.startsWith('smtp.')) {
    return smtpHost.replace(/^smtp\./, 'imap.');
  }
  if (smtpHost.startsWith('smtps.')) {
    return smtpHost.replace(/^smtps\./, 'imaps.');
  }
  if (smtpHost.startsWith('mail.')) {
    return smtpHost; // mail.domain.com often works for both
  }
  if (smtpHost.startsWith('out.')) {
    return smtpHost.replace(/^out\./, 'in.');
  }
  return null;
}

function extractProviderNameFromHost(host: string): string {
  // Extract domain name from host
  const parts = host.split('.');
  if (parts.length >= 2) {
    // Get the main domain (e.g., "example" from "smtp.example.com")
    const domainIndex = parts.length >= 3 ? parts.length - 2 : 0;
    const domain = parts[domainIndex];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return 'Sconosciuto';
}

export function getItalianProviderPreset(providerKey: string): ItalianProviderPreset | null {
  const normalizedKey = providerKey.toLowerCase().trim();
  return ITALIAN_PROVIDERS[normalizedKey] || null;
}

export function getAllItalianProviders(): ItalianProviderPreset[] {
  return Object.values(ITALIAN_PROVIDERS);
}

export function isSendOnlyProvider(smtpHost: string): boolean {
  const classification = classifyEmailProvider(smtpHost);
  return classification.providerType === 'send_only';
}

export function requiresImapConfiguration(smtpHost: string): boolean {
  const classification = classifyEmailProvider(smtpHost);
  return classification.requiresManualImap;
}
