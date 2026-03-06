import * as dns from "dns";
import * as net from "net";

export interface VerificationResult {
  is_valid: boolean;
  status: "valid" | "invalid" | "catch_all" | "disposable" | "unknown";
  confidence: number;
}

const DISPOSABLE_DOMAINS: Set<string> = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
  "guerrillamail.net", "guerrillamail.org", "spam4.me", "trashmail.com",
  "trashmail.me", "trashmail.net", "trashmail.org", "trashmail.at",
  "trashmail.io", "trashmail.ws", "tempail.com", "tempr.email",
  "temp-mail.org", "temp-mail.io", "dispostable.com", "mailnesia.com",
  "getnada.com", "fakeinbox.com", "maildrop.cc", "discard.email",
  "harakirimail.com", "33mail.com", "mailcatch.com", "mailexpire.com",
  "mailmoat.com", "mytemp.email", "spamgourmet.com", "tempmailaddress.com",
  "throwam.com", "tmail.ws", "tmpmail.net", "tmpmail.org", "trashymail.com",
  "trashymail.net", "wegwerfmail.de", "wegwerfmail.net", "yopmail.fr",
  "yopmail.net", "jetable.org", "nospam.ze.tc", "mailzilla.com",
  "tempinbox.com", "spaml.com", "uggsrock.com", "discardmail.com",
  "discardmail.de", "spambox.us", "spamevader.com", "spamfree24.org",
  "spamhole.com", "spamify.com", "spaminator.de", "spamkill.info",
  "spaml.de", "spamoff.de", "spamstack.net", "spamtrail.com",
  "temporaryemail.net", "temporaryforwarding.com", "temporaryinbox.com",
  "temporarymailaddress.com", "thankyou2010.com", "thisisnotmyrealemail.com",
  "tradermail.info", "turual.com", "veryrealemail.com", "viditag.com",
  "viewcastmedia.com", "viewcastmedia.net", "viewcastmedia.org",
  "vomoto.com", "vpn.st", "vsimcard.com", "vubby.com",
  "wasteland.rfc822.org", "webemail.me", "weg-werf-email.de",
  "wegwerfadresse.de", "wegwerfemail.com", "wegwerfemail.de",
  "wegwerfmail.info", "wh4f.org", "whatiaas.com", "whatpaas.com",
  "whyspam.me", "wikidocuslice.com", "willhackforfood.biz",
  "willselfdestruct.com", "winemaven.info", "wronghead.com",
  "wuzup.net", "wuzupmail.net", "wwwnew.eu", "xagloo.com",
  "xemaps.com", "xents.com", "xjoi.com", "xmaily.com",
  "xoxox.cc", "xyzfree.net", "yapped.net", "yeah.net",
  "yep.it", "yogamaven.com", "yomail.info", "yopmail.gq",
  "ypmail.webarnak.fr.eu.org", "yuurok.com", "zehnminutenmail.de",
  "zippymail.info", "zoaxe.com", "zoemail.org", "10minutemail.com",
  "20minutemail.com", "20minutemail.it", "emailondeck.com",
  "mailhazard.com", "mailhazard.us", "mailhz.me", "tempsky.com",
  "temptam.com", "mailcuk.com", "mvrht.com", "emailfake.com",
  "crazymailing.com", "trbvm.com", "armyspy.com", "cuvox.de",
  "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com",
  "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
  "burnermail.io", "inboxbear.com", "mailsac.com", "anonaddy.com",
  "simplelogin.io", "relay.firefox.com", "mozmail.com",
  "duck.com", "privaterelay.appleid.com",
  "mohmal.com", "emailna.co", "mailtemp.net", "tempmailo.com",
  "emailisvalid.com", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
  "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "mail-temporaire.fr", "filzmail.com", "frapmail.com", "front14.org",
  "fux0ringduh.com", "gishpuppy.com", "great-host.in", "greensloth.com",
  "haltospam.com", "hotpop.com", "ichimail.com", "imstations.com",
  "incognitomail.com", "ipoo.org", "irish2me.com", "jetable.com",
  "kasmail.com", "koszmail.pl", "kurzepost.de", "lawlita.com",
  "letthemeatspam.com", "lhsdv.com", "lifebyfood.com", "lookugly.com",
  "lr78.com", "lroid.com", "maileater.com", "mailin8r.com",
  "mailinator.net", "mailinator2.com", "mailincubator.com", "mailme.ir",
  "mailme.lv", "mailmetrash.com", "mailnator.com", "mailnull.com",
  "mailshell.com", "mailsiphon.com", "mailslite.com", "mailzilla.org",
  "mbx.cc", "meltmail.com", "mierdamail.com", "mintemail.com",
  "mjukgansen.com", "mobi.web.id", "moburl.com", "mt2015.com",
  "mx0.wwwnew.eu", "mypartyclip.de", "mytempemail.com", "nepwk.com",
  "nervmich.net", "nervtansen.de", "netmails.com", "netmails.net",
  "neverbox.com", "no-spam.ws", "nobulk.com", "noclickemail.com",
  "nogmailspam.info", "nomail2me.com", "nothingtoseehere.ca",
  "nowmymail.com", "nurfuerspam.de", "nwldx.com", "objectmail.com",
  "obobbo.com", "onewaymail.com", "oopi.org", "ordinaryamerican.net",
  "otherinbox.com", "ourklips.com", "outlawspam.com", "ovpn.to",
  "owlpic.com", "pancakemail.com", "pimpedupmyspace.com", "pjjkp.com",
  "plexolan.de", "pookmail.com", "privacy.net", "proxymail.eu",
  "prtnx.com", "putthisinyouremail.com", "quickinbox.com", "rcpt.at",
  "reallymymail.com", "recode.me", "recursor.net", "regbypass.com",
  "rejectmail.com", "rklips.com", "rmqkr.net", "rppkn.com",
  "rtrtr.com", "s0ny.net", "safe-mail.net", "safersignup.de",
  "safetymail.info", "safetypost.de", "sandelf.de", "saynotospams.com",
  "scatmail.com", "schafmail.de", "selfdestructingmail.com",
  "shiftmail.com", "shitmail.me", "shortmail.net", "sibmail.com",
  "skeefmail.com", "slaskpost.se", "slipry.net", "slopsbox.com",
  "smashmail.de", "soodonims.com", "spam.la", "spam.su",
  "spamavert.com", "spambob.com", "spambob.net", "spambob.org",
  "spambog.com", "spambog.de", "spambog.ru", "spambox.info",
  "spamcannon.com", "spamcannon.net", "spamcero.com", "spamcorptastic.com",
  "spamcowboy.com", "spamcowboy.net", "spamcowboy.org", "spamday.com",
  "spamex.com", "spamfighter.cf", "spamfighter.ga", "spamfighter.gq",
  "spamfighter.ml", "spamfighter.tk", "spamfree24.com", "spamfree24.de",
  "spamfree24.eu", "spamfree24.info", "spamfree24.net",
  "spamgoes.in", "spamherelots.com", "spamhereplease.com",
  "spammotel.com", "spamobox.com", "spamslicer.com", "spamspot.com",
  "spamthis.co.uk", "spamtrap.ro", "spamwc.de",
  "temp.emeraldcraft.com", "temp.headstrong.de", "tempalias.com",
  "tempe4mail.com", "tempemail.biz", "tempemail.co.za", "tempemail.com",
  "tempemail.net", "tempmail.eu", "tempmail.it", "tempmail2.com",
  "tempmaildemo.com", "tempmailer.com", "tempmailer.de",
  "tempomail.fr", "temporarily.de", "temporarioemail.com.br",
  "temporaryemail.us", "temporary-mail.net",
  "thc.st", "thecriminals.com", "throam.com", "throwawayemailaddress.com",
  "tittbit.in", "tmailinator.com", "toiea.com",
  "trash-amil.com", "trash-mail.at", "trash-mail.com",
  "trash-mail.de", "trash2009.com", "trashemail.de",
  "trashmailer.com", "trillianpro.com", "twinmail.de",
  "tyldd.com", "umail.net", "upliftnow.com", "uplipht.com",
  "venompen.com", "fixmail.tk", "flurred.com",
  "dodgeit.com", "dodgit.com", "dontreg.com", "e4ward.com",
  "emailigo.de", "emailmiser.com", "emailsensei.com",
  "emailtemporario.com.br", "ephemail.net",
  "binkmail.com", "bobmail.info", "chammy.info", "devnullmail.com",
  "10minutemail.co.za", "mailforspam.com", "correotemporal.org",
  "pokemail.net", "byom.de",
  "getairmail.com", "mfsa.ru", "mfsa.info", "imgof.com",
  "dropmail.me", "emkei.cz", "eml.pp.ua", "extremail.ru",
  "get2mail.fr", "getonemail.com", "getonemail.net",
  "girlsindetention.com", "gmal.com", "goemailgo.com",
  "hmamail.com", "hulapla.de", "ieh-mail.de",
  "imgjar.com", "insorg-mail.info", "killmail.com",
  "klzlk.com", "kostenlosemailadresse.de", "kmail.com.my",
  "mail-filter.com", "mail-temporaire.com", "mail2rss.org",
  "mailblocks.com", "mailbucket.org", "mailconsul.com",
  "maileimer.de", "mailforspam.com", "mailfree.ga",
  "mailfreeonline.com", "mailfs.com", "mailimate.com",
  "mailismagic.com", "mailmate.com", "mailscrap.com",
  "mailstink.com", "mailtemp.info", "mailtemporaire.com",
  "mailtemporaire.fr", "malahierba.com", "manifestgenerator.com",
  "meandmycat.com", "messagebeamer.de", "mezimages.net",
  "mmmmail.com", "moakt.com", "mt2014.com",
  "mx.awiki.org", "mymail-in.net", "myphantom.com",
  "mysamp.de", "myspaceinc.com", "myspaceinc.net",
  "myspaceinc.org", "myspacepimpedup.com", "mytrashmail.com",
  "neomailbox.com", "nextmail.info", "noblepioneer.com",
  "notvpn.com", "nurfuerspam.com", "nutpa.net",
  "oneoffemail.com", "onlineanschreiben.de", "opamail.com",
  "opentrash.com", "partybombe.de", "pepbot.com",
  "pfui.ru", "pleasenospam.email", "politikerclub.de",
  "punkass.com", "putthisinyouremail.com",
  "remail.cf", "remail.ga", "resortarea.com",
  "ruffrey.com", "s33db0x.com", "safaat.cf",
  "safaat.ga", "safaat.gq", "safaat.ml", "safaat.tk",
  "safepost.net", "sharktank.ga", "shieldedmail.com",
  "sinnlos-mail.de", "siteposter.net", "skeefmail.com",
  "slaskpost.se", "sofortmail.de", "sogetthis.com",
  "sohu.com", "solidmail.de", "solvemail.info",
  "spamarrest.com", "spamavert.com",
  "sporexpert.com", "squizzy.de", "stinkefinger.net",
  "stop-my-spam.cf", "stop-my-spam.com", "stop-my-spam.ga",
  "stop-my-spam.ml", "stop-my-spam.tk",
  "stuffmail.de", "super-auswahl.de", "supergreatmail.com",
  "superstachel.de", "suremail.info",
  "sweetxxx.de", "tafmail.com", "tafoi.gr",
  "tagyoureit.com", "teewars.org", "teleworm.com",
  "thecloudindex.com", "thrma.com", "throwawaymail.com",
  "tradermail.info", "trash2011.com", "trashdevil.com",
  "trashdevil.de", "trashemails.de",
  "trashmail.de", "trashmail.me", "trash-me.com",
  "uroid.com", "us.af", "venompen.com",
  "veryday.ch", "veryday.eu", "veryday.info",
  "vfemail.net", "vickaentb.cf", "vickaentb.ga",
  "vickaentb.gq", "vickaentb.ml", "vickaentb.tk",
  "wmail.cf", "wolfsmail.tk", "writeme.us",
  "xmail.com", "ycare.de", "yogamaven.com",
  "zehnminuten.de", "zoemail.com", "zoemail.net",
]);

const verificationCache: Map<string, { result: VerificationResult; timestamp: number }> = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const catchAllDomainCache: Map<string, { isCatchAll: boolean; timestamp: number }> = new Map();

const lastSmtpCheckByDomain: Map<string, number> = new Map();
const SMTP_RATE_LIMIT_MS = 2000;

function isValidSyntax(email: string): boolean {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!regex.test(email)) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain.includes(".")) return false;
  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) return false;
  return true;
}

function getDomain(email: string): string {
  return email.split("@")[1].toLowerCase();
}

async function resolveMx(domain: string): Promise<dns.MxRecord[]> {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses.sort((a, b) => a.priority - b.priority));
    });
  });
}

async function enforceRateLimit(domain: string): Promise<void> {
  const lastTime = lastSmtpCheckByDomain.get(domain);
  if (lastTime) {
    const elapsed = Date.now() - lastTime;
    if (elapsed < SMTP_RATE_LIMIT_MS) {
      await new Promise(r => setTimeout(r, SMTP_RATE_LIMIT_MS - elapsed));
    }
  }
  lastSmtpCheckByDomain.set(domain, Date.now());
}

async function smtpCheck(email: string, mxHost: string, timeoutMs: number = 10000): Promise<{ accepted: boolean; code: number }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let step = 0;
    let responseBuffer = "";
    let resolved = false;

    const finish = (accepted: boolean, code: number) => {
      if (resolved) return;
      resolved = true;
      try { socket.write("QUIT\r\n"); } catch {}
      try { socket.destroy(); } catch {}
      resolve({ accepted, code });
    };

    const timeout = setTimeout(() => finish(false, 0), timeoutMs);

    socket.on("error", () => {
      clearTimeout(timeout);
      finish(false, 0);
    });
    socket.on("timeout", () => {
      clearTimeout(timeout);
      finish(false, 0);
    });
    socket.on("close", () => {
      clearTimeout(timeout);
      if (!resolved) finish(false, 0);
    });
    socket.setTimeout(timeoutMs);

    socket.connect(25, mxHost);

    socket.on("data", (data: Buffer) => {
      responseBuffer += data.toString();
      const lines = responseBuffer.split("\r\n");
      responseBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const code = parseInt(line.substring(0, 3));
        if (isNaN(code)) continue;

        if (line.length > 3 && line[3] === "-") continue;

        switch (step) {
          case 0:
            if (code >= 200 && code < 300) {
              step = 1;
              socket.write("EHLO verify.local\r\n");
            } else {
              clearTimeout(timeout);
              finish(false, code);
            }
            break;
          case 1:
            if (code >= 200 && code < 300) {
              step = 2;
              socket.write("MAIL FROM:<verify@verify.local>\r\n");
            } else {
              clearTimeout(timeout);
              finish(false, code);
            }
            break;
          case 2:
            if (code >= 200 && code < 300) {
              step = 3;
              socket.write(`RCPT TO:<${email}>\r\n`);
            } else {
              clearTimeout(timeout);
              finish(false, code);
            }
            break;
          case 3:
            clearTimeout(timeout);
            finish(code >= 200 && code < 300, code);
            break;
        }
      }
    });
  });
}

async function isCatchAllDomain(domain: string, mxRecords: dns.MxRecord[]): Promise<boolean> {
  const cached = catchAllDomainCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.isCatchAll;
  }

  const randomLocal = `nonexistent_test_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const testEmail = `${randomLocal}@${domain}`;

  try {
    const result = await smtpCheck(testEmail, mxRecords[0].exchange, 8000);
    const isCatchAll = result.accepted;
    catchAllDomainCache.set(domain, { isCatchAll, timestamp: Date.now() });
    return isCatchAll;
  } catch {
    catchAllDomainCache.set(domain, { isCatchAll: false, timestamp: Date.now() });
    return false;
  }
}

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of verificationCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      verificationCache.delete(key);
    }
  }
  for (const [key, entry] of catchAllDomainCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      catchAllDomainCache.delete(key);
    }
  }
}

export async function verifyEmail(email: string): Promise<VerificationResult> {
  const lowerEmail = email.toLowerCase().trim();

  if (verificationCache.size > 5000) {
    cleanExpiredCache();
  }

  const cached = verificationCache.get(lowerEmail);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  if (!isValidSyntax(lowerEmail)) {
    const result: VerificationResult = { is_valid: false, status: "invalid", confidence: 100 };
    verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
    return result;
  }

  const domain = getDomain(lowerEmail);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    const result: VerificationResult = { is_valid: false, status: "disposable", confidence: 99 };
    verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
    return result;
  }

  let mxRecords: dns.MxRecord[];
  try {
    mxRecords = await resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      const result: VerificationResult = { is_valid: false, status: "invalid", confidence: 90 };
      verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
      return result;
    }
  } catch {
    const result: VerificationResult = { is_valid: false, status: "invalid", confidence: 85 };
    verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
    return result;
  }

  await enforceRateLimit(domain);

  try {
    const catchAll = await isCatchAllDomain(domain, mxRecords);
    if (catchAll) {
      const result: VerificationResult = { is_valid: true, status: "catch_all", confidence: 50 };
      verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
      return result;
    }

    let smtpResult: { accepted: boolean; code: number } | null = null;
    for (const mx of mxRecords.slice(0, 2)) {
      try {
        smtpResult = await smtpCheck(lowerEmail, mx.exchange);
        if (smtpResult.code > 0) break;
      } catch {
        continue;
      }
    }

    if (!smtpResult || smtpResult.code === 0) {
      const result: VerificationResult = { is_valid: true, status: "unknown", confidence: 40 };
      verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
      return result;
    }

    if (smtpResult.accepted) {
      const result: VerificationResult = { is_valid: true, status: "valid", confidence: 95 };
      verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
      return result;
    } else if (smtpResult.code === 550 || smtpResult.code === 551 || smtpResult.code === 552 || smtpResult.code === 553 || smtpResult.code === 554) {
      const result: VerificationResult = { is_valid: false, status: "invalid", confidence: 90 };
      verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
      return result;
    } else if (smtpResult.code === 450 || smtpResult.code === 451 || smtpResult.code === 452) {
      const result: VerificationResult = { is_valid: true, status: "unknown", confidence: 45 };
      verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
      return result;
    } else {
      const result: VerificationResult = { is_valid: true, status: "unknown", confidence: 35 };
      verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
      return result;
    }
  } catch {
    const result: VerificationResult = { is_valid: true, status: "unknown", confidence: 30 };
    verificationCache.set(lowerEmail, { result, timestamp: Date.now() });
    return result;
  }
}

export async function verifyEmails(emails: string[]): Promise<Map<string, VerificationResult>> {
  const results = new Map<string, VerificationResult>();
  for (const email of emails) {
    try {
      const result = await verifyEmail(email);
      results.set(email.toLowerCase().trim(), result);
    } catch (error) {
      console.error(`[EMAIL-VERIFY] Error verifying ${email}:`, error);
      results.set(email.toLowerCase().trim(), { is_valid: true, status: "unknown", confidence: 20 });
    }
  }
  return results;
}

export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = getDomain(email.toLowerCase().trim());
  return DISPOSABLE_DOMAINS.has(domain);
}

export function isValidEmailSyntax(email: string): boolean {
  return isValidSyntax(email.toLowerCase().trim());
}

export function clearVerificationCache(): void {
  verificationCache.clear();
  catchAllDomainCache.clear();
}

export function getCacheSize(): number {
  return verificationCache.size;
}
