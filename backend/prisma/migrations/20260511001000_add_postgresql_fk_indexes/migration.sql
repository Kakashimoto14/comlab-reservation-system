-- CreateIndex
CREATE INDEX "Reservation_scheduleId_idx" ON "Reservation"("scheduleId");

-- CreateIndex
CREATE INDEX "Reservation_reviewedById_idx" ON "Reservation"("reviewedById");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "CalendarEvent_pcId_idx" ON "CalendarEvent"("pcId");
