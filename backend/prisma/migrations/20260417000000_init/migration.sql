CREATE TABLE `User` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `firstName` VARCHAR(191) NOT NULL,
  `lastName` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN', 'STUDENT', 'LABORATORY_STAFF') NOT NULL,
  `status` ENUM('ACTIVE', 'DEACTIVATED') NOT NULL DEFAULT 'ACTIVE',
  `studentNumber` VARCHAR(191) NULL,
  `department` VARCHAR(191) NULL,
  `yearLevel` INTEGER NULL,
  `phone` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  UNIQUE INDEX `User_studentNumber_key`(`studentNumber`),
  INDEX `User_role_status_idx`(`role`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Laboratory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `roomCode` VARCHAR(191) NOT NULL,
  `building` VARCHAR(191) NOT NULL,
  `capacity` INTEGER NOT NULL,
  `computerCount` INTEGER NOT NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  `imageUrl` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Laboratory_roomCode_key`(`roomCode`),
  INDEX `Laboratory_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Schedule` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `laboratoryId` INTEGER NOT NULL,
  `date` DATETIME(3) NOT NULL,
  `startTime` VARCHAR(191) NOT NULL,
  `endTime` VARCHAR(191) NOT NULL,
  `status` ENUM('AVAILABLE', 'BLOCKED', 'CLOSED') NOT NULL DEFAULT 'AVAILABLE',
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Schedule_laboratoryId_date_idx`(`laboratoryId`, `date`),
  INDEX `Schedule_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Reservation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reservationCode` VARCHAR(191) NOT NULL,
  `studentId` INTEGER NOT NULL,
  `laboratoryId` INTEGER NOT NULL,
  `scheduleId` INTEGER NULL,
  `purpose` TEXT NOT NULL,
  `reservationDate` DATETIME(3) NOT NULL,
  `startTime` VARCHAR(191) NOT NULL,
  `endTime` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
  `remarks` VARCHAR(191) NULL,
  `reviewedById` INTEGER NULL,
  `reviewedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Reservation_reservationCode_key`(`reservationCode`),
  INDEX `Reservation_studentId_reservationDate_idx`(`studentId`, `reservationDate`),
  INDEX `Reservation_laboratoryId_reservationDate_idx`(`laboratoryId`, `reservationDate`),
  INDEX `Reservation_status_reservationDate_idx`(`status`, `reservationDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ActivityLog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NULL,
  `action` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(191) NOT NULL,
  `entityId` INTEGER NULL,
  `description` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ActivityLog_action_idx`(`action`),
  INDEX `ActivityLog_entityType_entityId_idx`(`entityType`, `entityId`),
  INDEX `ActivityLog_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Schedule`
  ADD CONSTRAINT `Schedule_laboratoryId_fkey`
  FOREIGN KEY (`laboratoryId`) REFERENCES `Laboratory`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Schedule`
  ADD CONSTRAINT `Schedule_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Reservation`
  ADD CONSTRAINT `Reservation_studentId_fkey`
  FOREIGN KEY (`studentId`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Reservation`
  ADD CONSTRAINT `Reservation_laboratoryId_fkey`
  FOREIGN KEY (`laboratoryId`) REFERENCES `Laboratory`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Reservation`
  ADD CONSTRAINT `Reservation_scheduleId_fkey`
  FOREIGN KEY (`scheduleId`) REFERENCES `Schedule`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Reservation`
  ADD CONSTRAINT `Reservation_reviewedById_fkey`
  FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ActivityLog`
  ADD CONSTRAINT `ActivityLog_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
