// NewPlace – prosty serwer bez zależności. Dane trzymane w DATA_DIR/db.json.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(UPLOADS, { recursive: true });

const uid = () => crypto.randomBytes(6).toString('hex');
const emptyDesign = () => ({ styles: [], palette: [], materials: '', notes: '' });

function seed() {
  const cat = (name, emoji) => ({ id: uid(), name, emoji, design: emptyDesign(), createdAt: Date.now() });
  return {
    profiles: [
      { id: 'p1', name: 'Kuba', color: '#c2410c' },
      { id: 'p2', name: 'Osoba 2', color: '#0f766e' },
    ],
    design: emptyDesign(),
    categories: [cat('Łazienka', '🛁'), cat('Sypialnia', '🛏️'), cat('Kuchnia', '🍳'), cat('Salon', '🛋️')],
    links: [],
    inspirations: [],
  };
}

let db;
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch {
  db = seed();
  save();
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const FIELDS = {
  categories: ['name', 'emoji', 'design'],
  links: ['categoryId', 'url', 'title', 'image', 'price', 'note', 'status', 'author', 'likes'],
  inspirations: ['categoryId', 'url', 'image', 'note', 'author', 'likes'],
};

function clean(col, body) {
  const o = {};
  for (const k of FIELDS[col]) if (k in body) o[k] = body[k];
  if ('price' in o) {
    const n = parseFloat(String(o.price ?? '').replace(/\s/g, '').replace(',', '.'));
    o.price = Number.isFinite(n) ? n : null;
  }
  if ('likes' in o && !Array.isArray(o.likes)) o.likes = [];
  return o;
}

function removeUpload(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  fs.unlink(path.join(UPLOADS, path.basename(url)), () => {});
}

// --- podgląd linku (tytuł, zdjęcie, cena) ---
function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .trim();
}

async function preview(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });
    const ct = r.headers.get('content-type') || '';
    if (ct.startsWith('image/')) return { image: r.url };
    const html = (await r.text()).slice(0, 1_500_000);
    const meta = {};
    for (const tag of html.match(/<meta\s[^>]*>/gi) || []) {
      const attrs = {};
      for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
        attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5];
      }
      const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
      if (key && attrs.content && !(key in meta)) meta[key] = decode(attrs.content);
    }
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = meta['og:title'] || meta['twitter:title'] || decode(titleTag && titleTag[1]);
    let image = meta['og:image'] || meta['og:image:url'] || meta['og:image:secure_url'] || meta['twitter:image'] || meta['twitter:image:src'] || '';
    if (image) {
      try { image = new URL(image, r.url).href; } catch { image = ''; }
    }
    let price = meta['product:price:amount'] || meta['og:price:amount'] || meta['price'] || '';
    if (!price) {
      const m = html.match(/"price"\s*:\s*"?(\d+(?:[.,]\d{1,2})?)/);
      if (m) price = m[1];
    }
    return { title, image, price };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

// --- HTTP ---
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
const IMG_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Za duże dane')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('Niepoprawny JSON')); }
    });
    req.on('error', reject);
  });
}

function serveFile(res, base, rel, cache) {
  const p = path.normalize(path.join(base, rel));
  if (!p.startsWith(base)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(data);
  });
}

async function api(req, res, parts) {
  const [resource, id] = parts;
  const m = req.method;

  if (resource === 'state' && m === 'GET') return json(res, 200, db);

  if (resource === 'preview' && m === 'POST') {
    const { url } = await readBody(req);
    if (!/^https?:\/\//i.test(url || '')) return json(res, 400, { error: 'Zły adres' });
    return json(res, 200, await preview(url));
  }

  if (resource === 'upload' && m === 'POST') {
    const { data } = await readBody(req);
    const match = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(data || '');
    const ext = match && IMG_EXT[match[1].toLowerCase()];
    if (!ext) return json(res, 400, { error: 'Nieobsługiwany obraz' });
    const name = `${uid()}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(match[2], 'base64'));
    return json(res, 200, { url: `/uploads/${name}` });
  }

  if (resource === 'profiles' && m === 'PUT') {
    const p = db.profiles.find((x) => x.id === id);
    if (!p) return json(res, 404, { error: 'Brak profilu' });
    const body = await readBody(req);
    if (typeof body.name === 'string' && body.name.trim()) p.name = body.name.trim().slice(0, 40);
    if (/^#[0-9a-f]{6}$/i.test(body.color || '')) p.color = body.color;
    save();
    return json(res, 200, p);
  }

  if (resource === 'design' && m === 'PUT') {
    db.design = { ...emptyDesign(), ...db.design, ...(await readBody(req)) };
    save();
    return json(res, 200, db.design);
  }

  if (!FIELDS[resource]) return json(res, 404, { error: 'Nie znaleziono' });
  const list = db[resource];

  if (m === 'POST' && !id) {
    const item = { id: uid(), createdAt: Date.now(), likes: [], ...clean(resource, await readBody(req)) };
    if (resource === 'categories') item.design = { ...emptyDesign(), ...item.design };
    if (resource !== 'categories') delete item.design;
    else delete item.likes;
    list.push(item);
    save();
    return json(res, 201, item);
  }

  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return json(res, 404, { error: 'Nie znaleziono' });

  if (m === 'PUT') {
    const patch = clean(resource, await readBody(req));
    if (resource === 'inspirations' && 'image' in patch && patch.image !== list[idx].image) removeUpload(list[idx].image);
    list[idx] = { ...list[idx], ...patch, id, updatedAt: Date.now() };
    save();
    return json(res, 200, list[idx]);
  }

  if (m === 'DELETE') {
    const [gone] = list.splice(idx, 1);
    if (resource === 'categories') {
      db.links = db.links.filter((l) => l.categoryId !== id);
      db.inspirations.forEach((i) => { if (i.categoryId === id) i.categoryId = ''; });
    }
    if (resource === 'inspirations') removeUpload(gone.image);
    save();
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Metoda niedozwolona' });
}

http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(pathname);
    if (p.startsWith('/api/')) return await api(req, res, p.slice(5).split('/').filter(Boolean));
    if (p.startsWith('/uploads/')) return serveFile(res, UPLOADS, p.slice(9), 'public, max-age=31536000, immutable');
    return serveFile(res, PUBLIC, p === '/' ? 'index.html' : p, 'no-cache');
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}).listen(PORT, () => console.log(`NewPlace działa na http://localhost:${PORT}  (dane: ${DATA_DIR})`));
