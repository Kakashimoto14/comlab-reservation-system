-- CreateTable
CREATE TABLE `Notification` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `reservationId` INTEGER NULL,
  `channel` ENUM('EMAIL', 'IN_APP') NOT NULL,
  `type` ENUM('RESERVATION_CREATED', 'RESERVATION_CONFIRMED', 'RESERVATION_CANCELLED', 'RESERVATION_REMINDER') NOT NULL,
  `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `subject` VARCHAR(191) NOT NULL,
  `message` LONGTEXT NOT NULL,
  `metadata` JSON NULL,
  `readAt` DATETIME(3) NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Notification_userId_reservationId_channel_type_key`(`userId`, `reservationId`, `channel`, `type`),
  INDEX `Notification_userId_channel_createdAt_idx`(`userId`, `channel`, `createdAt`),
  INDEX `Notification_channel_status_createdAt_idx`(`channel`, `status`, `createdAt`),
  INDEX `Notification_reservationId_type_idx`(`reservationId`, `type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification`
  ADD CONSTRAINT `Notification_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification`
  ADD CONSTRAINT `Notification_reservationId_fkey`
  FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
