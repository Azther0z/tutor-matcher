# Git Backlog

This directory is the editable planning authority for the Tutor Matcher product
and sprint backlogs. The HTML exports and SVG journey under `../sources/` are
immutable historical evidence.

## Layout

```text
backlog.yaml
backlog.html
sprint-1.yaml
product-backlog/
  EPIC-N-story-slug.yaml
```

Each product story has one YAML file. The `EPIC-N` ID is stable; the slug is
kept stable even when the title changes. `backlog.yaml` owns the epic acronym
registry, format version, and source policy.

Open `backlog.html` for a self-contained visual dashboard of the product
backlog and Sprint 1.

## Product Stories

Story files contain the product story, epic, role, lifecycle, story points,
dependencies by stable product-story ID, structured Given/When/Then acceptance criteria, and inline
source/journey references. Lifecycle values are `backlog`, `todo`, `review`,
`done`, and `cancelled`.

Source references identify the source filename and visible epic/story label.
Journey references identify a route and action label, such as `/search` and
`Search & Browse Tutors`. The `journey_coverage` section in `backlog.yaml` is
the canonical route/action coverage index. Its entries classify meaningful
journey pairs as `story` or `non-story` and list the relevant stable story IDs.
SVG labels are evidence, not an instruction to create a story for every label.
Implementation and navigation details may therefore be explicitly `non-story`.
Independent uncovered capabilities are recorded as new product stories with
the journey SVG as their source. Reconciliation is additive and minimal:
retain existing stories and add only uncovered capabilities.

## Sprints

Each root `sprint-N.yaml` contains sprint-level metadata and a `story_ids` list
selecting the product stories committed to that sprint.
Product story files contain the complete story definition and, when selected for
a sprint, its execution fields and inline task breakdown. Sprint and task
statuses are `planned`, `in_progress`, `todo`, `blocked`, and `done` as
applicable. Estimates are original man-hours; story points remain on product
stories.

Stories may appear in sequential sprints, but not overlapping active sprints.
Completed and cancelled story files remain in place.

## Checks

Run `npm run format:check` and `npm run backlog:check`. CI checks formatting,
YAML structure, required fields, stable IDs, dependency IDs, duplicate IDs,
filename/path agreement, valid links, allowed values, and required immutable
source files.
