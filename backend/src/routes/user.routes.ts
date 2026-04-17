import { Router } from "express";

import { UserController } from "../controllers/UserController.js";
import { authenticate } from "../middleware/auth.js";
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
router.put("/profile", validate(updateProfileSchema), asyncHandler(UserController.updateProfile));

export default router;
