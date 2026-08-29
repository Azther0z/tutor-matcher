import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const backlog = join(root, "docs", "backlog");
const storiesDir = join(backlog, "product-backlog");
const errors = [];
const storyFiles = (await readdir(storiesDir)).filter((file) => file.endsWith(".yaml")).sort();
const storyIds = new Set();
const dependencyEntries = [];

for (const file of storyFiles) {
  const content = await readFile(join(storiesDir, file), "utf8");
  const id = content.match(/^id:\s*(\S+)$/m)?.[1];
  const filenameId = file.match(/^([A-Z]+-\d+)(?:-|\.)/)?.[1];
  if (!id) errors.push(`${file}: missing id`);
  if (id && filenameId !== id) errors.push(`${file}: filename ID does not match id ${id}`);
  if (id && storyIds.has(id)) errors.push(`${file}: duplicate id ${id}`);
  if (id) storyIds.add(id);
  if (!/^lifecycle:\s*(backlog|todo|review|done|cancelled)$/m.test(content))
    errors.push(`${file}: invalid or missing lifecycle`);
  if (!/^description:\s*.+$/m.test(content)) errors.push(`${file}: missing description`);
  if (!/^story_points:\s*\d+$/m.test(content))
    errors.push(`${file}: invalid or missing story_points`);
  const dependencies = content.match(/^dependencies:\s*\[([^\]]*)\]$/m);
  if (!dependencies) {
    errors.push(`${file}: missing or invalid dependencies`);
  } else {
    for (const dependency of dependencies[1]
      .split(",")
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)) {
      if (!/^[A-Z]+-\d+$/.test(dependency)) {
        errors.push(`${file}: invalid dependency ID ${dependency}`);
      } else {
        dependencyEntries.push({ file, dependency });
      }
    }
  }
  if (!/^acceptance_criteria:\n/m.test(content))
    errors.push(`${file}: missing acceptance_criteria`);
  if (!/^\s+- given:\s*.+\n\s+when:\s*.+\n\s+then:\s*.+/m.test(content))
    errors.push(`${file}: acceptance criteria must use given/when/then`);
  if (
    !content.includes("file: ../../sources/Product Backlog v1.2.html") &&
    !content.includes("file: ../../sources/Untitled-2026-08-28-2348.svg")
  )
    errors.push(`${file}: missing product or journey source reference`);
  if (!content.includes("route: ") || !content.includes("action: "))
    errors.push(`${file}: missing journey route/action reference`);
}

for (const { file, dependency } of dependencyEntries) {
  if (!storyIds.has(dependency)) errors.push(`${file}: unknown dependency ID ${dependency}`);
}

const backlogContent = await readFile(join(backlog, "backlog.yaml"), "utf8");
for (const match of backlogContent.matchAll(/^\s+story_ids:\s*\[([^\]]*)\]$/gm)) {
  for (const id of match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (!storyIds.has(id)) errors.push(`backlog.yaml: unknown journey coverage story ${id}`);
  }
}

const sprintManifests = (await readdir(backlog)).filter((file) => /^sprint-\d+\.yaml$/.test(file));
for (const manifest of sprintManifests) {
  const manifestContent = await readFile(join(backlog, manifest), "utf8");
  if (!/^status:\s*(planned|in_progress|done)$/m.test(manifestContent))
    errors.push(`${manifest}: invalid or missing sprint status`);
  const selectedStories = manifestContent.match(/^story_ids:\n((?:\s+- \S+\n?)+)/m)?.[1] ?? "";
  for (const match of selectedStories.matchAll(/^\s+- (\S+)$/gm)) {
    const [, id] = match;
    if (!storyIds.has(id)) errors.push(`${manifest}: unknown story ${id}`);
  }
}

for (const source of [
  "Product Backlog v1.2.html",
  "Sprint 1 v1.1.html",
  "Untitled-2026-08-28-2348.svg",
]) {
  try {
    await access(join(root, "docs", "sources", source));
  } catch {
    errors.push(`missing immutable source docs/sources/${source}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${storyFiles.length} product stories and ${sprintManifests.length} sprint backlogs.`
  );
}
