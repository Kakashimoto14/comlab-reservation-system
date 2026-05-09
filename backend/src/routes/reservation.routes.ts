import { Router } from "express";

import { ReservationController } from "../controllers/ReservationController.js";
import { authenticate } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { authorizeRoles } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  completeReservationSchema,
  createReservationSchema,
  reservationIdSchema,
  reviewReservationSchema
} from "../validations/reservation.validation.js";

const router = Router();
const reservationCreateRateLimit = createRateLimiter({
  keyPrefix: "reservation-create",
  windowMs: 60_000,
  maxRequests: 10,
  message: "Too many reservation submissions. Please wait a moment and try again."
});

router.use(authenticate);
router.get("/", authorizeRoles("STUDENT", "CUSTODIAN", "ADMIN"), asyncHandler(ReservationController.list));
router.post(
  "/",
  authorizeRoles("STUDENT"),
  reservationCreateRateLimit,
  validate(createReservationSchema),
  asyncHandler(ReservationController.create)
);
router.patch(
  "/:id/cancel",
  authorizeRoles("STUDENT"),
  validate(reservationIdSchema),
  asyncHandler(ReservationController.cancel)
);
router.patch(
  "/:id/review",
  authorizeRoles("ADMIN", "CUSTODIAN"),
  validate(reviewReservationSchema),
  asyncHandler(ReservationController.review)
);
router.patch(
  "/:id/complete",
  authorizeRoles("ADMIN", "CUSTODIAN"),
  validate(completeReservationSchema),
  asyncHandler(ReservationController.complete)
);

export default router;
