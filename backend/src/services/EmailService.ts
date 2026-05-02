import nodemailer from "nodemailer";

import { env } from "../config/env.js";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

export class EmailService {
  private transporter?: nodemailer.Transporter;

  async sendMail(input: SendMailInput) {
    if (env.NOTIFICATION_EMAIL_PREVIEW) {
      console.info(
        `[email][preview] To: ${input.to}\nSubject: ${input.subject}\n\n${input.text}`
      );

      return {
        preview: true
      };
    }

    const transporter = this.getTransporter();

    await transporter.sendMail({
      from: env.SMTP_FROM_NAME
        ? {
            name: env.SMTP_FROM_NAME,
            address: this.getFromEmail()
          }
        : this.getFromEmail(),
      to: input.to,
      subject: input.subject,
      text: input.text
    });

    return {
      preview: false
    };
  }

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_FROM_EMAIL) {
      throw new Error("SMTP settings are incomplete for notification delivery.");
    }

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? false,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS
            }
          : undefined
    });

    return this.transporter;
  }

  private getFromEmail() {
    if (!env.SMTP_FROM_EMAIL) {
      throw new Error("SMTP_FROM_EMAIL must be configured for notification delivery.");
    }

    return env.SMTP_FROM_EMAIL;
  }
}
