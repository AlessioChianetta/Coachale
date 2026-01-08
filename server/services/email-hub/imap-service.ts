import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import { Readable } from "stream";

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

  async fetchRecentEmails(limit: number = 50): Promise<ParsedEmail[]> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();
      const emails: ParsedEmail[] = [];

      imap.once("ready", () => {
        imap.openBox("INBOX", true, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          const totalMessages = box.messages.total;
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
              stream.on("end", async () => {
                try {
                  const parsed = await this.parseEmailBuffer(buffer);
                  if (parsed) {
                    emails.push(parsed);
                  }
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
