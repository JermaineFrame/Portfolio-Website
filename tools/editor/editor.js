/* =========================================================================
   Portfolio WYSIWYG editor — runs only when served by tools/editor-server.mjs
   (which injects this module and sets window.__EDIT__). Provides:
     • inline text editing of static HTML  ([data-edit-id])
     • inline editing of project fields     ([data-bind="id:field"])
     • a projects panel: add / edit / delete / drag-reorder
     • image upload by dropping/clicking placeholder panes
   Edits are written back to real files via the server's POST endpoints.
   ========================================================================= */

(() => {
  'use strict';
  if (!window.__EDIT__) return;

  // ---- tiny hyperscript --------------------------------------------------
  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return node;
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---- state -------------------------------------------------------------
  const state = {
    editing: true,
    projects: [],
    byId: {},
    textEdits: {},     // editId -> innerHTML  (pending static-text edits)
    dataDirty: false,
    needsReload: false
  };
  function reindex() {
    state.byId = {};
    state.projects.forEach((p) => { state.byId[p.id] = p; });
  }
  function pageFile() {
    let p = location.pathname.split('/').pop();
    return !p ? 'index.html' : p;
  }
  const isDirty = () => Object.keys(state.textEdits).length > 0 || state.dataDirty;

  // ---- server calls ------------------------------------------------------
  async function api(path, payload) {
    const r = await fetch('/__editor__/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }
  async function uploadFile(file, dir) {
    const dataBase64 = await fileToDataURL(file);
    const j = await api('upload-image', { name: file.name, dataBase64, dir });
    return j.path;
  }
  async function saveAll() {
    const ids = Object.keys(state.textEdits);
    for (const editId of ids) {
      await api('save-text', { file: pageFile(), editId, html: state.textEdits[editId] });
      delete state.textEdits[editId];
    }
    if (state.dataDirty) {
      await api('save-data', { projects: state.projects });
      state.dataDirty = false;
    }
  }

  // ---- toast & status ----------------------------------------------------
  let toastEl;
  function toast(msg, isErr) {
    if (!toastEl) { toastEl = h('div', { class: 'jj-ed-toast' }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = 'jj-ed-toast show' + (isErr ? ' jj-ed-toast--err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.className = 'jj-ed-toast'; }, 2600);
  }
  function setStatus(text, kind) {
    if (!els.status) return;
    els.status.textContent = text;
    els.status.className = 'jj-ed-status' + (kind ? ' jj-ed-status--' + kind : '');
  }
  function refreshStatus() {
    if (isDirty()) setStatus('Unsaved changes', 'dirty');
    else setStatus('All saved', 'good');
    if (els.save) els.save.disabled = !isDirty();
  }
  function markText(editId, html) { state.textEdits[editId] = html; refreshStatus(); }
  function markData() { state.dataDirty = true; refreshStatus(); }

  // ---- inline editing wiring --------------------------------------------
  function plainPaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  function wireStatic(el) {
    if (el.dataset.jjWired) return;
    el.dataset.jjWired = '1';
    el.dataset.jjOrig = el.innerHTML;
    el.addEventListener('paste', plainPaste);
    el.addEventListener('focusout', () => {
      const html = el.innerHTML;
      const editId = el.getAttribute('data-edit-id');
      if (html !== el.dataset.jjOrig) {
        markText(editId, html);
      } else if (state.textEdits[editId] !== undefined) {
        delete state.textEdits[editId];
        refreshStatus();
      }
    });
  }

  function wireBind(el, single) {
    if (el.dataset.jjWired) return;
    el.dataset.jjWired = '1';
    el.addEventListener('paste', plainPaste);
    if (single) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('focusout', () => {
      const bind = el.getAttribute('data-bind') || '';
      const sep = bind.indexOf(':');
      const id = bind.slice(0, sep);
      const field = bind.slice(sep + 1);          // may be a dotted path, e.g. phases.0.title
      const proj = state.byId[id];
      if (!proj || !field) return;
      const val = field === 'tools' || field === 'tags'
        ? el.textContent.split(',').map((s) => s.trim()).filter(Boolean)
        : el.textContent.trim();
      const before = JSON.stringify(getDeep(proj, field) || '');
      setDeep(proj, field, val);
      if (JSON.stringify(val) !== before) markData();
    });
  }

  // Project-detail page: wire the fixed-id elements to the project's fields.
  function wireProjectDetail() {
    if (pageFile() !== 'project.html') return;
    const id = new URLSearchParams(location.search).get('id');
    if (!id || !state.byId[id]) return;
    const map = [
      ['#projectTitle', 'title', true], ['#projectDescription', 'description'],
      ['#projectRole', 'role', true], ['#projectYear', 'year', true],
      ['#projectTools', 'tools', true], ['#projectMethodology', 'methodology'],
      ['#caseOutcomeBody', 'caseStudy.outcome.text'], ['#caseOutcomeTitle', 'caseStudy.outcome.title', true]
    ];
    for (const [sel, field, single] of map) {
      const el = $(sel);
      if (!el || el.dataset.jjWired) continue;
      el.setAttribute('data-bind-detail', field);
      el.dataset.jjWired = '1';
      el.addEventListener('paste', plainPaste);
      if (single) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
      el.addEventListener('focusout', () => {
        const proj = state.byId[id];
        const val = field === 'tools'
          ? el.textContent.split(',').map((s) => s.trim()).filter(Boolean)
          : el.textContent.trim();
        setDeep(proj, field, val);
        markData();
      });
      if (state.editing) el.contentEditable = 'true';
    }
  }
  function setDeep(obj, dotted, val) {
    const keys = dotted.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) { o[keys[i]] = o[keys[i]] || {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = val;
  }
  function getDeep(obj, dotted) {
    return dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }

  // ---- image swap (any [data-img-bind] container) -------------------------
  // The bind is "<projectId>:<dotted.path>" pointing at the src/image field.
  // media[] and phase items[] slots also accept video; their sibling `type`
  // field is kept in sync with what was uploaded.
  function allowsVideo(path) {
    return /(^|\.)(media|items)\.\d+\.src$/.test(path);
  }
  function wireImgSwap(el) {
    if (el.dataset.jjImgWired) return;
    el.dataset.jjImgWired = '1';
    el.classList.add('jj-ed-dropzone');
    const bind = el.getAttribute('data-img-bind') || '';
    const path = bind.slice(bind.indexOf(':') + 1);
    const video = allowsVideo(path);
    const hint = h('span', { class: 'jj-ed-drop-hint', text: video ? 'Drop image/video · or click' : 'Drop image · or click' });
    // Lightbox-able images get an expand chip: clicking it falls through to
    // the page's own lightbox handler so captions can be edited in-place.
    if (el.querySelector('img') && (el.closest('.project-detail') || el.classList.contains('masonry-item'))) {
      hint.appendChild(h('button', { class: 'jj-ed-expand', type: 'button', title: 'Open lightbox (edit caption there)' }, '⤢ Expand'));
    }
    el.appendChild(hint);

    const pick = () => {
      const input = h('input', { type: 'file', accept: video ? 'image/*,video/*' : 'image/*', class: 'jj-ed-fileinput' });
      input.addEventListener('change', () => { if (input.files[0]) handleSwap(el, input.files[0]); });
      document.body.appendChild(input);
      input.click();
      setTimeout(() => input.remove(), 0);
    };
    // Capture phase so we beat the lightbox / card-link handlers main.js
    // attached earlier on the same element.
    el.addEventListener('click', (e) => {
      if (!state.editing) return;
      if (e.target.closest && e.target.closest('[data-bind],[data-edit-id],figcaption')) return; // let captions be text-edited
      if (e.target.closest && e.target.closest('.jj-ed-expand')) return; // fall through to the lightbox
      e.preventDefault();
      e.stopImmediatePropagation();
      pick();
    }, true);
    el.addEventListener('dragover', (e) => { if (!state.editing) return; e.preventDefault(); el.classList.add('jj-ed-dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('jj-ed-dragover'));
    el.addEventListener('drop', (e) => {
      if (!state.editing) return;
      e.preventDefault(); e.stopImmediatePropagation(); el.classList.remove('jj-ed-dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleSwap(el, file);
    }, true);
  }
  async function handleSwap(el, file) {
    const bind = el.getAttribute('data-img-bind') || '';
    const sep = bind.indexOf(':');
    const id = bind.slice(0, sep);
    const path = bind.slice(sep + 1);
    const proj = state.byId[id];
    if (!proj || !path) { toast('Could not link this pane to a project', true); return; }

    const isVideo = /^video\//.test(file.type);
    const isImage = /^image\//.test(file.type);
    const video = allowsVideo(path);
    if (!isImage && !(isVideo && video)) {
      toast(video ? 'Please choose an image or video file' : 'Please choose an image file', true);
      return;
    }
    try {
      setStatus('Uploading…');
      const newSrc = await uploadFile(file, 'uploads/' + id);
      setDeep(proj, path, newSrc);
      // keep the media/phase item's type in sync with the uploaded kind
      if (video) {
        const item = getDeep(proj, path.replace(/\.src$/, ''));
        if (item && typeof item === 'object') item.type = isVideo ? 'video' : 'image';
      }
      // first image on an empty project also seeds the media gallery
      if (path === 'cover' && Array.isArray(proj.media) && proj.media.length === 0) {
        proj.media.push({ type: 'image', src: newSrc, alt: proj.title });
      }
      markData();

      // instant visual feedback where we can; reload on Save otherwise
      const img = el.querySelector('img');
      const vid = el.querySelector('video');
      if (isVideo && vid) {
        vid.src = newSrc;
      } else if (isImage && img) {
        img.src = newSrc;
      } else if (isImage && !img && !vid) {
        el.querySelectorAll('.placeholder-mark').forEach((n) => n.remove());
        el.classList.remove('placeholder', 'is-placeholder');
        el.insertBefore(h('img', { src: newSrc, alt: proj.title }), el.firstChild);
      } else {
        state.needsReload = true; // image<->video swap: layout differs, rebuild on Save
      }
      toast('Uploaded — press Save to keep it');
      refreshStatus();
    } catch (err) {
      toast('Upload failed: ' + err.message, true);
      refreshStatus();
    }
  }

  // ---- scan & (re)wire the page -----------------------------------------
  function scan() {
    $$('[data-edit-id]').forEach(wireStatic);
    $$('[data-bind]').forEach((el) => wireBind(el, /(:|\.)(title|year|role|eyebrow|caption|alt)$/.test(el.getAttribute('data-bind') || '')));
    wireProjectDetail();
    $$('[data-img-bind]').forEach(wireImgSwap);
    if (state.editing) applyEditing();
  }
  function applyEditing() {
    document.body.classList.toggle('jj-editing', state.editing);
    $$('[data-edit-id],[data-bind],[data-bind-detail]').forEach((el) => {
      el.contentEditable = state.editing ? 'true' : 'false';
    });
  }

  // While editing, intercept clicks on project cards and editable links so they
  // don't navigate. Real site navigation (nav bar, footer, CTAs) still works.
  document.addEventListener('click', (e) => {
    if (!state.editing) return;
    const t = e.target;
    if (!t.closest) return;
    if (t.closest('.jj-ed-panel') || t.closest('.jj-ed-bar') || t.closest('.jj-ed-toast')) return;
    const a = t.closest('a');
    if (!a) return;
    const isCard = /[?&]id=/.test(a.getAttribute('href') || '');
    const isEditableHit = (a.isContentEditable) ||
      (t.closest('[contenteditable="true"]')) || (t.closest('.jj-ed-dropzone'));
    if (isCard || isEditableHit) e.preventDefault();
  }, true);

  // ---- toolbar -----------------------------------------------------------
  const els = {};
  function buildToolbar() {
    els.toggle = h('button', { class: 'jj-ed-btn', onClick: toggleEditing }, 'Preview');
    els.projects = h('button', { class: 'jj-ed-btn', onClick: openPanel }, 'Projects');
    els.save = h('button', { class: 'jj-ed-btn jj-ed-btn--primary', onClick: onSave }, 'Save');
    els.status = h('span', { class: 'jj-ed-status' });
    const bar = h('div', { class: 'jj-ed-bar' },
      h('span', { class: 'jj-ed-bar__brand' }, h('span', { class: 'jj-ed-bar__dot' }), 'Editor'),
      els.toggle, els.projects, els.save, els.status
    );
    document.body.appendChild(bar);
    refreshStatus();
  }
  function toggleEditing() {
    state.editing = !state.editing;
    els.toggle.textContent = state.editing ? 'Preview' : 'Edit';
    applyEditing();
  }
  async function onSave() {
    if (!isDirty()) return;
    try {
      setStatus('Saving…');
      const reload = state.needsReload;
      await saveAll();
      if (reload) { location.reload(); return; }
      setStatus('All saved', 'good');
      els.save.disabled = true;
      toast('Saved to disk');
    } catch (err) {
      setStatus('Save failed', 'err');
      toast('Save failed: ' + err.message, true);
    }
  }

  // ---- projects panel ----------------------------------------------------
  const CATS = { research: 'Research', interactive: 'Interactive', visual: 'Visual Arts' };
  const SUBS = { graphic: 'Graphic Design', '3d': '3D Modeling', photo: 'Photography' };
  let panelEl, panelBody;

  function openPanel() { ensurePanel(); panelEl.classList.add('open'); renderList(); }
  function closePanel() { if (panelEl) panelEl.classList.remove('open'); }

  function ensurePanel() {
    if (panelEl) return;
    panelBody = h('div', { class: 'jj-ed-panel__body' });
    panelEl = h('div', { class: 'jj-ed-panel' },
      h('div', { class: 'jj-ed-panel__head' },
        h('h2', {}, 'Projects'),
        h('button', { class: 'jj-ed-close', onClick: closePanel, title: 'Close' }, '×')
      ),
      panelBody
    );
    document.body.appendChild(panelEl);
  }

  function slugify(s) {
    return (s || 'project').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'project';
  }
  function uniqueId(base) {
    let id = base, n = 2;
    while (state.byId[id]) { id = base + '-' + n; n++; }
    return id;
  }

  function renderList() {
    panelBody.innerHTML = '';
    panelBody.appendChild(h('button', { class: 'jj-ed-btn jj-ed-btn--primary', style: { width: '100%', justifyContent: 'center' }, onClick: () => openForm(null) }, '+ Add project'));
    panelBody.appendChild(h('p', { class: 'jj-ed-hint' }, 'Drag the ⠿ handle to reorder. Changes apply when you press Save.'));

    const list = h('div', { class: 'jj-ed-list' });
    state.projects.forEach((p, idx) => list.appendChild(projectRow(p, idx)));
    panelBody.appendChild(list);

    panelBody.appendChild(h('div', { class: 'jj-ed-form__actions' },
      h('button', { class: 'jj-ed-btn jj-ed-btn--primary', onClick: onSave }, 'Save changes'),
      h('button', { class: 'jj-ed-btn', onClick: closePanel }, 'Close')
    ));
  }

  function projectRow(p, idx) {
    const row = h('div', { class: 'jj-ed-row', draggable: 'true', dataset: { idx: String(idx) } },
      h('span', { class: 'jj-ed-handle', title: 'Drag to reorder' }, '⠿'),
      h('span', { class: 'jj-ed-row__title' }, p.title || '(untitled)',
        h('small', {}, (CATS[p.category] || p.category || '') + (p.subcategory ? ' · ' + (SUBS[p.subcategory] || p.subcategory) : ''))),
      h('button', { class: 'jj-ed-iconbtn', title: 'Edit', onClick: () => openForm(p) }, 'Edit'),
      h('button', { class: 'jj-ed-iconbtn jj-ed-iconbtn--danger', title: 'Delete', onClick: () => deleteProject(p) }, 'Delete')
    );
    wireRowDrag(row);
    return row;
  }

  let dragFromIdx = null;
  function wireRowDrag(row) {
    row.addEventListener('dragstart', (e) => {
      dragFromIdx = Number(row.dataset.idx);
      row.classList.add('jj-ed-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('jj-ed-dragging');
      $$('.jj-ed-row').forEach((r) => r.classList.remove('jj-ed-drop-before', 'jj-ed-drop-after'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const before = (e.clientY - row.getBoundingClientRect().top) < row.offsetHeight / 2;
      row.classList.toggle('jj-ed-drop-before', before);
      row.classList.toggle('jj-ed-drop-after', !before);
    });
    row.addEventListener('dragleave', () => row.classList.remove('jj-ed-drop-before', 'jj-ed-drop-after'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const to = Number(row.dataset.idx);
      const before = row.classList.contains('jj-ed-drop-before');
      moveProject(dragFromIdx, before ? to : to + 1);
    });
  }
  function moveProject(from, to) {
    if (from == null || from === to) return;
    const arr = state.projects;
    const [item] = arr.splice(from, 1);
    if (from < to) to--;
    arr.splice(to, 0, item);
    markData();
    state.needsReload = true;
    renderList();
  }
  function deleteProject(p) {
    if (!confirm('Delete “' + (p.title || p.id) + '”? This removes it from projects.json on the next Save.')) return;
    state.projects = state.projects.filter((x) => x !== p);
    reindex();
    markData();
    state.needsReload = true;
    renderList();
  }

  // ---- project form ------------------------------------------------------
  function field(label, control, hint) {
    return h('div', {}, h('label', {}, label), control, hint ? h('p', { class: 'jj-ed-hint' }, hint) : null);
  }
  function input(value, attrs) { return h('input', Object.assign({ type: 'text', value: value == null ? '' : value }, attrs || {})); }
  function textarea(value) { const t = h('textarea', {}); t.value = value || ''; return t; }
  function selectEl(opts, value) {
    return h('select', {}, [h('option', { value: '' }, '—')].concat(
      Object.entries(opts).map(([v, l]) => h('option', value === v ? { value: v, selected: '' } : { value: v }, l))));
  }

  function openForm(existing) {
    ensurePanel();
    const isNew = !existing;
    const p = existing || {};
    const f = {};

    f.title = input(p.title);
    f.category = selectEl(CATS, p.category || 'visual');
    f.subcategory = selectEl(SUBS, p.subcategory);
    f.type = input(p.type, { placeholder: 'e.g. publication, simulation, prop' });
    f.subtype = input(p.subtype);
    f.year = input(p.year);
    f.role = input(p.role);
    f.venue = input(p.venue, { placeholder: 'research only (optional)' });
    f.link = input(p.link, { placeholder: 'external URL (optional)' });
    f.summary = textarea(p.summary);
    f.description = textarea(p.description);
    f.methodology = textarea(p.methodology);
    f.tools = input((p.tools || []).join(', '), { placeholder: 'comma separated' });
    f.tags = input((p.tags || []).join(', '), { placeholder: 'comma separated' });
    f.featured = h('input', Object.assign({ type: 'checkbox' }, p.featured ? { checked: '' } : {}));

    // cover + media + phase-media thumbs
    const coverWrap = h('div', { class: 'jj-ed-thumbrow' });
    const mediaWrap = h('div', { class: 'jj-ed-thumbrow' });
    const phasesWrap = h('div', {});
    const draft = {
      cover: p.cover || '',
      media: (p.media || []).map((m) => Object.assign({}, m)),
      phases: JSON.parse(JSON.stringify(p.phases || []))
    };
    const uploadDir = 'uploads/' + (p.id || slugify(f.title.value || 'project'));

    function renderCover() {
      coverWrap.innerHTML = '';
      if (draft.cover) {
        coverWrap.appendChild(h('div', { class: 'jj-ed-thumb' },
          h('img', { src: draft.cover, alt: '' }),
          h('button', { title: 'Remove', onClick: () => { draft.cover = ''; renderCover(); } }, '×')));
      }
      coverWrap.appendChild(makeUpload(async (path) => { draft.cover = path; renderCover(); }, uploadDir));
    }
    function renderMedia() {
      mediaWrap.innerHTML = '';
      draft.media.forEach((m, i) => {
        mediaWrap.appendChild(mediaThumb(m, () => { draft.media.splice(i, 1); renderMedia(); }));
      });
      mediaWrap.appendChild(makeUpload(async (path, file) => {
        const type = file && /^video\//.test(file.type) ? 'video' : 'image';
        draft.media.push({ type: type, src: path, alt: f.title.value });
        renderMedia();
      }, uploadDir, 'image/*,video/*'));
    }
    function renderPhases() {
      phasesWrap.innerHTML = '';
      draft.phases.forEach((phase, pi) => {
        const row = h('div', { class: 'jj-ed-thumbrow' });
        (phase.items || []).forEach((item, ii) => {
          row.appendChild(mediaThumb(item, () => { phase.items.splice(ii, 1); renderPhases(); }));
        });
        row.appendChild(makeUpload(async (path, file) => {
          const type = file && /^video\//.test(file.type) ? 'video' : 'image';
          phase.items = phase.items || [];
          phase.items.push({ type: type, src: path, caption: '' });
          renderPhases();
        }, uploadDir, 'image/*,video/*'));
        phasesWrap.appendChild(h('div', {},
          h('label', {}, (phase.eyebrow || ('Phase ' + (pi + 1))) + ' — ' + (phase.title || '')),
          row,
          h('p', { class: 'jj-ed-hint' }, 'Captions are edited on the project page (click the caption, or ⤢ Expand an image).')));
      });
    }
    renderCover(); renderMedia(); renderPhases();

    const form = h('div', { class: 'jj-ed-form' },
      field('Title', f.title),
      field('Category', f.category),
      field('Subcategory (visual)', f.subcategory),
      field('Type', f.type),
      field('Subtype', f.subtype),
      field('Year', f.year),
      field('Role', f.role),
      field('Venue', f.venue),
      field('External link', f.link),
      field('Summary', f.summary),
      field('Description', f.description),
      field('Methodology', f.methodology),
      field('Tools', f.tools),
      field('Tags', f.tags),
      h('div', { class: 'jj-ed-check' }, f.featured, h('label', {}, 'Featured (shown on home grid)')),
      field('Cover image', coverWrap),
      field('Media gallery', mediaWrap),
      draft.phases.length ? field('Phase media (game showcase)', phasesWrap) : null,
      h('div', { class: 'jj-ed-form__actions' },
        h('button', { class: 'jj-ed-btn jj-ed-btn--primary', onClick: commit }, isNew ? 'Add project' : 'Apply'),
        h('button', { class: 'jj-ed-btn', onClick: renderList }, 'Cancel'))
    );

    function commit() {
      if (!f.title.value.trim()) { toast('Title is required', true); return; }
      const obj = existing || {};
      obj.id = obj.id || uniqueId(slugify(f.title.value));
      obj.title = f.title.value.trim();
      obj.category = f.category.value || 'visual';
      setOrDelete(obj, 'subcategory', f.subcategory.value);
      setOrDelete(obj, 'type', f.type.value.trim());
      setOrDelete(obj, 'subtype', f.subtype.value.trim());
      setOrDelete(obj, 'year', f.year.value.trim());
      setOrDelete(obj, 'role', f.role.value.trim());
      setOrDelete(obj, 'venue', f.venue.value.trim());
      setOrDelete(obj, 'link', f.link.value.trim());
      setOrDelete(obj, 'summary', f.summary.value.trim());
      setOrDelete(obj, 'description', f.description.value.trim());
      setOrDelete(obj, 'methodology', f.methodology.value.trim());
      obj.tools = csv(f.tools.value);
      obj.tags = csv(f.tags.value);
      obj.featured = f.featured.checked;
      obj.cover = draft.cover;
      obj.media = draft.media;
      if (draft.phases.length) obj.phases = draft.phases;
      if (isNew) state.projects.push(obj);
      reindex();
      markData();
      state.needsReload = true;
      renderList();
      toast(isNew ? 'Project added — press Save' : 'Updated — press Save');
    }

    panelBody.innerHTML = '';
    panelBody.appendChild(h('button', { class: 'jj-ed-btn', onClick: renderList }, '← Back to list'));
    panelBody.appendChild(form);
  }
  function makeUpload(onDone, dir, accept) {
    const btn = h('button', { class: 'jj-ed-addmedia', title: 'Upload' }, '+');
    btn.addEventListener('click', () => {
      const input = h('input', { type: 'file', accept: accept || 'image/*', class: 'jj-ed-fileinput' });
      input.addEventListener('change', async () => {
        if (!input.files[0]) return;
        try { btn.textContent = '…'; const path = await uploadFile(input.files[0], dir); await onDone(path, input.files[0]); }
        catch (err) { toast('Upload failed: ' + err.message, true); }
        finally { btn.textContent = '+'; input.remove(); }
      });
      document.body.appendChild(input); input.click();
    });
    return btn;
  }
  function mediaThumb(m, onRemove) {
    const isVideo = m.type === 'video';
    return h('div', { class: 'jj-ed-thumb', title: m.caption || m.alt || '' },
      isVideo ? h('video', { src: m.src, muted: '', preload: 'metadata' }) : h('img', { src: m.src, alt: m.alt || '' }),
      isVideo ? h('span', { class: 'jj-ed-thumb__kind', text: 'VID' }) : null,
      h('button', { title: 'Remove', onClick: onRemove }, '×'));
  }
  function csv(s) { return s.split(',').map((x) => x.trim()).filter(Boolean); }
  function setOrDelete(obj, key, val) { if (val) obj[key] = val; else delete obj[key]; }

  // ---- boot --------------------------------------------------------------
  async function boot() {
    try {
      const r = await fetch('data/projects.json', { cache: 'no-store' });
      const data = await r.json();
      state.projects = data.projects || [];
      reindex();
    } catch (err) {
      console.warn('[editor] could not load projects.json', err);
    }
    buildToolbar();
    scan();
    // main.js renders cards asynchronously — rewire as nodes appear
    const obs = new MutationObserver(() => { clearTimeout(boot._t); boot._t = setTimeout(scan, 60); });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
