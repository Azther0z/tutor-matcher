import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const backlog = join(root, 'docs', 'backlog');
const storiesDir = join(backlog, 'product-backlog');
const errors = [];
const storyFiles = (await readdir(storiesDir)).filter((file) => file.endsWith('.yaml')).sort();
const storyIds = new Set();

for (const file of storyFiles) {
  const content = await readFile(join(storiesDir, file), 'utf8');
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
  if (!/^acceptance_criteria:\n/m.test(content))
    errors.push(`${file}: missing acceptance_criteria`);
  if (!/^\s+- given:\s*.+\n\s+when:\s*.+\n\s+then:\s*.+/m.test(content))
    errors.push(`${file}: acceptance criteria must use given/when/then`);
  if (
    !content.includes('file: ../../sources/Product Backlog v1.2.html') &&
    !content.includes('file: ../../sources/Untitled-2026-08-28-2348.svg')
  )
    errors.push(`${file}: missing product or journey source reference`);
  if (!content.includes('route: ') || !content.includes('action: '))
    errors.push(`${file}: missing journey route/action reference`);
}

const backlogContent = await readFile(join(backlog, 'backlog.yaml'), 'utf8');
for (const match of backlogContent.matchAll(/^\s+story_ids:\s*\[([^\]]*)\]$/gm)) {
  for (const id of match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (!storyIds.has(id)) errors.push(`backlog.yaml: unknown journey coverage story ${id}`);
  }
}

const sprintDirs = (await readdir(backlog, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^sprint-\d+-backlog$/.test(entry.name))
  .map((entry) => entry.name);
for (const directory of sprintDirs) {
  const manifest = `${directory}/manifest.yaml`;
  const manifestContent = await readFile(join(backlog, manifest), 'utf8');
  if (!/^status:\s*(planned|in_progress|done)$/m.test(manifestContent))
    errors.push(`${manifest}: invalid or missing sprint status`);
  const referencedFiles = new Set();
  for (const match of manifestContent.matchAll(/^\s+- id: (\S+)\n\s+path: (\S+)$/gm)) {
    const [, id, path] = match;
    referencedFiles.add(path);
    if (!storyIds.has(id)) errors.push(`${manifest}: unknown story ${id}`);
    if (!path.endsWith('.yaml')) errors.push(`${manifest}: invalid story path ${path}`);
  }
  const sprintStories = (await readdir(join(backlog, directory))).filter(
    (file) => file.endsWith('.yaml') && file !== 'manifest.yaml'
  );
  for (const file of sprintStories) {
    const content = await readFile(join(backlog, directory, file), 'utf8');
    const id = content.match(/^id:\s*(\S+)$/m)?.[1];
    const productPath = content.match(/^path:\s*(\S+)$/m)?.[1];
    if (!referencedFiles.has(file)) errors.push(`${manifest}: unlisted story file ${file}`);
    if (!storyIds.has(id)) errors.push(`${directory}/${file}: unknown story ${id}`);
    if (!productPath || !productPath.startsWith('product-backlog/'))
      errors.push(`${directory}/${file}: invalid story path ${productPath ?? ''}`);
    if (productPath && !storyFiles.includes(productPath.slice('product-backlog/'.length)))
      errors.push(`${directory}/${file}: missing product story ${productPath}`);
    for (const match of content.matchAll(/^\s*status:\s*(\S+)/gm)) {
      if (!['planned', 'todo', 'in_progress', 'done', 'blocked'].includes(match[1]))
        errors.push(`${directory}/${file}: invalid story/task status ${match[1]}`);
    }
  }
}

for (const source of [
  'Product Backlog v1.2.html',
  'Sprint 1 v1.1.html',
  'Untitled-2026-08-28-2348.svg',
]) {
  try {
    await access(join(root, 'docs', 'sources', source));
  } catch {
    errors.push(`missing immutable source docs/sources/${source}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${storyFiles.length} product stories and ${sprintDirs.length} sprint backlogs.`
  );
}
