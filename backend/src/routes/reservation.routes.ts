import { Router } from "express";

import { ReservationController } from "../controllers/ReservationController.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  completeReservationSchema,
  createReservationSchema,
  reservationIdSchema,
  reviewReservationSchema
} from "../validations/reservation.validation.js";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(ReservationController.list));
router.post(
  "/",
  requireRole("STUDENT"),
  validate(createReservationSchema),
  asyncHandler(ReservationController.create)
);
router.patch(
  "/:id/cancel",
  requireRole("STUDENT"),
  validate(reservationIdSchema),
  asyncHandler(ReservationController.cancel)
);
router.patch(
  "/:id/review",
  requireRole("ADMIN", "LABORATORY_STAFF"),
  validate(reviewReservationSchema),
  asyncHandler(ReservationController.review)
);
router.patch(
  "/:id/complete",
  requireRole("ADMIN", "LABORATORY_STAFF"),
  validate(completeReservationSchema),
  asyncHandler(ReservationController.complete)
);

export default router;
