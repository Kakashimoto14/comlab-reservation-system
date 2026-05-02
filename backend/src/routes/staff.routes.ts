import { Router } from "express";

import { StaffController } from "../controllers/StaffController.js";
import { authenticate } from "../middleware/auth.js";
import { allowReadOtherLabAvailability } from "../middleware/labAccess.js";
import { authorizeRoles } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { updateMyLabPcStatusSchema } from "../validations/laboratory.validation.js";
import { reviewReservationSchema } from "../validations/reservation.validation.js";
import { listScheduleSchema, updateMyLabScheduleSchema } from "../validations/schedule.validation.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles("CUSTODIAN", "ADMIN"));

router.get("/my-lab", asyncHandler(StaffController.getMyLab));
router.get("/my-lab/reservations", asyncHandler(StaffController.getMyLabReservations));
router.get("/my-lab/schedules", asyncHandler(StaffController.getMyLabSchedules));
router.get("/my-lab/logs", asyncHandler(StaffController.getMyLabLogs));
router.get("/my-lab/pcs", asyncHandler(StaffController.getMyLabPcs));

router.get(
  "/labs/availability",
  allowReadOtherLabAvailability(),
  validate(listScheduleSchema),
  asyncHandler(StaffController.listAvailability)
);
router.get(
  "/labs/schedules/public",
  allowReadOtherLabAvailability(),
  validate(listScheduleSchema),
  asyncHandler(StaffController.listPublicSchedules)
);

router.put(
  "/my-lab/reservation/:id",
  validate(reviewReservationSchema),
  asyncHandler(StaffController.updateMyLabReservation)
);
router.put(
  "/my-lab/schedule/:id",
  validate(updateMyLabScheduleSchema),
  asyncHandler(StaffController.updateMyLabSchedule)
);
router.put(
  "/my-lab/pcs/:id/status",
  validate(updateMyLabPcStatusSchema),
  asyncHandler(StaffController.updateMyLabPcStatus)
);

export default router;
