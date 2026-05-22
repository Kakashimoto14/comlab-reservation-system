-- Add backend-owned Google Calendar sync metadata for approved reservations.
CREATE TYPE "CalendarSyncStatus" AS ENUM ('NOT_ATTEMPTED', 'DISABLED', 'SYNCED', 'FAILED');

ALTER TABLE "Reservation"
ADD COLUMN "googleCalendarEventId" TEXT,
ADD COLUMN "calendarSyncStatus" "CalendarSyncStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
ADD COLUMN "calendarSyncError" TEXT,
ADD COLUMN "calendarSyncedAt" TIMESTAMP(3);

CREATE INDEX "Reservation_calendarSyncStatus_idx" ON "Reservation"("calendarSyncStatus");
