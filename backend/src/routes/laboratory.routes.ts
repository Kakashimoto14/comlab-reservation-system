import { Router } from "express";

import { LaboratoryController } from "../controllers/LaboratoryController.js";
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  assignLaboratoryStaffSchema,
  createLaboratorySchema,
  laboratoryIdSchema,
  listLaboratoryAssignmentsSchema,
  updatePcStatusSchema,
  updateLaboratorySchema
} from "../validations/laboratory.validation.js";

const router = Router();

router.get("/", optionalAuthenticate, asyncHandler(LaboratoryController.list));
router.get(
  "/assignments",
  authenticate,
  requireRole("ADMIN"),
  validate(listLaboratoryAssignmentsSchema),
  asyncHandler(LaboratoryController.listAssignments)
);
router.get(
  "/staff-options",
  authenticate,
  requireRole("ADMIN"),
  asyncHandler(LaboratoryController.listStaffOptions)
);
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
router.put(
  "/:id/custodian",
  authenticate,
  requireRole("ADMIN"),
  validate(assignLaboratoryStaffSchema),
  asyncHandler(LaboratoryController.assignStaff)
);
router.put(
  "/:id/pcs/:pcId/status",
  authenticate,
  requireRole("ADMIN"),
  validate(updatePcStatusSchema),
  asyncHandler(LaboratoryController.updatePcStatus)
);
router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validate(laboratoryIdSchema),
  asyncHandler(LaboratoryController.remove)
);

export default router;
