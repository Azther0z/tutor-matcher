import { access } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { readBacklog } from "./lib/backlog.mjs";

const root = process.cwd();
const errors = [];
const executionFields = ["sprint", "assignees", "status", "order", "estimate_hours", "tasks"];
const lifecycleValues = new Set(["backlog", "todo", "review", "done", "cancelled"]);
const sprintStatusValues = new Set(["planned", "in_progress", "todo", "blocked", "done"]);
const taskRoles = new Set(["UXUI", "Frontend", "Backend", "QA"]);
const { config, stories, sprints } = await readBacklog(root);
const epicNames = new Set((config?.epics ?? []).map((epic) => epic.name));
const sourcesDir = join(root, "docs", "sources");
const storyById = new Map();
const dependencyEntries = [];
const taskIds = new Set();

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const sameNames = (left, right) =>
  Array.isArray(left) && Array.isArray(right) && JSON.stringify(left) === JSON.stringify(right);

for (const record of stories) {
  const story = record.data;
  if (!story || typeof story !== "object" || Array.isArray(story)) {
    errors.push(`${record.file}: story must be a YAML object`);
    continue;
  }
  const filenameId = record.file.match(/^([A-Z]+-\d+)(?:-|\.)/)?.[1];

  if (!isNonEmptyString(story.id)) errors.push(`${record.file}: missing id`);
  if (story.id && filenameId !== story.id)
    errors.push(`${record.file}: filename ID does not match id ${story.id}`);
  if (story.id && storyById.has(story.id)) errors.push(`${record.file}: duplicate id ${story.id}`);
  if (story.id) storyById.set(story.id, record);
  if (!isNonEmptyString(story.title)) errors.push(`${record.file}: missing title`);
  if (!isNonEmptyString(story.description)) errors.push(`${record.file}: missing description`);
  if (!epicNames.has(story.epic)) errors.push(`${record.file}: unknown epic ${story.epic}`);
  if (!isNonEmptyString(story.role)) errors.push(`${record.file}: missing role`);
  if (!lifecycleValues.has(story.lifecycle))
    errors.push(`${record.file}: invalid or missing lifecycle`);
  if (!Number.isInteger(story.story_points) || story.story_points < 0)
    errors.push(`${record.file}: invalid or missing story_points`);

  if (!Array.isArray(story.dependencies)) {
    errors.push(`${record.file}: dependencies must be an array`);
  } else {
    const seenDependencies = new Set();
    for (const dependency of story.dependencies) {
      if (!/^[A-Z]+-\d+$/.test(dependency)) {
        errors.push(`${record.file}: invalid dependency ID ${dependency}`);
      } else {
        if (dependency === story.id) errors.push(`${record.file}: story cannot depend on itself`);
        if (seenDependencies.has(dependency))
          errors.push(`${record.file}: duplicate dependency ${dependency}`);
        seenDependencies.add(dependency);
        dependencyEntries.push({ file: record.file, dependency });
      }
    }
  }

  if (!Array.isArray(story.acceptance_criteria) || story.acceptance_criteria.length === 0) {
    errors.push(`${record.file}: missing acceptance_criteria`);
  } else {
    for (const [index, criterion] of story.acceptance_criteria.entries()) {
      if (![criterion?.given, criterion?.when, criterion?.then].every(isNonEmptyString))
        errors.push(`${record.file}: acceptance criterion ${index + 1} must use given/when/then`);
    }
  }

  if (!Array.isArray(story.sources) || story.sources.length === 0) {
    errors.push(`${record.file}: missing source references`);
  } else {
    for (const source of story.sources) {
      if (!isNonEmptyString(source?.file) || !isNonEmptyString(source?.locator)) {
        errors.push(`${record.file}: invalid source reference`);
        continue;
      }
      const sourcePath = resolve(dirname(record.path), source.file);
      const sourceRelativePath = relative(sourcesDir, sourcePath);
      if (sourceRelativePath.startsWith("..") || isAbsolute(sourceRelativePath)) {
        errors.push(`${record.file}: source must stay within docs/sources`);
        continue;
      }
      try {
        await access(sourcePath);
      } catch {
        errors.push(`${record.file}: missing source ${source.file}`);
      }
    }
  }

  if (!Array.isArray(story.journey) || story.journey.length === 0) {
    errors.push(`${record.file}: missing journey references`);
  } else if (
    story.journey.some(
      (entry) => !isNonEmptyString(entry?.route) || !isNonEmptyString(entry?.action)
    )
  ) {
    errors.push(`${record.file}: journey entries require route and action`);
  }

  const hasExecution = executionFields.some((field) => story[field] !== undefined);
  if (!hasExecution) continue;
  for (const field of executionFields) {
    if (story[field] === undefined) errors.push(`${record.file}: missing execution field ${field}`);
  }
  if (!/^sprint-\d+$/.test(story.sprint)) errors.push(`${record.file}: invalid sprint ID`);
  if (
    !Array.isArray(story.assignees) ||
    story.assignees.length !== 2 ||
    new Set(story.assignees).size !== 2 ||
    !story.assignees.every(isNonEmptyString)
  )
    errors.push(`${record.file}: story assignees must contain one two-person pair`);
  if (!sprintStatusValues.has(story.status)) errors.push(`${record.file}: invalid story status`);
  if (!Number.isInteger(story.order) || story.order < 1)
    errors.push(`${record.file}: invalid execution order`);
  if (!Number.isInteger(story.estimate_hours) || story.estimate_hours < 1)
    errors.push(`${record.file}: invalid estimate_hours`);
  if (!Array.isArray(story.tasks) || story.tasks.length === 0) {
    errors.push(`${record.file}: sprint stories require tasks`);
    continue;
  }

  let taskHours = 0;
  for (const [index, task] of story.tasks.entries()) {
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      errors.push(`${record.file}: task ${index + 1} must be a YAML object`);
      continue;
    }
    if (!isNonEmptyString(task.id)) errors.push(`${record.file}: task ${index + 1} missing id`);
    if (task.id && taskIds.has(task.id))
      errors.push(`${record.file}: duplicate task ID ${task.id}`);
    if (task.id) taskIds.add(task.id);
    if (task.id !== `${story.id}-T${index + 1}`)
      errors.push(`${record.file}: task ${index + 1} has unexpected ID ${task.id}`);
    if (!isNonEmptyString(task.title)) errors.push(`${record.file}: ${task.id} missing title`);
    if (!taskRoles.has(task.role)) errors.push(`${record.file}: ${task.id} has invalid role`);
    if (!sprintStatusValues.has(task.status))
      errors.push(`${record.file}: ${task.id} has invalid status`);
    if (!sameNames(task.assignees, story.assignees))
      errors.push(`${record.file}: ${task.id} assignees must match the story pair`);
    if (!Number.isInteger(task.estimate_hours) || task.estimate_hours < 1) {
      errors.push(`${record.file}: ${task.id} has invalid estimate_hours`);
    } else {
      taskHours += task.estimate_hours;
    }
  }
  if (taskHours !== story.estimate_hours)
    errors.push(
      `${record.file}: task estimates total ${taskHours}, expected ${story.estimate_hours}`
    );
}

for (const { file, dependency } of dependencyEntries) {
  if (!storyById.has(dependency)) errors.push(`${file}: unknown dependency ID ${dependency}`);
}

const visitedStories = new Set();
const visitingStories = new Set();
const dependencyCycles = new Set();
const visitStory = (storyId, path = []) => {
  if (visitingStories.has(storyId)) {
    const cycleStart = path.indexOf(storyId);
    dependencyCycles.add([...path.slice(cycleStart), storyId].join(" -> "));
    return;
  }
  if (visitedStories.has(storyId)) return;
  visitingStories.add(storyId);
  const story = storyById.get(storyId)?.data;
  for (const dependency of story?.dependencies ?? []) {
    if (storyById.has(dependency)) visitStory(dependency, [...path, storyId]);
  }
  visitingStories.delete(storyId);
  visitedStories.add(storyId);
};
for (const storyId of storyById.keys()) visitStory(storyId);
for (const cycle of dependencyCycles) errors.push(`dependency cycle: ${cycle}`);

for (const entry of config?.journey_coverage?.entries ?? []) {
  for (const storyId of entry.story_ids ?? []) {
    if (!storyById.has(storyId))
      errors.push(`backlog.yaml: unknown journey coverage story ${storyId}`);
  }
}

for (const record of sprints) {
  const sprint = record.data;
  if (!sprint || typeof sprint !== "object" || Array.isArray(sprint)) {
    errors.push(`${record.file}: sprint must be a YAML object`);
    continue;
  }
  const filenameId = record.file.replace(/\.yaml$/, "");
  const selectedIds = Array.isArray(sprint.story_ids) ? sprint.story_ids : [];
  const selectedSet = new Set(selectedIds);

  if (sprint.id !== filenameId) errors.push(`${record.file}: filename does not match id`);
  if (!new Set(["planned", "in_progress", "done"]).has(sprint.status))
    errors.push(`${record.file}: invalid or missing sprint status`);
  if (!isNonEmptyString(sprint.goal)) errors.push(`${record.file}: missing goal`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sprint.dates?.start ?? ""))
    errors.push(`${record.file}: invalid or missing start date`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sprint.dates?.end ?? ""))
    errors.push(`${record.file}: invalid or missing end date`);
  if (!Number.isInteger(sprint.capacity_hours) || sprint.capacity_hours < 1)
    errors.push(`${record.file}: invalid or missing capacity_hours`);
  if (!Array.isArray(sprint.story_ids) || selectedSet.size !== selectedIds.length)
    errors.push(`${record.file}: story_ids must be a unique list`);

  const selectedStories = [];
  for (const storyId of selectedIds) {
    const storyRecord = storyById.get(storyId);
    if (!storyRecord) {
      errors.push(`${record.file}: unknown story ${storyId}`);
      continue;
    }
    selectedStories.push(storyRecord.data);
    if (storyRecord.data.sprint !== sprint.id)
      errors.push(`${record.file}: ${storyId} does not reference ${sprint.id}`);
  }
  for (const { file, data: story } of stories) {
    if (story.sprint === sprint.id && !selectedSet.has(story.id))
      errors.push(`${file}: references ${sprint.id} but is missing from its story_ids`);
  }

  const orders = selectedStories.map((story) => story.order);
  if (new Set(orders).size !== orders.length) errors.push(`${record.file}: duplicate story order`);
  const estimatedHours = selectedStories.reduce(
    (total, story) => total + (story.estimate_hours ?? 0),
    0
  );
  if (estimatedHours !== sprint.capacity_hours)
    errors.push(
      `${record.file}: story estimates total ${estimatedHours}, expected ${sprint.capacity_hours}`
    );
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
  console.log(`Validated ${stories.length} product stories and ${sprints.length} sprint backlogs.`);
}
