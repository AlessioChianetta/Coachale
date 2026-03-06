interface EmailContact {
  address: string;
  verified: boolean;
  status: string;
  priority: number;
  source: string;
}

interface PhoneContact {
  number: string;
  type: string;
  source: string;
  priority: number;
}

interface AllContacts {
  emails: EmailContact[];
  phones: PhoneContact[];
}

interface VerificationResult {
  is_valid: boolean;
  status: "valid" | "invalid" | "catch_all" | "disposable" | "unknown";
  confidence: number;
}

function isPersonalEmail(email: string): boolean {
  const local = email.split("@")[0].toLowerCase();
  const genericPrefixes = [
    "info", "contact", "admin", "support", "help", "hello", "office",
    "segreteria", "reception", "noreply", "no-reply", "webmaster",
    "postmaster", "sales", "marketing", "contatti", "direzione",
    "amministrazione", "ufficio", "generale", "pec", "fatturazione",
  ];
  return !genericPrefixes.some(prefix => local === prefix || local.startsWith(prefix + ".") || local.startsWith(prefix + "_"));
}

function getEmailPriorityScore(
  email: string,
  verification: VerificationResult | null,
  source: string
): number {
  let score = 0;

  if (verification) {
    switch (verification.status) {
      case "valid": score += 100; break;
      case "catch_all": score += 40; break;
      case "unknown": score += 20; break;
      case "disposable": score -= 50; break;
      case "invalid": score -= 100; break;
    }
  } else {
    score += 10;
  }

  if (isPersonalEmail(email)) {
    score += 30;
  }

  switch (source) {
    case "team_member": score += 20; break;
    case "website_scraped": score += 10; break;
    case "maps": score += 5; break;
    default: score += 5; break;
  }

  return score;
}

function classifyPhoneType(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("39") ? digits.substring(2) : digits;

  if (normalized.startsWith("3")) return "mobile";
  if (normalized.startsWith("800") || normalized.startsWith("803") || normalized.startsWith("899")) return "toll_free";
  if (normalized.startsWith("0")) return "landline";
  return "other";
}

function getPhonePriorityScore(phone: string, source: string): number {
  let score = 0;
  const phoneType = classifyPhoneType(phone);

  switch (phoneType) {
    case "mobile": score += 80; break;
    case "landline": score += 40; break;
    case "toll_free": score += 20; break;
    default: score += 30; break;
  }

  switch (source) {
    case "maps": score += 20; break;
    case "website_scraped": score += 15; break;
    default: score += 10; break;
  }

  return score;
}

export function selectBestContacts(
  emails: string[],
  phones: string[],
  verificationResults: Map<string, VerificationResult>,
  mapsPhone: string | null,
  teamMembers?: Array<{ name?: string; role?: string; email?: string }>
): {
  allContacts: AllContacts;
  primaryEmail: string | null;
  primaryPhone: string | null;
  emailVerified: boolean;
  emailVerificationStatus: string | null;
} {
  const emailSources = new Map<string, string>();
  for (const email of emails) {
    emailSources.set(email, "website_scraped");
  }
  if (teamMembers) {
    for (const member of teamMembers) {
      if (member.email && member.email.includes("@")) {
        emailSources.set(member.email, "team_member");
        if (!emails.includes(member.email)) {
          emails = [...emails, member.email];
        }
      }
    }
  }

  const phoneSources = new Map<string, string>();
  for (const phone of phones) {
    phoneSources.set(phone, "website_scraped");
  }
  if (mapsPhone) {
    phoneSources.set(mapsPhone, "maps");
    if (!phones.includes(mapsPhone)) {
      phones = [...phones, mapsPhone];
    }
  }

  const scoredEmails: EmailContact[] = emails
    .filter(e => e && e.includes("@"))
    .map(email => {
      const verification = verificationResults.get(email) || null;
      const source = emailSources.get(email) || "unknown";
      const priority = getEmailPriorityScore(email, verification, source);
      return {
        address: email,
        verified: verification?.is_valid ?? false,
        status: verification?.status ?? "unknown",
        priority,
        source,
      };
    })
    .filter(e => e.status !== "invalid" && e.status !== "disposable")
    .sort((a, b) => b.priority - a.priority);

  const scoredPhones: PhoneContact[] = phones
    .filter(p => p && p.trim())
    .map(phone => {
      const source = phoneSources.get(phone) || "unknown";
      const priority = getPhonePriorityScore(phone, source);
      return {
        number: phone,
        type: classifyPhoneType(phone),
        source,
        priority,
      };
    })
    .sort((a, b) => b.priority - a.priority);

  const bestEmail = scoredEmails.length > 0 ? scoredEmails[0] : null;
  const bestPhone = scoredPhones.length > 0 ? scoredPhones[0] : null;

  return {
    allContacts: {
      emails: scoredEmails,
      phones: scoredPhones,
    },
    primaryEmail: bestEmail?.address ?? null,
    primaryPhone: bestPhone?.number ?? null,
    emailVerified: bestEmail?.verified ?? false,
    emailVerificationStatus: bestEmail?.status ?? null,
  };
}

export function shouldAllowAutomatedOutreach(
  emailVerified: boolean,
  emailVerificationStatus: string | null
): boolean {
  if (!emailVerified) return false;
  return emailVerificationStatus === "valid";
}
