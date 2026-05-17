import { Router } from "express";

import { AuthController } from "../controllers/AuthController.js";
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerStudentSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema
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
const forgotPasswordRateLimit = createRateLimiter({
  keyPrefix: "auth-forgot-password",
  windowMs: env.FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS,
  maxRequests: env.FORGOT_PASSWORD_RATE_LIMIT_MAX,
  message: "Too many password reset attempts. Please wait before trying again."
});
const resetPasswordRateLimit = createRateLimiter({
  keyPrefix: "auth-reset-password",
  windowMs: env.RESET_PASSWORD_RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RESET_PASSWORD_RATE_LIMIT_MAX,
  message: "Too many password reset attempts. Please wait before trying again."
});
const verifyEmailRateLimit = createRateLimiter({
  keyPrefix: "auth-verify-email",
  windowMs: env.VERIFY_EMAIL_RATE_LIMIT_WINDOW_MS,
  maxRequests: env.VERIFY_EMAIL_RATE_LIMIT_MAX,
  message: "Too many verification attempts. Please wait a moment before trying again."
});
const resendVerificationRateLimit = createRateLimiter({
  keyPrefix: "auth-resend-verification",
  windowMs: env.RESEND_VERIFICATION_RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RESEND_VERIFICATION_RATE_LIMIT_MAX,
  message: "Too many verification requests. Please wait before requesting another email."
});

router.post(
  "/register",
  registerRateLimit,
  validate(registerStudentSchema),
  asyncHandler(AuthController.register)
);
router.post("/login", loginRateLimit, validate(loginSchema), asyncHandler(AuthController.login));
router.post("/refresh", asyncHandler(AuthController.refresh));
router.post(
  "/verify-email",
  verifyEmailRateLimit,
  validate(verifyEmailSchema),
  asyncHandler(AuthController.verifyEmail)
);
router.post(
  "/resend-verification",
  resendVerificationRateLimit,
  validate(resendVerificationSchema),
  asyncHandler(AuthController.resendVerification)
);
router.post(
  "/forgot-password",
  forgotPasswordRateLimit,
  validate(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword)
);
router.post(
  "/reset-password",
  resetPasswordRateLimit,
  validate(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword)
);
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(AuthController.changePassword)
);
router.post("/logout", optionalAuthenticate, asyncHandler(AuthController.logout));
router.get("/me", authenticate, asyncHandler(AuthController.me));

export default router;
