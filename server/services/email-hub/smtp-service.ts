import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

export interface SendEmailOptions {
  from: string;
  fromName?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SmtpService {
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  private createTransporter(): Transporter {
    return nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.port === 465,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = this.createTransporter();
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const transporter = this.createTransporter();

      const fromAddress = options.fromName
        ? `"${options.fromName}" <${options.from}>`
        : options.from;

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      if (options.cc) {
        mailOptions.cc = Array.isArray(options.cc) ? options.cc.join(", ") : options.cc;
      }

      if (options.bcc) {
        mailOptions.bcc = Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc;
      }

      if (options.replyTo) {
        mailOptions.replyTo = options.replyTo;
      }

      if (options.inReplyTo) {
        mailOptions.inReplyTo = options.inReplyTo;
      }

      if (options.references) {
        mailOptions.references = options.references;
      }

      const result = await transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (err: any) {
      console.error("[SMTP] Send email error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}

export function createSmtpService(config: SmtpConfig): SmtpService {
  return new SmtpService(config);
}
