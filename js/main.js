/* =========================================================================
   Jermaine Johnson, Portfolio, main.js
   One script, page-aware. Each block is a no-op if its target isn't present.
   ========================================================================= */

(function () {
  'use strict';

  // --- Theme toggle -------------------------------------------------------
  const THEME_KEY = 'jj-theme';
  const themeToggle = document.getElementById('themeToggle');
  function setTheme(mode, persist) {
    document.documentElement.setAttribute('data-theme', mode);
    if (persist) {
      try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
    }
    if (themeToggle) {
      themeToggle.setAttribute(
        'aria-label',
        mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );
    }
  }
  if (themeToggle) {
    setTheme(document.documentElement.getAttribute('data-theme') || 'light', false);
    themeToggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(current === 'dark' ? 'light' : 'dark', true);
    });
  }
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) {
      mq.addEventListener('change', function (e) {
        try { if (localStorage.getItem(THEME_KEY)) return; } catch (err) {}
        setTheme(e.matches ? 'dark' : 'light', false);
      });
    }
  }

  // --- Nav toggle (mobile) ------------------------------------------------
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
  }

  // --- Track labels -------------------------------------------------------
  const TRACK_LABELS = {
    research:    'Research & Scholarship',
    interactive: 'Interactive & Games',
    visual:      'Visual Arts'
  };
  const TRACK_PAGES = {
    research:    'research.html',
    interactive: 'interactive.html',
    visual:      'visual-arts.html'
  };
  const SUBCATEGORY_LABELS = {
    graphic: 'Graphic Design',
    '3d':    '3D Modeling',
    photo:   'Photography'
  };
  const RESEARCH_TYPE_LABELS = {
    publication:   'Publication',
    project:       'Project',
    visualization: 'Visualization'
  };
  const INTERACTIVE_TYPE_LABELS = {
    simulation: 'Simulation',
    experience: 'Experience',
    game:       'Game',
    narrative:  'Narrative'
  };

  // --- Data fetch with tolerant fallback ----------------------------------
  function fetchProjects() {
    return fetch('data/projects.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('projects.json load failed: ' + r.status);
        return r.json();
      })
      .then(function (data) { return data.projects || []; });
  }

  // --- Small DOM helpers --------------------------------------------------
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (children) children.forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function padIndex(n) { return String(n + 1).padStart(2, '0'); }
  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // =========================================================================
  //  HOME: Featured grid (one per track)
  // =========================================================================
  const featuredGrid = document.getElementById('featuredGrid');
  if (featuredGrid) {
    fetchProjects().then(function (projects) {
      const tracks = ['research', 'interactive', 'visual'];
      tracks.forEach(function (track) {
        const pick =
          projects.find(function (p) { return p.category === track && p.featured; }) ||
          projects.find(function (p) { return p.category === track; });
        if (!pick) return;

        const href = 'project.html?id=' + encodeURIComponent(pick.id);
        const card = el('a', { href: href, class: 'featured-card', 'data-track': track });

        const media = el('div', { class: 'featured-media' + (pick.cover ? '' : ' placeholder'), 'data-img-bind': pick.id + ':cover' });
        if (pick.cover) {
          media.appendChild(el('img', { src: pick.cover, alt: pick.title, loading: 'lazy' }));
        } else {
          media.appendChild(el('span', { class: 'placeholder-mark', text: 'PLACEHOLDER' }));
        }
        media.appendChild(el('span', { class: 'track', text: TRACK_LABELS[track] }));

        const body = el('div', { class: 'featured-body' });
        body.appendChild(el('div', { class: 'title', text: pick.title, 'data-bind': pick.id + ':title' }));
        if (pick.summary) body.appendChild(el('div', { class: 'summary', text: pick.summary, 'data-bind': pick.id + ':summary' }));
        body.appendChild(el('div', { class: 'go', text: 'Open \u2192' }));

        card.appendChild(media);
        card.appendChild(body);
        featuredGrid.appendChild(card);
      });
    }).catch(function (err) {
      console.error(err);
      featuredGrid.innerHTML = '<p class="text-muted">Unable to load featured work.</p>';
    });
  }

  // =========================================================================
  //  RESEARCH page (list layout with filter chips)
  // =========================================================================
  const researchList = document.getElementById('researchList');
  if (researchList && document.body.getAttribute('data-page') === 'research') {
    const filterBar = document.getElementById('filterBar');
    let all = [];
    let currentFilter = 'all';

    function render() {
      researchList.innerHTML = '';
      const items = currentFilter === 'all'
        ? all
        : all.filter(function (p) { return (p.type || '').toLowerCase() === currentFilter; });
      if (!items.length) {
        researchList.appendChild(el('li', { class: 'text-muted', text: 'No entries for this filter yet.' }));
        return;
      }
      items.forEach(function (p, i) {
        const detailHref = 'project.html?id=' + encodeURIComponent(p.id);
        const li = el('li', { class: 'research-item', 'data-type': (p.type || '').toLowerCase() });
        li.appendChild(el('div', { class: 'idx', text: padIndex(i) }));

        const body = el('div', { class: 'body' });
        body.appendChild(el('span', { class: 'type', text: (RESEARCH_TYPE_LABELS[p.type] || p.type || 'Entry') }));
        const titleLink = el('a', { href: detailHref });
        titleLink.appendChild(el('h3', { class: 'title', text: p.title, 'data-bind': p.id + ':title' }));
        body.appendChild(titleLink);
        if (p.venue) body.appendChild(el('div', { class: 'venue', text: p.venue, 'data-bind': p.id + ':venue' }));
        if (p.summary) body.appendChild(el('p', { class: 'summary', text: p.summary, 'data-bind': p.id + ':summary' }));
        if (p.methodology) {
          const meth = el('div', { class: 'methodology' });
          meth.appendChild(el('strong', { text: 'Methodology  ' }));
          meth.appendChild(document.createTextNode(p.methodology));
          body.appendChild(meth);
        }
        li.appendChild(body);

        const side = el('div', { class: 'side' });
        if (p.year) side.appendChild(el('span', { class: 'year', text: p.year }));
        side.appendChild(el('span', { text: (p.type || '').toUpperCase() }));
        side.appendChild(document.createElement('br'));
        if (p.link) {
          side.appendChild(el('a', { href: p.link, target: '_blank', rel: 'noopener', text: 'READ \u2192' }));
          side.appendChild(document.createElement('br'));
        }
        side.appendChild(el('a', { href: detailHref, class: 'view-detail', text: 'VIEW \u2192' }));
        li.appendChild(side);

        researchList.appendChild(li);
      });
    }

    fetchProjects().then(function (projects) {
      all = projects.filter(function (p) { return p.category === 'research'; });

      if (filterBar) {
        const types = Array.from(new Set(all.map(function (p) { return (p.type || '').toLowerCase(); }).filter(Boolean)));
        const chips = ['all'].concat(types);
        chips.forEach(function (s, i) {
          const label = s === 'all' ? 'ALL' : (RESEARCH_TYPE_LABELS[s] || s).toUpperCase();
          const chip = el('button', { class: 'filter-chip' + (i === 0 ? ' active' : ''), 'data-filter': s, text: label });
          chip.addEventListener('click', function () {
            currentFilter = s;
            Array.from(filterBar.querySelectorAll('.filter-chip')).forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            render();
          });
          filterBar.appendChild(chip);
        });
      }
      render();
    }).catch(function (err) {
      console.error(err);
      researchList.innerHTML = '<li class="text-muted">Unable to load research entries.</li>';
    });
  }

  // =========================================================================
  //  INTERACTIVE page (card gallery with tag chips)
  // =========================================================================
  const interactiveGrid = document.getElementById('interactiveGrid');
  if (interactiveGrid && document.body.getAttribute('data-page') === 'interactive') {
    const filterBar = document.getElementById('filterBar');
    let all = [];
    let currentFilter = 'all';

    function render() {
      interactiveGrid.innerHTML = '';
      const items = currentFilter === 'all'
        ? all
        : all.filter(function (p) { return (p.type || '').toLowerCase() === currentFilter; });
      if (!items.length) {
        interactiveGrid.appendChild(el('p', { class: 'text-muted', text: 'No entries for this filter yet.' }));
        return;
      }
      items.forEach(function (p) {
        const href = 'project.html?id=' + encodeURIComponent(p.id);
        const card = el('a', { href: href, class: 'interactive-card' });

        const media = el('div', { class: 'interactive-media' + (p.cover ? '' : ' placeholder'), 'data-img-bind': p.id + ':cover' });
        if (p.cover) {
          media.appendChild(el('img', { src: p.cover, alt: p.title, loading: 'lazy' }));
        } else {
          media.appendChild(el('span', { class: 'placeholder-mark', text: 'PLACEHOLDER' }));
        }

        const body = el('div', { class: 'interactive-body' });
        body.appendChild(el('span', { class: 'kind', text: (INTERACTIVE_TYPE_LABELS[p.type] || p.type || 'Entry') + '  /  ' + (p.year || '') }));
        body.appendChild(el('h3', { class: 'title', text: p.title, 'data-bind': p.id + ':title' }));
        if (p.summary) body.appendChild(el('p', { class: 'summary', text: p.summary, 'data-bind': p.id + ':summary' }));

        const tags = p.tags || p.tools || [];
        if (tags.length) {
          const tagRow = el('div', { class: 'tag-row' });
          tags.forEach(function (t) { tagRow.appendChild(el('span', { class: 'tag-chip', text: t })); });
          body.appendChild(tagRow);
        }
        body.appendChild(el('span', { class: 'go', text: 'Open \u2192' }));

        card.appendChild(media);
        card.appendChild(body);
        interactiveGrid.appendChild(card);
      });
    }

    fetchProjects().then(function (projects) {
      all = projects.filter(function (p) { return p.category === 'interactive'; });

      if (filterBar) {
        const types = Array.from(new Set(all.map(function (p) { return (p.type || '').toLowerCase(); }).filter(Boolean)));
        const chips = ['all'].concat(types);
        chips.forEach(function (s, i) {
          const label = s === 'all' ? 'ALL' : (INTERACTIVE_TYPE_LABELS[s] || s).toUpperCase();
          const chip = el('button', { class: 'filter-chip' + (i === 0 ? ' active' : ''), 'data-filter': s, text: label });
          chip.addEventListener('click', function () {
            currentFilter = s;
            Array.from(filterBar.querySelectorAll('.filter-chip')).forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            render();
          });
          filterBar.appendChild(chip);
        });
      }
      render();
    }).catch(function (err) {
      console.error(err);
      interactiveGrid.innerHTML = '<p class="text-muted">Unable to load interactive entries.</p>';
    });
  }

  // =========================================================================
  //  VISUAL ARTS page: hub with three subcategory tabs
  //    graphic -> project cards -> project.html
  //    3d      -> project cards -> project.html
  //    photo   -> flat image gallery with lightbox
  // =========================================================================
  const subSwitcher = document.getElementById('subSwitcher');
  const visualProjectGrid = document.getElementById('visualProjectGrid');
  const photoMasonry = document.getElementById('photoMasonry');
  if (subSwitcher && document.body.getAttribute('data-page') === 'visual') {
    const VALID_SUBS = ['graphic', '3d', 'photo'];
    let allVisual = [];
    let currentSub = getQueryParam('sub') || 'graphic';
    if (VALID_SUBS.indexOf(currentSub) === -1) currentSub = 'graphic';

    function buildProjectCard(project, index) {
      const href = 'project.html?id=' + encodeURIComponent(project.id);
      const card = el('a', { href: href, class: 'project-card' });
      if (!project.cover) card.setAttribute('data-empty', 'true');

      const media = el('div', { class: 'project-card-media' + (project.cover ? '' : ' placeholder'), 'data-img-bind': project.id + ':cover' });
      if (project.cover) {
        media.appendChild(el('img', { src: project.cover, alt: project.title, loading: 'lazy' }));
      } else {
        media.appendChild(el('span', { class: 'placeholder-mark', text: 'PLACEHOLDER' }));
      }

      const body = el('div', { class: 'project-card-body' });
      const textWrap = el('div');
      textWrap.appendChild(el('div', {
        class: 'num',
        text: padIndex(index) + ' / ' + (project.subtype || project.subcategory || '').toUpperCase()
      }));
      textWrap.appendChild(el('div', { class: 'title', text: project.title, 'data-bind': project.id + ':title' }));
      if (project.summary) textWrap.appendChild(el('div', { class: 'summary', text: project.summary, 'data-bind': project.id + ':summary' }));
      body.appendChild(textWrap);
      body.appendChild(el('span', { class: 'go', text: 'OPEN \u2192' }));

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function renderProjectGrid(subcat) {
      visualProjectGrid.innerHTML = '';
      const items = allVisual.filter(function (p) { return (p.subcategory || '').toLowerCase() === subcat; });
      if (!items.length) {
        visualProjectGrid.appendChild(el('p', { class: 'text-muted', text: 'No projects in this subcategory yet.' }));
        return;
      }
      items.forEach(function (p, i) {
        visualProjectGrid.appendChild(buildProjectCard(p, i));
      });
    }

    function renderPhotoGallery() {
      photoMasonry.innerHTML = '';
      const photos = allVisual.filter(function (p) { return (p.subcategory || '').toLowerCase() === 'photo'; });

      // Flatten every photo project's images into a flat list of tiles.
      const tiles = [];
      photos.forEach(function (p) {
        const media = (p.media && p.media.length) ? p.media
                    : (p.cover ? [{ type: 'image', src: p.cover, alt: p.title }] : []);
        const fromMedia = !!(p.media && p.media.length);
        if (media.length === 0) {
          tiles.push({ projectId: p.id, title: p.title, src: '', alt: p.title, subtype: p.subtype || '', bind: p.id + ':cover' });
        } else {
          media.forEach(function (m, mi) {
            if (m.type !== 'image' || !m.src) return;
            tiles.push({
              projectId: p.id, title: p.title, src: m.src, alt: m.alt || p.title, subtype: p.subtype || '',
              bind: fromMedia ? (p.id + ':media.' + mi + '.src') : (p.id + ':cover')
            });
          });
        }
      });

      if (!tiles.length) {
        photoMasonry.appendChild(el('p', { class: 'text-muted', text: 'No photos yet.' }));
        return;
      }

      const realTiles = tiles.filter(function (t) { return t.src; });

      tiles.forEach(function (t) {
        if (!t.src) {
          const ph = el('div', { class: 'masonry-item is-placeholder', 'data-img-bind': t.bind });
          ph.appendChild(el('span', { class: 'placeholder-mark', text: 'PLACEHOLDER' }));
          photoMasonry.appendChild(ph);
          return;
        }
        const tile = el('button', {
          class: 'masonry-item',
          type: 'button',
          'aria-label': 'View ' + t.title,
          'data-img-bind': t.bind
        });
        tile.appendChild(el('img', { src: t.src, alt: t.alt, loading: 'lazy' }));
        const cap = el('span', { class: 'm-cap' });
        cap.appendChild(el('span', { class: 'm-title', text: 'PHOTOGRAPHY' }));
        cap.appendChild(document.createTextNode(t.subtype ? (t.subtype.toUpperCase() + '  \u00B7  ' + t.title) : t.title));
        tile.appendChild(cap);

        const index = realTiles.indexOf(t);
        tile.addEventListener('click', function (e) {
          e.preventDefault();
          openLightbox(realTiles.map(function (x) {
            return { src: x.src, alt: x.alt, title: x.title, subcaption: 'PHOTOGRAPHY' };
          }), index);
        });
        photoMasonry.appendChild(tile);
      });
    }

    function applyView(sub) {
      // update tab button state
      Array.from(subSwitcher.querySelectorAll('.sub-tab')).forEach(function (btn) {
        const match = btn.getAttribute('data-sub') === sub;
        btn.classList.toggle('active', match);
        btn.setAttribute('aria-selected', match ? 'true' : 'false');
      });

      // swap the visible container and render
      if (sub === 'photo') {
        visualProjectGrid.hidden = true;
        photoMasonry.hidden = false;
        renderPhotoGallery();
      } else {
        photoMasonry.hidden = true;
        visualProjectGrid.hidden = false;
        renderProjectGrid(sub);
      }

      // keep URL in sync for sharing / deep links
      const url = new URL(window.location.href);
      url.searchParams.set('sub', sub);
      window.history.replaceState({}, '', url);
    }

    // wire up tab clicks
    Array.from(subSwitcher.querySelectorAll('.sub-tab')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const sub = btn.getAttribute('data-sub');
        if (VALID_SUBS.indexOf(sub) === -1) return;
        currentSub = sub;
        applyView(sub);
      });
    });

    fetchProjects().then(function (projects) {
      allVisual = projects.filter(function (p) { return p.category === 'visual'; });
      applyView(currentSub);
    }).catch(function (err) {
      console.error(err);
      visualProjectGrid.hidden = false;
      visualProjectGrid.innerHTML = '<p class="text-muted">Unable to load visual arts.</p>';
    });
  }

  // --- Lightbox -----------------------------------------------------------
  const lightbox = document.getElementById('lightbox');
  let lbItems = [];
  let lbIndex = 0;

  function openLightbox(items, index) {
    if (!lightbox || !items || !items.length) return;
    lbItems = items;
    lbIndex = Math.max(0, index || 0);
    showLightbox();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function showLightbox() {
    const img = document.getElementById('lightboxImg');
    const cap = document.getElementById('lightboxCaption');
    const cur = lbItems[lbIndex];
    if (!cur) return;
    img.src = cur.src;
    img.alt = cur.alt || cur.title || '';
    const leading = cur.subcaption
      ? cur.subcaption
      : (SUBCATEGORY_LABELS[cur.subcategory] || cur.subcategory || '').toUpperCase();
    const counter = lbItems.length > 1 ? (String(lbIndex + 1).padStart(2, '0') + ' / ' + String(lbItems.length).padStart(2, '0')) : '';
    cap.textContent = [leading, cur.title || '', counter].filter(Boolean).join('  \u00B7  ');
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.style.overflow = '';
  }
  function nextLightbox() {
    if (!lbItems.length) return;
    lbIndex = (lbIndex + 1) % lbItems.length;
    showLightbox();
  }
  function prevLightbox() {
    if (!lbItems.length) return;
    lbIndex = (lbIndex - 1 + lbItems.length) % lbItems.length;
    showLightbox();
  }
  if (lightbox) {
    const closeBtn = document.getElementById('lightboxClose');
    const prevBtn  = document.getElementById('lightboxPrev');
    const nextBtn  = document.getElementById('lightboxNext');
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn)  prevBtn.addEventListener('click', prevLightbox);
    if (nextBtn)  nextBtn.addEventListener('click', nextLightbox);
    lightbox.addEventListener('click', function (e) {
      // Click on the dim backdrop closes; clicks on figure/buttons do not.
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') nextLightbox();
      else if (e.key === 'ArrowLeft')  prevLightbox();
    });
  }

  // =========================================================================
  //  PROJECT DETAIL (with case study template support)
  // =========================================================================
  if (document.body.getAttribute('data-page') === 'project') {
    const id = getQueryParam('id');

    fetchProjects().then(function (projects) {
      const project = projects.find(function (p) { return p.id === id; });
      if (!project) {
        document.getElementById('projectTitle').textContent = 'Project not found';
        const pd = document.getElementById('projectDescription');
        if (pd) pd.textContent = 'This project does not exist yet, or its id is mistyped.';
        return;
      }

      document.getElementById('pageTitle').textContent = project.title + ' \u2014 Jermaine Johnson';
      document.getElementById('projectTitle').textContent = project.title;

      // Category/track label for the eyebrow
      const trackLabel = TRACK_LABELS[project.category] || project.category;
      const subLabel = project.subcategory ? (SUBCATEGORY_LABELS[project.subcategory] || project.subcategory) : '';
      document.getElementById('projectCategory').textContent = subLabel
        ? trackLabel + ' \u00B7 ' + subLabel
        : trackLabel;

      // Standard overview panels
      document.getElementById('projectDescription').textContent = project.description || project.summary || '';
      document.getElementById('projectRole').textContent = project.role || '\u2014';
      document.getElementById('projectTools').textContent = (project.tools || []).join(', ') || '\u2014';
      document.getElementById('projectYear').textContent = project.year || '\u2014';

      // Methodology (research track)
      const methWrap = document.getElementById('projectMethodologyWrap');
      if (methWrap) {
        if (project.methodology) {
          methWrap.hidden = false;
          document.getElementById('projectMethodology').textContent = project.methodology;
        } else {
          methWrap.hidden = true;
        }
      }

      // Meta row
      const metaRow = document.getElementById('projectMetaRow');
      metaRow.innerHTML = '';
      const typeValue = project.subcategory
        ? (SUBCATEGORY_LABELS[project.subcategory] || project.subcategory)
        : (project.type || '');
      const metas = [
        { label: 'TRACK', value: trackLabel.toUpperCase() },
        { label: 'TYPE',  value: (typeValue || '\u2014').toUpperCase() },
        { label: 'YEAR',  value: project.year || '\u2014' }
      ];
      if (project.venue) metas.push({ label: 'VENUE', value: project.venue });
      metas.forEach(function (m) {
        const s = el('span', {});
        s.innerHTML = '<strong>' + m.label + '</strong>' + m.value;
        metaRow.appendChild(s);
      });

      // Back link points at the parent track page
      const back = document.getElementById('backLink');
      if (back) back.href = TRACK_PAGES[project.category] || 'index.html';

      // Collected list of this project's images for the lightbox
      const projectLb = [];
      const projectSubcap = (SUBCATEGORY_LABELS[project.subcategory] || (TRACK_LABELS[project.category] || '')).toUpperCase();
      function pushLb(src, alt, title) {
        if (!src) return -1;
        projectLb.push({ src: src, alt: alt || project.title, title: title || project.title, subcaption: projectSubcap });
        return projectLb.length - 1;
      }
      function wireLightbox(target, myIdx) {
        if (!target || myIdx < 0) return;
        target.style.cursor = 'zoom-in';
        target.addEventListener('click', function (e) {
          e.preventDefault();
          openLightbox(projectLb, myIdx);
        });
      }

      // Hero image (used for both layouts)
      const heroImg = document.getElementById('projectHeroImg');
      const heroFigure = document.getElementById('projectHero');
      if (project.embed) {
        // Embed an interactive piece directly in the hero frame
        heroImg.remove();
        if (heroFigure) {
          const iframe = el('iframe', {
            src: project.embed,
            title: project.title,
            allowfullscreen: '',
            loading: 'lazy'
          });
          heroFigure.appendChild(iframe);
        }
      } else if (project.cover) {
        heroImg.src = project.cover;
        heroImg.alt = project.title;
        const heroIdx = pushLb(project.cover, project.title, project.title);
        wireLightbox(heroFigure, heroIdx);
      } else {
        heroImg.remove();
        if (heroFigure) {
          heroFigure.style.background = 'repeating-linear-gradient(135deg, var(--bg-surface) 0 24px, var(--bg-elevated) 24px 48px)';
          heroFigure.style.display = 'flex';
          heroFigure.style.alignItems = 'center';
          heroFigure.style.justifyContent = 'center';
          heroFigure.appendChild(el('span', { class: 'placeholder-mark', text: 'NO MEDIA YET' }));
        }
      }
      if (!project.embed && heroFigure) {
        heroFigure.setAttribute('data-img-bind', project.id + ':cover');
      }

      // --- Phases layout (game showcase) ---
      const caseStudyEl = document.getElementById('caseStudy');
      const standardBody = document.getElementById('projectBody');
      const standardMedia = document.getElementById('projectMedia');
      const hasPhases = project.phases && project.phases.length;

      if (hasPhases) {
        if (standardBody) standardBody.hidden = true;
        if (standardMedia) standardMedia.hidden = true;
        if (caseStudyEl) caseStudyEl.hidden = true;
        projectLb.length = 0;

        // Game hero banner
        const gameHero = el('figure', { class: 'game-hero', 'data-img-bind': project.id + ':cover' });
        gameHero.appendChild(el('img', { src: project.cover, alt: project.title }));
        const projectArticle = document.querySelector('.project-detail .container');
        const backLink = document.getElementById('backLink');
        if (projectArticle && backLink) {
          projectArticle.insertBefore(gameHero, backLink.nextSibling.nextSibling);
        }

        const phasesWrap = el('div', { class: 'game-phases' });

        project.phases.forEach(function (phase, pi) {
          const bindBase = project.id + ':phases.' + pi;
          const section = el('section', { class: 'game-phase' });

          const header = el('div', { class: 'game-phase-header' });
          if (phase.eyebrow) header.appendChild(el('span', { class: 'eyebrow', text: phase.eyebrow, 'data-bind': bindBase + '.eyebrow' }));
          header.appendChild(el('h2', { text: phase.title, 'data-bind': bindBase + '.title' }));
          if (phase.description) header.appendChild(el('p', { text: phase.description, 'data-bind': bindBase + '.description' }));
          section.appendChild(header);

          const grid = el('div', { class: 'phase-media-grid' });

          (phase.items || []).forEach(function (item, ii) {
            const itemBind = bindBase + '.items.' + ii;
            const isVideo = item.type === 'video';
            const wrapper = el('div', { class: 'phase-media-item' + (isVideo ? ' full-width' : '') });
            const fig = el('figure', { 'data-img-bind': itemBind + '.src' });

            if (isVideo) {
              const vid = document.createElement('video');
              vid.src = item.src;
              vid.setAttribute('controls', '');
              vid.setAttribute('playsinline', '');
              vid.setAttribute('preload', 'metadata');
              fig.appendChild(vid);
            } else {
              const img = el('img', { src: item.src, alt: item.caption || project.title, loading: 'lazy' });
              const idx = pushLb(item.src, item.caption || project.title, item.caption || project.title);
              fig.appendChild(img);
              wireLightbox(fig, idx);
            }

            if (item.caption) {
              fig.appendChild(el('figcaption', { text: item.caption, 'data-bind': itemBind + '.caption' }));
            }
            wrapper.appendChild(fig);
            grid.appendChild(wrapper);
          });

          section.appendChild(grid);
          phasesWrap.appendChild(section);
        });

        const insertAfter = standardMedia || caseStudyEl;
        if (insertAfter && insertAfter.parentNode) {
          insertAfter.parentNode.insertBefore(phasesWrap, insertAfter);
        }
      }

      // --- Case study timeline (if present) ---
      const hasCaseStudy = !hasPhases && project.caseStudy && project.caseStudy.timeline && project.caseStudy.timeline.length;

      if (hasCaseStudy && caseStudyEl) {
        // Hide the standard hero/media layout so the case study is the star
        if (standardBody) standardBody.hidden = true;
        if (standardMedia) standardMedia.hidden = true;
        projectLb.length = 0; // reset: case study drives its own image sequence

        const outcome = project.caseStudy.outcome || {};
        const outcomeImg = document.getElementById('caseOutcomeImg');
        const outcomeFig = outcomeImg ? outcomeImg.parentElement : null;
        if (outcome.image && outcomeImg) {
          outcomeImg.src = outcome.image;
          outcomeImg.alt = outcome.title || project.title;
          const idx = pushLb(outcome.image, outcome.title || project.title, outcome.title || 'Final Outcome');
          wireLightbox(outcomeFig, idx);
        } else if (outcomeImg) {
          outcomeImg.remove();
        }
        if (outcomeFig) outcomeFig.setAttribute('data-img-bind', project.id + ':caseStudy.outcome.image');
        document.getElementById('caseOutcomeTitle').textContent = outcome.title || 'Final Outcome';
        document.getElementById('caseOutcomeBody').textContent  = outcome.text  || project.description || '';

        const timelineEl = document.getElementById('caseTimeline');
        timelineEl.innerHTML = '';
        project.caseStudy.timeline.forEach(function (entry, ti) {
          const tlBind = project.id + ':caseStudy.timeline.' + ti;
          const item = el('li', { class: 'timeline-item' });

          const media = el('figure', { class: 'timeline-media', 'data-img-bind': tlBind + '.image' });
          if (entry.image) {
            media.appendChild(el('img', { src: entry.image, alt: entry.title || '', loading: 'lazy' }));
            const idx = pushLb(entry.image, entry.title || '', (entry.step ? 'STEP ' + entry.step + '  \u00B7  ' : '') + (entry.title || ''));
            wireLightbox(media, idx);
          } else {
            media.style.background = 'repeating-linear-gradient(135deg, var(--bg-surface) 0 18px, var(--bg-elevated) 18px 36px)';
          }
          item.appendChild(media);

          const textWrap = el('div', { class: 'timeline-text' });
          textWrap.appendChild(el('span', { class: 'step', text: 'STEP ' + (entry.step || '') }));
          textWrap.appendChild(el('h4', { class: 't-title', text: entry.title || '', 'data-bind': tlBind + '.title' }));
          if (entry.text) textWrap.appendChild(el('p', { class: 't-body', text: entry.text, 'data-bind': tlBind + '.text' }));
          item.appendChild(textWrap);

          timelineEl.appendChild(item);
        });

        caseStudyEl.hidden = false;
      } else {
        // Populate standard media grid from project.media
        if (standardMedia) {
          (project.media || []).forEach(function (m, mi) {
            if (!m.src) return;
            const mBind = project.id + ':media.' + mi;
            if (m.type === 'video') {
              const fig = el('figure', { class: 'media-video', 'data-img-bind': mBind + '.src' });
              const vid = document.createElement('video');
              vid.src = m.src;
              vid.setAttribute('controls', '');
              vid.setAttribute('playsinline', '');
              vid.setAttribute('preload', 'metadata');
              fig.appendChild(vid);
              if (m.alt || m.caption) fig.appendChild(el('figcaption', { text: m.alt || m.caption, 'data-bind': mBind + '.alt' }));
              standardMedia.appendChild(fig);
            } else if (m.type === 'image') {
              const fig = el('figure', { 'data-img-bind': mBind + '.src' }, [el('img', { src: m.src, alt: m.alt || project.title, loading: 'lazy' })]);
              const isDuplicateCover = (m.src === project.cover) && projectLb.length && projectLb[0].src === project.cover;
              const idx = isDuplicateCover ? 0 : pushLb(m.src, m.alt || project.title, m.alt || project.title);
              wireLightbox(fig, idx);
              standardMedia.appendChild(fig);
            }
          });
        }
      }

      // Next project (within same track)
      const pool = projects.filter(function (p) { return p.category === project.category && p.id !== project.id; });
      if (pool.length) {
        const next = pool[0];
        const wrap = document.getElementById('nextProject');
        wrap.hidden = false;
        const link = document.getElementById('nextProjectLink');
        link.href = 'project.html?id=' + encodeURIComponent(next.id);
        document.getElementById('nextProjectTitle').textContent = next.title;
      }
    }).catch(function (err) {
      console.error(err);
      document.getElementById('projectTitle').textContent = 'Error loading project';
    });
  }

})();
