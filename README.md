# Jermaine Johnson, Portfolio

Static site. Vanilla HTML, CSS and a single JS file. Project content is driven by `data/projects.json`. Deployed to GitHub Pages on push to `main`.

## Edit the site (WYSIWYG editor)

The repo ships with a local editor so you can build the portfolio directly in the browser — no install needed (uses the Python 3 that comes with macOS):

```
python3 tools/editor_server.py
# then open http://localhost:4321
```

A toolbar appears at the bottom of every page:

| Control | What it does |
| --- | --- |
| **Preview / Edit** | Toggle the editing outlines on and off |
| **Projects** | Side panel: add, edit, delete and drag-reorder projects |
| **Save** | Writes all pending changes to the real files |

While in Edit mode:

- **Click any outlined text** to edit it in place — headlines, taglines, about bio, project titles/summaries, phase descriptions, captions, timeline entries, even the template labels on detail pages.
- **Click or drop onto any image** to replace it. Uploads land in `assets/uploads/<project>/` and the right field in `projects.json` updates automatically. Media-gallery and game-phase slots also accept video.
- Nothing is written until you press **Save** — the status pill shows "Unsaved changes" until then.

Changes go straight to your working files; review with `git diff`, then commit and push to deploy. The editor is injected by the local server only — **the deployed site never includes it**.

Notes:

- Different port: `PORT=4322 python3 tools/editor_server.py`
- "Address already in use" means an editor is already running — just use the open tab.
- `tools/editor-server.mjs` is an equivalent Node version, if Node is ever installed (`npm run edit`).

## Preview locally (read-only)

Because the site fetches `data/projects.json` at runtime, it needs to be served over HTTP, not opened with `file://`. The editor server above works; for a plain preview without the editing layer:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## File layout

```
index.html              Home, hero + featured grid + tracks
research.html           Research & Scholarship list (filter chips)
interactive.html        Interactive & Games gallery
visual-arts.html        Visual Arts hub (Graphic / 3D / Photography tabs)
about.html              Bio, links, CV actions
project.html            Detail template (reads ?id=<slug> from URL)
cv.html                 CV PDF viewer
data/projects.json      All project metadata (single source of truth)
css/styles.css          Single stylesheet with all tokens and components
js/main.js              Page-aware; drives nav, grids, galleries, detail
tools/                  Local WYSIWYG editor (never deployed)
assets/cv/              Jermaine_Johnson_CV.pdf lives here
assets/graphic-design/  Graphic design project folders
assets/3d-modeling/     3D project folders
assets/interactive/     Interactive & games media (e.g. Noctoflora)
assets/uploads/         Images/videos added through the editor
SITEMAP.md              Sitemap, wireframes, design system
```

## Adding a new project

Easiest: run the editor (above), open **Projects → + Add project**, fill the form, drop in a cover, **Save**.

By hand instead:

1. Drop images into the right folder, e.g. `assets/graphic-design/New Project/`.
2. Add an entry to `data/projects.json`:

```json
{
  "id": "new-project",
  "title": "New Project",
  "category": "visual",
  "subcategory": "graphic",
  "year": "2026",
  "role": "Designer",
  "tools": ["Figma"],
  "summary": "One-liner shown on gallery cards.",
  "description": "Long-form writeup for the detail page.",
  "cover": "assets/graphic-design/New%20Project/cover.jpg",
  "media": [
    { "type": "image", "src": "assets/graphic-design/New%20Project/img-01.jpg", "alt": "..." }
  ],
  "featured": true
}
```

Valid categories: `research`, `interactive`, `visual` (visual subcategories: `graphic`, `3d`, `photo`). Set `featured: true` to appear on the home featured grid. URL-encode spaces in paths (`%20`).

Optional layouts on the detail page: a `caseStudy` object renders an outcome + process timeline; a `phases` array renders a game-showcase layout with image and video slots (see the Noctoflora entry for the shape); an `embed` URL renders a live iframe in the hero.

## Design tokens

All colors, fonts and edge treatments live as CSS custom properties at the top of `css/styles.css` under `:root`. Change them once, the whole site follows.
