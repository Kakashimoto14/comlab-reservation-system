import { Router } from "express";

import { AuthController } from "../controllers/AuthController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginSchema, registerStudentSchema } from "../validations/auth.validation.js";

const router = Router();

router.post("/register", validate(registerStudentSchema), asyncHandler(AuthController.register));
router.post("/login", validate(loginSchema), asyncHandler(AuthController.login));
router.post("/logout", authenticate, asyncHandler(AuthController.logout));
router.get("/me", authenticate, asyncHandler(AuthController.me));

export default router;
