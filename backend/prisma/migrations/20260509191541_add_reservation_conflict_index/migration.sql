-- CreateIndex
CREATE INDEX `idx_reservation_conflict` ON `Reservation`(`laboratoryId`, `reservationDate`, `status`, `startTime`, `endTime`);
