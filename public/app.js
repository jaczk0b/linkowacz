// NewPlace – frontend (vanilla JS)
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const STATUSES = [
  { id: 'idea', label: 'Pomysł' },
  { id: 'short', label: 'Shortlista' },
  { id: 'buy', label: 'Do kupienia' },
  { id: 'bought', label: 'Kupione' },
];
// Style + sugerowane palety – do "nakierowywania" designu
const PALETTES = {
  'Skandynawski': ['#f4f1ec', '#d9d4cc', '#b9a58c', '#6f7d75', '#2f3433'],
  'Japandi': ['#ece6dc', '#cbbba6', '#8c7a66', '#5d6650', '#2e2a26'],
  'Minimalizm': ['#ffffff', '#ececea', '#bdbab5', '#6e6b67', '#1f1f1f'],
  'Nowoczesny': ['#f2f2f2', '#c9c9c9', '#3d4a5c', '#c08a5b', '#141414'],
  'Industrialny': ['#d6d2cc', '#8e8a85', '#5a4e45', '#a05a2c', '#222222'],
  'Loft': ['#e3ddd3', '#9c8f80', '#7b4a32', '#3c3c3c', '#1a1a1a'],
  'Boho': ['#f3e9dc', '#e0c29b', '#c47a4a', '#7f8b5a', '#4a3426'],
  'Klasyczny': ['#f7f3ea', '#e2d6c0', '#a8916c', '#3f4b5a', '#2a2420'],
  'Glamour': ['#f6efe9', '#d8c3b5', '#c9a24d', '#2f3b4c', '#111111'],
  'Rustykalny': ['#efe7da', '#cdb490', '#8f6b45', '#5c6b4a', '#3b2d22'],
  'Mid-century': ['#f1e8d8', '#e0a458', '#c0603a', '#2f6f6a', '#3b2f2a'],
  'Śródziemnomorski': ['#fbf7f0', '#e9dcc6', '#c96f4a', '#2f6fa3', '#1f3b57'],
  'Wabi-sabi': ['#eee8df', '#d3c7b6', '#a99883', '#6f6556', '#3a342d'],
  'Art déco': ['#f3ecde', '#c9a24d', '#1f5c4a', '#1e2b4a', '#111111'],
};
const STYLES = Object.keys(PALETTES);

const S = {
  db: null,
  me: store.get('me', 'p1'),
  tab: store.get('tab', 'rooms'),
  cat: store.get('cat', 'all'),
  status: 'all',
  author: 'all',
  inspCat: 'all',
  modalSubmit: null,
};

// ---------- API ----------
async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}
async function load() {
  S.db = await api('GET', '/api/state');
  if (!S.db.profiles.some((p) => p.id === S.me)) S.me = S.db.profiles[0].id;
  render();
}
async function create(col, data) {
  const it = await api('POST', `/api/${col}`, data);
  S.db[col].push(it);
  render();
  return it;
}
async function update(col, id, data, rerender = true) {
  const it = await api('PUT', `/api/${col}/${id}`, data);
  const arr = S.db[col];
  arr[arr.findIndex((x) => x.id === id)] = it;
  if (rerender) render();
  return it;
}
async function remove(col, id) {
  await api('DELETE', `/api/${col}/${id}`);
  S.db = await api('GET', '/api/state');
  render();
}

// ---------- helpers ----------
const prof = (id) => S.db.profiles.find((p) => p.id === id);
const catById = (id) => S.db.categories.find((c) => c.id === id);
const money = (n) => `${Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`;
const domain = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const normUrl = (u) => (u = u.trim(), /^https?:\/\//i.test(u) ? u : `https://${u}`);
const isEmptyDesign = (d) => !d || (!d.styles?.length && !d.palette?.length && !d.materials && !d.notes);

function avatar(id, cls = '') {
  const p = prof(id);
  if (!p) return '';
  return `<span class="av ${cls}" style="--c:${esc(p.color)}" title="${esc(p.name)}">${esc(p.name[0] || '?')}</span>`;
}
function likeBtn(col, item) {
  const likes = item.likes || [];
  const on = likes.includes(S.me);
  const who = likes.map((id) => avatar(id, 'sm')).join('');
  return `<button class="like ${on ? 'on' : ''}" data-act="like" data-col="${col}" data-id="${item.id}" title="${on ? 'Nie podoba mi się już' : 'Podoba mi się'}">${on ? '♥' : '♡'}</button><span class="likers">${who}</span>`;
}
function catOptions(selected, withEmpty = true) {
  return (withEmpty ? `<option value="">— bez pokoju —</option>` : '') +
    S.db.categories.map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('');
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2200);
}

// ---------- render ----------
function render() {
  if (!S.db) return;
  $('#profiles').innerHTML = S.db.profiles.map((p) =>
    `<button class="prof ${p.id === S.me ? 'on' : ''}" data-act="me" data-id="${p.id}" style="--c:${esc(p.color)}" title="Jestem: ${esc(p.name)}">
      <span class="av">${esc(p.name[0] || '?')}</span><span class="nm">${esc(p.name)}</span></button>`).join('');
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#view').innerHTML = S.tab === 'insp' ? viewInsp() : S.tab === 'design' ? viewDesign() : viewRooms();
}

function designStrip(design, catId) {
  if (isEmptyDesign(design)) {
    return `<button class="strip empty" data-act="goto-design">+ Ustal kierunek designu ${catId ? 'dla tego pokoju' : 'całego mieszkania'} – styl, kolory, materiały</button>`;
  }
  const sw = (design.palette || []).map((c) => `<span style="background:${esc(c)}"></span>`).join('');
  return `<div class="strip">
    <span class="lbl">Kierunek</span>
    ${(design.styles || []).map((s) => `<span class="chip on">${esc(s)}</span>`).join('')}
    ${sw ? `<span class="swatches">${sw}</span>` : ''}
    ${design.materials ? `<span class="txt" title="${esc(design.materials)}">${esc(design.materials)}</span>` : ''}
    <button class="btn ghost edit" data-act="goto-design">Edytuj</button>
  </div>`;
}

function viewRooms() {
  const { categories, links } = S.db;
  const cat = catById(S.cat);
  if (S.cat !== 'all' && !cat) S.cat = 'all';
  const inCat = links.filter((l) => S.cat === 'all' || l.categoryId === S.cat);
  let list = inCat;
  if (S.status !== 'all') list = list.filter((l) => l.status === S.status);
  if (S.author !== 'all') list = list.filter((l) => l.author === S.author);
  list = [...list].sort((a, b) => b.createdAt - a.createdAt);

  const sum = inCat.reduce((a, l) => a + (l.price || 0), 0);
  const bought = inCat.filter((l) => l.status === 'bought').reduce((a, l) => a + (l.price || 0), 0);
  const count = (id) => links.filter((l) => l.categoryId === id).length;

  const side = `<aside class="side">
    <div class="side-label">Pokoje</div>
    <button class="side-item ${S.cat === 'all' ? 'on' : ''}" data-act="cat" data-id="all"><span class="em">✦</span>Wszystko<span class="count">${links.length}</span></button>
    ${categories.map((c) => `<button class="side-item ${S.cat === c.id ? 'on' : ''}" data-act="cat" data-id="${c.id}"><span class="em">${esc(c.emoji)}</span>${esc(c.name)}<span class="count">${count(c.id)}</span></button>`).join('')}
    <button class="btn ghost" data-act="add-cat">+ Dodaj pokój</button>
  </aside>`;

  const head = `<div class="room-head">
    <div>
      <h1>${cat ? `${esc(cat.emoji)} ${esc(cat.name)}` : 'Wszystkie rzeczy'}</h1>
      <p class="sub">${inCat.length} ${inCat.length === 1 ? 'link' : 'linków'}${sum ? ` · razem ${money(sum)}` : ''}${bought ? ` · kupione ${money(bought)}` : ''}</p>
    </div>
    ${cat ? `<div class="actions">
      <button class="btn ghost" data-act="edit-cat" data-id="${cat.id}">Edytuj</button>
      <button class="btn ghost danger" data-act="del-cat" data-id="${cat.id}">Usuń</button></div>` : ''}
  </div>`;

  const filters = `<div class="filters">
    <button class="chip ${S.status === 'all' ? 'on' : ''}" data-act="f-status" data-id="all">Wszystkie</button>
    ${STATUSES.map((s) => `<button class="chip ${S.status === s.id ? 'on' : ''}" data-act="f-status" data-id="${s.id}">${s.label}</button>`).join('')}
    <span class="sep"></span>
    <button class="chip ${S.author === 'all' ? 'on' : ''}" data-act="f-author" data-id="all">Oboje</button>
    ${S.db.profiles.map((p) => `<button class="chip ${S.author === p.id ? 'on' : ''}" data-act="f-author" data-id="${p.id}">${avatar(p.id, 'sm')}${esc(p.name)}</button>`).join('')}
  </div>`;

  const grid = list.length
    ? `<div class="grid">${list.map(linkCard).join('')}</div>`
    : `<div class="empty-state"><b>${inCat.length ? 'Nic nie pasuje do filtrów' : 'Pusto tutaj'}</b>${inCat.length ? 'Zmień filtry powyżej.' : 'Wklej link do płytek, lustra, lampy… – zdjęcie i tytuł pobiorą się same.'}</div>`;

  return `<div class="rooms">${side}<section>
    ${head}
    ${designStrip(cat ? cat.design : S.db.design, cat?.id)}
    <form class="add-link" data-form="add-link">
      <input name="url" placeholder="Wklej link do produktu, np. płytki, lustro, bateria…" autocomplete="off" required>
      <button class="btn primary">Dodaj link</button>
    </form>
    ${filters}${grid}
  </section></div>`;
}

function linkCard(l) {
  const st = STATUSES.find((s) => s.id === l.status) || STATUSES[0];
  const c = catById(l.categoryId);
  const d = domain(l.url);
  return `<article class="card">
    <a class="thumb" href="${esc(l.url)}" target="_blank" rel="noopener">
      <span class="ph">${esc(d[0] || '?')}</span>
      ${l.image ? `<img src="${esc(l.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      ${st.id !== 'idea' ? `<span class="badge ${st.id}">${st.label}</span>` : ''}
    </a>
    <div class="body">
      <div class="meta">${avatar(l.author, 'sm')}<span>${esc(d)}</span>${S.cat === 'all' && c ? `<span>· ${esc(c.emoji)} ${esc(c.name)}</span>` : ''}</div>
      <h3><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title || d || l.url)}</a></h3>
      ${l.note ? `<p class="note">${esc(l.note)}</p>` : ''}
      <div class="foot">
        ${l.price != null ? `<span class="price">${money(l.price)}</span>` : ''}
        ${likeBtn('links', l)}
        <select data-act="status" data-id="${l.id}">${STATUSES.map((s) => `<option value="${s.id}" ${s.id === st.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
        <button class="icon" data-act="edit-link" data-id="${l.id}" title="Edytuj">✎</button>
      </div>
    </div>
  </article>`;
}

function viewInsp() {
  let list = S.db.inspirations;
  if (S.inspCat === 'both') list = list.filter((i) => S.db.profiles.every((p) => (i.likes || []).includes(p.id)));
  else if (S.inspCat !== 'all') list = list.filter((i) => i.categoryId === S.inspCat);
  list = [...list].sort((a, b) => b.createdAt - a.createdAt);
  const chip = (id, label) => `<button class="chip ${S.inspCat === id ? 'on' : ''}" data-act="f-insp" data-id="${id}">${label}</button>`;
  return `<div class="toolbar">
      <h1>Inspiracje</h1>
      <div class="chips">
        ${chip('all', 'Wszystkie')}
        ${chip('both', '♥ Podoba się obojgu')}
        ${S.db.categories.map((c) => chip(c.id, `${esc(c.emoji)} ${esc(c.name)}`)).join('')}
      </div>
      <button class="btn primary" data-act="add-insp">+ Dodaj inspirację</button>
    </div>
    ${list.length ? `<div class="masonry">${list.map(inspCard).join('')}</div>`
      : `<div class="empty-state"><b>Brak inspiracji</b>Dodaj zdjęcie z Pinteresta, Instagrama albo wrzuć screena (możesz też wkleić Ctrl+V w okienku dodawania).</div>`}`;
}

function inspCard(i) {
  const c = catById(i.categoryId);
  return `<figure class="insp">
    <a href="${esc(i.url || i.image)}" target="_blank" rel="noopener"><img src="${esc(i.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>
    <figcaption>
      ${i.note ? `<p class="note">${esc(i.note)}</p>` : ''}
      <div class="foot">
        ${avatar(i.author, 'sm')}
        ${c ? `<span class="tag">${esc(c.emoji)} ${esc(c.name)}</span>` : ''}
        ${likeBtn('inspirations', i)}
        <span class="tools">
          <button class="icon" data-act="edit-insp" data-id="${i.id}" title="Edytuj">✎</button>
          <button class="icon" data-act="del-insp" data-id="${i.id}" title="Usuń">🗑</button>
        </span>
      </div>
    </figcaption>
  </figure>`;
}

function designEditor(design, key, title) {
  const d = { styles: [], palette: [], materials: '', notes: '', ...design };
  const styles = [...new Set([...STYLES, ...d.styles])];
  const suggest = d.styles.find((s) => PALETTES[s]);
  return `<div class="de" data-key="${key}">
    <h2>${title}</h2>
    <div class="lbl">Styl</div>
    <div class="chips">
      ${styles.map((s) => `<button class="chip ${d.styles.includes(s) ? 'on' : ''}" data-act="style" data-style="${esc(s)}">${esc(s)}</button>`).join('')}
      <input data-input="style-add" placeholder="+ własny…">
    </div>
    <div class="lbl">Paleta kolorów
      ${suggest ? `<button class="btn" data-act="suggest" data-style="${esc(suggest)}" title="Dodaj paletę pasującą do stylu ${esc(suggest)}">✨ Podpowiedz z: ${esc(suggest)}</button>` : ''}
    </div>
    <div class="palette">
      ${d.palette.map((c, i) => `<button class="sw" style="background:${esc(c)}" data-act="color-rm" data-i="${i}" title="${esc(c)} – kliknij, aby usunąć"></button>`).join('')}
      <input type="color" data-input="color-add" value="#c8b8a6" title="Dodaj kolor">
    </div>
    <div class="cols">
      <label><div class="lbl">Materiały i wykończenia</div>
        <textarea data-field="materials" placeholder="np. dąb, trawertyn, mikrocement, czarne baterie">${esc(d.materials)}</textarea></label>
      <label><div class="lbl">Notatki · czego unikamy</div>
        <textarea data-field="notes" placeholder="np. bez połysku, dużo światła, ukryte schowki">${esc(d.notes)}</textarea></label>
    </div>
  </div>`;
}

function viewDesign() {
  const cards = S.db.categories.map((c) => {
    const imgs = S.db.inspirations.filter((i) => i.categoryId === c.id).slice(-8);
    return `<section class="dcard">${designEditor(c.design, c.id, `${esc(c.emoji)} ${esc(c.name)}`)}
      ${imgs.length ? `<div class="lbl">Inspiracje do tego pokoju</div><div class="mini-insp">${imgs.map((i) => `<img src="${esc(i.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>` : ''}
    </section>`;
  }).join('');
  return `<div class="design-head">
      <div><h1>Kierunek designu</h1>
      <p>Ustalcie razem styl, kolory i materiały – pokażą się przy każdym pokoju, żeby każdy nowy link było łatwo porównać z kierunkiem.</p></div>
      <button class="btn" data-act="copy-brief" title="Skopiuj opis do wklejenia projektantowi lub do AI">📋 Kopiuj brief</button>
    </div>
    <section class="dcard global">${designEditor(S.db.design, 'global', 'Całe mieszkanie')}</section>
    <div class="dgrid">${cards}</div>`;
}

// ---------- design ----------
function getDesign(key) {
  return key === 'global' ? S.db.design : catById(key).design;
}
async function saveDesign(key, patch, rerender = true) {
  const next = { styles: [], palette: [], materials: '', notes: '', ...getDesign(key), ...patch };
  if (key === 'global') {
    S.db.design = await api('PUT', '/api/design', next);
    if (rerender) render();
  } else {
    await update('categories', key, { design: next }, rerender);
  }
}
function briefText() {
  const block = (title, d) => {
    if (isEmptyDesign(d)) return '';
    const lines = [`## ${title}`];
    if (d.styles?.length) lines.push(`Styl: ${d.styles.join(', ')}`);
    if (d.palette?.length) lines.push(`Paleta: ${d.palette.join(', ')}`);
    if (d.materials) lines.push(`Materiały: ${d.materials}`);
    if (d.notes) lines.push(`Uwagi: ${d.notes}`);
    return lines.join('\n');
  };
  const parts = [block('Całe mieszkanie', S.db.design)];
  for (const c of S.db.categories) {
    let b = block(c.name, c.design);
    const liked = S.db.links.filter((l) => l.categoryId === c.id && (l.likes || []).length);
    if (liked.length) b = (b || `## ${c.name}`) + `\nWybrane rzeczy:\n` + liked.map((l) => `- ${l.title || l.url} (${l.url})`).join('\n');
    parts.push(b);
  }
  return `# Brief remontu\n\n${parts.filter(Boolean).join('\n\n')}`;
}

// ---------- modals ----------
function openModal(html, onSubmit) {
  const m = $('#modal');
  m.innerHTML = `<form data-form="modal">${html}</form>`;
  m.hidden = false;
  S.modalSubmit = onSubmit;
  setTimeout(() => m.querySelector('input:not([type=file]):not([type=hidden]), textarea')?.focus(), 30);
}
function closeModal() {
  $('#modal').hidden = true;
  $('#modal').innerHTML = '';
  S.modalSubmit = null;
}
const modalBtns = (extra = '') => `<div class="btns">${extra}<span style="flex:1"></span><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn primary">Zapisz</button></div>`;

function linkModal(l, isNew) {
  openModal(`
    <h2>${isNew ? 'Nowy link' : 'Edytuj link'}</h2>
    ${l.image ? `<img class="prev" src="${esc(l.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
    <label>Nazwa<input name="title" value="${esc(l.title)}" placeholder="np. Płytki Calacatta 60×120"></label>
    <label>Link<input name="url" value="${esc(l.url)}" required></label>
    <div class="row">
      <label>Pokój<select name="categoryId">${catOptions(l.categoryId)}</select></label>
      <label>Status<select name="status">${STATUSES.map((s) => `<option value="${s.id}" ${s.id === l.status ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
    </div>
    <div class="row">
      <label>Cena (zł)<input name="price" value="${esc(l.price ?? '')}" inputmode="decimal" placeholder="np. 189,99"></label>
      <label>Zdjęcie (URL)<input name="image" value="${esc(l.image)}" placeholder="https://…"></label>
    </div>
    <label>Notatka<textarea name="note" placeholder="np. potrzebne 12 m², kolor 'sand', sprawdzić w sklepie">${esc(l.note)}</textarea></label>
    ${modalBtns(isNew ? '' : `<button type="button" class="btn ghost danger" data-act="del-link" data-id="${l.id}">Usuń</button>`)}
  `, async (f) => {
    const data = { ...f, url: normUrl(f.url) };
    if (isNew) await create('links', { ...data, author: S.me });
    else await update('links', l.id, data);
    toast(isNew ? 'Dodano link' : 'Zapisano');
  });
}

function catModal(c) {
  openModal(`
    <h2>${c ? 'Edytuj pokój' : 'Nowy pokój'}</h2>
    <div class="row" style="grid-template-columns:90px 1fr">
      <label>Emoji<input name="emoji" value="${esc(c?.emoji || '🏠')}" maxlength="4"></label>
      <label>Nazwa<input name="name" value="${esc(c?.name || '')}" placeholder="np. Szafa, Przedpokój, Balkon" required></label>
    </div>
    ${modalBtns()}
  `, async (f) => {
    if (c) await update('categories', c.id, f);
    else { const it = await create('categories', f); S.cat = it.id; store.set('cat', it.id); render(); }
  });
}

function inspModal(i) {
  const isNew = !i;
  i = i || { image: '', url: '', note: '', categoryId: S.inspCat !== 'all' && S.inspCat !== 'both' ? S.inspCat : '' };
  openModal(`
    <h2>${isNew ? 'Nowa inspiracja' : 'Edytuj inspirację'}</h2>
    <img class="prev" id="insp-prev" src="${esc(i.image)}" alt="" referrerpolicy="no-referrer" ${i.image ? '' : 'hidden'}>
    <label class="drop" id="drop">📷 Wybierz zdjęcie, przeciągnij je tutaj albo wklej Ctrl+V
      <input type="file" name="file" accept="image/*"></label>
    <label>…albo adres obrazka<input name="image" value="${esc(i.image)}" placeholder="https://…jpg"></label>
    <label>Link do źródła (Pinterest, Instagram, strona)<input name="url" value="${esc(i.url)}" placeholder="opcjonalnie – jeśli brak obrazka, spróbuję go pobrać stąd"></label>
    <div class="row">
      <label>Pokój<select name="categoryId">${catOptions(i.categoryId)}</select></label>
      <span></span>
    </div>
    <label>Co się podoba?<textarea name="note" placeholder="np. ten kolor fug, oświetlenie nad lustrem">${esc(i.note)}</textarea></label>
    <p class="err" id="insp-err" hidden></p>
    ${modalBtns()}
  `, async (f, form) => {
    const file = form.file.files[0] || S.pastedFile;
    let image = f.image.trim();
    if (file) image = (await api('POST', '/api/upload', { data: await shrink(file) })).url;
    const url = f.url.trim() ? normUrl(f.url) : '';
    if (!image && url) image = (await api('POST', '/api/preview', { url })).image || '';
    if (!image) throw new Error('Dodaj zdjęcie albo link, z którego da się je pobrać.');
    const data = { image, url, note: f.note, categoryId: f.categoryId };
    if (isNew) await create('inspirations', { ...data, author: S.me });
    else await update('inspirations', i.id, data);
    toast(isNew ? 'Dodano inspirację' : 'Zapisano');
  });
  S.pastedFile = null;
  const form = $('#modal form');
  const setFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    S.pastedFile = file;
    const prev = $('#insp-prev');
    prev.src = URL.createObjectURL(file);
    prev.hidden = false;
  };
  form.file.addEventListener('change', () => setFile(form.file.files[0]));
  form.image.addEventListener('change', () => { if (form.image.value) { $('#insp-prev').src = form.image.value; $('#insp-prev').hidden = false; } });
  const drop = $('#drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); setFile(e.dataTransfer.files[0]); });
}

// zmniejsz zdjęcie przed wysłaniem (max 1800px)
function shrink(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      if (file.type === 'image/gif') return resolve(reader.result);
      const img = new Image();
      img.onerror = () => resolve(reader.result);
      img.onload = () => {
        const k = Math.min(1, 1800 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k);
        cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.86));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function settingsModal() {
  openModal(`
    <h2>Profile</h2>
    <p class="hint" style="margin:0">Dwa konta bez logowania – wybierasz u góry, kim jesteś na tym urządzeniu.</p>
    ${S.db.profiles.map((p) => `<div class="row" style="grid-template-columns:1fr 60px">
      <label>Nazwa<input name="name_${p.id}" value="${esc(p.name)}" required maxlength="40"></label>
      <label>Kolor<input type="color" name="color_${p.id}" value="${esc(p.color)}"></label>
    </div>`).join('')}
    ${modalBtns()}
  `, async (f) => {
    for (const p of S.db.profiles) {
      Object.assign(p, await api('PUT', `/api/profiles/${p.id}`, { name: f[`name_${p.id}`], color: f[`color_${p.id}`] }));
    }
    render();
  });
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) { S.tab = tabBtn.dataset.tab; store.set('tab', S.tab); render(); window.scrollTo(0, 0); return; }

  if (e.target.id === 'modal') return closeModal();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;
  const key = el.closest('.de')?.dataset.key;
  try {
    switch (act) {
      case 'me': S.me = id; store.set('me', id); render(); toast(`Teraz jesteś: ${prof(id).name}`); break;
      case 'settings': settingsModal(); break;
      case 'close': closeModal(); break;
      case 'cat': S.cat = id; store.set('cat', id); S.status = 'all'; render(); break;
      case 'add-cat': catModal(); break;
      case 'edit-cat': catModal(catById(id)); break;
      case 'del-cat': {
        const c = catById(id);
        const n = S.db.links.filter((l) => l.categoryId === id).length;
        if (confirm(`Usunąć pokój „${c.name}”${n ? ` razem z ${n} linkami` : ''}?`)) { await remove('categories', id); S.cat = 'all'; render(); }
        break;
      }
      case 'f-status': S.status = id; render(); break;
      case 'f-author': S.author = id; render(); break;
      case 'f-insp': S.inspCat = id; render(); break;
      case 'goto-design': S.tab = 'design'; store.set('tab', 'design'); render(); window.scrollTo(0, 0); break;
      case 'edit-link': linkModal(S.db.links.find((l) => l.id === id), false); break;
      case 'del-link': if (confirm('Usunąć ten link?')) { closeModal(); await remove('links', id); } break;
      case 'like': {
        const item = S.db[el.dataset.col].find((x) => x.id === id);
        const likes = new Set(item.likes || []);
        likes.has(S.me) ? likes.delete(S.me) : likes.add(S.me);
        await update(el.dataset.col, id, { likes: [...likes] });
        break;
      }
      case 'add-insp': inspModal(); break;
      case 'edit-insp': inspModal(S.db.inspirations.find((i) => i.id === id)); break;
      case 'del-insp': if (confirm('Usunąć inspirację?')) await remove('inspirations', id); break;
      case 'style': {
        const s = el.dataset.style;
        const styles = new Set(getDesign(key).styles || []);
        styles.has(s) ? styles.delete(s) : styles.add(s);
        await saveDesign(key, { styles: [...styles] });
        break;
      }
      case 'suggest': {
        const palette = [...new Set([...(getDesign(key).palette || []), ...PALETTES[el.dataset.style]])];
        await saveDesign(key, { palette });
        break;
      }
      case 'color-rm': {
        const palette = [...(getDesign(key).palette || [])];
        palette.splice(Number(el.dataset.i), 1);
        await saveDesign(key, { palette });
        break;
      }
      case 'copy-brief': {
        const text = briefText();
        try { await navigator.clipboard.writeText(text); }
        catch {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
        toast('Brief skopiowany – wklej go projektantowi albo do AI');
        break;
      }
    }
  } catch (err) { alert(err.message); }
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  const key = el.closest('.de')?.dataset.key;
  try {
    if (el.dataset.act === 'status') await update('links', el.dataset.id, { status: el.value });
    else if (el.dataset.input === 'color-add') {
      await saveDesign(key, { palette: [...(getDesign(key).palette || []), el.value] });
    } else if (el.dataset.field && key) {
      await saveDesign(key, { [el.dataset.field]: el.value }, false);
      toast('Zapisano');
    }
  } catch (err) { alert(err.message); }
});

document.addEventListener('keydown', async (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden) return closeModal();
  const el = e.target;
  if (e.key === 'Enter' && el.dataset.input === 'style-add' && el.value.trim()) {
    e.preventDefault();
    const key = el.closest('.de').dataset.key;
    const styles = [...new Set([...(getDesign(key).styles || []), el.value.trim()])];
    await saveDesign(key, { styles });
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button:not([type=button])');
  if (btn) btn.disabled = true;
  try {
    if (form.dataset.form === 'add-link') {
      if (!S.db.categories.length) throw new Error('Najpierw dodaj pokój.');
      const url = normUrl(form.url.value);
      btn.textContent = 'Pobieram…';
      const p = await api('POST', '/api/preview', { url }).catch(() => ({}));
      linkModal({
        url, title: p.title || '', image: p.image || '', price: p.price || '', note: '', status: 'idea',
        categoryId: S.cat !== 'all' ? S.cat : S.db.categories[0].id,
      }, true);
      form.reset();
    } else if (form.dataset.form === 'modal' && S.modalSubmit) {
      const f = Object.fromEntries([...new FormData(form)].filter(([, v]) => typeof v === 'string'));
      await S.modalSubmit(f, form);
      closeModal();
    }
  } catch (err) {
    const box = $('#insp-err');
    if (box && form.contains(box)) { box.textContent = err.message; box.hidden = false; } else alert(err.message);
  } finally {
    if (btn && document.contains(btn)) { btn.disabled = false; if (form.dataset.form === 'add-link') btn.textContent = 'Dodaj link'; }
  }
});

// wklejanie zdjęcia ze schowka w okienku inspiracji
document.addEventListener('paste', (e) => {
  if ($('#modal').hidden || !$('#drop')) return;
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  S.pastedFile = file;
  $('#insp-prev').src = URL.createObjectURL(file);
  $('#insp-prev').hidden = false;
});

// odśwież, gdy druga osoba mogła coś dodać
window.addEventListener('focus', () => { if ($('#modal').hidden) load().catch(() => {}); });

load().catch((err) => { $('#view').innerHTML = `<div class="empty-state"><b>Nie mogę połączyć się z serwerem</b>${esc(err.message)}</div>`; });
