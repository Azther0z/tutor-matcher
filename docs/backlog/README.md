# Git Backlog

This directory is the editable planning authority for the Tutor Matcher product
and sprint backlogs. The HTML exports and SVG journey under `../sources/` are
immutable historical evidence.

## Layout

```text
docs/backlog/
  backlog.yaml
  backlog.html  # generated; do not edit directly
  sprint-1.yaml
  product-backlog/
    EPIC-N-story-slug.yaml
scripts/templates/backlog.html
```

Each product story has one YAML file. The `EPIC-N` ID is stable; the slug is
kept stable even when the title changes. `backlog.yaml` owns the epic acronym
registry, format version, and source policy.

Open `backlog.html` for a self-contained visual dashboard of the product
backlog and Sprint 1. Edit the YAML planning records or
`../../scripts/templates/backlog.html`, then run `npm run backlog:build` to
regenerate the dashboard. CI rejects a committed dashboard that does not match
those sources.

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

Each sprint-selected story has one accountable two-person delivery pair in its
`assignees` field. That pair owns the complete story outcome, including design
integration, frontend and backend implementation, automated tests, review, and
CI verification. When inline tasks are present, their assignees match the story
pair; task roles describe activities rather than handoffs to other pairs.
`estimate_hours` values are shared pair-hours: count each estimate once for the
pair, not once per assignee. Balance Sprint capacity by reassigning whole stories
among the fixed pairs; do not split a story or change pair membership solely to
make the totals equal.

Stories may appear in sequential sprints, but not overlapping active sprints.
Completed and cancelled story files remain in place.

## Checks

Run `npm run backlog:build` after editing backlog YAML or the dashboard template.
Run `npm run format:check` and `npm run backlog:check` before committing. CI
checks formatting, parsed YAML structure, required fields, stable story and task
IDs, dependency IDs, duplicate IDs, filename/path agreement, source links,
allowed values, Sprint capacity, pair ownership, task estimate totals, required
immutable source files, and generated-dashboard freshness.
