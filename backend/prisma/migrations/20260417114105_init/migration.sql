-- AlterTable
ALTER TABLE `activitylog` MODIFY `description` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `laboratory` MODIFY `description` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `reservation` MODIFY `purpose` VARCHAR(191) NOT NULL;
