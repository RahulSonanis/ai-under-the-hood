#!/usr/bin/env python3
"""Assemble src/ into:
  docs/index.html    - complete standalone page (GitHub Pages / open locally)
  dist/artifact.html - same page without <html>/<head>/<body>, for hosts that add their own skeleton
"""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900'
         '&family=JetBrains+Mono:wght@400;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&display=swap">')
META = '<meta name="description" content="An interactive, referenced course on what happens when you talk to an AI: tokens, models, serving, training, datacenters and agents, explained from age 5 to mathematician.">'


def build():
    css = (SRC / "styles.css").read_text()
    top = (SRC / "shell-top.html").read_text()
    chapters = "\n".join(p.read_text() for p in sorted((SRC / "chapters").glob("*.html")))
    # one <script> per file, so a mistake in one chapter's script can't take down the others
    js = "\n</script>\n<script>\n".join(p.read_text() for p in [SRC / "js" / "core.js"] + sorted((SRC / "js").glob("c[0-9]*.js")))
    head = f"<title>AI Under the Hood</title>\n{META}\n{FONTS}\n<style>\n{css}\n</style>"
    body = f"{top}\n{chapters}\n</main>\n</div>\n<script>\n{js}\n</script>"
    for d in ("dist", "docs"):
        (ROOT / d).mkdir(exist_ok=True)
    def put(path, text):  # atomic write, so a reader never sees a half-written file
        tmp = path.with_suffix(path.suffix + ".tmp"); tmp.write_text(text); tmp.replace(path)
    put(ROOT / "dist" / "artifact.html", head + "\n" + body + "\n")
    full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f"{head}\n</head>\n<body>\n{body}\n</body>\n</html>\n")
    put(ROOT / "docs" / "index.html", full)
    print(f"built docs/index.html: {len(full) / 1024:.0f} KB")


if __name__ == "__main__":
    build()
