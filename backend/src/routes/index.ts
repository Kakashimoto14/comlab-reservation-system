import { Router } from "express";

import authRoutes from "./auth.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import laboratoryRoutes from "./laboratory.routes.js";
import reservationRoutes from "./reservation.routes.js";
import scheduleRoutes from "./schedule.routes.js";
import userRoutes from "./user.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    message: "ComLab Reservation System API is running."
  });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/laboratories", laboratoryRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/reservations", reservationRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
