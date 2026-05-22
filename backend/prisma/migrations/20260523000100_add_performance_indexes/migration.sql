CREATE INDEX IF NOT EXISTS "Schedule_status_date_idx" ON "Schedule"("status", "date");

CREATE INDEX IF NOT EXISTS "Reservation_createdAt_idx" ON "Reservation"("createdAt");

CREATE INDEX IF NOT EXISTS "Reservation_laboratoryId_createdAt_idx" ON "Reservation"("laboratoryId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_channel_readAt_createdAt_idx" ON "Notification"("userId", "channel", "readAt", "createdAt");
