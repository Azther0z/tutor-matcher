/**
 * Copy env templates into place for a fresh checkout.
 *
 * Runs as part of `npm run setup` / `just setup`. Cross-platform (no shell `cp`).
 * Existing files are left untouched; a missing template is reported and skipped.
 */
import { existsSync, copyFileSync } from "node:fs";

const PAIRS = [
  [".env.example", ".env"],
  ["apps/backend/.env.example", "apps/backend/.env"],
];

let created = 0;

for (const [template, target] of PAIRS) {
  if (existsSync(target)) {
    console.log(`kept    ${target} (already exists)`);
    continue;
  }
  if (!existsSync(template)) {
    console.warn(`skipped ${target} (no template at ${template})`);
    continue;
  }
  copyFileSync(template, target);
  created += 1;
  console.log(`created ${target} from ${template}`);
}

console.log(created === 0 ? "env: nothing to do" : `env: created ${created} file(s)`);
