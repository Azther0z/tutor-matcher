# Database ERD

Proposed data model for the full TutorMatcher app (1‑to‑1 instant‑paid tutoring,
subject‑specific availability, wallet ledger, review workflow, messaging, admin
moderation). This is a **design reference** — the live Prisma schema in
`apps/backend/prisma/schema.prisma` is authoritative for what is actually built.

| File                                     | What it is                                                                    | Open with                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`database-erd.html`](database-erd.html) | Self‑contained interactive diagram (pan / zoom, table index, enum reference). | Any browser — open the file directly                                    |
| [`database-erd.dbml`](database-erd.dbml) | Source of truth. DBML text.                                                   | [dbdiagram.io](https://dbdiagram.io), any editor                        |
| [`database-erd.puml`](database-erd.puml) | PlantUML source (crow's‑foot ER).                                             | VS Code PlantUML ext, [plantuml.com](https://www.plantuml.com/plantuml) |

## Regenerate the diagram

`database-erd.dbml` is edited by hand. `database-erd.puml` is the PlantUML view of
the same model; keep it in step when the DBML changes.

`database-erd.html` embeds a rendered SVG. To refresh it, render the PlantUML and
drop the SVG into the HTML's `<div id="stage">`:

```bash
# needs Java + Graphviz (brew install graphviz)
curl -sSL -o /tmp/plantuml.jar https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar
java -jar /tmp/plantuml.jar -tsvg docs/erd/database-erd.puml
```

Or paste `database-erd.puml` into <https://www.plantuml.com/plantuml> and export SVG.
