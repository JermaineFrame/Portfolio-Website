# Jermaine Johnson, Portfolio

Static site. Vanilla HTML, CSS and a single JS file. Project content is driven by `data/projects.json`.

## Preview locally

Because the site fetches `data/projects.json` at runtime, it needs to be served over HTTP, not opened with `file://`. From this folder, run any of:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

```
npx serve .
```

## File layout

```
index.html              Home, hero + highlights rail + disciplines
graphic-design.html     Category gallery (reads category="graphic")
3d-modeling.html        Category gallery (reads category="3d")
photography.html        Category gallery (reads category="photo")
project.html            Detail template (reads ?id=<slug> from URL)
cv.html                 CV PDF viewer
data/projects.json      All project metadata
css/styles.css          Single stylesheet with all tokens and components
js/main.js              Page-aware; drives nav, rail, gallery, detail
assets/cv/              Jermaine_Johnson_CV.pdf lives here
assets/3d-modeling/     3D project folders (one per project)
assets/graphic-design/  Graphic design project folders
assets/photography/     Photography project folders
SITEMAP.md              Sitemap, wireframes, design system
```

## Adding a new project

1. Drop images into the right category folder, e.g. `assets/graphic-design/New Project/`.
2. Add an entry to `data/projects.json`:

```json
{
  "id": "new-project",
  "title": "New Project",
  "category": "graphic",
  "subcategory": "branding",
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

Valid categories: `graphic`, `3d`, `photo`. Set `featured: true` to appear in the home highlights rail. URL-encode spaces in paths (`%20`).

## Design tokens

All colors, fonts and edge treatments live as CSS custom properties at the top of `css/styles.css` under `:root`. Change them once, the whole site follows.
