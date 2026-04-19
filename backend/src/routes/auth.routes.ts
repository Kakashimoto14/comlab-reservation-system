import { Router } from "express";

import { AuthController } from "../controllers/AuthController.js";
import { authenticate } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerStudentSchema,
  resetPasswordSchema
} from "../validations/auth.validation.js";

const router = Router();
const loginRateLimit = createRateLimiter({
  keyPrefix: "auth-login",
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  maxRequests: env.LOGIN_RATE_LIMIT_MAX,
  message: "Too many login attempts. Please wait a moment and try again."
});
const registerRateLimit = createRateLimiter({
  keyPrefix: "auth-register",
  windowMs: env.REGISTER_RATE_LIMIT_WINDOW_MS,
  maxRequests: env.REGISTER_RATE_LIMIT_MAX,
  message: "Too many registration attempts. Please wait a moment before submitting again."
});
const passwordResetRateLimit = createRateLimiter({
  keyPrefix: "auth-password-reset",
  windowMs: env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  maxRequests: env.PASSWORD_RESET_RATE_LIMIT_MAX,
  message: "Too many password reset attempts. Please wait before trying again."
});

router.post(
  "/register",
  registerRateLimit,
  validate(registerStudentSchema),
  asyncHandler(AuthController.register)
);
router.post("/login", loginRateLimit, validate(loginSchema), asyncHandler(AuthController.login));
router.post(
  "/forgot-password",
  passwordResetRateLimit,
  validate(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword)
);
router.post(
  "/reset-password",
  passwordResetRateLimit,
  validate(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword)
);
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(AuthController.changePassword)
);
router.post("/logout", authenticate, asyncHandler(AuthController.logout));
router.get("/me", authenticate, asyncHandler(AuthController.me));

export default router;
