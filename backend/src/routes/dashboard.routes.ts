import { Router } from "express";

import { DashboardController } from "../controllers/DashboardController.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(DashboardController.getData));

export default router;
