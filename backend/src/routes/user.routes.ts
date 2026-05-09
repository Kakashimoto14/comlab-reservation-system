import { Router } from "express";

import { UserController } from "../controllers/UserController.js";
import { authenticate } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createUserSchema,
  updateProfileSchema,
  updateUserSchema,
  updateUserStatusSchema
} from "../validations/user.validation.js";

const router = Router();
const profileUpdateRateLimit = createRateLimiter({
  keyPrefix: "profile-update",
  windowMs: 60_000,
  maxRequests: 10,
  message: "Too many profile update attempts. Please wait a moment before trying again."
});

router.use(authenticate);
router.get("/", requireRole("ADMIN"), asyncHandler(UserController.list));
router.post("/", requireRole("ADMIN"), validate(createUserSchema), asyncHandler(UserController.create));
router.put(
  "/:id",
  requireRole("ADMIN"),
  validate(updateUserSchema),
  asyncHandler(UserController.update)
);
router.patch(
  "/:id/status",
  requireRole("ADMIN"),
  validate(updateUserStatusSchema),
  asyncHandler(UserController.updateStatus)
);
router.put(
  "/profile",
  profileUpdateRateLimit,
  validate(updateProfileSchema),
  asyncHandler(UserController.updateProfile)
);

export default router;
