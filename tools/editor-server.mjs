#!/usr/bin/env node
/* =========================================================================
   Portfolio editor server — LOCAL ONLY.
   Serves the static site from the repo root and injects a WYSIWYG editing
   layer that writes edits back to the real files. The editor assets are
   injected at request time, so the files on disk (and the GitHub Pages
   deploy) never reference the editor. Run with:  node tools/editor-server.mjs
   Zero dependencies — Node built-ins only.
   ========================================================================= */

import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');      // repo root (the site)
const EDITOR_DIR = path.join(__dirname, 'editor'); // tools/editor
const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

// --- helpers --------------------------------------------------------------

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Resolve a request path to an absolute path that MUST stay inside `base`.
function safeResolve(base, relPath) {
  const clean = decodeURIComponent(relPath).split('?')[0].replace(/^\/+/, '');
  const abs = path.resolve(base, clean);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

// Inject the editor stylesheet, the __EDIT__ flag, and the editor module.
function injectEditor(html) {
  const head =
    '<link rel="stylesheet" href="/__editor__/editor.css">\n' +
    '<script>window.__EDIT__=true;</script>\n';
  const tail = '<script type="module" src="/__editor__/editor.js"></script>\n';
  let out = html;
  out = out.includes('</head>') ? out.replace('</head>', head + '</head>') : head + out;
  out = out.includes('</body>') ? out.replace('</body>', tail + '</body>') : out + tail;
  return out;
}

/* Replace the inner HTML of the element carrying data-edit-id="<editId>".
   Walks balanced same-tag open/close tokens, so it is safe as long as an
   editable element does not nest another element of its own tag name (none
   of ours do). Returns the new file string. */
function replaceInner(html, editId, newInner) {
  const attr = 'data-edit-id="' + editId + '"';
  const attrIdx = html.indexOf(attr);
  if (attrIdx === -1) throw new Error('data-edit-id not found: ' + editId);

  const tagStart = html.lastIndexOf('<', attrIdx);
  const nameMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(tagStart));
  if (!nameMatch) throw new Error('could not find opening tag for: ' + editId);
  const tag = nameMatch[1];

  const openEnd = html.indexOf('>', attrIdx);
  if (openEnd === -1) throw new Error('unterminated opening tag for: ' + editId);
  const innerStart = openEnd + 1;

  const tokenRe = new RegExp('<' + tag + '(?:[\\s>/])|</' + tag + '>', 'gi');
  tokenRe.lastIndex = innerStart;
  let depth = 1;
  let innerEnd = -1;
  let m;
  while ((m = tokenRe.exec(html))) {
    if (m[0].slice(0, 2) === '</') {
      depth--;
      if (depth === 0) { innerEnd = m.index; break; }
    } else {
      depth++;
    }
  }
  if (innerEnd === -1) throw new Error('no matching </' + tag + '> for: ' + editId);
  return html.slice(0, innerStart) + newInner + html.slice(innerEnd);
}

// --- API handlers ---------------------------------------------------------

async function handleSaveData(req, res) {
  const body = await readBody(req);
  let data;
  try { data = JSON.parse(body); } catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
  if (!data || !Array.isArray(data.projects)) {
    return sendJson(res, 400, { error: 'expected { projects: [...] }' });
  }
  const file = path.join(ROOT, 'data', 'projects.json');
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  sendJson(res, 200, { ok: true, count: data.projects.length });
}

async function handleSaveText(req, res) {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body); } catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
  const { file, editId, html } = payload || {};
  if (!file || !editId || typeof html !== 'string') {
    return sendJson(res, 400, { error: 'expected { file, editId, html }' });
  }
  if (!/^[\w-]+\.html$/.test(file)) {
    return sendJson(res, 400, { error: 'file must be a top-level .html file' });
  }
  const abs = path.join(ROOT, file);
  if (!existsSync(abs)) return sendJson(res, 404, { error: 'file not found: ' + file });
  try {
    const current = await readFile(abs, 'utf8');
    const updated = replaceInner(current, editId, html);
    await writeFile(abs, updated, 'utf8');
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: String(err.message || err) });
  }
}

async function handleUpload(req, res) {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body); } catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
  let { name, dataBase64, dir } = payload || {};
  if (!name || !dataBase64) return sendJson(res, 400, { error: 'expected { name, dataBase64, dir }' });

  // Sanitize: keep a flat, safe filename and a safe sub-directory under assets/.
  name = String(name).replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '');
  dir = String(dir || 'uploads').replace(/[^\w/\-]+/g, '_').replace(/\.\.+/g, '_').replace(/^\/+|\/+$/g, '');
  const targetDir = path.join(ROOT, 'assets', dir);
  if (!targetDir.startsWith(path.join(ROOT, 'assets'))) {
    return sendJson(res, 400, { error: 'invalid dir' });
  }

  // strip a possible data: URI prefix
  const comma = dataBase64.indexOf(',');
  const raw = dataBase64.startsWith('data:') && comma !== -1 ? dataBase64.slice(comma + 1) : dataBase64;

  try {
    await mkdir(targetDir, { recursive: true });
    // avoid clobbering: if it exists, suffix with a counter
    let finalName = name;
    let n = 1;
    while (existsSync(path.join(targetDir, finalName))) {
      const dot = name.lastIndexOf('.');
      finalName = dot === -1 ? name + '-' + n : name.slice(0, dot) + '-' + n + name.slice(dot);
      n++;
    }
    await writeFile(path.join(targetDir, finalName), Buffer.from(raw, 'base64'));
    // Return a web path, URL-encoded per segment (matches projects.json style).
    const webPath = 'assets/' + dir.split('/').map(encodeURIComponent).join('/') + '/' + encodeURIComponent(finalName);
    sendJson(res, 200, { ok: true, path: webPath });
  } catch (err) {
    sendJson(res, 500, { error: String(err.message || err) });
  }
}

// --- static serving -------------------------------------------------------

async function serveStatic(req, res, base, urlPath, { inject = false } = {}) {
  let abs = safeResolve(base, urlPath);
  if (!abs) return send(res, 403, 'Forbidden');
  if (urlPath === '/' || urlPath === '') abs = path.join(base, 'index.html');
  if (existsSync(abs) && (await import('node:fs')).statSync(abs).isDirectory()) {
    abs = path.join(abs, 'index.html');
  }
  if (!existsSync(abs)) return send(res, 404, 'Not found: ' + urlPath);

  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  try {
    if (ext === '.html' && inject) {
      const html = await readFile(abs, 'utf8');
      return send(res, 200, injectEditor(html), { 'Content-Type': type });
    }
    const buf = await readFile(abs);
    send(res, 200, buf, { 'Content-Type': type });
  } catch (err) {
    send(res, 500, 'Read error: ' + err.message);
  }
}

// --- router ---------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // editor assets
  if (urlPath.startsWith('/__editor__/')) {
    if (req.method === 'POST') {
      if (urlPath === '/__editor__/save-data') return handleSaveData(req, res);
      if (urlPath === '/__editor__/save-text') return handleSaveText(req, res);
      if (urlPath === '/__editor__/upload-image') return handleUpload(req, res);
      return sendJson(res, 404, { error: 'unknown endpoint' });
    }
    const assetPath = urlPath.replace('/__editor__/', '/');
    return serveStatic(req, res, EDITOR_DIR, assetPath, { inject: false });
  }

  if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
  return serveStatic(req, res, ROOT, urlPath, { inject: true });
});

server.listen(PORT, () => {
  console.log('\n  Portfolio editor running:  \x1b[1mhttp://localhost:' + PORT + '/\x1b[0m');
  console.log('  Serving:                   ' + ROOT);
  console.log('  Edits save to real files. The live site never loads the editor.');
  console.log('  Press Ctrl+C to stop.\n');
});
