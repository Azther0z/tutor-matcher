import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./docs/openapi.ts";
import { errorHandler } from "./middleware/error-handler.ts";
import { apiRouter } from "./routes.ts";

export const app = express();

app.set("trust proxy", ["loopback", "uniquelocal"]);
app.use(express.json());
// Swagger UI and the raw OpenAPI document are public, like the health check.
app.get("/api/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiDocument);
});
// The page itself is served at /api/docs with a <base> tag instead of letting swagger-ui-express
// redirect to /api/docs/: the frontend proxy strips the trailing slash, so that would loop.
const swaggerPage = swaggerUi
  .generateHTML(openApiDocument)
  .replace("<head>", '<head>\n  <base href="/api/docs/">');
app.get("/api/docs", (_req: Request, res: Response) => {
  res.type("html").send(swaggerPage);
});
app.use("/api/docs", swaggerUi.serve);
app.use("/api", apiRouter);

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "hi" });
});

app.use(errorHandler);
