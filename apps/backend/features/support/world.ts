import { setWorldConstructor, World } from "@cucumber/cucumber";
import type { Response } from "supertest";

export class TutorMatcherWorld extends World {
  response?: Response;
}

setWorldConstructor(TutorMatcherWorld);
