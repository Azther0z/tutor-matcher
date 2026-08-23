#!/usr/bin/env python3
"""Mechanical evidence check for a YAML-frontmatter LLM wiki.

Report-only; never modifies files. The checker verifies:

1. Fidelity — extract candidate literals from each checked wiki page and
   verify that each candidate appears in the page's evidence corpus. Candidate
   coverage intentionally includes YAML scalar values, plus the traditional
   high-signal body literals: specific numbers, ISO dates, and direct quotes.
2. Evidence errors — missing/invalid frontmatter, unresolvable evidence paths,
   raw links that escape raw/, archive sources that escape wiki/, empty
   evidence lists, and status claims that do not appear in article bodies.
3. Inventory — raw files that are not connected to the wiki, including raw
   .md evidence files no article references and non-md originals not covered by
   a referenced name.ext.md extraction.

Evidence corpus by page type:
- article: raw .md files listed in YAML `raw`, project-root-relative.
- archive: wiki pages listed in YAML `sources`, project-root-relative.
- index: all wiki .md files, including itself.
- log: all raw/wiki .md file contents plus project-root-relative raw/wiki paths,
  including itself.

The exit code carries no information; the report is the interface.

Usage: check_evidence.py [project-root] [page.md ...]
Defaults: project-root is the current directory; all wiki/**/*.md pages are
checked, including index.md and log.md. Paths may be absolute or relative to
the project root.
"""

import re
import sys
from dataclasses import dataclass
from pathlib import Path


NUMBER_TOKEN_RE = re.compile(
    r"(?:\d{1,3}(?:,\d{3})+(?:\.\d+)*(?:\s*[KMB%](?![A-Za-z]))?"
    r"|\d+(?:\.\d+)*(?:\s*[KMB%](?![A-Za-z]))?)(?![A-Za-z])"
)
SUFFIX_RE = re.compile(r"[KMB%]$")
DATE_RE = re.compile(r"\d{4}-\d{2}(?:-\d{2})?")
QUOTE_RES = [re.compile(r'"([^"\n]*)"'), re.compile(r"“([^”\n]*)”")]
LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]*)\)")
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
NO_MATERIAL_HEADING_RE = re.compile(
    r"^## \[[^\]]*\]\s*ingest\s*\|\s*no material:\s*(\S+)", re.IGNORECASE
)
EXTRACTION_FAILED_HEADING_RE = re.compile(
    r"^## \[[^\]]*\]\s*ingest\s*\|\s*extraction failed:\s*(\S+)", re.IGNORECASE
)
FENCE_OPEN_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
FENCE_CLOSE_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})[ \t]*$")
WS_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class Candidate:
    kind: str
    value: str


@dataclass(frozen=True)
class Page:
    path: Path
    yaml_lines: tuple[str, ...]
    body: str
    meta: dict[str, object]
    frontmatter_error: str | None = None


def normalize(text: str) -> str:
    return WS_RE.sub(" ", text).strip()


def fence_opener(line: str) -> tuple[str, int] | None:
    m = FENCE_OPEN_RE.match(line)
    if not m:
        return None
    marker, info = m.groups()
    if marker[0] == "`" and "`" in info:
        return None
    return marker[0], len(marker)


def is_fence_closer(line: str, char: str, length: int) -> bool:
    m = FENCE_CLOSE_RE.match(line)
    return bool(m and m.group(1)[0] == char and len(m.group(1)) >= length)


def strip_fences(text: str) -> str:
    out = []
    fence_char = None
    fence_len = 0
    for line in text.splitlines():
        if fence_char:
            if is_fence_closer(line, fence_char, fence_len):
                fence_char = None
            continue
        opener = fence_opener(line)
        if opener:
            fence_char, fence_len = opener
            continue
        out.append(line)
    return "\n".join(out)


def strip_noise(text: str) -> str:
    text = INLINE_CODE_RE.sub(" ", text)
    text = LINK_RE.sub(r"\1", text)
    return text


def keep_number(token: str) -> bool:
    token = token.strip()
    if SUFFIX_RE.search(token) or "," in token or "." in token:
        return True
    return len(token) >= 4


def scalar_value(value: str) -> str | None:
    value = value.strip().rstrip(",")
    if not value or value in {"[]", "{}", "|", ">"}:
        return None
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        value = value[1:-1]
    return value.strip() or None


def parse_scalar(raw: str) -> object:
    value = raw.strip()
    if value == "null":
        return None
    if value == "[]":
        return []
    parsed = scalar_value(value)
    return parsed if parsed is not None else value


def parse_frontmatter(text: str) -> tuple[list[str], str, str | None]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return [], text, "missing YAML frontmatter"
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return lines[1:i], "\n".join(lines[i + 1 :]), None
    return lines[1:], "", "unterminated YAML frontmatter"


def parse_frontmatter_fields(lines: list[str]) -> dict[str, object]:
    """Parse the small YAML subset used by the wiki templates.

    This is not a general YAML parser. It supports top-level scalars, lists of
    scalars, and lists of simple objects with scalar fields.
    """
    meta: dict[str, object] = {}
    current_key: str | None = None
    current_list: list[object] | None = None
    current_obj: dict[str, object] | None = None

    for raw_line in lines:
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        line = raw_line.strip()

        if indent == 0 and ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            current_key = key
            current_obj = None
            if value:
                meta[key] = parse_scalar(value)
                current_list = meta[key] if isinstance(meta[key], list) else None
            else:
                current_list = []
                meta[key] = current_list
            continue

        if current_key is None or current_list is None:
            continue

        if line.startswith("- "):
            item = line[2:].strip()
            if ":" in item and not item.startswith(('"', "'")):
                key, value = item.split(":", 1)
                current_obj = {key.strip(): parse_scalar(value)}
                current_list.append(current_obj)
            else:
                current_obj = None
                current_list.append(parse_scalar(item))
            continue

        if current_obj is not None and ":" in line:
            key, value = line.split(":", 1)
            current_obj[key.strip()] = parse_scalar(value)

    return meta


def read_page(path: Path) -> Page:
    text = path.read_text(encoding="utf-8")
    yaml_lines, body, error = parse_frontmatter(text)
    return Page(path, tuple(yaml_lines), body, parse_frontmatter_fields(yaml_lines), error)


def yaml_scalar_candidates(lines: tuple[str, ...]) -> list[Candidate]:
    candidates: list[Candidate] = []
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("- "):
            value = line[2:].strip()
            if ":" in value and not value.startswith(('"', "'")):
                _, value = value.split(":", 1)
            value = scalar_value(value)
        elif ":" in line:
            _, value = line.split(":", 1)
            value = scalar_value(value)
        else:
            value = None
        if value is not None:
            candidates.append(Candidate("literal", normalize(value)))
    return candidates


def extract_numeric_date_candidates(line: str) -> list[Candidate]:
    line = strip_noise(line)
    date_matches = list(DATE_RE.finditer(line))
    candidates = [Candidate("date", m.group(0)) for m in date_matches]
    number_text = list(line)
    for match in date_matches:
        number_text[match.start() : match.end()] = " " * (match.end() - match.start())
    candidates.extend(
        Candidate("number", m.group(0))
        for m in NUMBER_TOKEN_RE.finditer("".join(number_text))
        if keep_number(m.group(0))
    )
    return candidates


def extract_text_candidates(text: str) -> list[Candidate]:
    candidates: list[Candidate] = []
    blockquote: list[str] = []
    paragraph: list[str] = []

    def flush_blockquote():
        if blockquote:
            joined = normalize(" ".join(blockquote))
            if len(joined) >= 15:
                candidates.append(Candidate("quote", joined))
            blockquote.clear()

    def flush_paragraph():
        if paragraph:
            joined = normalize(" ".join(paragraph))
            for quote_re in QUOTE_RES:
                candidates.extend(
                    Candidate("quote", m.group(1))
                    for m in quote_re.finditer(joined)
                    if len(m.group(1).strip()) >= 15
                )
            paragraph.clear()

    for line in strip_fences(text).splitlines():
        stripped = line.strip()
        if stripped.startswith(">"):
            flush_paragraph()
            content = strip_noise(stripped.lstrip(">").strip())
            blockquote.append(content)
            candidates.extend(extract_numeric_date_candidates(content))
            continue
        flush_blockquote()
        if not stripped:
            flush_paragraph()
            continue
        line = strip_noise(line)
        candidates.extend(extract_numeric_date_candidates(line))
        paragraph.append(line)
    flush_blockquote()
    flush_paragraph()
    return candidates


def extract_candidates(page: Page) -> list[Candidate]:
    candidates = yaml_scalar_candidates(page.yaml_lines)
    candidates.extend(extract_text_candidates("\n".join(page.yaml_lines) + "\n" + page.body))
    seen = set()
    unique = []
    for candidate in candidates:
        value = normalize(candidate.value.strip().strip(".,;:()[]"))
        candidate = Candidate(candidate.kind, value)
        if value and candidate not in seen:
            seen.add(candidate)
            unique.append(candidate)
    return unique


def contains(haystack: str, candidate: Candidate) -> bool:
    if candidate.kind in {"quote", "literal"}:
        return candidate.value in haystack
    right = r"(?!-\d{2})" if candidate.kind == "date" and len(candidate.value) == 7 else ""
    pattern = (
        r"(?<![\d.,])" + re.escape(candidate.value) + right + r"(?![A-Za-z0-9]|[.,]\d|%)"
    )
    return re.search(pattern, haystack) is not None


def project_label(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def resolve_project_path(root: Path, raw_path: object) -> Path | None:
    if not isinstance(raw_path, str) or not raw_path.strip():
        return None
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate.resolve()
    return (root / candidate).resolve()


def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def content_of(path: Path) -> str:
    return normalize(path.read_text(encoding="utf-8"))


def all_wiki_pages(root: Path) -> list[Path]:
    wiki_dir = root / "wiki"
    if not wiki_dir.is_dir():
        return []
    return sorted(wiki_dir.rglob("*.md"))


def all_raw_markdown(root: Path) -> list[Path]:
    raw_dir = root / "raw"
    if not raw_dir.is_dir():
        return []
    return sorted(raw_dir.rglob("*.md"))


def all_raw_non_markdown(root: Path) -> list[Path]:
    raw_dir = root / "raw"
    if not raw_dir.is_dir():
        return []
    return sorted(path for path in raw_dir.rglob("*") if path.is_file() and path.suffix != ".md")


def evidence_for_page(page: Page, root: Path) -> tuple[list[str], list[str]]:
    errors = []
    page_type = page.meta.get("type")
    raw_root = (root / "raw").resolve()
    wiki_root = (root / "wiki").resolve()

    if page.frontmatter_error:
        errors.append(page.frontmatter_error)

    if page_type == "article":
        raw_paths = page.meta.get("raw")
        if not isinstance(raw_paths, list):
            return [], errors + ["article has no raw list"]
        if not raw_paths:
            return [], errors + ["article raw list is empty; no evidence"]
        evidence = []
        for item in raw_paths:
            target = resolve_project_path(root, item)
            if target is None:
                errors.append(f"invalid raw path: {item}")
            elif not is_relative_to(target, raw_root):
                errors.append(f"raw path escapes raw/: {item}")
            elif target.suffix != ".md":
                errors.append(f"raw path is not a .md evidence file: {item}")
            elif not target.is_file():
                errors.append(f"unresolvable raw path: {item}")
            else:
                evidence.append(content_of(target))
        return evidence, errors

    if page_type == "archive":
        sources = page.meta.get("sources")
        if not isinstance(sources, list):
            return [], errors + ["archive has no sources list"]
        if not sources:
            return [], errors + ["archive sources list is empty; no evidence"]
        evidence = []
        for item in sources:
            target = resolve_project_path(root, item)
            if target is None:
                errors.append(f"invalid archive source path: {item}")
            elif not is_relative_to(target, wiki_root):
                errors.append(f"archive source escapes wiki/: {item}")
            elif target.suffix != ".md":
                errors.append(f"archive source is not a .md wiki page: {item}")
            elif not target.is_file():
                errors.append(f"unresolvable archive source: {item}")
            else:
                evidence.append(content_of(target))
        return evidence, errors

    if page_type == "index":
        return [content_of(path) for path in all_wiki_pages(root)], errors

    if page_type == "log":
        evidence = []
        for path in all_raw_markdown(root) + all_wiki_pages(root):
            evidence.append(content_of(path))
            evidence.append(project_label(path, root))
        for path in all_raw_non_markdown(root):
            evidence.append(project_label(path, root))
        return evidence, errors

    return [], errors + [f"unknown or missing page type: {page_type}"]


def validate_statuses(page: Page) -> list[str]:
    if page.meta.get("type") != "article":
        return []
    errors = []
    statuses = page.meta.get("statuses")
    if not isinstance(statuses, list):
        return ["article has no statuses list"]
    for index, status in enumerate(statuses, 1):
        if not isinstance(status, dict):
            errors.append(f"status {index} is not an object")
            continue
        claim = status.get("claim")
        state = status.get("status")
        date = status.get("date")
        note = status.get("note")
        if not isinstance(claim, str) or not claim.strip():
            errors.append(f"status {index} has no claim")
        elif claim not in page.body:
            errors.append(f"status {index} claim does not appear verbatim in article body: {claim}")
        if state not in {"outdated", "disputed"}:
            errors.append(f"status {index} has invalid status: {state}")
        if state == "outdated" and not isinstance(date, str):
            errors.append(f"status {index} outdated entry must have a date")
        if state == "disputed" and date is not None:
            errors.append(f"status {index} disputed entry date must be null")
        if not isinstance(note, str) or not note.strip():
            errors.append(f"status {index} has no note")
    return errors


def check_page(page_path: Path, root: Path) -> tuple[list[str], list[str]]:
    page = read_page(page_path)
    evidence, errors = evidence_for_page(page, root)
    errors.extend(validate_statuses(page))
    misses = []
    if evidence:
        haystacks = [normalize(item) for item in evidence]
        for candidate in extract_candidates(page):
            if not any(contains(haystack, candidate) for haystack in haystacks):
                misses.append(candidate.value)
    return misses, errors


def strip_logged_path(path: str) -> str:
    return path.strip().strip("`,;.")


def logged_no_material_paths(log_file: Path) -> set[str]:
    if not log_file.is_file():
        return set()
    paths = set()
    text = strip_fences(log_file.read_text(encoding="utf-8"))
    for line in text.splitlines():
        m = NO_MATERIAL_HEADING_RE.match(line)
        if m:
            paths.add(strip_logged_path(m.group(1)))
    return paths


def logged_extraction_failed_paths(log_file: Path) -> set[str]:
    if not log_file.is_file():
        return set()
    paths = set()
    text = strip_fences(log_file.read_text(encoding="utf-8"))
    for line in text.splitlines():
        m = EXTRACTION_FAILED_HEADING_RE.match(line)
        if m:
            paths.add(strip_logged_path(m.group(1)))
    return paths


def referenced_raw_markdown(root: Path) -> set[Path]:
    referenced = set()
    raw_root = (root / "raw").resolve()
    for page_path in all_wiki_pages(root):
        page = read_page(page_path)
        if page.meta.get("type") != "article":
            continue
        raw_paths = page.meta.get("raw")
        if not isinstance(raw_paths, list):
            continue
        for item in raw_paths:
            target = resolve_project_path(root, item)
            if target and is_relative_to(target, raw_root) and target.suffix == ".md":
                referenced.add(target.resolve())
    return referenced


def raw_extraction_errors(root: Path) -> list[str]:
    errors = []
    raw_dir = root / "raw"
    if not raw_dir.is_dir():
        return errors
    for md_path in all_raw_markdown(root):
        page = read_page(md_path)
        if page.frontmatter_error:
            errors.append(f"{project_label(md_path, root)}: {page.frontmatter_error}")
            continue
        if page.meta.get("type") != "raw":
            errors.append(f"{project_label(md_path, root)}: raw markdown has type {page.meta.get('type')}, expected raw")
        for field in ("source", "collected", "published"):
            if field not in page.meta:
                errors.append(f"{project_label(md_path, root)}: missing raw metadata field: {field}")

        source = page.meta.get("source")
        if isinstance(source, str) and source and not re.match(r"^[a-z][a-z0-9+.-]*://", source):
            if "/" in source or source in {".", ".."}:
                errors.append(f"{project_label(md_path, root)}: source must be a basename: {source}")
                continue
            expected_name = md_path.name[:-3]
            if source != expected_name:
                errors.append(
                    f"{project_label(md_path, root)}: source {source} does not match extraction name {expected_name}"
                )
            original = md_path.with_name(source)
            if not original.is_file():
                errors.append(f"{project_label(md_path, root)}: source original not found: {source}")
            elif original.suffix == ".md":
                errors.append(f"{project_label(md_path, root)}: source original must be non-md: {source}")
    return errors


def raw_inventory(root: Path) -> list[str]:
    raw_dir = root / "raw"
    if not raw_dir.is_dir():
        return []
    referenced = referenced_raw_markdown(root)
    no_material = logged_no_material_paths(root / "wiki" / "log.md")
    extraction_failed = logged_extraction_failed_paths(root / "wiki" / "log.md")
    missing = []

    for md_path in all_raw_markdown(root):
        rel = project_label(md_path, root)
        if md_path.resolve() not in referenced and rel not in no_material and rel not in extraction_failed:
            missing.append(f"unreferenced raw md: {rel}")

    for original in all_raw_non_markdown(root):
        rel = project_label(original, root)
        extraction = original.with_name(original.name + ".md")
        if rel in extraction_failed:
            continue
        if not extraction.is_file():
            missing.append(f"unpaired original: {rel} (missing {project_label(extraction, root)})")
        elif extraction.resolve() not in referenced:
            missing.append(f"unreferenced original: {rel} (covered by {project_label(extraction, root)})")
    return missing


def pages_from_args(root: Path, argv: list[str]) -> list[Path]:
    wiki_dir = root / "wiki"
    if len(argv) <= 2:
        return all_wiki_pages(root)
    pages = []
    for arg in argv[2:]:
        path = Path(arg)
        if not path.is_absolute():
            path = root / path
        if not path.is_file():
            print(f"warning: page not found: {arg}", file=sys.stderr)
            continue
        try:
            path.resolve().relative_to(wiki_dir.resolve())
        except ValueError:
            print(f"warning: page is not under wiki/: {arg}", file=sys.stderr)
        pages.append(path)
    return pages


def main(argv: list[str]) -> int:
    root = Path(argv[1]).resolve() if len(argv) > 1 else Path.cwd().resolve()
    wiki_dir = root / "wiki"
    if not wiki_dir.is_dir():
        print(f"no wiki/ directory under {root}")
        return 1

    pages = pages_from_args(root, argv)
    results = {page: check_page(page, root) for page in pages}

    print("# Evidence check\n")
    print("## Fidelity suspects")
    suspect_count = 0
    for page, (misses, _) in results.items():
        if misses:
            print(f"\n{project_label(page, root)}")
            for miss in misses:
                print(f"- {miss}")
                suspect_count += 1
    if suspect_count == 0:
        print("\n(none)")

    print("\n## Evidence errors")
    error_count = 0
    global_errors = raw_extraction_errors(root)
    for page, (_, errors) in results.items():
        if errors:
            print(f"\n{project_label(page, root)}")
            for error in errors:
                print(f"- {error}")
                error_count += 1
    if global_errors:
        print("\nraw/")
        for error in global_errors:
            print(f"- {error}")
            error_count += 1
    if error_count == 0:
        print("(none)")

    print("\n## Unreferenced raw files")
    orphans = raw_inventory(root)
    for path in orphans:
        print(f"- {path}")
    if not orphans:
        print("(none)")

    print(
        f"\n## Summary\n{suspect_count} fidelity suspect(s), "
        f"{error_count} evidence error(s), {len(orphans)} unreferenced raw file(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
