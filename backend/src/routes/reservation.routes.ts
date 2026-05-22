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

const reservationReadRoles = ["STUDENT", "LABORATORY_STAFF", "ADMIN"] as const;
const reservationCreateRoles = ["STUDENT"] as const;
const reservationReviewRoles = ["ADMIN", "LABORATORY_STAFF"] as const;

router.use(authenticate);
router.get("/", authorizeRoles(...reservationReadRoles), asyncHandler(ReservationController.list));
router.post(
  "/",
  authorizeRoles(...reservationCreateRoles),
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
  authorizeRoles(...reservationReviewRoles),
  validate(reviewReservationSchema),
  asyncHandler(ReservationController.review)
);
router.patch(
  "/:id/complete",
  authorizeRoles(...reservationReviewRoles),
  validate(completeReservationSchema),
  asyncHandler(ReservationController.complete)
);

export default router;
