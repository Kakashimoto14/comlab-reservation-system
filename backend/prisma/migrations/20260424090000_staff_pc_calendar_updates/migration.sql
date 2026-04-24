-- AlterTable
ALTER TABLE `Laboratory`
  ADD COLUMN `location` VARCHAR(191) NULL,
  ADD COLUMN `custodianId` INTEGER NULL;

UPDATE `Laboratory`
SET `location` = CONCAT(`building`, ' - ', `roomCode`)
WHERE `location` IS NULL;

-- AlterTable
ALTER TABLE `Reservation`
  ADD COLUMN `pcId` INTEGER NULL,
  ADD COLUMN `reservationType` ENUM('LAB', 'PC') NOT NULL DEFAULT 'LAB';

-- AlterTable
ALTER TABLE `ActivityLog`
  ADD COLUMN `labId` INTEGER NULL,
  ADD COLUMN `pcId` INTEGER NULL,
  ADD COLUMN `metadata` JSON NULL,
  ADD COLUMN `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `ActivityLog`
SET `timestamp` = `createdAt`
WHERE `timestamp` IS NULL;

-- CreateTable
CREATE TABLE `PC` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `laboratoryId` INTEGER NOT NULL,
  `pcNumber` VARCHAR(191) NOT NULL,
  `status` ENUM('AVAILABLE', 'OCCUPIED', 'MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PC_laboratoryId_pcNumber_key`(`laboratoryId`, `pcNumber`),
  INDEX `PC_laboratoryId_status_idx`(`laboratoryId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalendarEvent` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(191) NOT NULL,
  `type` ENUM('MAINTENANCE', 'HOLIDAY') NOT NULL,
  `laboratoryId` INTEGER NULL,
  `pcId` INTEGER NULL,
  `date` DATETIME(3) NOT NULL,
  `startTime` VARCHAR(191) NULL,
  `endTime` VARCHAR(191) NULL,
  `description` VARCHAR(191) NULL,
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `CalendarEvent_date_type_idx`(`date`, `type`),
  INDEX `CalendarEvent_laboratoryId_date_idx`(`laboratoryId`, `date`),
  INDEX `CalendarEvent_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Laboratory_custodianId_idx` ON `Laboratory`(`custodianId`);

-- CreateIndex
CREATE INDEX `Laboratory_building_status_idx` ON `Laboratory`(`building`, `status`);

-- CreateIndex
CREATE INDEX `Reservation_pcId_reservationDate_idx` ON `Reservation`(`pcId`, `reservationDate`);

-- CreateIndex
CREATE INDEX `ActivityLog_labId_timestamp_idx` ON `ActivityLog`(`labId`, `timestamp`);

-- CreateIndex
CREATE INDEX `ActivityLog_pcId_timestamp_idx` ON `ActivityLog`(`pcId`, `timestamp`);

-- CreateIndex
CREATE INDEX `ActivityLog_timestamp_idx` ON `ActivityLog`(`timestamp`);

-- AddForeignKey
ALTER TABLE `Laboratory`
  ADD CONSTRAINT `Laboratory_custodianId_fkey`
  FOREIGN KEY (`custodianId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation`
  ADD CONSTRAINT `Reservation_pcId_fkey`
  FOREIGN KEY (`pcId`) REFERENCES `PC`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PC`
  ADD CONSTRAINT `PC_laboratoryId_fkey`
  FOREIGN KEY (`laboratoryId`) REFERENCES `Laboratory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog`
  ADD CONSTRAINT `ActivityLog_labId_fkey`
  FOREIGN KEY (`labId`) REFERENCES `Laboratory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog`
  ADD CONSTRAINT `ActivityLog_pcId_fkey`
  FOREIGN KEY (`pcId`) REFERENCES `PC`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent`
  ADD CONSTRAINT `CalendarEvent_laboratoryId_fkey`
  FOREIGN KEY (`laboratoryId`) REFERENCES `Laboratory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent`
  ADD CONSTRAINT `CalendarEvent_pcId_fkey`
  FOREIGN KEY (`pcId`) REFERENCES `PC`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent`
  ADD CONSTRAINT `CalendarEvent_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
