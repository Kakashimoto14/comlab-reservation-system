import { createPrivateKey, createSign } from "crypto";

import dayjs from "dayjs";
import type { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { toDateOnly } from "../utils/time.js";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const calendarReservationInclude = {
  laboratory: {
    select: {
      name: true,
      roomCode: true
    }
  },
  student: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      studentNumber: true
    }
  }
} satisfies Prisma.ReservationInclude;

export type CalendarReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof calendarReservationInclude;
}>;

export type GoogleCalendarSyncResult =
  | {
      status: "DISABLED";
      message: string;
      eventId: null;
      error: null;
      syncedAt: null;
    }
  | {
      status: "SYNCED";
      message: string;
      eventId: string;
      error: null;
      syncedAt: Date;
    }
  | {
      status: "FAILED";
      message: string;
      eventId: null;
      error: string;
      syncedAt: null;
    };

type GoogleAccessToken = {
  accessToken: string;
  expiresAt: number;
};

export class GoogleCalendarService {
  private tokenCache: GoogleAccessToken | null = null;

  isEnabled() {
    return env.GOOGLE_CALENDAR_ENABLED;
  }

  async createReservationEvent(
    reservation: CalendarReservationRecord
  ): Promise<GoogleCalendarSyncResult> {
    if (!this.isEnabled()) {
      return {
        status: "DISABLED",
        message: "Reservation approved. Google Calendar integration is disabled.",
        eventId: null,
        error: null,
        syncedAt: null
      };
    }

    const configError = this.getConfigurationError();

    if (configError) {
      return {
        status: "FAILED",
        message:
          "Reservation approved, but Google Calendar sync failed. Please check calendar configuration.",
        eventId: null,
        error: configError,
        syncedAt: null
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          env.GOOGLE_CALENDAR_ID!
        )}/events?sendUpdates=all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(this.buildCalendarEvent(reservation))
        }
      );

      const body = (await response.json().catch(() => null)) as { id?: string; error?: unknown } | null;

      if (!response.ok || !body?.id) {
        throw new Error(
          `Calendar API event creation failed with status ${response.status}.`
        );
      }

      return {
        status: "SYNCED",
        message: "Reservation approved. Google Calendar event created.",
        eventId: body.id,
        error: null,
        syncedAt: new Date()
      };
    } catch (error) {
      const safeError = this.sanitizeError(error);

      console.error("[calendar] Reservation calendar sync failed.", {
        reservationId: reservation.id,
        reservationCode: reservation.reservationCode,
        error: safeError
      });

      return {
        status: "FAILED",
        message:
          "Reservation approved, but Google Calendar sync failed. Please check calendar configuration.",
        eventId: null,
        error: safeError,
        syncedAt: null
      };
    }
  }

  private buildCalendarEvent(reservation: CalendarReservationRecord) {
    const studentName = `${reservation.student.firstName} ${reservation.student.lastName}`.trim();
    const reservationDate = dayjs(toDateOnly(reservation.reservationDate)).format("YYYY-MM-DD");
    const attendees = reservation.student.email
      ? [
          {
            email: reservation.student.email,
            displayName: studentName
          }
        ]
      : [];

    return {
      summary: `ComPort Reservation - ${reservation.laboratory.roomCode}`,
      description: [
        `Student name: ${studentName}`,
        `Student number: ${reservation.student.studentNumber ?? "N/A"}`,
        `Laboratory: ${reservation.laboratory.name} (${reservation.laboratory.roomCode})`,
        `Reservation date: ${reservationDate}`,
        `Start time: ${reservation.startTime}`,
        `End time: ${reservation.endTime}`,
        `Purpose: ${reservation.purpose}`,
        `Reservation status: ${reservation.status}`
      ].join("\n"),
      start: {
        dateTime: `${reservationDate}T${this.normalizeTime(reservation.startTime)}`,
        timeZone: env.GOOGLE_CALENDAR_TIME_ZONE
      },
      end: {
        dateTime: `${reservationDate}T${this.normalizeTime(reservation.endTime)}`,
        timeZone: env.GOOGLE_CALENDAR_TIME_ZONE
      },
      attendees,
      reminders: {
        useDefault: false,
        overrides: [
          {
            method: "popup",
            minutes: 30
          }
        ]
      }
    };
  }

  private async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);

    if (this.tokenCache && this.tokenCache.expiresAt - 60 > now) {
      return this.tokenCache.accessToken;
    }

    const assertion = this.createJwtAssertion(now);
    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });
    const tokenBody = (await response.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number }
      | null;

    if (!response.ok || !tokenBody?.access_token) {
      throw new Error(`Google OAuth token request failed with status ${response.status}.`);
    }

    this.tokenCache = {
      accessToken: tokenBody.access_token,
      expiresAt: now + (tokenBody.expires_in ?? 3600)
    };

    return this.tokenCache.accessToken;
  }

  private createJwtAssertion(now: number) {
    const header = {
      alg: "RS256",
      typ: "JWT"
    };
    const payload = {
      iss: env.GOOGLE_CLIENT_EMAIL,
      scope: GOOGLE_CALENDAR_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      iat: now,
      exp: now + 3600
    };
    const unsignedToken = `${this.base64Url(JSON.stringify(header))}.${this.base64Url(
      JSON.stringify(payload)
    )}`;
    const signer = createSign("RSA-SHA256");

    signer.update(unsignedToken);
    signer.end();

    const signature = signer.sign(this.normalizePrivateKey(env.GOOGLE_PRIVATE_KEY!));

    return `${unsignedToken}.${this.base64Url(signature)}`;
  }

  private getConfigurationError() {
    const missing = [
      ["GOOGLE_CALENDAR_ID", env.GOOGLE_CALENDAR_ID],
      ["GOOGLE_PROJECT_ID", env.GOOGLE_PROJECT_ID],
      ["GOOGLE_CLIENT_EMAIL", env.GOOGLE_CLIENT_EMAIL],
      ["GOOGLE_PRIVATE_KEY", env.GOOGLE_PRIVATE_KEY]
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length) {
      return `Missing required Google Calendar server configuration: ${missing.join(", ")}.`;
    }

    try {
      createPrivateKey(this.normalizePrivateKey(env.GOOGLE_PRIVATE_KEY!));
    } catch {
      return "GOOGLE_PRIVATE_KEY is not a valid PEM private key. Use escaped newline characters from the service-account JSON key.";
    }

    return null;
  }

  private normalizePrivateKey(privateKey: string) {
    const trimmed = privateKey.trim();
    const unquoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ? trimmed.slice(1, -1)
        : trimmed;

    return unquoted.replace(/\\r/g, "\r").replace(/\\n/g, "\n");
  }

  private normalizeTime(time: string) {
    return time.length === 5 ? `${time}:00` : time;
  }

  private base64Url(input: string | Buffer) {
    return Buffer.from(input)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  private sanitizeError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown Google Calendar error.";
    const privateKey = env.GOOGLE_PRIVATE_KEY
      ? this.normalizePrivateKey(env.GOOGLE_PRIVATE_KEY)
      : null;

    return privateKey ? message.replace(privateKey, "[redacted]") : message;
  }
}
