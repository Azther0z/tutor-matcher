import { Router } from "express";
import { requireAuth } from "./middleware/auth.ts";
import { authRouter } from "./modules/auth/auth.routes.ts";
import { bookingRouter } from "./modules/booking/booking.routes.ts";
import { classroomRouter } from "./modules/classroom/classroom.routes.ts";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.ts";
import { discoveryRouter } from "./modules/discovery/discovery.routes.ts";
import { healthRouter } from "./modules/health/health.routes.ts";
import { messagingRouter } from "./modules/messaging/messaging.routes.ts";
import { profileRouter } from "./modules/profile/profile.routes.ts";
import { reviewRouter } from "./modules/review/review.routes.ts";
import { walletRouter } from "./modules/wallet/wallet.routes.ts";

export const apiRouter = Router();

// Public routes
apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);

// Protected routes — require a valid Bearer token
apiRouter.use("/profiles", requireAuth, profileRouter);
apiRouter.use("/discovery", requireAuth, discoveryRouter);
apiRouter.use("/bookings", requireAuth, bookingRouter);
apiRouter.use("/wallet", requireAuth, walletRouter);
apiRouter.use("/messages", requireAuth, messagingRouter);
apiRouter.use("/reviews", requireAuth, reviewRouter);
apiRouter.use("/classroom", requireAuth, classroomRouter);
apiRouter.use("/dashboard", requireAuth, dashboardRouter);
