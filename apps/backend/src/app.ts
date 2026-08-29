import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import { errorHandler } from "./middleware/error-handler.ts";
import { apiRouter } from "./routes.ts";

export const app = express();

app.use(express.json());
app.use("/api", apiRouter);

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "hi" });
});

app.use(errorHandler);
