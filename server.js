'use strict';
/* Сервер «Nordika: сердце фьерда». Без внешних пакетов: нужен только Node.js 18 или новее.
   Запуск: node server.js
   Настройки через переменные окружения: PORT (по умолчанию 3000), TIME_MUL (темп игры, по умолчанию 10), DATA_DIR (где хранятся игроки). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('./public/core.js');
const Clan = require('./public/clans.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
Core.CFG.t = Number(process.env.TIME_MUL) > 0 ? Number(process.env.TIME_MUL) : 10;

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- игроки ---------- */
const users = new Map();      // id -> user
const byName = new Map();     // имя в нижнем регистре -> id
const byToken = new Map();    // sha256(токена) -> id
const dirty = new Set();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const userFile = id => path.join(DATA_DIR, id + '.json');

function indexUser(u) {
  users.set(u.id, u); byName.set(u.nameKey, u.id);
  u.tokens.forEach(h => byToken.set(h, u.id));
}
function loadAll() {
  let n = 0;
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!/^[0-9a-f]{16}\.json$/.test(f)) continue;
    try { indexUser(JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))); n++; }
    catch (e) { console.error('Не удалось прочитать', f, e.message); }
  }
  console.log('Загружено игроков:', n);
}
function markDirty(u) { if (u) dirty.add(u.id); }
function flush() {
  flushClans();
  for (const id of dirty) {
    const u = users.get(id); if (!u) continue;
    try {
      const tmp = userFile(id) + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(u)); fs.renameSync(tmp, userFile(id));
    } catch (e) { console.error('Ошибка записи', id, e.message); continue; }
    dirty.delete(id);
  }
}
/* ---------- кланы ---------- */
const CLAN_FILE = path.join(DATA_DIR, 'clans.json');
let cstore; try { cstore = JSON.parse(fs.readFileSync(CLAN_FILE, 'utf8')); } catch (e) { cstore = Clan.newStore(); }
let cdirty = false;
function flushClans() {
  if (!cdirty) return;
  try { const tmp = CLAN_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(cstore)); fs.renameSync(tmp, CLAN_FILE); cdirty = false; }
  catch (e) { console.error('Ошибка записи кланов', e.message); }
}
const cctx = {
  now: () => Date.now(),
  nameOf: pid => (users.get(pid) || {}).name || '?',
  scoreOf: pid => { const u = users.get(pid); return u ? Core.score(u.state) : 0; },
  hallOf: pid => { const u = users.get(pid); return u ? u.state.b.hall : 0; },
  charge: pid => { const u = users.get(pid); if (!u) return 'Нет такого игрока.'; touchState(u); Core.use(u.state); const e = Core.chargeClan(); if (!e) markDirty(u); return e; },
  jobInfo: (pid, kind) => { const u = users.get(pid); if (!u) return null; touchState(u); Core.use(u.state); const r = Core.jobInfo(kind); markDirty(u); return r; },
  helpApply: (pid, kind, sid, cut) => { const u = users.get(pid); if (!u) return false; touchState(u); Core.use(u.state); const ok = Core.helpJob(kind, sid, cut); if (ok) { Core.update(); markDirty(u); } return ok; },
  notify: (pid, text) => { const u = users.get(pid); if (u) { Core.addLogTo(u.state, text, 'good'); markDirty(u); } }
};
setInterval(flush, 2000).unref();
function shutdown() { flush(); flushClans(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

/* ---------- связь ядра с игроками ---------- */
Core.HOOK.getState = pid => { const u = users.get(pid); return u ? u.state : null; };
Core.HOOK.touch = pid => markDirty(users.get(pid));
Core.HOOK.pickPlayers = (st, n) => {
  const taken = new Set(st.targets.filter(t => t.pid).map(t => t.pid));
  const H = st.b.hall;
  const all = [];
  for (const u of users.values()) if (u.id !== st.pid && !taken.has(u.id)) all.push(u);
  let near = all.filter(u => Math.abs(u.state.b.hall - H) <= 2);
  if (near.length < n) near = all;
  for (let i = near.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [near[i], near[j]] = [near[j], near[i]]; }
  return near.slice(0, n).map(u => ({ pid: u.id, name: u.name, level: u.state.b.hall, comp: Object.assign({}, u.state.troops), shield: u.state.shield }));
};

function touchState(u) {
  Core.use(u.state);
  Core.update();
  if (!u.state.targets.length) Core.refreshTargets();
  Core.topUpPlayers();
  markDirty(u);
}

/* ---------- защита от перебора и спама ---------- */
const buckets = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.until) { b = { n: 0, until: now + windowMs }; buckets.set(key, b); }
  b.n++;
  return b.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.until) buckets.delete(k); }, 60000).unref();

/* ---------- http ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.apk': 'application/vnd.android.package-archive' };
const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY'
};
function send(res, code, body, headers) {
  const h = Object.assign({}, SEC, headers);
  res.writeHead(code, h); res.end(body);
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); }
function ipOf(req) { return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?'; }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 4096) { reject(new Error('big')); req.destroy(); } });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function authUser(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer ([0-9a-f]{64})$/.exec(h); if (!m) return null;
  const id = byToken.get(sha(m[1])); return id ? users.get(id) : null;
}
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
function newToken(u) {
  const tok = crypto.randomBytes(32).toString('hex'), h = sha(tok);
  u.tokens.push(h); byToken.set(h, u.id);
  while (u.tokens.length > 5) byToken.delete(u.tokens.shift());
  return tok;
}
const NAME_RE = /^[\p{L}\p{N}_\- ]{3,16}$/u;
function cleanName(s) { return typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : ''; }

let rankCache = { at: 0, list: [] };
function ranking() {
  if (Date.now() - rankCache.at < 20000) return rankCache.list;
  const list = [];
  for (const u of users.values()) list.push({ id: u.id, name: u.name, hall: u.state.b.hall, score: Core.score(u.state) });
  list.sort((a, b) => b.score - a.score);
  rankCache = { at: Date.now(), list };
  return list;
}

async function api(req, res, url) {
  const ip = ipOf(req);
  if (limited('ip:' + ip, 600, 60000)) return json(res, 429, { error: 'Слишком много запросов. Подождите минуту.' });

  if (req.method === 'POST' && (url === '/api/register' || url === '/api/login')) {
    if (limited('auth:' + ip, 30, 600000)) return json(res, 429, { error: 'Слишком много попыток входа. Подождите 10 минут.' });
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
    const name = cleanName(b.name), pw = typeof b.password === 'string' ? b.password : '';
    if (url === '/api/register') {
      if (limited('reg:' + ip, 8, 3600000)) return json(res, 429, { error: 'С этого адреса создано слишком много аккаунтов. Попробуйте позже.' });
      if (!NAME_RE.test(name)) return json(res, 400, { error: 'Имя: от 3 до 16 символов, буквы, цифры, пробел, дефис или подчёркивание.' });
      if (pw.length < 6 || pw.length > 64) return json(res, 400, { error: 'Пароль: от 6 до 64 символов.' });
      const key = name.toLowerCase();
      if (byName.has(key)) return json(res, 409, { error: 'Это имя уже занято.' });
      const id = crypto.randomBytes(8).toString('hex'), salt = crypto.randomBytes(16).toString('hex');
      const u = { id, name, nameKey: key, salt, hash: hashPw(pw, salt), tokens: [], state: null };
      Core.setNow(Date.now);
      u.state = Core.newState(name, id);
      indexUser(u);
      const token = newToken(u);
      Core.use(u.state); Core.refreshTargets();
      markDirty(u); flush();
      return json(res, 200, { token });
    }
    const id = byName.get(name.toLowerCase()), u = id && users.get(id);
    const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!ok) return json(res, 401, { error: 'Неверное имя или пароль.' });
    const token = newToken(u); markDirty(u);
    return json(res, 200, { token });
  }

  const u = authUser(req);
  if (!u) return json(res, 401, { error: 'Нужно войти.' });

  if (req.method === 'GET' && url === '/api/state') {
    touchState(u);
    return json(res, 200, { state: u.state, cfg: { t: Core.CFG.t }, now: Date.now() });
  }
  if (req.method === 'POST' && url === '/api/act') {
    if (limited('act:' + u.id, 10, 3000)) return json(res, 429, { error: 'Слишком быстро.' });
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
    if (typeof b.a !== 'string' || b.a.length > 20) return json(res, 400, { error: 'Некорректное действие' });
    touchState(u);
    Core.act(b.a, b.arg);
    Core.update();
    markDirty(u);
    return json(res, 200, { state: u.state, cfg: { t: Core.CFG.t }, now: Date.now() });
  }
  if (req.method === 'GET' && url === '/api/rank') {
    const list = ranking();
    const idx = list.findIndex(x => x.id === u.id);
    return json(res, 200, { top: list.slice(0, 30).map(x => ({ name: x.name, hall: x.hall, score: x.score, me: x.id === u.id })), me: idx + 1, total: list.length, my: idx >= 0 ? list[idx].score : 0 });
  }
  if (req.method === 'GET' && url === '/api/clan') return json(res, 200, Clan.view(cstore, cctx, u.id));
  if (req.method === 'POST' && url === '/api/clan/act') {
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
    if (typeof b.a !== 'string' || b.a.length > 12) return json(res, 400, { error: 'Некорректное действие' });
    if (limited((b.a === 'say' ? 'say:' : 'clan:') + u.id, b.a === 'say' ? 8 : 20, 10000)) return json(res, 429, { error: 'Слишком быстро.' });
    const r = Clan.act(cstore, cctx, u.id, b.a, b);
    if (r.ok) cdirty = true;
    if (r.error) return json(res, 400, { error: r.error });
    return json(res, 200, Object.assign(Clan.view(cstore, cctx, u.id), { result: r }));
  }
  if (req.method === 'POST' && url === '/api/logout') {
    const h = (req.headers['authorization'] || '').slice(7);
    const hh = sha(h); u.tokens = u.tokens.filter(x => x !== hh); byToken.delete(hh); markDirty(u);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Нет такого запроса' });
}

function serveStatic(req, res, url) {
  let p; try { p = decodeURIComponent(url.split('?')[0]); } catch (e) { return send(res, 400, 'Плохой адрес'); }
  if (p === '/') p = '/site.html';
  else if (p === '/play') p = '/index.html';
  else if (p === '/play/') { res.writeHead(301, { Location: '/play' }); return res.end(); }
  const full = path.normalize(path.join(PUB, p));
  if (!full.startsWith(PUB + path.sep)) return send(res, 403, 'Нельзя');
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Не найдено', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(full).toLowerCase();
    const base = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': ext === '.html' || ext === '.js' ? 'no-cache' : 'public, max-age=86400' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {   // нужно для видео на iPhone
      let a = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
      let b = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (a > b || a >= st.size) return send(res, 416, '', { 'Content-Range': 'bytes */' + st.size });
      res.writeHead(206, Object.assign({}, SEC, base, { 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 }));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(full, { start: a, end: b }).pipe(res);
    }
    if (ext === '.apk') base['Content-Disposition'] = 'attachment; filename="Nordika.apk"';
    res.writeHead(200, Object.assign({}, SEC, base, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(full).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url.startsWith('/api/')) {
    api(req, res, url.split('?')[0]).catch(e => { console.error('Ошибка запроса', e); if (!res.headersSent) json(res, 500, { error: 'Ошибка сервера' }); });
  } else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url);
  else send(res, 405, 'Нельзя');
});
server.requestTimeout = 15000;
loadAll();
server.listen(PORT, HOST, () => console.log(`Nordika запущена: http://${HOST}:${PORT}  (темп игры x${Core.CFG.t})`));
