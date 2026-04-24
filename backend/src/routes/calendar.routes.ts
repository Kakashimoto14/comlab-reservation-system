import { Router } from "express";

import { CalendarController } from "../controllers/CalendarController.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  calendarEventIdSchema,
  createCalendarEventSchema,
  listCalendarSchema,
  updateCalendarEventSchema
} from "../validations/calendar.validation.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("ADMIN"));

router.get("/", validate(listCalendarSchema), asyncHandler(CalendarController.list));
router.post("/", validate(createCalendarEventSchema), asyncHandler(CalendarController.create));
router.put(
  "/:id",
  validate(updateCalendarEventSchema),
  asyncHandler(CalendarController.update)
);
router.delete(
  "/:id",
  validate(calendarEventIdSchema),
  asyncHandler(CalendarController.remove)
);

export default router;
