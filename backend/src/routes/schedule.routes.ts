import { Router } from "express";

import { ScheduleController } from "../controllers/ScheduleController.js";
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createScheduleSchema,
  listScheduleSchema,
  scheduleIdSchema,
  updateScheduleSchema
} from "../validations/schedule.validation.js";

const router = Router();

router.get(
  "/",
  optionalAuthenticate,
  validate(listScheduleSchema),
  asyncHandler(ScheduleController.list)
);
router.post(
  "/",
  authenticate,
  requireRole("ADMIN", "LABORATORY_STAFF"),
  validate(createScheduleSchema),
  asyncHandler(ScheduleController.create)
);
router.put(
  "/:id",
  authenticate,
  requireRole("ADMIN", "LABORATORY_STAFF"),
  validate(updateScheduleSchema),
  asyncHandler(ScheduleController.update)
);
router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN", "LABORATORY_STAFF"),
  validate(scheduleIdSchema),
  asyncHandler(ScheduleController.remove)
);

export default router;
