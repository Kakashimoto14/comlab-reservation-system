import { Router } from "express";

import { AiController } from "../controllers/AiController.js";
import { authenticate } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { reservationAssistantSchema } from "../validations/ai.validation.js";

const router = Router();
const assistantRateLimit = createRateLimiter({
  keyPrefix: "ai-assistant",
  windowMs: 60_000,
  maxRequests: 10,
  message: "Too many assistant requests. Please wait a moment and try again."
});

router.post(
  "/reservation-assistant",
  authenticate,
  assistantRateLimit,
  validate(reservationAssistantSchema),
  asyncHandler(AiController.askReservationAssistant)
);

export default router;
