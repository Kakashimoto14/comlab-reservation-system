import { Router } from "express";

import { AiController } from "../controllers/AiController.js";
import { env } from "../config/env.js";
import { authenticate } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  assistantActionIdSchema,
  confirmAssistantActionSchema,
  reservationAssistantSchema
} from "../validations/ai.validation.js";

const router = Router();
const assistantRateLimit = createRateLimiter({
  keyPrefix: "ai-assistant",
  windowMs: env.AI_ASSISTANT_RATE_LIMIT_WINDOW_MS,
  maxRequests: env.AI_ASSISTANT_RATE_LIMIT_MAX,
  message: "Too many assistant requests. Please wait a moment and try again."
});

router.post(
  "/reservation-assistant",
  authenticate,
  assistantRateLimit,
  validate(reservationAssistantSchema),
  asyncHandler(AiController.askReservationAssistant)
);
router.post(
  "/reservation-assistant/actions/:actionId/confirm",
  authenticate,
  assistantRateLimit,
  validate(confirmAssistantActionSchema),
  asyncHandler(AiController.confirmPendingAssistantAction)
);
router.post(
  "/reservation-assistant/actions/:actionId/cancel",
  authenticate,
  assistantRateLimit,
  validate(assistantActionIdSchema),
  asyncHandler(AiController.cancelPendingAssistantAction)
);

export default router;
