---
type: article
sources:
  - name: {Author, organization, or publication}
    date: {YYYY-MM-DD | null}
raw:
  - raw/{path}/{evidence}.md
updated: {YYYY-MM-DD}
statuses: []
---

# {Title}

## Overview

{One paragraph summarizing the key points of this article.}

## {Body Sections}

{Synthesize a coherent structure from the source material. Do not copy source text verbatim; distill and reorganize. Use blockquotes sparingly for particularly important original phrasing.}

{When a claim is outdated or disputed, keep the claim in the body and add a YAML status entry in frontmatter. The claim text must appear verbatim in the body:}

```yaml
statuses:
  - claim: {Verbatim claim text from the article body}
    status: outdated
    date: {YYYY-MM-DD}
    note: {What changed and the current understanding is, with source attribution.}
  - claim: {Verbatim claim text from the article body}
    status: disputed
    date: null
    note: {The competing claims, each with source attribution.}
```

{OPTIONAL — include this section only when cross-references exist:}

## See Also

{Cross-references to related wiki articles. Markdown links are relative to this file:
- Same topic: [Other Article](other-article.md)
- Different topic: [Other Article](../other-topic/other-article.md)}
