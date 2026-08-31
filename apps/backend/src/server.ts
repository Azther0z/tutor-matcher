import { app } from "./app.ts";
import { env } from "./lib/env.ts";

app.listen(env.port, () => console.log(`server run on port ${env.port}`));
