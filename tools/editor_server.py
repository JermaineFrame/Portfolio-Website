#!/usr/bin/env python3
"""
Portfolio editor server -- LOCAL ONLY.

Serves the static site from the repo root and injects a WYSIWYG editing layer
that writes edits back to the real files. The editor assets are injected at
request time, so the files on disk (and the GitHub Pages deploy) never
reference the editor.

Run with no install -- macOS ships Python 3:

    python3 tools/editor_server.py

Standard library only.
"""

import base64
import json
import mimetypes
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, os.pardir))   # repo root (the site)
EDITOR_DIR = os.path.join(HERE, "editor")               # tools/editor
PORT = int(os.environ.get("PORT", "4321"))

EXTRA_MIME = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
}


def guess_type(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in EXTRA_MIME:
        return EXTRA_MIME[ext]
    if ext in (".html", ".htm"):
        return "text/html; charset=utf-8"
    t = mimetypes.guess_type(path)[0]
    return t or "application/octet-stream"


def inject_editor(html):
    """Inject the editor stylesheet, the __EDIT__ flag, and the editor module."""
    head = (
        '<link rel="stylesheet" href="/__editor__/editor.css">\n'
        "<script>window.__EDIT__=true;</script>\n"
    )
    tail = '<script type="module" src="/__editor__/editor.js"></script>\n'
    if "</head>" in html:
        html = html.replace("</head>", head + "</head>", 1)
    else:
        html = head + html
    if "</body>" in html:
        html = html.replace("</body>", tail + "</body>", 1)
    else:
        html = html + tail
    return html


def replace_inner(html, edit_id, new_inner):
    """Replace the inner HTML of the element carrying data-edit-id="<edit_id>".

    Walks balanced same-tag open/close tokens, so it is safe as long as an
    editable element does not nest another element of its own tag name (none
    of ours do).
    """
    attr = 'data-edit-id="%s"' % edit_id
    i = html.find(attr)
    if i == -1:
        raise ValueError("data-edit-id not found: " + edit_id)

    tag_start = html.rfind("<", 0, i)
    m = re.match(r"<([a-zA-Z][\w-]*)", html[tag_start:])
    if not m:
        raise ValueError("could not find opening tag for: " + edit_id)
    tag = m.group(1)

    open_end = html.find(">", i)
    if open_end == -1:
        raise ValueError("unterminated opening tag for: " + edit_id)
    inner_start = open_end + 1

    token_re = re.compile(r"<%s(?:[\s>/])|</%s>" % (re.escape(tag), re.escape(tag)), re.I)
    depth = 1
    inner_end = -1
    for mt in token_re.finditer(html, inner_start):
        if mt.group(0)[:2] == "</":
            depth -= 1
            if depth == 0:
                inner_end = mt.start()
                break
        else:
            depth += 1
    if inner_end == -1:
        raise ValueError("no matching </%s> for: %s" % (tag, edit_id))
    return html[:inner_start] + new_inner + html[inner_end:]


def safe_join(base, rel):
    """Resolve rel under base, refusing anything that escapes base."""
    rel = rel.split("?")[0].lstrip("/")
    abs_path = os.path.abspath(os.path.join(base, rel))
    if abs_path != base and not abs_path.startswith(base + os.sep):
        return None
    return abs_path


class Handler(BaseHTTPRequestHandler):
    server_version = "PortfolioEditor/1.0"

    # ---- helpers --------------------------------------------------------
    def _send(self, status, body=b"", ctype="text/plain; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_json(self, status, obj):
        self._send(status, json.dumps(obj), "application/json; charset=utf-8")

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""
        return json.loads(raw.decode("utf-8"))

    def log_message(self, fmt, *args):  # quieter logging
        sys.stderr.write("  %s\n" % (fmt % args))

    # ---- routing --------------------------------------------------------
    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/__editor__/"):
            asset = path[len("/__editor__/"):]
            return self.serve_static(EDITOR_DIR, asset, inject=False)
        return self.serve_static(ROOT, path, inject=True)

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            if path == "/__editor__/save-data":
                return self.handle_save_data()
            if path == "/__editor__/save-text":
                return self.handle_save_text()
            if path == "/__editor__/upload-image":
                return self.handle_upload()
        except Exception as e:  # noqa: BLE001
            return self._send_json(500, {"error": str(e)})
        return self._send_json(404, {"error": "unknown endpoint"})

    # ---- static ---------------------------------------------------------
    def serve_static(self, base, rel, inject):
        abs_path = safe_join(base, rel)
        if abs_path is None:
            return self._send(403, "Forbidden")
        if rel in ("", "/") or os.path.isdir(abs_path):
            abs_path = os.path.join(abs_path, "index.html")
        if not os.path.isfile(abs_path):
            return self._send(404, "Not found: " + rel)
        ctype = guess_type(abs_path)
        try:
            if inject and abs_path.lower().endswith((".html", ".htm")):
                with open(abs_path, "r", encoding="utf-8") as f:
                    return self._send(200, inject_editor(f.read()), ctype)
            with open(abs_path, "rb") as f:
                return self._send(200, f.read(), ctype)
        except OSError as e:
            return self._send(500, "Read error: " + str(e))

    # ---- API ------------------------------------------------------------
    def handle_save_data(self):
        data = self._read_json()
        if not isinstance(data, dict) or not isinstance(data.get("projects"), list):
            return self._send_json(400, {"error": "expected { projects: [...] }"})
        target = os.path.join(ROOT, "data", "projects.json")
        with open(target, "w", encoding="utf-8") as f:
            f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        return self._send_json(200, {"ok": True, "count": len(data["projects"])})

    def handle_save_text(self):
        payload = self._read_json()
        fname = payload.get("file")
        edit_id = payload.get("editId")
        html = payload.get("html")
        if not fname or not edit_id or not isinstance(html, str):
            return self._send_json(400, {"error": "expected { file, editId, html }"})
        if not re.match(r"^[\w-]+\.html$", fname):
            return self._send_json(400, {"error": "file must be a top-level .html file"})
        abs_path = os.path.join(ROOT, fname)
        if not os.path.isfile(abs_path):
            return self._send_json(404, {"error": "file not found: " + fname})
        with open(abs_path, "r", encoding="utf-8") as f:
            current = f.read()
        updated = replace_inner(current, edit_id, html)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(updated)
        return self._send_json(200, {"ok": True})

    def handle_upload(self):
        payload = self._read_json()
        name = payload.get("name")
        data_b64 = payload.get("dataBase64")
        sub = payload.get("dir") or "uploads"
        if not name or not data_b64:
            return self._send_json(400, {"error": "expected { name, dataBase64, dir }"})

        name = re.sub(r"[^\w.\-]+", "_", str(name)).lstrip(".")
        sub = re.sub(r"\.\.+", "_", re.sub(r"[^\w/\-]+", "_", str(sub))).strip("/")
        target_dir = os.path.abspath(os.path.join(ROOT, "assets", sub))
        assets_root = os.path.join(ROOT, "assets")
        if not target_dir.startswith(assets_root):
            return self._send_json(400, {"error": "invalid dir"})

        if data_b64.startswith("data:") and "," in data_b64:
            data_b64 = data_b64.split(",", 1)[1]
        raw = base64.b64decode(data_b64)

        os.makedirs(target_dir, exist_ok=True)
        final = name
        n = 1
        while os.path.exists(os.path.join(target_dir, final)):
            stem, ext = os.path.splitext(name)
            final = "%s-%d%s" % (stem, n, ext)
            n += 1
        with open(os.path.join(target_dir, final), "wb") as f:
            f.write(raw)

        from urllib.parse import quote
        web = "assets/" + "/".join(quote(p) for p in sub.split("/")) + "/" + quote(final)
        return self._send_json(200, {"ok": True, "path": web})


def main():
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = "http://localhost:%d/" % PORT
    print("\n  Portfolio editor running:  \033[1m%s\033[0m" % url)
    print("  Serving:                   %s" % ROOT)
    print("  Edits save to real files. The live site never loads the editor.")
    print("  Press Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
        httpd.server_close()


if __name__ == "__main__":
    main()
