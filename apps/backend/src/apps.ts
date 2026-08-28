import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";

export const app = express();

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "hi" });
});
