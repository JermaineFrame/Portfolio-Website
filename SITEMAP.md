# Jermaine Johnson Portfolio, Redesign Brief

## 1. Site Map

```
                          ┌──────────────────────┐
                          │       HOME (/)       │
                          │  Hero + Highlights   │
                          └──────────┬───────────┘
                                     │
        ┌────────────────┬───────────┼───────────┬────────────────┐
        ▼                ▼           ▼           ▼                ▼
  /graphic-design   /3d-modeling  /photography  /cv            /#contact
   (gallery)         (gallery)    (gallery)    (CV viewer)   (footer anchor)
        │                │           │
        └────────────────┴───────────┘
                         │
                         ▼
          /project.html?id=<slug>
           (project detail view)
```

## 2. Visual Language

**Aesthetic:** Modern, edgy, brutalist-leaning. No rounded corners anywhere. Sharp chamfered
clip-paths on cards, buttons, and images. Diagonal section dividers. High-contrast dark palette
with bold color pops.

**Colors**
- Background base: `#0A0A0A` (near-black)
- Elevated surface: `#151515`
- Card surface: `#1F1F1F`
- Primary text: `#FAFAFA`
- Secondary text: `#8A8A8A`
- Divider: `#2A2A2A`
- Accent, Blue: `#00AEEF`
- Accent, Orange: `#F07F21`

**Typography**
- Display / headers: Archivo Black (bold, condensed feel for hero and section titles)
- Body / UI: Inter (400, 500, 600)
- Metadata chips: Inter 500 uppercase, tracked

**Edge treatments**
- Chamfered corner clip-path on cards: `polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))`
- Angled section dividers using clip-path
- Thin 2px accent bars on section headers (blue or orange)
- Skewed / offset number badges for project indices (01, 02, 03)

## 3. Page-by-Page Wireframes

### 3.1 Home (/)

```
┌─────────────────────────────────────────────────────────────────┐
│  JJ              WORK  GRAPHIC  3D  PHOTO  CV          CONTACT  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ╱╱ MULTIDISCIPLINARY                                          │
│                                                                 │
│   JERMAINE                                                      │
│   JOHNSON                          ◢◣  (angular graphic)        │
│                                    ◤◥                           │
│   Graphic design · 3D · photography                             │
│                                                                 │
│   [ VIEW WORK →]   [ DOWNLOAD CV ]                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ── HIGHLIGHTS ────────────────────────  ←/→ scroll              │
│                                                                 │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐  (horizontal rail)  │
│   │ 01 │ │ 02 │ │ 03 │ │ 04 │ │ 05 │ │ 06 │                    │
│   │ img│ │ img│ │ img│ │ img│ │ img│ │ img│                    │
│   └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│   ◢ DISCIPLINES                                                 │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│   │  GRAPHIC    │ │    3D       │ │ PHOTOGRAPHY │               │
│   │  DESIGN     │ │  MODELING   │ │             │               │
│   │   → open    │ │   → open    │ │   → open    │               │
│   └─────────────┘ └─────────────┘ └─────────────┘               │
├─────────────────────────────────────────────────────────────────┤
│   ABOUT strip · contact · social                                │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Category Gallery (e.g. /3d-modeling.html)

```
┌─────────────────────────────────────────────────────────────────┐
│  nav                                                            │
├─────────────────────────────────────────────────────────────────┤
│  BREADCRUMB · Home / 3D Modeling                                │
│                                                                 │
│  3D MODELING                                   [ filter chips ] │
│  ─────────                                     ALL · CHAR · ENV │
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                          │
│  │         │  │         │  │         │                          │
│  │  img    │  │  img    │  │  img    │                          │
│  │         │  │         │  │         │                          │
│  │ 01 TITLE│  │ 02 TITLE│  │ 03 TITLE│                          │
│  └─────────┘  └─────────┘  └─────────┘                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                          │
│  │         │  │         │  │         │                          │
│  └─────────┘  └─────────┘  └─────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Project Detail (/project.html?id=<slug>)

```
┌─────────────────────────────────────────────────────────────────┐
│  nav                                                            │
├─────────────────────────────────────────────────────────────────┤
│  ← BACK                                                          │
│                                                                 │
│   PROJECT TITLE                                                 │
│   ─────────────                                                 │
│   category · year · tools                                       │
│                                                                 │
│  ┌────────────────────────────────────┐  ┌──────────────────┐   │
│  │                                    │  │  OVERVIEW        │   │
│  │       hero image                   │  │  long description│   │
│  │                                    │  │  text block      │   │
│  └────────────────────────────────────┘  │                  │   │
│                                          │  ROLE            │   │
│  ┌──────────┐  ┌──────────┐              │  TOOLS           │   │
│  │  media   │  │  media   │              │  YEAR            │   │
│  └──────────┘  └──────────┘              └──────────────────┘   │
│                                                                 │
│  NEXT PROJECT →  [ card ]                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 CV Page (/cv.html)

```
┌─────────────────────────────────────────────────────────────────┐
│  nav                                                            │
├─────────────────────────────────────────────────────────────────┤
│  CV · JERMAINE JOHNSON                      [ DOWNLOAD PDF ↓ ]  │
│  ────────────────────────                                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │              <iframe src="Jermaine_Johnson_CV.pdf">       │  │
│  │                                                           │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Scaling model

All projects are stored in `data/projects.json`. Adding a new project is a single JSON entry:

```json
{
  "id": "slug-name",
  "title": "Project Title",
  "category": "3d",              // "graphic" | "3d" | "photo"
  "year": "2025",
  "role": "Designer",
  "tools": ["Blender", "Photoshop"],
  "summary": "One-liner shown on gallery cards.",
  "description": "Long-form writeup for the detail page.",
  "cover": "path/to/cover.jpg",
  "media": [
    { "type": "image", "src": "path/to/img1.jpg", "alt": "..." }
  ],
  "featured": true               // shown in home highlights rail
}
```

Gallery and detail pages read the same JSON, so one entry populates everywhere.

## 5. Responsive breakpoints
- `≤640px`: single column, collapsed nav, horizontal swipe for highlights
- `641–1024px`: two-column gallery, full nav
- `≥1025px`: three-column gallery, expanded hero
