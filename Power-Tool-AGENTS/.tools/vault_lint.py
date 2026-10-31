#!/usr/bin/env python3
"""vault_lint.py: check and repair a folder of markdown so it reads as a linked
graph in Obsidian and still works on GitHub and in VS Code. Standard library only,
Python 3.9 or newer, Windows, macOS and Linux.

  python vault_lint.py <root> [--json] [--exclude NAME ...] [--max N]
  python vault_lint.py <root> --fix-index          # write INDEX.md in folders that have none, link it from the nearest index above
  python vault_lint.py <root> --to-markdown-links  # rewrite [[wikilinks]] that resolve to one file as relative markdown links
  python vault_lint.py <root> --vault-init [--ignore FOLDER ...]   # .obsidian/app.json (markdown links, relative paths) + .gitignore lines
  python vault_lint.py --probe                     # is the `obsidian` CLI on PATH (or its Windows shim beside the app), which vaults exist

Errors (exit code 1): broken markdown links (missing target, a space in the target,
or a target whose case differs from the file on disk, which is a 404 on GitHub and
Linux), broken or ambiguous wikilinks, frontmatter that is opened but never closed,
tab-indented, or has a line without a key (a quick check, not a YAML parser).
Warnings: orphans (no inbound link), folders without an index, duplicate basenames,
links that leave the root, wikilink count (they do not render on GitHub).

An index is README.md, INDEX.md, _index.md, MOC.md or SKILL.md (any case), or a file
named after its folder. Links from index files are what cover a folder: a folder whose
every file is linked from some index anywhere in the tree is not reported. Only an
index at the root is exempt from the orphan check. The walk skips hidden folders and
common build folders (node_modules, __pycache__, venv, Library, Temp, obj, Logs,
Builds, bin, dist, build); --exclude adds folder names, matched at any depth.
Reference-style links count; links inside code fences (any length, also inside
blockquotes), inline code, HTML comments and frontmatter are ignored, except that
wikilinks in frontmatter count as links (Obsidian treats them as properties).
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, unquote

SKIP_DIRS = {".git", ".obsidian", ".trash", "node_modules", "__pycache__", ".venv", "venv",
             "Library", "Temp", "obj", "Logs", "Builds", "bin", "dist", "build", ".idea", ".vs"}
INDEX_NAMES = ("readme.md", "index.md", "_index.md", "moc.md", "skill.md")
FENCE_OPEN_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
FENCE_CLOSE_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})\s*$")
BLOCKQUOTE_RE = re.compile(r"^\s{0,3}(?:>\s?)+")
HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
MD_LINK_RE = re.compile(r"(?<!\!)\[((?:[^\]\\]|\\.)*)\]\((?:<([^>]*)>|([^)\s]+))(?:\s+\"[^\"]*\")?\)")
MD_EMBED_RE = re.compile(r"\!\[((?:[^\]\\]|\\.)*)\]\((?:<([^>]*)>|([^)\s]+))(?:\s+\"[^\"]*\")?\)")
SPACE_LINK_RE = re.compile(r"(?<!\!)\[(?:[^\]\\]|\\.)*\]\(([^)<>\s\"']*\s[^)\"']*)\)")
REF_DEF_RE = re.compile(r"^\s{0,3}\[([^\]]+)\]:\s*(\S+)", re.M)
WIKI_RE = re.compile(r"(\!?)\[\[([^\]\|#]*?)(#[^\]\|]*)?(\\?\|[^\]]*)?\]\]")
EXTERNAL = ("http://", "https://", "mailto:", "obsidian://", "file://", "ftp://", "tel:")


# ---------- text helpers ----------

def read(p):
    """Return (text, had_bom). Newlines are kept as they are on disk so a rewrite does not change them."""
    raw = p.read_bytes()
    bom = raw.startswith(b"\xef\xbb\xbf")
    if bom:
        raw = raw[3:]
    return raw.decode("utf-8", errors="replace"), bom


def write(p, text, bom=False):
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="") as fh:
        if bom:
            fh.write("\ufeff")
        fh.write(text)


def newline_of(text):
    return "\r\n" if "\r\n" in text else "\n"


def posix(p):
    return str(p).replace("\\", "/")


def frontmatter_end(text):
    """Offset just after the closing --- line; 0 when there is no frontmatter; -1 when it is never closed."""
    if not text.startswith("---"):
        return 0
    lines = text.splitlines(keepends=True)
    if lines[0].strip() != "---":
        return 0
    for i in range(1, min(len(lines), 200)):
        if lines[i].strip() == "---":
            return sum(len(l) for l in lines[: i + 1])
    return -1


def check_frontmatter(text):
    end = frontmatter_end(text)
    if end == 0:
        return None
    if end < 0:
        return "frontmatter opened with --- but never closed"
    for ln in text[:end].splitlines()[1:-1]:
        if ln.strip() == "" or ln.startswith("#") or ln.startswith(" ") or ln.startswith("- "):
            continue
        if "\t" in ln[: len(ln) - len(ln.lstrip())]:
            return "tab indentation in frontmatter"
        if ":" not in ln:
            return f"line without key: {ln.strip()[:40]}"
    return None


def split_prose(text):
    """List of (chunk, is_prose). Frontmatter, HTML comments, fenced code (any fence length,
    also inside blockquotes) and inline code are not prose."""
    chunks = []
    end = frontmatter_end(text)
    if end > 0:
        chunks.append((text[:end], False))
        text = text[end:]
    pieces, pos = [], 0
    for m in HTML_COMMENT_RE.finditer(text):
        pieces.append((text[pos:m.start()], True))
        pieces.append((m.group(0), False))
        pos = m.end()
    pieces.append((text[pos:], True))
    fence = None
    for piece, prose in pieces:
        if not prose:
            chunks.append((piece, False))
            continue
        for line in piece.splitlines(keepends=True):
            core = BLOCKQUOTE_RE.sub("", line, count=1)
            if fence is None:
                m = FENCE_OPEN_RE.match(core)
                if m:
                    fence = m.group(1)
                    chunks.append((line, False))
                    continue
                for seg in re.split(r"(`[^`\n]*`)", line):
                    if seg:
                        chunks.append((seg, not seg.startswith("`")))
            else:
                m = FENCE_CLOSE_RE.match(core)
                if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                    fence = None
                chunks.append((line, False))
    return chunks


def prose_only(text):
    return "".join(c for c, prose in split_prose(text) if prose)


def title_of(path, text):
    end = max(frontmatter_end(text), 0)
    m = re.search(r"^#\s+(.+?)\s*$", text[end:], re.M)
    title = m.group(1).strip() if m else path.stem.replace("-", " ").replace("_", " ")
    return title.replace("[", "\\[").replace("]", "\\]")


def link_target(m):
    """Target of an MD_LINK_RE / MD_EMBED_RE match: the <...> form or the plain form."""
    return m.group(2) if m.group(2) is not None else m.group(3)


def resolve_typed(base, typed):
    """Resolve a typed relative path against the disk one component at a time.
    Returns (exact_case, path): path is None when nothing matches even case-insensitively;
    exact_case is False when it only matches with a different case (Windows and macOS resolve
    that, GitHub and Linux do not). A last component without .md may match name.md."""
    cur = Path(base)
    exact = True
    parts = [x for x in typed.replace("\\", "/").split("/") if x not in ("", ".")]
    for i, part in enumerate(parts):
        if part == "..":
            cur = cur.parent
            continue
        try:
            names = {e.name for e in os.scandir(cur)}
        except OSError:
            return exact, None
        last = i == len(parts) - 1
        if part in names:
            cur = cur / part
            continue
        if last and part + ".md" in names:
            cur = cur / (part + ".md")
            continue
        lower = {n.lower(): n for n in names}
        hit = lower.get(part.lower()) or (lower.get(part.lower() + ".md") if last else None)
        if hit is None:
            return exact, None
        exact = False
        cur = cur / hit
    return exact, cur


def index_in(folder):
    """The index file of a folder, if any (README.md first)."""
    try:
        names = {e.name.lower(): e.name for e in os.scandir(folder)}
    except OSError:
        return None
    for n in INDEX_NAMES:
        if n in names:
            return folder / names[n]
    own = folder.name.lower() + ".md"
    if own in names:
        return folder / names[own]
    return None


def resolve_wikilink(name, embed, by_base, by_name_any):
    """Candidate files for a wikilink name, the way Obsidian resolves it: by basename,
    narrowed by a folder path when one is given. Attachments (non-.md extension) and embeds
    look at every file; plain links look at markdown files."""
    n = name.strip().rstrip("\\")
    if not n:
        return []
    base = n.rsplit("/", 1)[-1]
    low = base.lower()
    stem = low[:-3] if low.endswith(".md") else low
    ext = low.rsplit(".", 1)[1] if "." in low else ""
    attachment = bool(ext) and ext != "md" and len(ext) <= 5 and ext.isalnum()
    if embed or attachment:
        matches = by_name_any.get(low, []) or by_name_any.get(stem, [])
    else:
        matches = by_base.get(stem, [])
    if "/" in n:
        path = n.lower()
        path = path[:-3] if path.endswith(".md") else path
        exact = [c for c in matches if posix(c).lower().endswith("/" + path + ".md") or posix(c).lower().endswith("/" + path)]
        matches = exact or matches
    return matches


# ---------- walking ----------

def md_files(root, excludes):
    skip = SKIP_DIRS | set(excludes)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in skip and not d.startswith("."))
        for f in sorted(filenames):
            if f.lower().endswith(".md"):
                yield Path(dirpath) / f


def all_files(root, excludes):
    skip = SKIP_DIRS | set(excludes)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip and not d.startswith(".")]
        for f in filenames:
            yield Path(dirpath) / f


def rel(p, root):
    """Path relative to the root as walked (so a junction inside the root stays a vault-relative path)."""
    p = Path(p)
    for cand in (p, p.resolve()):
        try:
            return posix(cand.relative_to(root))
        except ValueError:
            pass
    return posix(p)


def under(path, root):
    try:
        Path(path).resolve().relative_to(root)
        return True
    except ValueError:
        return False


# ---------- scan ----------

def scan(root, excludes):
    root = Path(root).resolve()
    files = list(md_files(root, excludes))
    by_base, by_name_any = {}, {}
    for p in files:
        by_base.setdefault(p.stem.lower(), []).append(p)
    for p in all_files(root, excludes):
        by_name_any.setdefault(p.name.lower(), []).append(p)
        by_name_any.setdefault(p.stem.lower(), []).append(p)
    inbound = {p.resolve(): [0, p] for p in files}
    from_index = set()
    f = {"broken_md_links": [], "broken_wikilinks": [], "ambiguous_wikilinks": [], "frontmatter_errors": [],
         "duplicate_basenames": [], "orphans": [], "folders_without_index": [], "links_outside_root": [],
         "wikilinks": 0, "md_links": 0, "files": len(files)}
    texts, boms = {}, {}

    def credit(cand, src):
        key = cand.resolve()
        if key in inbound:
            inbound[key][0] += 1
            if src.name.lower() in INDEX_NAMES:
                from_index.add(key)

    def check_md_target(p, target, raw):
        if target.startswith(EXTERNAL) or target.startswith("#"):
            return
        f["md_links"] += 1
        t = unquote(target.split("#", 1)[0].split("?", 1)[0])
        if not t:
            return
        exact, cand = resolve_typed(p.parent, t)
        if cand is None:
            f["broken_md_links"].append({"file": rel(p, root), "target": raw})
            return
        if not exact:
            f["broken_md_links"].append({"file": rel(p, root), "target": raw + " (case differs from the file on disk)"})
            return
        if cand.is_dir():
            idx = index_in(cand)
            cand = idx if idx else cand
        if not under(cand, root):
            f["links_outside_root"].append({"file": rel(p, root), "target": raw})
            return
        credit(cand, p)

    def check_wikilink(p, m):
        f["wikilinks"] += 1
        name = m.group(2).strip().rstrip("\\")
        if not name:
            return  # same-file heading link
        matches = resolve_wikilink(name, bool(m.group(1)), by_base, by_name_any)
        if not matches:
            f["broken_wikilinks"].append({"file": rel(p, root), "target": name})
        elif len(matches) > 1:
            f["ambiguous_wikilinks"].append({"file": rel(p, root), "target": name, "candidates": [rel(c, root) for c in matches]})
        else:
            credit(matches[0], p)

    for p in files:
        text, bom = read(p)
        texts[p], boms[p] = text, bom
        err = check_frontmatter(text)
        if err:
            f["frontmatter_errors"].append({"file": rel(p, root), "error": err})
        end = max(frontmatter_end(text), 0)
        prose = prose_only(text)
        for m in list(MD_LINK_RE.finditer(prose)) + list(MD_EMBED_RE.finditer(prose)):
            check_md_target(p, link_target(m), link_target(m))
        for m in REF_DEF_RE.finditer(prose):
            check_md_target(p, m.group(2), m.group(2))
        for m in SPACE_LINK_RE.finditer(prose):
            f["md_links"] += 1
            f["broken_md_links"].append({"file": rel(p, root), "target": m.group(1) + " (space in link target: use %20 or <...>)"})
        for m in WIKI_RE.finditer(prose):
            check_wikilink(p, m)
        for m in WIKI_RE.finditer(text[:end]):
            check_wikilink(p, m)

    for stem, ps in sorted(by_base.items()):
        if len(ps) > 1 and stem + ".md" not in INDEX_NAMES:
            f["duplicate_basenames"].append({"basename": ps[0].name, "files": [rel(x, root) for x in ps]})
    for key, (n, p) in inbound.items():
        if n == 0 and not (p.name.lower() in INDEX_NAMES and p.parent.resolve() == root):
            f["orphans"].append(rel(p, root))
    folders = {}
    for p in files:
        folders.setdefault(p.parent, []).append(p)
    for folder, ps in sorted(folders.items()):
        covered = all(x.resolve() in from_index for x in ps)
        if index_in(folder) is None and not covered:
            f["folders_without_index"].append(rel(folder, root) or ".")
    f["_root"], f["_texts"], f["_boms"], f["_files"], f["_folders"] = root, texts, boms, files, folders
    f["_by_base"], f["_by_name_any"] = by_base, by_name_any
    return f


# ---------- report ----------

def error_count(f):
    return len(f["broken_md_links"]) + len(f["broken_wikilinks"]) + len(f["ambiguous_wikilinks"]) + len(f["frontmatter_errors"])


def report(f, max_items):
    errs = error_count(f)
    print(f"vault-lint {f['_root']}: {f['files']} markdown files, {f['md_links']} markdown links, {f['wikilinks']} wikilinks")
    print(f"  errors {errs}: broken md links {len(f['broken_md_links'])}, broken wikilinks {len(f['broken_wikilinks'])}, "
          f"ambiguous wikilinks {len(f['ambiguous_wikilinks'])}, frontmatter {len(f['frontmatter_errors'])}")
    print(f"  warnings: orphans {len(f['orphans'])}, folders without index {len(f['folders_without_index'])}, "
          f"duplicate basenames {len(f['duplicate_basenames'])}, links outside root {len(f['links_outside_root'])}")

    def show(label, items, fmt):
        if not items:
            return
        print(f"  {label}:")
        for it in items[:max_items]:
            print("    " + fmt(it))
        if len(items) > max_items:
            print(f"    ... {len(items) - max_items} more (use --json or --max)")

    show("broken markdown links", f["broken_md_links"], lambda i: f"{i['file']} -> {i['target']}")
    show("broken wikilinks", f["broken_wikilinks"], lambda i: f"{i['file']} -> [[{i['target']}]]")
    show("ambiguous wikilinks", f["ambiguous_wikilinks"], lambda i: f"{i['file']} -> [[{i['target']}]] matches {', '.join(i['candidates'])}")
    show("frontmatter", f["frontmatter_errors"], lambda i: f"{i['file']}: {i['error']}")
    show("duplicate basenames", f["duplicate_basenames"], lambda i: f"{i['basename']}: {', '.join(i['files'])}")
    show("folders without an index", f["folders_without_index"], lambda i: i)
    show("orphans (no inbound link)", f["orphans"], lambda i: i)
    show("links outside the root (Obsidian cannot follow them from a vault)", f["links_outside_root"], lambda i: f"{i['file']} -> {i['target']}")
    if f["wikilinks"]:
        print("  note: wikilinks do not render on GitHub or in VS Code; --to-markdown-links converts them")
    return errs


# ---------- fixes ----------

def fix_index(f):
    root = f["_root"]
    pending = {(root / r if r != "." else root) for r in f["folders_without_index"]}
    written = []
    md_folders = set(f["_folders"])

    def index_below(d):
        """Relative path of the index a folder will have after this run, or the nearest one below it."""
        for cand in sorted((x for x in md_folders if x == d or d in x.parents), key=lambda x: len(x.parts)):
            if cand in pending:
                return posix((cand / "INDEX.md").relative_to(d))
            idx = index_in(cand)
            if idx is not None:
                return posix(idx.relative_to(d))
        return None

    for folder in sorted(pending, key=lambda d: len(d.parts)):
        entries = sorted(p for p in f["_files"] if p.parent == folder)
        children = set()
        for d in md_folders:
            if d != folder and folder in d.parents:
                c = d
                while c.parent != folder:
                    c = c.parent
                children.add(c)
        lines = [f"# {folder.name or root.name}", "",
                 "Index of this folder. Each document links back here; add a line when you add a file.", ""]
        for p in entries:
            lines.append(f"- [{title_of(p, f['_texts'][p])}]({quote(p.name)})")
        for c in sorted(children):
            below = index_below(c)
            target = f"{c.name}/{below}" if below else f"{c.name}/"
            lines.append(f"- [{c.name}/]({quote(target)})")
        out = folder / "INDEX.md"
        write(out, "\n".join(lines) + "\n")
        written.append(rel(out, root))
        if folder == root:
            continue
        # Link the new index from the nearest index above, unless that ancestor is also being written now
        # (its listing already links this folder) or it is a generated everlast index (rebuilt from frontmatter).
        anc = folder.parent
        while True:
            if anc in pending:
                break
            idx = index_in(anc)
            if idx is not None:
                txt, bom = read(idx)
                if "everlast.py index" in txt:
                    break
                have = {unquote(link_target(m)).rstrip("/") for m in MD_LINK_RE.finditer(prose_only(txt))}
                frel = posix(folder.relative_to(anc))
                target = frel + "/INDEX.md"
                if target not in have and frel not in have:
                    nl = newline_of(txt)
                    write(idx, txt.rstrip("\r\n") + f"{nl}- [{frel}/]({quote(target)}){nl}", bom)
                    written.append(rel(idx, root) + " (one line)")
                break
            if anc == root or anc.parent == anc:
                break
            anc = anc.parent
    return written


def to_markdown_links(f):
    root = f["_root"]
    rewritten = []
    for p in f["_files"]:
        text = f["_texts"][p]

        def sub(m):
            embed, name, anchor, alias = m.group(1), m.group(2).strip().rstrip("\\"), m.group(3) or "", m.group(4)
            label = alias.lstrip("\\")[1:] if alias else (name or anchor.lstrip("#"))
            enc_anchor = "#" + quote(anchor[1:], safe="^/") if anchor else ""
            if embed:
                return m.group(0)
            if not name:
                return f"[{label}]({enc_anchor})"
            matches = resolve_wikilink(name, False, f["_by_base"], f["_by_name_any"])
            if len(matches) != 1:
                return m.group(0)
            target = posix(os.path.relpath(matches[0], p.parent))
            return f"[{label}]({quote(target)}{enc_anchor})"

        new = "".join(WIKI_RE.sub(sub, c) if prose else c for c, prose in split_prose(text))
        if new != text:
            write(p, new, f["_boms"][p])
            rewritten.append(rel(p, root))
    return rewritten


def vault_init(root, ignore):
    root = Path(root).resolve()
    ob = root / ".obsidian"
    ob.mkdir(exist_ok=True)
    app = ob / "app.json"
    cfg = json.loads(read(app)[0]) if app.exists() else {}
    cfg["useMarkdownLinks"] = True
    cfg["newLinkFormat"] = "relative"
    cfg["alwaysUpdateLinks"] = True
    cfg["showUnsupportedFiles"] = False
    filters = list(cfg.get("userIgnoreFilters", []))
    for d in sorted(SKIP_DIRS - {".git", ".obsidian", ".trash"}):
        if (root / d).is_dir() and d + "/" not in filters:
            filters.append(d + "/")
    for d in ignore:
        d = d.strip("/\\") + "/"
        if d not in filters:
            filters.append(d)
    cfg["userIgnoreFilters"] = filters
    write(app, json.dumps(cfg, indent=2) + "\n")
    gi = root / ".gitignore"
    lines = [".obsidian/workspace.json", ".obsidian/workspace-mobile.json", ".obsidian/cache", ".obsidian/plugins/*/data.json"]
    header = "# Obsidian: per-machine state stays local; app.json travels"
    if gi.exists():
        existing, bom = read(gi)
        have = {ln.strip() for ln in existing.splitlines()}
        add = [l for l in lines if l not in have]
        if add:
            nl = newline_of(existing)
            write(gi, existing.rstrip("\r\n") + nl + nl + header + nl + nl.join(add) + nl, bom)
    else:
        add = lines
        write(gi, header + "\n" + "\n".join(lines) + "\n")
    print(f"vault config written: {app} (markdown links, relative paths, ignored: {', '.join(filters) or 'none'})")
    print(f".gitignore: {'added ' + ', '.join(add) if add else 'already covered'}")
    print("open it: Obsidian > Open folder as vault > " + str(root))


def probe():
    exe = shutil.which("obsidian") or shutil.which("obsidian.com")
    cands = [Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Obsidian" / "Obsidian.exe",
             Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Obsidian" / "Obsidian.exe",
             Path("/Applications/Obsidian.app"), Path.home() / ".local" / "bin" / "obsidian"]
    if os.name == "nt":
        cands += [Path(f"{d}:/Program Files/Obsidian/Obsidian.exe") for d in "DEFG" if Path(f"{d}:/").exists()]
    installed = next((str(c) for c in cands if c.exists()), None)
    # On Windows the toggle drops Obsidian.com beside Obsidian.exe and adds that folder to the user PATH;
    # a shell opened before the toggle does not see it, so report the shim's full path as well.
    shim = None
    if installed and os.name == "nt":
        cand = Path(installed).parent / "Obsidian.com"
        shim = str(cand) if cand.exists() else None
    run_as = exe or shim
    ver, vaults = None, None
    if run_as:
        try:
            ver = subprocess.run([run_as, "version"], capture_output=True, text=True, timeout=20).stdout.strip()
            vaults = [v for v in subprocess.run([run_as, "vaults"], capture_output=True, text=True, timeout=20).stdout.splitlines() if v.strip()]
        except Exception as e:  # noqa: BLE001
            ver = f"error: {e}"
    print(json.dumps({"cli_on_path": exe, "cli_shim": shim, "cli_version": ver, "vaults": vaults, "app_found": installed,
                      "enable": "Obsidian > Settings > General > Command line interface (needs the 1.12.7+ installer; restart the terminal afterwards, or call cli_shim by full path)"}, indent=2))


# ---------- main ----------

def main():
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            try:
                s.reconfigure(errors="backslashreplace")
            except Exception:  # noqa: BLE001
                pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root", nargs="?", help="folder to check (a vault, a docs folder, a repo)")
    ap.add_argument("--json", action="store_true", help="machine-readable report on stdout (fix messages go to stderr)")
    ap.add_argument("--max", type=int, default=15, help="items shown per list in the text report")
    ap.add_argument("--exclude", nargs="*", default=[], metavar="NAME", help="folder names to skip, matched at any depth")
    ap.add_argument("--fix-index", action="store_true", help="write INDEX.md where a folder has no index and link it from the index above")
    ap.add_argument("--to-markdown-links", action="store_true", help="rewrite wikilinks that resolve to one file as relative markdown links")
    ap.add_argument("--vault-init", action="store_true", help="write .obsidian/app.json (markdown links, relative paths, build folders ignored) and .gitignore lines")
    ap.add_argument("--ignore", nargs="*", default=[], metavar="FOLDER", help="extra folders for Obsidian to ignore (with --vault-init)")
    ap.add_argument("--probe", action="store_true", help="report whether the obsidian CLI is on PATH and where the app is")
    a = ap.parse_args()
    if a.probe:
        probe()
        return
    if not a.root:
        ap.error("root is required")
    if not Path(a.root).is_dir():
        ap.error(f"root is not a directory: {a.root}")
    if a.vault_init:
        vault_init(a.root, a.ignore)
        return
    f = scan(a.root, a.exclude)
    messages, written, rewritten = [], [], []
    if a.to_markdown_links:
        rewritten = to_markdown_links(f)
        messages.append(f"rewrote wikilinks in {len(rewritten)} file(s); embeds, ambiguous and unresolved names left as they were")
        f = scan(a.root, a.exclude)
    if a.fix_index:
        written = fix_index(f)
        messages.append("wrote " + (", ".join(written) if written else "nothing (every folder has an index)"))
        f = scan(a.root, a.exclude)
    if a.json:
        for m in messages:
            print(m, file=sys.stderr)
        out = {k: v for k, v in f.items() if not k.startswith("_")}
        out["written"], out["rewritten"] = written, rewritten
        print(json.dumps(out, indent=2))
        errs = error_count(f)
    else:
        for m in messages:
            print(m)
        errs = report(f, a.max)
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
