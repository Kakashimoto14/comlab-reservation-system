import { Router } from "express";

import { NotificationController } from "../controllers/NotificationController.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(NotificationController.list));
router.post("/mark-all-read", asyncHandler(NotificationController.markAllAsRead));
router.patch("/:id/read", asyncHandler(NotificationController.markAsRead));
router.get("/stream", NotificationController.stream);

export default router;
