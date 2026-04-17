-- AlterTable
ALTER TABLE `ActivityLog` MODIFY `description` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Laboratory` MODIFY `description` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Reservation` MODIFY `purpose` VARCHAR(191) NOT NULL;
