#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
SRC = ROOT / "frontend" / "src"

if not SRC.exists():
    print("ERROR: run this from the DARLA repo root; frontend/src not found.")
    sys.exit(1)

def backup(path: Path):
    bak = path.with_suffix(path.suffix + ".bak_ui_accuracy")
    if not bak.exists():
        shutil.copy2(path, bak)

def patch_app():
    app = SRC / "App.tsx"
    if not app.exists():
        print("WARN: App.tsx not found")
        return False

    s = app.read_text()
    original = s

    if 'SelectionProvider' not in s:
        # Insert import after React import or first import.
        lines = s.splitlines()
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i + 1
        lines.insert(insert_at, 'import { SelectionProvider } from "./context/SelectionContext";')
        s = "\n".join(lines) + "\n"

    # Wrap simplest common return patterns.
    if "<SelectionProvider>" not in s:
        # Try wrap `return (` block body.
        # Conservative: replace first return ( with return (<SelectionProvider> and final matching-ish `);`
        idx = s.find("return (")
        if idx != -1:
            s = s[:idx] + "return (\n    <SelectionProvider>\n" + s[idx+len("return ("):]
            # Replace last occurrence of "\n  );" or "\n);" in file
            candidates = ["\n  );", "\n);"]
            replaced = False
            for c in candidates:
                pos = s.rfind(c)
                if pos != -1:
                    indent = "    " if c == "\n  );" else "  "
                    s = s[:pos] + f"\n    </SelectionProvider>{c}"
                    replaced = True
                    break
            if not replaced:
                print("WARN: Could not auto-close SelectionProvider in App.tsx")
        else:
            print("WARN: Could not find return ( in App.tsx")

    if s != original:
        backup(app)
        app.write_text(s)
        print("patched App.tsx with SelectionProvider")
        return True
    print("App.tsx already patched or unchanged")
    return False

def find_files_with(text):
    return [p for p in SRC.rglob("*.tsx") if text in p.read_text(errors="ignore")]

def patch_no_moment_inspector():
    files = find_files_with("No moment selected")
    if not files:
        print("WARN: No file containing 'No moment selected' found")
        return False

    for p in files:
        s = p.read_text()
        original = s

        if "SynchronizedInspector" not in s:
            rel_import = relative_import(p, SRC / "components" / "SynchronizedInspector")
            s = add_import(s, f'import SynchronizedInspector from "{rel_import}";')

        # Replace the obvious title text block by injecting useful inspector before/near it.
        if "<SynchronizedInspector" not in s:
            marker = "No moment selected"
            pos = s.find(marker)
            # insert component before first h/title line containing marker
            line_start = s.rfind("\n", 0, pos)
            insert = '\n      <SynchronizedInspector dashboardData={dashboardData ?? data ?? {}} />\n'
            s = s[:line_start] + insert + s[line_start:]

        if s != original:
            backup(p)
            p.write_text(s)
            print(f"patched inspector candidate: {p.relative_to(ROOT)}")
            return True

    return False

def patch_coa_gates():
    candidates = []
    for needle in ["COA REALISM GATES", "COA Gates", "coa gates", "Realism"]:
        candidates.extend(find_files_with(needle))
    # unique
    seen = []
    for p in candidates:
        if p not in seen:
            seen.append(p)

    for p in seen:
        if "node_modules" in str(p):
            continue
        s = p.read_text()
        original = s
        if "CompactCoaGateBoard" in s:
            continue
        rel_import = relative_import(p, SRC / "components" / "CompactCoaGateBoard")
        s = add_import(s, f'import CompactCoaGateBoard from "{rel_import}";')

        # Insert after first header-ish section if possible, else after return (
        insert = '\n      <CompactCoaGateBoard dashboardData={dashboardData ?? data ?? {}} />\n'
        pos = s.find("COA REALISM GATES")
        if pos == -1:
            pos = s.find("COA Gates")
        if pos != -1:
            line_end = s.find("\n", pos)
            s = s[:line_end+1] + insert + s[line_end+1:]
        else:
            pos = s.find("return (")
            if pos != -1:
                after = s.find("\n", pos)
                s = s[:after+1] + insert + s[after+1:]
            else:
                continue

        if s != original:
            backup(p)
            p.write_text(s)
            print(f"patched COA/Realism candidate: {p.relative_to(ROOT)}")
            return True

    print("WARN: Could not confidently patch COA/Realism page")
    return False

def patch_moment_analysis():
    files = find_files_with("Moment Analysis")
    if not files:
        print("WARN: No file containing 'Moment Analysis' found")
        return False

    for p in files:
        s = p.read_text()
        original = s

        if "EvidenceChainPanel" in s:
            continue

        rel_import = relative_import(p, SRC / "components" / "EvidenceChainPanel")
        s = add_import(s, f'import EvidenceChainPanel from "{rel_import}";')
        pos = s.find("Moment Analysis")
        line_end = s.find("\n", pos)
        insert = '\n      <EvidenceChainPanel dashboardData={dashboardData ?? data ?? {}} />\n'
        s = s[:line_end+1] + insert + s[line_end+1:]

        if s != original:
            backup(p)
            p.write_text(s)
            print(f"patched Moment Analysis candidate: {p.relative_to(ROOT)}")
            return True

    return False

def relative_import(from_file: Path, target_no_ext: Path):
    rel = target_no_ext.relative_to(from_file.parent) if False else None
    import os
    relpath = os.path.relpath(target_no_ext, from_file.parent)
    relpath = relpath.replace("\\", "/")
    if not relpath.startswith("."):
        relpath = "./" + relpath
    return relpath

def add_import(s: str, import_line: str):
    if import_line in s:
        return s
    lines = s.splitlines()
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, import_line)
    return "\n".join(lines) + "\n"

def main():
    print("DARLA UI Accuracy auto-apply")
    patch_app()
    patch_no_moment_inspector()
    patch_coa_gates()
    patch_moment_analysis()
    print("\nDone. Now run:")
    print("  cd frontend && npm run build")
    print("\nIf TypeScript errors appear, paste them. Backups end with .bak_ui_accuracy")

if __name__ == "__main__":
    main()
