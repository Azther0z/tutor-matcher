import { Router } from "express";
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

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/profiles", profileRouter);
apiRouter.use("/discovery", discoveryRouter);
apiRouter.use("/bookings", bookingRouter);
apiRouter.use("/wallet", walletRouter);
apiRouter.use("/messages", messagingRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/classroom", classroomRouter);
apiRouter.use("/dashboard", dashboardRouter);
