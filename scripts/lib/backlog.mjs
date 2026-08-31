import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse } from "yaml";

export async function readBacklog(root = process.cwd()) {
  const backlogDir = join(root, "docs", "backlog");
  const storiesDir = join(backlogDir, "product-backlog");
  const storyFiles = (await readdir(storiesDir)).filter((file) => file.endsWith(".yaml")).sort();
  const sprintFiles = (await readdir(backlogDir))
    .filter((file) => /^sprint-\d+\.yaml$/.test(file))
    .sort();

  const stories = await Promise.all(
    storyFiles.map(async (file) => ({
      file,
      path: join(storiesDir, file),
      data: parse(await readFile(join(storiesDir, file), "utf8")),
    }))
  );
  const sprints = await Promise.all(
    sprintFiles.map(async (file) => ({
      file,
      path: join(backlogDir, file),
      data: parse(await readFile(join(backlogDir, file), "utf8")),
    }))
  );

  return {
    backlogDir,
    config: parse(await readFile(join(backlogDir, "backlog.yaml"), "utf8")),
    stories,
    sprints,
  };
}
