import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import { Readable } from "stream";
import { EventEmitter } from "events";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

export interface ParsedEmail {
  messageId: string;
  subject: string | undefined;
  fromName: string | undefined;
  fromEmail: string;
  toRecipients: { name?: string; email: string }[];
  ccRecipients: { name?: string; email: string }[];
  bodyHtml: string | undefined;
  bodyText: string | undefined;
  snippet: string | undefined;
  receivedAt: Date;
  inReplyTo: string | undefined;
  attachments: { filename: string; contentType: string; size: number }[];
  hasAttachments: boolean;
}

export interface MailboxInfo {
  path: string;
  name: string;
  delimiter: string;
  specialUse: string | null; // \Sent, \Drafts, \Trash, \Junk, \Archive, etc.
  flags: string[];
  hasChildren: boolean;
}

export interface DiscoveredFolders {
  inbox: string | null;
  sent: string | null;
  drafts: string | null;
  trash: string | null;
  junk: string | null;
  archive: string | null;
  all: MailboxInfo[];
}

// Common folder name aliases for fallback detection (case-insensitive)
const SENT_ALIASES = [
  "sent", "sent mail", "sent items", "sent messages", "outbox",
  "posta inviata", "inviata", "inviati", // Italian
  "envoyés", "messages envoyés", "éléments envoyés", // French
  "enviados", "mensajes enviados", "elementos enviados", // Spanish
  "gesendet", "gesendete objekte", "gesendete elemente", // German
  "verzonden", "verzonden items", // Dutch
  "enviadas", "itens enviados", // Portuguese
];

const DRAFTS_ALIASES = [
  "drafts", "draft", "draughts",
  "bozze", "bozza", // Italian
  "brouillons", // French
  "borradores", // Spanish
  "entwürfe", // German
  "concepten", // Dutch
  "rascunhos", // Portuguese
];

const TRASH_ALIASES = [
  "trash", "deleted", "deleted items", "deleted messages", "bin",
  "cestino", "eliminati", "posta eliminata", // Italian
  "corbeille", "éléments supprimés", // French
  "papelera", "elementos eliminados", // Spanish
  "papierkorb", "gelöschte objekte", // German
  "prullenbak", "verwijderde items", // Dutch
  "lixeira", "itens excluídos", // Portuguese
];

const JUNK_ALIASES = [
  "junk", "spam", "junk mail", "bulk mail",
  "posta indesiderata", "spam", // Italian
  "courrier indésirable", "spam", // French
  "correo no deseado", // Spanish
  "junk-e-mail", // German
  "ongewenste e-mail", // Dutch
];

const ARCHIVE_ALIASES = [
  "archive", "all mail", "all",
  "archivio", "tutti i messaggi", // Italian
  "archives", "tous les messages", // French
  "archivo", "todos los mensajes", // Spanish
  "archiv", "alle nachrichten", // German
];

export class ImapService {
  private config: ImapConfig;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  private createConnection(): Imap {
    return new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.tls,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 15000,
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const imap = this.createConnection();

      const timeout = setTimeout(() => {
        imap.destroy();
        resolve({ success: false, error: "Connection timeout" });
      }, 15000);

      imap.once("ready", () => {
        clearTimeout(timeout);
        imap.end();
        resolve({ success: true });
      });

      imap.once("error", (err: Error) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });

      imap.connect();
    });
  }

  async listMailboxes(): Promise<DiscoveredFolders> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();
      
      const timeout = setTimeout(() => {
        imap.destroy();
        reject(new Error("Timeout while listing mailboxes"));
      }, 20000);

      imap.once("ready", () => {
        imap.getBoxes((err, boxes) => {
          clearTimeout(timeout);
          if (err) {
            imap.end();
            return reject(err);
          }

          const allMailboxes: MailboxInfo[] = [];
          
          // Recursively extract all mailboxes
          const extractBoxes = (boxesObj: any, parentPath: string = "") => {
            for (const name in boxesObj) {
              const box = boxesObj[name];
              const delimiter = box.delimiter || "/";
              const fullPath = parentPath ? `${parentPath}${delimiter}${name}` : name;
              
              // Extract special-use attribute if present
              let specialUse: string | null = null;
              const attribs = box.attribs || [];
              for (const attr of attribs) {
                if (attr.startsWith("\\") && ["\\Sent", "\\Drafts", "\\Trash", "\\Junk", "\\Archive", "\\All", "\\Flagged"].includes(attr)) {
                  specialUse = attr;
                  break;
                }
              }

              allMailboxes.push({
                path: fullPath,
                name: name,
                delimiter: delimiter,
                specialUse: specialUse,
                flags: attribs,
                hasChildren: !!box.children,
              });

              // Recurse into children
              if (box.children) {
                extractBoxes(box.children, fullPath);
              }
            }
          };

          extractBoxes(boxes);
          
          // Log ALL folders with details for debugging
          console.log(`[IMAP] ===== FULL FOLDER LIST =====`);
          for (const box of allMailboxes) {
            console.log(`[IMAP]   ${box.path} | name="${box.name}" | specialUse=${box.specialUse || 'none'} | flags=${box.flags.join(',')}`);
          }
          console.log(`[IMAP] ===== END FOLDER LIST =====`);

          // Now identify special folders
          const result: DiscoveredFolders = {
            inbox: null,
            sent: null,
            drafts: null,
            trash: null,
            junk: null,
            archive: null,
            all: allMailboxes,
          };

          // First pass: use SPECIAL-USE attributes (RFC 6154)
          for (const box of allMailboxes) {
            if (box.specialUse) {
              switch (box.specialUse) {
                case "\\Sent":
                  result.sent = box.path;
                  break;
                case "\\Drafts":
                  result.drafts = box.path;
                  break;
                case "\\Trash":
                  result.trash = box.path;
                  break;
                case "\\Junk":
                  result.junk = box.path;
                  break;
                case "\\Archive":
                case "\\All":
                  result.archive = box.path;
                  break;
              }
            }
            // INBOX is always named INBOX
            if (box.path.toUpperCase() === "INBOX") {
              result.inbox = box.path;
            }
          }

          // Second pass: fallback to name matching if SPECIAL-USE not found
          if (!result.sent) {
            result.sent = this.findFolderByAlias(allMailboxes, SENT_ALIASES);
          }
          if (!result.drafts) {
            result.drafts = this.findFolderByAlias(allMailboxes, DRAFTS_ALIASES);
          }
          if (!result.trash) {
            result.trash = this.findFolderByAlias(allMailboxes, TRASH_ALIASES);
          }
          if (!result.junk) {
            result.junk = this.findFolderByAlias(allMailboxes, JUNK_ALIASES);
          }
          if (!result.archive) {
            result.archive = this.findFolderByAlias(allMailboxes, ARCHIVE_ALIASES);
          }

          console.log(`[IMAP] Discovered folders: inbox=${result.inbox}, sent=${result.sent}, drafts=${result.drafts}, trash=${result.trash}`);

          imap.end();
          resolve(result);
        });
      });

      imap.once("error", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      imap.connect();
    });
  }

  private findAllFolderCandidates(mailboxes: MailboxInfo[], aliases: string[]): MailboxInfo[] {
    const candidates: MailboxInfo[] = [];
    const seenPaths = new Set<string>();
    
    // First try exact match on folder name (last segment)
    for (const box of mailboxes) {
      // Skip folders with \Noselect or \NonExistent flags
      if (box.flags.some(f => f === "\\Noselect" || f === "\\NonExistent")) {
        continue;
      }
      const folderName = box.name.toLowerCase();
      if (aliases.includes(folderName) && !seenPaths.has(box.path)) {
        candidates.push(box);
        seenPaths.add(box.path);
      }
    }
    
    // Then try partial match on full path
    for (const box of mailboxes) {
      if (box.flags.some(f => f === "\\Noselect" || f === "\\NonExistent")) {
        continue;
      }
      if (seenPaths.has(box.path)) continue;
      
      const pathLower = box.path.toLowerCase();
      for (const alias of aliases) {
        if (pathLower.includes(alias)) {
          candidates.push(box);
          seenPaths.add(box.path);
          break;
        }
      }
    }
    
    return candidates;
  }

  // English generic names that should have lower priority
  private static ENGLISH_GENERIC_NAMES = new Set([
    "sent", "sent mail", "sent items", "sent messages", "outbox",
    "drafts", "draft", "draughts",
    "trash", "deleted", "deleted items", "deleted messages", "bin",
    "junk", "spam", "junk mail", "bulk mail",
    "archive", "all mail", "all",
  ]);

  private findFolderByAlias(mailboxes: MailboxInfo[], aliases: string[]): string | null {
    const candidates = this.findAllFolderCandidates(mailboxes, aliases);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].path;
    
    // Multiple candidates found - log them all
    console.log(`[IMAP] Multiple folder candidates found:`, candidates.map(c => c.path).join(", "));
    
    // Score candidates: prefer localized names over generic English names
    // Localized names (Italian, French, Spanish, etc.) get higher priority
    const scored = candidates.map(c => {
      const nameLower = c.name.toLowerCase();
      const isEnglishGeneric = ImapService.ENGLISH_GENERIC_NAMES.has(nameLower);
      // Higher score = better candidate
      // Localized names score 10, English generic names score 1
      const score = isEnglishGeneric ? 1 : 10;
      return { candidate: c, score };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    const chosen = scored[0].candidate;
    console.log(`[IMAP] Choosing folder: ${chosen.path} (score: ${scored[0].score}, localized: ${scored[0].score > 1})`);
    
    return chosen.path;
  }

  async fetchRecentEmails(limit: number = 50): Promise<ParsedEmail[]> {
    return this.fetchRecentEmailsFromFolder("INBOX", limit);
  }

  async fetchRecentEmailsFromFolder(folderName: string, limit: number = 50): Promise<ParsedEmail[]> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();
      const emails: ParsedEmail[] = [];
      const parsePromises: Promise<void>[] = [];

      imap.once("ready", () => {
        imap.openBox(folderName, true, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          const totalMessages = box.messages.total;
          console.log(`[IMAP] Opened folder "${folderName}": server reports ${totalMessages} total messages`);
          
          if (totalMessages === 0) {
            imap.end();
            return resolve([]);
          }

          const start = Math.max(1, totalMessages - limit + 1);
          const range = `${start}:${totalMessages}`;

          const fetch = imap.seq.fetch(range, {
            bodies: "",
            struct: true,
          });

          fetch.on("message", (msg) => {
            msg.on("body", (stream) => {
              let buffer = "";
              stream.on("data", (chunk) => {
                buffer += chunk.toString("utf8");
              });
              stream.on("end", () => {
                // Track parsing promise to wait for all to complete
                const parsePromise = (async () => {
                  try {
                    const parsed = await this.parseEmailBuffer(buffer);
                    if (parsed) {
                      emails.push(parsed);
                    }
                  } catch (parseErr) {
                    console.error("[IMAP] Error parsing email:", parseErr);
                  }
                })();
                parsePromises.push(parsePromise);
              });
            });
          });

          fetch.once("error", (fetchErr) => {
            imap.end();
            reject(fetchErr);
          });

          fetch.once("end", async () => {
            // Wait for all parsing to complete before resolving
            await Promise.all(parsePromises);
            console.log(`[IMAP] Finished parsing ${emails.length} emails from "${folderName}"`);
            imap.end();
            resolve(emails);
          });
        });
      });

      imap.once("error", (err: Error) => {
        reject(err);
      });

      imap.connect();
    });
  }

  async fetchEmailByUid(uid: number): Promise<ParsedEmail | null> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();

      imap.once("ready", () => {
        imap.openBox("INBOX", true, (err) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          const fetch = imap.fetch(uid, { bodies: "", struct: true });
          let email: ParsedEmail | null = null;

          fetch.on("message", (msg) => {
            msg.on("body", (stream) => {
              let buffer = "";
              stream.on("data", (chunk) => {
                buffer += chunk.toString("utf8");
              });
              stream.on("end", async () => {
                try {
                  email = await this.parseEmailBuffer(buffer);
                } catch (parseErr) {
                  console.error("[IMAP] Error parsing email:", parseErr);
                }
              });
            });
          });

          fetch.once("error", (fetchErr) => {
            imap.end();
            reject(fetchErr);
          });

          fetch.once("end", () => {
            imap.end();
            resolve(email);
          });
        });
      });

      imap.once("error", (err: Error) => {
        reject(err);
      });

      imap.connect();
    });
  }

  private async parseEmailBuffer(buffer: string): Promise<ParsedEmail | null> {
    try {
      const parsed: ParsedMail = await simpleParser(buffer);

      const fromAddress = parsed.from?.value?.[0];
      if (!fromAddress?.address) {
        return null;
      }

      const toRecipients = (parsed.to?.value || []).map((addr) => ({
        name: addr.name || undefined,
        email: addr.address || "",
      }));

      const ccRecipients = (parsed.cc?.value || []).map((addr) => ({
        name: addr.name || undefined,
        email: addr.address || "",
      }));

      const bodyText = parsed.text || "";
      const snippet = bodyText.slice(0, 200).replace(/\s+/g, " ").trim();

      const attachments = (parsed.attachments || []).map((att) => ({
        filename: att.filename || "unnamed",
        contentType: att.contentType || "application/octet-stream",
        size: att.size || 0,
      }));

      return {
        messageId: parsed.messageId || `generated-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subject: parsed.subject,
        fromName: fromAddress.name || undefined,
        fromEmail: fromAddress.address,
        toRecipients,
        ccRecipients,
        bodyHtml: parsed.html || undefined,
        bodyText: bodyText || undefined,
        snippet: snippet || undefined,
        receivedAt: parsed.date || new Date(),
        inReplyTo: parsed.inReplyTo || undefined,
        attachments,
        hasAttachments: attachments.length > 0,
      };
    } catch (err) {
      console.error("[IMAP] parseEmailBuffer error:", err);
      return null;
    }
  }

  async markAsRead(uid: number): Promise<boolean> {
    return new Promise((resolve) => {
      const imap = this.createConnection();

      imap.once("ready", () => {
        imap.openBox("INBOX", false, (err) => {
          if (err) {
            imap.end();
            return resolve(false);
          }

          imap.addFlags(uid, ["\\Seen"], (flagErr) => {
            imap.end();
            resolve(!flagErr);
          });
        });
      });

      imap.once("error", () => {
        resolve(false);
      });

      imap.connect();
    });
  }

  async markAsStarred(uid: number, starred: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      const imap = this.createConnection();

      imap.once("ready", () => {
        imap.openBox("INBOX", false, (err) => {
          if (err) {
            imap.end();
            return resolve(false);
          }

          const method = starred ? imap.addFlags : imap.delFlags;
          method.call(imap, uid, ["\\Flagged"], (flagErr: Error | null) => {
            imap.end();
            resolve(!flagErr);
          });
        });
      });

      imap.once("error", () => {
        resolve(false);
      });

      imap.connect();
    });
  }
}

export function createImapService(config: ImapConfig): ImapService {
  return new ImapService(config);
}

export interface IdleConnectionConfig extends ImapConfig {
  accountId: string;
  consultantId: string;
  onNewEmail: (email: ParsedEmail) => Promise<void>;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
}

export class ImapIdleManager extends EventEmitter {
  private connections: Map<string, ImapIdleConnection> = new Map();
  private static instance: ImapIdleManager;

  private constructor() {
    super();
  }

  static getInstance(): ImapIdleManager {
    if (!ImapIdleManager.instance) {
      ImapIdleManager.instance = new ImapIdleManager();
    }
    return ImapIdleManager.instance;
  }

  async startIdleForAccount(config: IdleConnectionConfig): Promise<boolean> {
    const key = config.accountId;
    
    if (this.connections.has(key)) {
      console.log(`[IMAP IDLE] Account ${key} already has active connection`);
      return true;
    }

    try {
      const connection = new ImapIdleConnection(config);
      await connection.connect();
      this.connections.set(key, connection);
      console.log(`[IMAP IDLE] Started IDLE for account ${key}`);
      return true;
    } catch (error) {
      console.error(`[IMAP IDLE] Failed to start IDLE for account ${key}:`, error);
      return false;
    }
  }

  stopIdleForAccount(accountId: string): void {
    const connection = this.connections.get(accountId);
    if (connection) {
      connection.disconnect();
      this.connections.delete(accountId);
      console.log(`[IMAP IDLE] Stopped IDLE for account ${accountId}`);
    }
  }

  stopAll(): void {
    for (const [accountId, connection] of this.connections) {
      connection.disconnect();
      console.log(`[IMAP IDLE] Stopped IDLE for account ${accountId}`);
    }
    this.connections.clear();
  }

  isConnected(accountId: string): boolean {
    return this.connections.has(accountId);
  }

  getActiveConnections(): string[] {
    return Array.from(this.connections.keys());
  }
}

class ImapIdleConnection {
  private imap: Imap | null = null;
  private config: IdleConnectionConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private lastUid: number = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private readonly IDLE_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes (RFC recommends 29 max)
  private readonly RECONNECT_DELAY = 5000;

  constructor(config: IdleConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 15000,
        connTimeout: 20000,
        keepalive: {
          interval: 10000,
          idleInterval: 300000,
          forceNoop: true
        }
      });

      this.imap.once("ready", () => {
        this.isConnected = true;
        this.openInboxAndIdle()
          .then(() => resolve())
          .catch(reject);
      });

      this.imap.once("error", (err: Error) => {
        console.error(`[IMAP IDLE] Connection error for ${this.config.accountId}:`, err.message);
        this.config.onError?.(err);
        if (!this.isConnected) {
          reject(err);
        } else {
          this.scheduleReconnect();
        }
      });

      this.imap.once("end", () => {
        console.log(`[IMAP IDLE] Connection ended for ${this.config.accountId}`);
        this.isConnected = false;
        this.config.onDisconnect?.();
        this.scheduleReconnect();
      });

      this.imap.connect();
    });
  }

  private async openInboxAndIdle(): Promise<void> {
    if (!this.imap) return;

    return new Promise((resolve, reject) => {
      this.imap!.openBox("INBOX", false, (err, box) => {
        if (err) {
          return reject(err);
        }

        this.lastUid = box.uidnext - 1;
        console.log(`[IMAP IDLE] Inbox opened for ${this.config.accountId}, last UID: ${this.lastUid}`);

        this.imap!.on("mail", (numNewMsgs: number) => {
          console.log(`[IMAP IDLE] ${numNewMsgs} new message(s) for ${this.config.accountId}`);
          this.fetchNewEmails();
        });

        this.startIdleRefresh();
        resolve();
      });
    });
  }

  private startIdleRefresh(): void {
    this.clearIdleTimer();
    this.idleTimer = setInterval(() => {
      if (this.imap && this.isConnected) {
        console.log(`[IMAP IDLE] Refreshing IDLE for ${this.config.accountId}`);
        this.imap.openBox("INBOX", false, () => {});
      }
    }, this.IDLE_REFRESH_INTERVAL);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async fetchNewEmails(): Promise<void> {
    if (!this.imap || !this.isConnected) return;

    try {
      const searchCriteria = ["UNSEEN", ["UID", `${this.lastUid + 1}:*`]];
      
      this.imap.search(searchCriteria, (err, uids) => {
        if (err || !uids || uids.length === 0) return;

        const fetch = this.imap!.fetch(uids, { bodies: "", struct: true });

        fetch.on("message", (msg, seqno) => {
          let uid = 0;
          
          msg.once("attributes", (attrs) => {
            uid = attrs.uid;
            if (uid > this.lastUid) {
              this.lastUid = uid;
            }
          });

          msg.on("body", (stream) => {
            let buffer = "";
            stream.on("data", (chunk) => {
              buffer += chunk.toString("utf8");
            });
            stream.on("end", async () => {
              try {
                const parsed = await this.parseEmailBuffer(buffer);
                if (parsed) {
                  console.log(`[IMAP IDLE] New email: ${parsed.subject} from ${parsed.fromEmail}`);
                  await this.config.onNewEmail(parsed);
                }
              } catch (parseErr) {
                console.error("[IMAP IDLE] Error parsing email:", parseErr);
              }
            });
          });
        });

        fetch.once("error", (fetchErr) => {
          console.error("[IMAP IDLE] Fetch error:", fetchErr);
        });
      });
    } catch (error) {
      console.error("[IMAP IDLE] fetchNewEmails error:", error);
    }
  }

  private async parseEmailBuffer(buffer: string): Promise<ParsedEmail | null> {
    try {
      const parsed: ParsedMail = await simpleParser(buffer);

      const fromAddress = parsed.from?.value?.[0];
      if (!fromAddress?.address) {
        return null;
      }

      const toRecipients = (parsed.to?.value || []).map((addr) => ({
        name: addr.name || undefined,
        email: addr.address || "",
      }));

      const ccRecipients = (parsed.cc?.value || []).map((addr) => ({
        name: addr.name || undefined,
        email: addr.address || "",
      }));

      const bodyText = parsed.text || "";
      const snippet = bodyText.slice(0, 200).replace(/\s+/g, " ").trim();

      const attachments = (parsed.attachments || []).map((att) => ({
        filename: att.filename || "unnamed",
        contentType: att.contentType || "application/octet-stream",
        size: att.size || 0,
      }));

      return {
        messageId: parsed.messageId || `generated-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subject: parsed.subject,
        fromName: fromAddress.name || undefined,
        fromEmail: fromAddress.address,
        toRecipients,
        ccRecipients,
        bodyHtml: parsed.html || undefined,
        bodyText: bodyText || undefined,
        snippet: snippet || undefined,
        receivedAt: parsed.date || new Date(),
        inReplyTo: parsed.inReplyTo || undefined,
        attachments,
        hasAttachments: attachments.length > 0,
      };
    } catch (err) {
      console.error("[IMAP IDLE] parseEmailBuffer error:", err);
      return null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      console.log(`[IMAP IDLE] Attempting reconnect for ${this.config.accountId}`);
      try {
        await this.connect();
      } catch (error) {
        console.error(`[IMAP IDLE] Reconnect failed for ${this.config.accountId}:`, error);
        this.scheduleReconnect();
      }
    }, this.RECONNECT_DELAY);
  }

  disconnect(): void {
    this.clearIdleTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.imap) {
      this.imap.removeAllListeners();
      this.imap.end();
      this.imap = null;
    }
    this.isConnected = false;
  }
}
