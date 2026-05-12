import nodemailer from "nodemailer";

import { env } from "../config/env.js";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  previewUrl?: string;
};

export class EmailService {
  private transporter?: nodemailer.Transporter;
  private incompleteConfigWarningShown = false;
  private verifiedProductionTransport = false;

  async assertDeliveryReady() {
    if (env.NODE_ENV !== "production") {
      return;
    }

    if (env.NOTIFICATION_EMAIL_PREVIEW) {
      throw new Error(
        "Transactional email preview mode cannot be enabled in production."
      );
    }

    const transporter = this.getTransporter();

    if (!transporter) {
      throw new Error("SMTP is not fully configured for transactional email delivery.");
    }

    if (this.verifiedProductionTransport) {
      return;
    }

    await transporter.verify();
    this.verifiedProductionTransport = true;
  }

  async sendMail(input: SendMailInput) {
    const transporter = this.getTransporter();
    const shouldPreview =
      env.NODE_ENV !== "production" && (env.NOTIFICATION_EMAIL_PREVIEW || !transporter);

    if (shouldPreview) {
      this.logPreview(input);
      return {
        preview: true
      };
    }

    if (env.NOTIFICATION_EMAIL_PREVIEW) {
      throw new Error("Transactional email preview mode cannot be enabled in production.");
    }

    if (!transporter) {
      throw new Error("SMTP is not fully configured for transactional email delivery.");
    }

    await transporter.sendMail({
      from: this.getFromValue(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {})
    });

    return {
      preview: false
    };
  }

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    if (!env.SMTP_HOST || !env.SMTP_PORT || !this.hasSenderAddress()) {
      if (!this.incompleteConfigWarningShown) {
        console.warn(
          "[email] SMTP is incomplete. Emails will be previewed in development and rejected in production until SMTP settings are configured."
        );
        this.incompleteConfigWarningShown = true;
      }

      return null;
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

  private getFromValue() {
    if (env.SMTP_FROM) {
      return env.SMTP_FROM;
    }

    if (!env.SMTP_FROM_EMAIL) {
      throw new Error("SMTP_FROM or SMTP_FROM_EMAIL must be configured for email delivery.");
    }

    return env.SMTP_FROM_NAME
      ? {
          name: env.SMTP_FROM_NAME,
          address: env.SMTP_FROM_EMAIL
        }
      : env.SMTP_FROM_EMAIL;
  }

  private hasSenderAddress() {
    return Boolean(env.SMTP_FROM || env.SMTP_FROM_EMAIL);
  }

  private logPreview(input: SendMailInput) {
    if (env.NODE_ENV === "production") {
      console.warn(`[email] Skipped sending "${input.subject}" to ${input.to}.`);
      return;
    }

    const previewLines = [
      `[email][preview] To: ${input.to}`,
      `Subject: ${input.subject}`,
      "",
      input.text
    ];

    if (input.previewUrl) {
      previewLines.push("", `Preview URL: ${input.previewUrl}`);
    }

    console.info(previewLines.join("\n"));
  }
}
