UPDATE `User`
SET `studentNumber` = CONCAT(
  RIGHT(LEFT(`studentNumber`, 4), 2),
  '-',
  LPAD(RIGHT(`studentNumber`, 4), 5, '0')
)
WHERE `studentNumber` REGEXP '^[0-9]{4}-[0-9]{4}$';

UPDATE `User`
SET `studentNumber` = CONCAT(LEFT(`studentNumber`, 2), '-', RIGHT(`studentNumber`, 5))
WHERE `studentNumber` REGEXP '^[0-9]{7}$';

UPDATE `User`
SET `phone` = NULL
WHERE `phone` IS NOT NULL AND TRIM(`phone`) = '';

UPDATE `User`
SET `phone` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`phone`), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')
WHERE `phone` IS NOT NULL;

UPDATE `User`
SET `phone` = CONCAT('+', `phone`)
WHERE `phone` REGEXP '^639[0-9]{9}$';

UPDATE `User`
SET `studentNumber` = NULL,
    `yearLevel` = NULL
WHERE `role` IN ('ADMIN', 'LABORATORY_STAFF');

ALTER TABLE `User`
  MODIFY `firstName` VARCHAR(50) NOT NULL,
  MODIFY `lastName` VARCHAR(50) NOT NULL,
  MODIFY `studentNumber` VARCHAR(8) NULL,
  MODIFY `department` VARCHAR(120) NULL,
  MODIFY `phone` VARCHAR(13) NULL;

ALTER TABLE `User`
  ADD CONSTRAINT `User_phone_format_chk`
    CHECK (`phone` IS NULL OR `phone` REGEXP '^(\\+639|09)[0-9]{9}$'),
  ADD CONSTRAINT `User_student_role_fields_chk`
    CHECK (
      (
        `role` = 'STUDENT'
        AND `studentNumber` IS NOT NULL
        AND `studentNumber` REGEXP '^[0-9]{2}-[0-9]{5}$'
        AND `yearLevel` BETWEEN 1 AND 4
      )
      OR (
        `role` <> 'STUDENT'
        AND `studentNumber` IS NULL
        AND `yearLevel` IS NULL
      )
    );
