import { Router } from "express";

import { LaboratoryController } from "../controllers/LaboratoryController.js";
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createLaboratorySchema,
  laboratoryIdSchema,
  updateLaboratorySchema
} from "../validations/laboratory.validation.js";

const router = Router();

router.get("/", optionalAuthenticate, asyncHandler(LaboratoryController.list));
router.get(
  "/:id",
  optionalAuthenticate,
  validate(laboratoryIdSchema),
  asyncHandler(LaboratoryController.getById)
);
router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  validate(createLaboratorySchema),
  asyncHandler(LaboratoryController.create)
);
router.put(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validate(updateLaboratorySchema),
  asyncHandler(LaboratoryController.update)
);
router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validate(laboratoryIdSchema),
  asyncHandler(LaboratoryController.remove)
);

export default router;
