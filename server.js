'use strict';
/* Сервер «Nordika: сердце фьорда». Без внешних пакетов: нужен только Node.js 18 или новее.
   Запуск: node server.js
   Настройки через переменные окружения: PORT (по умолчанию 3000), TIME_MUL (темп игры, по умолчанию 10), DATA_DIR (где хранятся игроки). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('./public/core.js');
const Clan = require('./public/clans.js');
const Social = require('./public/social.js');

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
    try { const u = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); if (u.state) { Core.use(u.state); Core.ensure(u.state); } indexUser(u); n++; }
    catch (e) { console.error('Не удалось прочитать', f, e.message); }
  }
  console.log('Загружено игроков:', n);
}
function markDirty(u) { if (u) dirty.add(u.id); }
function flush() {
  flushClans(); flushSocial();
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
/* ---------- общение ---------- */
const SOC_FILE = path.join(DATA_DIR, 'social.json');
let sstore; try { sstore = Object.assign(Social.newStore(), JSON.parse(fs.readFileSync(SOC_FILE, 'utf8'))); } catch (e) { sstore = Social.newStore(); }
let sdirty = false;
function flushSocial() {
  if (!sdirty) return;
  try { const tmp = SOC_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(sstore)); fs.renameSync(tmp, SOC_FILE); sdirty = false; }
  catch (e) { console.error('Ошибка записи общения', e.message); }
}
const ONLINE_MS = 3 * 60 * 1000;
const sctx = {
  now: () => Date.now(),
  exists: pid => users.has(pid),
  nameOf: pid => (users.get(pid) || {}).name || '?',
  hallOf: pid => { const u = users.get(pid); return u ? u.state.b.hall : 0; },
  scoreOf: pid => { const u = users.get(pid); return u ? Core.score(u.state) : 0; },
  online: pid => { const u = users.get(pid); return !!(u && u.seen && Date.now() - u.seen < ONLINE_MS); },
  tagOf: pid => { const c = Clan.clanOf(cstore, pid); return c ? c.tag : ''; },
  isVip: pid => { const u = users.get(pid); return !!(u && (u.state.vip || 0) > Date.now()); }
};
const cctx = {
  now: () => Date.now(),
  nameOf: pid => (users.get(pid) || {}).name || '?',
  scoreOf: pid => { const u = users.get(pid); return u ? Core.score(u.state) : 0; },
  hallOf: pid => { const u = users.get(pid); return u ? u.state.b.hall : 0; },
  seen: pid => { const u = users.get(pid); return u ? (u.seen || 0) : 0; },
  charge: pid => { const u = users.get(pid); if (!u) return 'Нет такого игрока.'; touchState(u); Core.use(u.state); const e = Core.chargeClan(); if (!e) markDirty(u); return e; },
  jobInfo: (pid, kind) => { const u = users.get(pid); if (!u) return null; touchState(u); Core.use(u.state); const r = Core.jobInfo(kind); markDirty(u); return r; },
  helpApply: (pid, kind, sid, cut) => { const u = users.get(pid); if (!u) return false; touchState(u); Core.use(u.state); const ok = Core.helpJob(kind, sid, cut); if (ok) { Core.update(); markDirty(u); } return ok; },
  notify: (pid, text) => { const u = users.get(pid); if (u) { Core.addLogTo(u.state, text, 'good'); markDirty(u); } }
};
setInterval(flush, 2000).unref();
function shutdown() { flush(); flushClans(); flushSocial(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

/* ---------- связь ядра с игроками ---------- */
Core.HOOK.getState = pid => { const u = users.get(pid); return u ? u.state : null; };
Core.HOOK.touch = pid => markDirty(users.get(pid));
Core.HOOK.dist = (a, b) => distTo(a, b);
/* Каждому игроку по номеру достаётся своё место на карте 100 на 100. Путь к другому игроку зависит от расстояния между местами. */
const posOf = Core.posOf;
const distTo = (a, b) => { const p = posOf(a), q = posOf(b); return Math.max(6, Math.round(Math.hypot(p.x - q.x, p.y - q.y) / 2.6)); };
Core.HOOK.sameClan = (a, b) => { const c = Clan.clanOf(cstore, a); return !!(c && c.members && c.members[b]); };
Core.HOOK.pickPlayers = (st, n) => {
  const taken = new Set(st.targets.filter(t => t.pid).map(t => t.pid));
  const H = st.b.hall;
  const all = [];
  for (const u of users.values()) if (u.id !== st.pid && !taken.has(u.id) && !Core.HOOK.sameClan(st.pid, u.id)) all.push(u);
  let near = all.filter(u => Math.abs(u.state.b.hall - H) <= 2);
  if (near.length < n) near = all;
  for (let i = near.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [near[i], near[j]] = [near[j], near[i]]; }
  return near.slice(0, n).map(u => ({ pid: u.id, name: u.name, level: u.state.b.hall, comp: Object.assign({}, u.state.troops), shield: u.state.shield, dist: distTo(st.pid, u.id) }));
};

function touchState(u) {
  Core.use(u.state);
  Core.update();
  if (!u.state.targets.length) Core.refreshTargets();
  Core.topUpPlayers();
  markDirty(u);
}


/* ---------- боты-ярлы: живут на карте как обычные игроки ---------- */
const BOT_DEF = [
  { name: 'Торвальд',     hall: 4, cap: 9,  mix: { spear: 5, archer: 2, cav: 1 } },
  { name: 'Ингвар Седой', hall: 6, cap: 12, mix: { spear: 3, archer: 3, cav: 2 } },
  { name: 'Рагнхильд',    hall: 5, cap: 10, mix: { spear: 2, archer: 4, cav: 2 } },
  { name: 'Свейн Лютый',  hall: 7, cap: 13, mix: { spear: 2, archer: 2, cav: 4 } },
  { name: 'Эйрик Рыжий',  hall: 3, cap: 8,  mix: { spear: 4, archer: 3, cav: 1 } }
];
const lastBotHit = new Map();
function makeBot(d) {
  const key = d.name.toLowerCase(); if (byName.has(key)) return;
  const id = crypto.randomBytes(8).toString('hex');
  Core.setNow(Date.now);
  const st = Core.newState(d.name, id); Core.use(st);
  const h = d.hall;
  Object.assign(st.b, { hall: h, farm: Math.max(1, h - 1), sawmill: Math.max(1, h - 1), quarry: Math.max(1, h - 1), ironmine: Math.max(1, h - 1), silvermine: Math.max(0, h - 3), storehouse: Math.max(1, h - 1), barracks: Math.max(1, h - 1) });
  const t = Math.min(3, 1 + Math.floor(h / 6)); st.tier = { spear: t, archer: t, cav: t };
  const n = 22 * h, tot = Object.values(d.mix).reduce((a, b) => a + b, 0);
  st.troops = {}; st.stk = 1; for (const k in d.mix) st.troops[Core.skey(k, t)] = Math.round(n * d.mix[k] / tot);
  const cp = Core.cap(); for (const k of Object.keys(st.res)) st.res[k] = Math.round(cp * 0.6);
  st.shield = 0; st.nextRaid = 9e15; st.stat.trained = 60; st.introDone = true; st.hero.lv = Math.min(10, h);
  const u = { id, name: d.name, nameKey: key, salt: '', hash: '', tokens: [], state: st, bot: true, bcfg: d, seen: Date.now() };
  indexUser(u); Core.refreshTargets(); markDirty(u);
}
function ensureBots() { try { BOT_DEF.forEach(makeBot); } catch (e) { console.error('ensureBots', e.message); } }
function botTick(u) {
  const now = Date.now(), d = u.bcfg || BOT_DEF.find(x => x.name === u.name); if (!d) return;
  Core.setNow(Date.now); touchState(u);
  const S = u.state; Core.use(S);
  if (Math.random() < 0.5) u.seen = now - Math.floor(Math.random() * 120000);
  if (!u.nextGift || now > u.nextGift) { u.nextGift = now + 6 * 3600000; const cp = Core.cap(); for (const k of Object.keys(S.res)) S.res[k] = Math.min(cp, S.res[k] + cp * 0.1); }
  const lim = Math.min(d.cap, d.hall + Math.floor((now - S.created) / (2.5 * 86400000)));
  if (!S.q) {
    const ks = ['barracks', 'farm', 'sawmill', 'quarry', 'ironmine', 'storehouse', 'hall'].sort((a, b) => (S.b[a] || 0) - (S.b[b] || 0));
    for (const k of ks) { if (k === 'hall' && S.b.hall >= lim) continue; if (Core.canUp(k)) continue; Core.act('up', k); if (S.q) break; }
  }
  const t = Math.min(3, 1 + Math.floor(S.b.hall / 6));
  if (!S.train) {
    const ks = Object.keys(d.mix), tot = ks.reduce((a, k) => a + d.mix[k], 0); let x = Math.random() * tot, k = ks[0];
    for (const q of ks) { x -= d.mix[q]; if (x <= 0) { k = q; break; } }
    for (let n = Core.maxBatch(); n >= 4 && !S.train; n = Math.floor(n / 2)) Core.act('train', { k, n, t: Math.min(t, Core.maxTier()) });
  }
  if (S.marches.length === 0 && (!u.nextAtk || now > u.nextAtk)) {
    let cands = S.targets.filter(tg => {
      if (tg.kind !== 'player') return false;
      const v = users.get(tg.pid); if (!v || v.bot || v.banned || !v.state) return false;
      if (v.state.b.hall < 3 || v.state.shield > now || (v.seen || 0) < now - 3 * 86400000) return false;
      if (now - (lastBotHit.get(tg.pid) || 0) < 5 * 3600000) return false;
      const send = {}; for (const k in S.troops) send[k] = Math.floor(S.troops[k] * 0.7);
      const r = Core.battle(send, v.state.troops, Core.atkB(S), Core.defB(v.state));
      return r.win || r.ratio > 0.8;
    });
    if (cands.length) {
      const tg = cands[Math.floor(Math.random() * cands.length)], send = {}; for (const k in S.troops) send[k] = Math.floor(S.troops[k] * 0.7);
      Core.act('march', { id: tg.id, send }); if (S.marches.length) lastBotHit.set(tg.pid, now);
    }
    u.nextAtk = now + (cands.length ? 3 + Math.random() * 4 : 0.2) * 3600000;
  }
  markDirty(u);
}
function botsTick() { for (const u of users.values()) if (u.bot) { try { botTick(u); } catch (e) { console.error('botTick', u.name, e.message); } } }
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

/* ---------- новости на главной странице сайта ---------- */
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
let news; try { news = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')); } catch (e) {
  const t = Date.now();
  news = [
    { id: 'n1', t: t - 2 * 86400000, title: 'Открытие Nordika', text: 'Фьорд ждёт первых ярлов. Стройте деревню, собирайте дружину и ведите её в поход.' },
    { id: 'n2', t: t - 86400000, title: 'Приложение для Android', text: 'Игру можно скачать на телефон прямо с этого сайта. Для iPhone есть установка на экран «Домой».' },
    { id: 'n3', t: t - 3600000, title: 'Чат, друзья и кланы', text: 'В игре появились общий чат, личные сообщения, друзья и кланы с помощью в стройке.' }
  ];
}
function saveNews() { try { fs.writeFileSync(NEWS_FILE, JSON.stringify(news)); } catch (e) { console.error('Новости не сохранены', e.message); } }
let pubCache = { at: 0, data: null };
function publicInfo() {
  if (Date.now() - pubCache.at < 20000) return pubCache.data;
  const all = [...users.values()], t = Date.now();
  const top = ranking().filter(r => !(users.get(r.id) || {}).banned).slice(0, 10).map(r => ({ name: r.name, hall: r.hall, score: r.score, clan: sctx.tagOf(r.id) }));
  const clans = Clan.view(cstore, cctx, '-').list.slice(0, 10);
  pubCache = { at: t, data: { players: all.length, online: all.filter(u => sctx.online(u.id)).length, clans: Object.keys(cstore.clans).length,
    news: news.slice().sort((a, b) => b.t - a.t).slice(0, 12), top, topClans: clans } };
  return pubCache.data;
}

/* ---------- админ-панель ---------- */
/* ---------- недельное состязание: итоги и награды ---------- */
const EV_FILE = path.join(DATA_DIR, 'events.json');
let evs = { lastAwarded: null, last: null };
try { evs = Object.assign(evs, JSON.parse(fs.readFileSync(EV_FILE, 'utf8'))); } catch (e) { /* первый запуск */ }
function weekBoard(w) {
  const rows = [];
  for (const u of users.values()) { if (u.banned || u.bot) continue; const v = Core.wkScoreOf(u.state, w); if (v > 0) rows.push({ pid: u.id, name: u.name, clan: sctx.tagOf(u.id), v }); }
  rows.sort((a, b) => b.v - a.v || a.name.localeCompare(b.name));
  return rows;
}
/* ---------- клановый поход недели: общий счёт клана ---------- */
const CLAN_TIERS = [{ per: 5, gems: 5, haste: 0, n: 'Бронза' }, { per: 15, gems: 12, haste: 2, n: 'Серебро' }, { per: 30, gems: 25, haste: 4, n: 'Золото' }];   // нужно очков на каждого игрока клана (минимум 3)
const CLAN_TOP = [40, 25, 15];          // дополнительные камни клану из тройки лучших
const CLAN_MIN = 3;                     // личный вклад, с которого игрок получает награду
function clanBoard(w) {
  const out = [];
  for (const c of Object.values(cstore.clans)) {
    const ms = Object.keys(c.members).map(pid => ({ pid, name: c.members[pid].name, v: users.has(pid) ? Core.wkScoreOf(users.get(pid).state, w) : 0 }));
    const total = ms.reduce((a, m) => a + m.v, 0), base = Math.max(3, ms.length);
    let tier = 0; CLAN_TIERS.forEach((t, i) => { if (total >= t.per * base) tier = i + 1; });
    ms.sort((a, b) => b.v - a.v);
    out.push({ id: c.id, tag: c.tag, name: c.name, count: ms.length, total, tier, base, members: ms });
  }
  out.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return out;
}
function clanAward(prev) {
  const board = clanBoard(prev).filter(c => c.total > 0), res = [];
  board.forEach((c, i) => {
    const rw = c.tier ? CLAN_TIERS[c.tier - 1] : null, top = i < 3 ? CLAN_TOP[i] : 0;
    if (!rw && !top) return;
    for (const m of c.members) {
      if (m.v < CLAN_MIN) continue;
      const u = users.get(m.pid); if (!u) continue;
      const g = (rw ? rw.gems : 0) + top, h = rw ? rw.haste : 0;
      u.state.gems = (u.state.gems || 0) + g; u.state.haste += h;
      Core.addLogTo(u.state, `Итоги недели для клана [${c.tag}]${rw ? ': ' + rw.n : ''}${top ? ', ' + (i + 1) + '-е место среди кланов' : ''}. Награда: ${g} рунных камн.${h ? ', ' + h + ' ускор.' : ''}`, 'good');
      markDirty(u);
    }
    res.push({ tag: c.tag, name: c.name, total: c.total, tier: c.tier, place: i + 1 });
  });
  return res.slice(0, 5);
}
const FRAME_NEED = [0, 1, 3, 5, 8, 12, 15];   // Палата ярла, с которой открывается рамка
/* ---------- боссы: мировой и клановый ---------- */
const BOSS_HITS = 2, BOSS_LOSS = 0.05;
const WBOSS = ['Йотун Хримтурс', 'Сурт, огненный ярл', 'Хель, владычица мёртвых', 'Змей Йормунганд'];
const CBOSS = ['Лесной великан', 'Тёмный жрец'];
const bossIl = st => Math.min(5, 1 + Math.floor(st.b.hall / 5));
function bossPay(u, why, o) {
  const st = u.state; Core.use(st);
  const cp = Core.cap();
  for (const k of ['wood', 'iron', 'silver', 'food']) if (o.res) st.res[k] = Math.max(st.res[k], Math.min(cp, st.res[k] + (o.res[k] || 0)));
  st.gems = (st.gems || 0) + (o.gems || 0); st.haste += o.haste || 0;
  if (o.w) Core.giveItem(Core.newItem(bossIl(st), o.w), why);
  Core.addLogTo(st, `${why}. Награда: ${o.gems ? o.gems + ' рунных камн., ' : ''}${o.haste ? o.haste + ' ускор., ' : ''}ресурсы${o.w ? ' и предмет' : ''}.`, 'good');
  markDirty(u);
}
function topRows(dm) { return Object.keys(dm).map(pid => ({ pid, name: (users.get(pid) || {}).name || '?', v: Math.round(dm[pid]) })).sort((a, b) => b.v - a.v); }
function worldSettle(b) {
  const killed = b.hp <= 0, rows = topRows(b.dmg);
  rows.forEach((r, i) => {
    const u = users.get(r.pid); if (!u) return;
    const res = killed ? { wood: 500, iron: 400, silver: 250 } : { wood: 150, iron: 100, silver: 60 };
    if (i === 0) bossPay(u, `Мировой босс «${b.name}»: 1-е место по урону`, { res, gems: killed ? 25 : 10, haste: 4, w: [0, 35, 65] });
    else if (i < 3) bossPay(u, `Мировой босс «${b.name}»: ${i + 1}-е место по урону`, { res, gems: killed ? 15 : 6, haste: 3, w: [20, 60, 20] });
    else bossPay(u, `Мировой босс «${b.name}»${killed ? ' повержен' : ' ушёл'}: награда за участие`, { res, gems: killed ? 5 : 0, haste: killed ? 2 : 1, w: killed ? [65, 31, 4] : null });
  });
  b.settled = true; b.killed = killed; b.top = rows.slice(0, 3).map(r => ({ name: r.name, v: r.v }));
  b.nextAt = Math.max(Date.now(), b.end) + 24 * 3600000;
  try { Social.admin.say(sstore, sctx, `Мировой босс «${b.name}» ${killed ? 'повержен! Награды в хронике участников.' : 'ушёл непобеждённым.'}`); sdirty = true; } catch (e) { /* чат не критичен */ }
}
function worldBoss() {
  const now = Date.now(), b = evs.boss;
  if (b && !b.settled && (b.hp <= 0 || now >= b.end)) { worldSettle(b); saveEvs(); }
  if (!b || (b.settled && now >= b.nextAt)) {
    let n = 0; for (const u of users.values()) if (!u.banned && u.state.t > now - 7 * 86400000) n++;
    n = Math.max(1, Math.min(200, n));
    const max = 8000 + 6000 * n, i = ((b ? b.i : -1) + 1) % WBOSS.length;
    evs.boss = { i, name: WBOSS[i], hp: max, max, start: now, end: now + 72 * 3600000, dmg: {}, settled: false };
    saveEvs();
  }
  return evs.boss;
}
function clanBoss(c) {
  const w = Core.weekId(Date.now()), n = Object.keys(c.members).length;
  if (n < 2) return null;
  if (!c.boss || c.boss.w !== w) {
    if (c.boss && !c.boss.settled) clanSettle(c);
    const i = (c.boss ? c.boss.i + 1 : w) % CBOSS.length, max = 10000 * Math.min(20, n);
    c.boss = { w, i, name: CBOSS[i], hp: max, max, dmg: {}, settled: false }; cdirty = true;
  }
  if (!c.boss.settled && c.boss.hp <= 0) clanSettle(c);
  return c.boss;
}
function clanSettle(c) {
  const b = c.boss; if (b.settled) return; b.settled = true; cdirty = true;
  if (b.hp > 0) return;
  topRows(b.dmg).forEach((r, i) => {
    const u = users.get(r.pid); if (!u || !c.members[r.pid]) return;
    bossPay(u, `Клановый босс «${b.name}» повержен`, { res: { wood: 400, iron: 300, silver: 200 }, gems: 10 + (i === 0 ? 10 : 0), haste: 3, w: i === 0 ? [20, 60, 20] : [55, 38, 7] });
  });
}
const DBOSS = ['Ледяной страж', 'Огненный мореход', 'Вещая Вороница', 'Гром-Берсерк'];
const DAILY_HITS = 1;
function dailySettle(b) {
  if (b.settled) return; b.settled = true; b.killed = b.hp <= 0;
  const rows = topRows(b.dmg); b.top = rows.slice(0, 3).map(r => ({ name: r.name, v: r.v }));
  rows.forEach((r, i) => {
    const u = users.get(r.pid); if (!u) return;
    const res = b.killed ? { wood: 120, iron: 90, silver: 60 } : { wood: 40, iron: 30, silver: 20 };
    bossPay(u, `Дневной босс «${b.name}»${b.killed ? ' повержен' : ' ушёл'}${i === 0 ? ': 1-е место' : ''}`, { res, gems: b.killed ? (i === 0 ? 6 : 2) : 0, haste: b.killed ? 1 : 0, w: b.killed && i === 0 ? [40, 50, 10] : null });
  });
  saveEvs();
}
function dailyBoss() {
  const now = Date.now(), d = Core.dayId(now); let b = evs.daily;
  if (b && b.d !== d && !b.settled) dailySettle(b);
  if (!b || b.d !== d) {
    let n = 0; for (const u of users.values()) if (!u.banned && u.state.t > now - 7 * 86400000) n++;
    n = Math.max(1, Math.min(200, n)); const max = 3000 + 2000 * n, i = d % DBOSS.length;
    evs.daily = b = { d, i, name: DBOSS[i], hp: max, max, dmg: {}, settled: false }; saveEvs();
  }
  if (!b.settled && b.hp <= 0) dailySettle(b);
  return b;
}
function bossTick() { try { worldBoss(); dailyBoss(); for (const c of Object.values(cstore.clans || {})) clanBoss(c); } catch (e) { console.error('boss', e.message); } }
function bossView(u) {
  const now = Date.now(), st = u.state, day = Core.dayId(now), bt = (st.boss && st.boss.d === day) ? st.boss : { d: day, w: 0, c: 0 };
  const wb = worldBoss(), rows = topRows(wb.dmg), me = rows.findIndex(r => r.pid === u.id);
  const out = { now, left: { w: Math.max(0, BOSS_HITS - bt.w), c: Math.max(0, BOSS_HITS - bt.c) }, atk: Math.round(Core.armyAtk(st)), loss: BOSS_LOSS * 100,
    world: { name: wb.name, hp: Math.max(0, Math.round(wb.hp)), max: wb.max, end: wb.end, state: wb.settled ? (now >= wb.nextAt ? 'wait' : 'done') : 'active', killed: !!wb.killed, nextAt: wb.nextAt || 0, top: rows.slice(0, 5), me: { v: me < 0 ? 0 : rows[me].v, rank: me < 0 ? 0 : me + 1 }, lastTop: wb.top || [] } };
  const db = dailyBoss(), dr = topRows(db.dmg), dm = dr.findIndex(r => r.pid === u.id), dend = (Core.dayId(now) + 1) * 86400000 - 3 * 3600000;
  out.left.d = Math.max(0, DAILY_HITS - (bt.dd || 0));
  out.daily = { name: db.name, hp: Math.max(0, Math.round(db.hp)), max: db.max, end: dend, state: db.settled ? 'done' : 'active', killed: db.hp <= 0, top: dr.slice(0, 5), me: { v: dm < 0 ? 0 : dr[dm].v, rank: dm < 0 ? 0 : dm + 1 } };
  const c = Clan.clanOf(cstore, u.id);
  if (!c) out.clan = { none: 'Вступите в клан, чтобы бить кланового босса.' };
  else { const b = clanBoss(c); if (!b) out.clan = { none: 'Клановый босс появляется, когда в клане два игрока и больше.' };
    else { const r2 = topRows(b.dmg), m2 = r2.findIndex(r => r.pid === u.id); out.clan = { name: b.name, hp: Math.max(0, Math.round(b.hp)), max: b.max, end: Core.weekEnd(b.w), state: b.settled ? 'done' : 'active', killed: b.hp <= 0, top: r2.slice(0, 5), me: { v: m2 < 0 ? 0 : r2[m2].v, rank: m2 < 0 ? 0 : m2 + 1 } }; } }
  return out;
}
function bossHit(u, type) {
  const st = u.state; Core.use(st);
  if (st.b.hall < 3) return { error: 'Бить босса можно с Палаты ярла 3.' };
  const now = Date.now(), day = Core.dayId(now);
  if (!st.boss || st.boss.d !== day) st.boss = { d: day, w: 0, c: 0, dd: 0 };
  const key = type === 'clan' ? 'c' : type === 'daily' ? 'dd' : 'w';
  if ((st.boss[key] || 0) >= (type === 'daily' ? DAILY_HITS : BOSS_HITS)) return { error: type === 'daily' ? 'Сегодня удар по дневному боссу уже потрачен.' : 'Сегодня удары уже потрачены (2 в день).' };
  let b, c = null;
  if (type === 'clan') { c = Clan.clanOf(cstore, u.id); if (!c) return { error: 'Вы не в клане.' }; b = clanBoss(c); if (!b || b.settled) return { error: 'Босс сейчас недоступен.' }; }
  else if (type === 'daily') { b = dailyBoss(); if (b.settled) return { error: 'Дневной босс сегодня уже ушёл.' }; }
  else { b = worldBoss(); if (b.settled || now >= b.end) return { error: 'Мирового босса сейчас нет.' }; }
  if (b.hp <= 0) return { error: 'Босс уже повержен.' };
  const base = Core.armyAtk(st); if (base < 1) return { error: 'Нет войск для удара.' };
  const dmg = Math.round(base * (0.9 + Math.random() * 0.2));
  const lost = {}; for (const k of Object.keys(st.troops)) { const n = st.troops[k] || 0, l = Math.min(n, Math.ceil(n * BOSS_LOSS)); if (l > 0) { st.troops[k] = n - l; lost[k] = l; } }
  st.boss[key] = (st.boss[key] || 0) + 1;
  b.hp -= dmg; b.dmg[u.id] = (b.dmg[u.id] || 0) + dmg;
  Core.addLogTo(st, `Удар по боссу «${b.name}»: ${dmg} урона. Потери: ${Core.fmtComp(lost) || 'нет'}.`, 'info');
  if (type === 'clan') { if (b.hp <= 0) clanSettle(c); cdirty = true; } else if (type === 'daily') { if (b.hp <= 0) dailySettle(b); else saveEvs(); } else if (b.hp <= 0) { worldSettle(b); saveEvs(); } else saveEvs();
  markDirty(u);
  return { ok: true, dmg, lost: Core.fmtComp(lost) || 'нет', killed: b.hp <= 0 };
}
/* ---------- приглашения друзей ---------- */
const REF_WELCOME = 5;                                                     // новичку сразу
const REF_STEPS = [{ hall: 4, gems: 25, haste: 3 }, { hall: 8, gems: 40, haste: 5 }];   // пригласившему, когда друг дорос до уровня Палаты
const REF_MAX = 20;                                                        // сколько приглашённых приносят награду
function refTick() {
  const paidBy = {};
  for (const u of users.values()) if (u.ref && (u.refPaid || []).length) paidBy[u.ref] = (paidBy[u.ref] || 0) + 1;
  for (const u of users.values()) {
    if (!u.ref || u.banned) continue;
    const inv = users.get(u.ref); if (!inv || inv.banned) continue;
    if (inv.rip && inv.rip === u.rip) continue;                              // друг с того же адреса: не засчитывается
    u.refPaid = u.refPaid || [];
    for (const st of REF_STEPS) {
      if (u.refPaid.includes(st.hall) || u.state.b.hall < st.hall) continue;
      if (!u.refPaid.length && (paidBy[inv.id] || 0) >= REF_MAX) break;
      if (!u.refPaid.length) paidBy[inv.id] = (paidBy[inv.id] || 0) + 1;
      u.refPaid.push(st.hall); markDirty(u);
      inv.state.gems = (inv.state.gems || 0) + st.gems; inv.state.haste += st.haste;
      Core.addLogTo(inv.state, `Друг ${u.name} дорос до Палаты ${st.hall} уровня. Награда за приглашение: ${st.gems} рунных камн., ${st.haste} ускор.`, 'good'); markDirty(inv);
    }
  }
}
/* ---------- сезоны: месяц, призы лучшим игрокам и кланам, зал славы ---------- */
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const seasonId = t => { const d = new Date(t + 3 * 3600000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const seasonEnd = id => Date.UTC(Math.floor((id + 1) / 12), (id + 1) % 12, 1) - 3 * 3600000;       // конец месяца по Москве
const seasonLabel = id => MONTHS[id % 12] + ' ' + Math.floor(id / 12);
const SEASON_PL = [{ gems: 200, haste: 10 }, { gems: 120, haste: 6 }, { gems: 80, haste: 4 }], SEASON_REST = { gems: 30, haste: 0 }, SEASON_CL = [60, 40, 25], SEASON_MIN_HALL = 3;
function seasonTick() {
  const cur = seasonId(Date.now()), prev = cur - 1;
  if (evs.lastSeason === prev) return;
  if (evs.lastSeason == null) { evs.lastSeason = prev; saveEvs(); return; }
  if (evs.lastSeason < prev) evs.lastSeason = prev - 1;           // сервер долго стоял: награждаем только за последний сезон
  const rows = ranking().filter(r => { const u = users.get(r.id); return u && !u.banned && !u.bot && r.hall >= SEASON_MIN_HALL; });
  const pl = rows.slice(0, 10), hallPl = [];
  pl.forEach((r, i) => {
    const u = users.get(r.id), pz = SEASON_PL[i] || SEASON_REST;
    u.state.gems = (u.state.gems || 0) + pz.gems; u.state.haste += pz.haste;
    Core.addLogTo(u.state, `Сезон «${seasonLabel(prev)}» завершён: вы на ${i + 1}-м месте по силе. Награда: ${pz.gems} рунных камн.${pz.haste ? ', ' + pz.haste + ' ускор.' : ''}`, 'good'); markDirty(u);
    if (i < 3) hallPl.push({ name: r.name, score: r.score });
  });
  const cl = Object.values(cstore.clans).map(c => ({ c, p: Object.keys(c.members).reduce((a, pid) => a + (users.has(pid) ? Core.score(users.get(pid).state) : 0), 0) })).sort((a, b) => b.p - a.p).slice(0, 3), hallCl = [];
  cl.forEach((x, i) => {
    for (const pid of Object.keys(x.c.members)) {
      const u = users.get(pid); if (!u || u.banned || u.bot || u.state.b.hall < SEASON_MIN_HALL) continue;
      u.state.gems = (u.state.gems || 0) + SEASON_CL[i];
      Core.addLogTo(u.state, `Сезон «${seasonLabel(prev)}»: клан [${x.c.tag}] занял ${i + 1}-е место. Награда: ${SEASON_CL[i]} рунных камн.`, 'good'); markDirty(u);
    }
    hallCl.push({ tag: x.c.tag, name: x.c.name, power: x.p });
  });
  evs.hall = [{ id: prev, label: seasonLabel(prev), players: hallPl, clans: hallCl }].concat(evs.hall || []).slice(0, 12);
  evs.lastSeason = prev; saveEvs();
  Social.admin.say(sstore, sctx, `Сезон «${seasonLabel(prev)}» завершён! ${hallPl.length ? 'Победитель: ' + hallPl[0].name + '. ' : ''}Награды разосланы, начался новый сезон.`); sdirty = true;
}
function eventsTick() {
  bossTick();
  try { seasonTick(); } catch (e) { console.error('seasonTick', e.message); }
  try { refTick(); } catch (e) { console.error('refTick', e.message); }
  const cur = Core.weekId(Date.now()), prev = cur - 1;
  if (evs.lastAwarded === prev) return;
  if (evs.lastAwarded === null) { evs.lastAwarded = prev; saveEvs(); return; }      // первый запуск: награждать пока не за что
  const c = Core.contestOf(prev), rows = weekBoard(prev), winners = [];
  rows.slice(0, 10).forEach((r, i) => {
    const u = users.get(r.pid); if (!u) return;
    const pz = Core.PRIZES[i] || Core.PRIZE_PART, st = u.state;
    st.gems = (st.gems || 0) + (pz.gems || 0); st.haste += pz.haste || 0;
    Core.addLogTo(st, `Итоги недели «${c.t}»: ${i + 1}-е место. Награда: ${pz.gems} рунных камн.${pz.haste ? ', ' + pz.haste + ' ускор.' : ''}`, 'good');
    markDirty(u);
    if (i < 3) winners.push({ name: r.name, clan: r.clan, v: r.v });
  });
  evs.last = { week: prev, t: c.t, winners, players: rows.length };
  evs.lastClan = { week: prev, top: clanAward(prev) };
  evs.lastAwarded = prev; saveEvs();
}
function saveEvs() { try { fs.writeFileSync(EV_FILE + '.tmp', JSON.stringify(evs)); fs.renameSync(EV_FILE + '.tmp', EV_FILE); } catch (e) { console.error('events.json', e.message); } }
const backup = require('./backup.js')(DATA_DIR, () => flush());
backup.start();
setTimeout(eventsTick, 5000).unref(); setInterval(eventsTick, 60000).unref();
const adminApi = require('./admin.js')({ users, byName, byToken, DATA_DIR, Core, Clan, Social, sstore, cstore, sctx, cctx, json, readBody, limited, ipOf, markDirty, touchState, ranking, flush, backup,
  setSdirty: () => { sdirty = true; }, setCdirty: () => { cdirty = true; }, hashPw,
  newsApi: { list: () => news, add: (title, text) => { news.push({ id: 'n' + Date.now().toString(36), t: Date.now(), title, text }); if (news.length > 60) news.shift(); saveNews(); pubCache.at = 0; }, del: id => { news = news.filter(x => x.id !== id); saveNews(); pubCache.at = 0; } } });

/* ---------- магазин: пополнение за деньги подключается файлом payments.json ---------- */
const PACKS = [
  { id: 'g100', gems: 100, bonus: 0, rub: 99 }, { id: 'g500', gems: 500, bonus: 50, rub: 490 }, { id: 'g1000', gems: 1000, bonus: 200, rub: 990 },
  { id: 'g2000', gems: 2000, bonus: 600, rub: 1990 }, { id: 'g5000', gems: 5000, bonus: 2000, rub: 4990 }
];
function payInfo() {
  let c = null; try { c = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'payments.json'), 'utf8')); } catch (e) { /* оплата не подключена */ }
  return { enabled: !!(c && c.enabled), packs: PACKS };
}

/* ---------- http ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.apk': 'application/vnd.android.package-archive', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
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
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let d = ''; const lim = max || 4096;
    req.on('data', c => { d += c; if (d.length > lim) { reject(new Error('big')); req.destroy(); } });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function authUser(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer ([0-9a-f]{64})$/.exec(h); if (!m) return null;
  const id = byToken.get(sha(m[1])); const u = id ? users.get(id) : null;
  if (u) { const n = Date.now(); u.seen = n; if (!u.seenSaved || n - u.seenSaved > 600000) { u.seenSaved = n; markDirty(u); } }
  return u;
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
  if (Date.now() - rankCache.at < 3000) return rankCache.list;
  const list = [];
  for (const u of users.values()) list.push({ id: u.id, name: u.name, hall: u.state.b.hall, score: Core.score(u.state), tag: sctx.tagOf(u.id) });
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
      const u = { id, name, nameKey: key, salt, hash: hashPw(pw, salt), tokens: [], state: null, rip: crypto.createHash('sha256').update('nd' + ip).digest('hex').slice(0, 12) };
      Core.setNow(Date.now);
      u.state = Core.newState(name, id);
      const rc = typeof b.ref === 'string' && /^[0-9a-f]{6,16}$/.test(b.ref) ? b.ref : '';
      const inv = rc && [...users.values()].find(x => x.id.startsWith(rc) && !x.banned);
      if (inv) { u.ref = inv.id; u.state.gems = (u.state.gems || 0) + REF_WELCOME; Core.use(u.state); Core.addLogTo(u.state, `Вас пригласил ярл ${inv.name}. Подарок: ${REF_WELCOME} рунных камней.`, 'good'); }
      indexUser(u);
      const token = newToken(u);
      Core.use(u.state); Core.refreshTargets();
      markDirty(u); flush();
      return json(res, 200, { token });
    }
    const id = byName.get(name.toLowerCase()), u = id && users.get(id);
    const ok = u && !u.bot && crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!ok) return json(res, 401, { error: 'Неверное имя или пароль.' });
    if (u.banned) return json(res, 403, { error: 'Аккаунт заблокирован: ' + (u.banned.reason || 'нарушение правил') });
    const token = newToken(u); markDirty(u);
    return json(res, 200, { token });
  }

  if (url.startsWith('/api/admin/')) return adminApi.handle(req, res, url);
  if (req.method === 'GET' && url.startsWith('/api/av/')) {
    const t = users.get(url.slice(8)), m = t && !t.banned && typeof t.avatar === 'string' && t.avatar.match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return send(res, 404, 'no', { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=60' });
    return send(res, 200, Buffer.from(m[2], 'base64'), { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
  }
  if (req.method === 'GET' && url === '/api/public') return json(res, 200, publicInfo());

  const u = authUser(req);
  if (!u) return json(res, 401, { error: 'Нужно войти.' });
  if (u.banned) return json(res, 403, { error: 'Аккаунт заблокирован: ' + (u.banned.reason || 'нарушение правил') });

  const incomingOf = id => {
    const now = Date.now(), out = [];
    for (const t of users.values()) {
      if (t.banned || t.id === id || !t.state) continue;
      for (const m of t.state.marches || []) if (m.phase === 'out' && m.arrive > now && m.tgt && m.tgt.kind === 'player' && m.tgt.pid === id) out.push({ id: m.id + t.id.slice(0, 4), name: t.name, eta: m.arrive });
    }
    return out.sort((x, y) => x.eta - y.eta).slice(0, 5);
  };
  if (req.method === 'GET' && url === '/api/state') {
    touchState(u);
    return json(res, 200, { state: u.state, cfg: { t: Core.CFG.t }, now: Date.now(), inc: incomingOf(u.id) });
  }
  if (req.method === 'POST' && url === '/api/act') {
    if (limited('act:' + u.id, 10, 3000)) return json(res, 429, { error: 'Слишком быстро.' });
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
    if (typeof b.a !== 'string' || b.a.length > 20) return json(res, 400, { error: 'Некорректное действие' });
    touchState(u);
    Core.act(b.a, b.arg);
    Core.update();
    markDirty(u);
    return json(res, 200, { state: u.state, cfg: { t: Core.CFG.t }, now: Date.now(), inc: incomingOf(u.id) });
  }
  if (req.method === 'GET' && url === '/api/rank') {
    const list = ranking();
    const idx = list.findIndex(x => x.id === u.id);
    return json(res, 200, { clans: Clan.view(cstore, cctx, u.id).list.slice(0, 10), top: list.slice(0, 30).map(x => ({ name: x.name, hall: x.hall, score: x.score, tag: x.tag, me: x.id === u.id })), me: idx + 1, total: list.length, my: idx >= 0 ? list[idx].score : 0 });
  }
  if (req.method === 'GET' && url === '/api/clan') {
    const v = Clan.view(cstore, cctx, u.id);
    if (v && v.clan) {
      for (const pid of Object.keys((Clan.clanOf(cstore, u.id) || {}).members || {})) { const m = users.get(pid); if (m) { Core.use(m.state); Core.wkSync(m.state); } }
      const w = Core.weekId(Date.now()), board = clanBoard(w), i = board.findIndex(c => c.id === v.clan.id), me = board[i];
      if (me) v.goal = { contest: Core.contestOf(w), end: Core.weekEnd(w), total: me.total, base: me.base, tier: me.tier, tiers: CLAN_TIERS.map(t => ({ n: t.n, need: t.per * me.base, gems: t.gems, haste: t.haste })), min: CLAN_MIN, top: CLAN_TOP,
        rank: me.total > 0 ? board.filter(c => c.total > me.total).length + 1 : 0, clans: board.filter(c => c.total > 0).length, members: me.members, last: evs.lastClan };
    }
    return json(res, 200, v);
  }
  if (req.method === 'POST' && url === '/api/clan/act') {
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
    if (typeof b.a !== 'string' || b.a.length > 12) return json(res, 400, { error: 'Некорректное действие' });
    if (limited((b.a === 'say' ? 'say:' : 'clan:') + u.id, b.a === 'say' ? 8 : 20, 10000)) return json(res, 429, { error: 'Слишком быстро.' });
    const r = Clan.act(cstore, cctx, u.id, b.a, b);
    if (r.ok) cdirty = true;
    if (r.error) return json(res, 400, { error: r.error });
    return json(res, 200, Object.assign(Clan.view(cstore, cctx, u.id), { result: r }));
  }
  if (req.method === 'GET' && url === '/api/shop') return json(res, 200, { pay: payInfo() });
  if (req.method === 'GET' && url === '/api/social') {
    const q = new URL(req.url, 'http://x').searchParams;
    return json(res, 200, Social.view(sstore, sctx, u.id, (q.get('peer') || '').slice(0, 16)));
  }
  if (req.method === 'POST' && url === '/api/social/act') {
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
    if (typeof b.a !== 'string' || b.a.length > 12) return json(res, 400, { error: 'Некорректное действие' });
    if (limited('soc:' + u.id, 30, 10000)) return json(res, 429, { error: 'Слишком быстро.' });
    const r = Social.act(sstore, sctx, u.id, b.a, b);
    if (r.error !== undefined) return json(res, 400, { error: r.error });
    sdirty = true;
    return json(res, 200, Object.assign(Social.view(sstore, sctx, u.id, String(b.peer || b.to || b.pid || '').slice(0, 16)), { result: r }));
  }
  if (req.method === 'GET' && url === '/api/avatar') return json(res, 200, { img: u.avatar || '', fr: u.frame || 0 });
  if (req.method === 'POST' && url === '/api/avatar') {
    if (limited('avatar:' + u.id, 6, 60000)) return json(res, 429, { error: 'Слишком часто.' });
    let b; try { b = await readBody(req, 40000); } catch (e) { return json(res, 400, { error: 'Файл слишком большой.' }); }
    if (b.clear) { delete u.avatar; }
    else if (typeof b.img === 'string') {
      if (b.img.length > 26000 || !/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+\/=]+$/.test(b.img)) return json(res, 400, { error: 'Не подходит этот файл.' });
      u.avatar = b.img;
    }
    if (b.fr !== undefined) {
      const f = Number(b.fr) | 0; touchState(u);
      if (f < 0 || f >= FRAME_NEED.length || u.state.b.hall < FRAME_NEED[f]) return json(res, 400, { error: 'Эта рамка пока закрыта.' });
      u.frame = f;
    }
    markDirty(u); return json(res, 200, { img: u.avatar || '', fr: u.frame || 0 });
  }
  if (req.method === 'GET' && url === '/api/boss') return json(res, 200, bossView(u));
  if (req.method === 'POST' && url === '/api/boss/hit') {
    if (limited('boss:' + u.id, 6, 10000)) return json(res, 429, { error: 'Слишком быстро.' });
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
    touchState(u);
    const r = bossHit(u, b.t === 'clan' ? 'clan' : b.t === 'daily' ? 'daily' : 'world');
    if (r.error) return json(res, 400, { error: r.error });
    return json(res, 200, Object.assign({ view: bossView(u), state: u.state, cfg: { t: Core.CFG.t }, now: Date.now(), inc: incomingOf(u.id) }, r));
  }
  if (req.method === 'GET' && url === '/api/events') {
    Core.use(u.state); Core.wkSync(u.state);
    const w = Core.weekId(Date.now()), c = Core.contestOf(w), rows = weekBoard(w), i = rows.findIndex(r => r.pid === u.id);
    return json(res, 200, { now: Date.now(), week: w, end: Core.weekEnd(w), contest: c, top: rows.slice(0, 10), me: { v: Core.wkScoreOf(u.state, w), rank: i < 0 ? 0 : i + 1 }, participants: rows.length, last: evs.last, prizes: Core.PRIZES, part: Core.PRIZE_PART });
  }
  if (req.method === 'GET' && url === '/api/invite') {
    const mine = [...users.values()].filter(x => x.ref === u.id).map(x => ({ name: x.name, hall: x.state.b.hall, paid: (x.refPaid || []).length, same: !!(u.rip && u.rip === x.rip) })).sort((a, b) => b.hall - a.hall);
    return json(res, 200, { code: u.id.slice(0, 8), welcome: REF_WELCOME, steps: REF_STEPS, max: REF_MAX, list: mine.slice(0, 30), total: mine.length });
  }
  if (req.method === 'GET' && url === '/api/season') {
    const id = seasonId(Date.now()), rk = ranking(), i = rk.findIndex(x => x.id === u.id);
    return json(res, 200, { label: seasonLabel(id), now: Date.now(), end: seasonEnd(id), minHall: SEASON_MIN_HALL, players: SEASON_PL, rest: SEASON_REST, clans: SEASON_CL, hall: evs.hall || [], me: { rank: i + 1, score: i < 0 ? 0 : rk[i].score, ok: u.state.b.hall >= SEASON_MIN_HALL } });
  }
  if (req.method === 'GET' && url === '/api/worldmap') {
    const now = Date.now(), me = posOf(u.id), players = [], marches = [];
    const clampP = v => Math.max(1, Math.min(98, v));
    for (const t of users.values()) {
      if (t.banned) continue;
      const p = posOf(t.id);
      players.push({ pid: t.id, name: t.name, x: p.x, y: p.y, hall: t.state.b.hall, clan: sctx.tagOf(t.id), online: sctx.online(t.id), me: t.id === u.id, d: Math.hypot(p.x - me.x, p.y - me.y) });
      for (const m of t.state.marches || []) {
        const tg = m.tgt || {}; let a = p, b;
        b = tg.kind === 'player' && tg.pid && !users.has(tg.pid) ? a : Core.tgtPos(t.id, tg);
        let pr, eta;
        if (m.phase === 'out') { if (m.arrive <= now) continue; pr = Math.max(0, Math.min(1, 1 - (m.arrive - now) / (m.dur || 1))); eta = m.arrive; }
        else if (m.phase === 'back') { if (m.back <= now) continue; pr = Math.max(0, Math.min(1, (m.back - now) / (m.dur || 1))); eta = m.back; }
        else if (m.phase === 'gather') { pr = 1; eta = m.gEnd; }
        else continue;
        marches.push({ o: t.id, on: t.name, ax: a.x, ay: a.y, bx: b.x, by: b.y, p: pr, ph: m.phase, k: tg.kind, tn: tg.name || '', mine: t.id === u.id, inc: tg.kind === 'player' && tg.pid === u.id, eta, du: m.dur || 1 });
      }
    }
    players.sort((a, b) => (b.me - a.me) || a.d - b.d);
    marches.sort((a, b) => (b.mine - a.mine) || (b.inc - a.inc));
    return json(res, 200, { now, players: players.slice(0, 300).map(p => (delete p.d, p)), marches: marches.slice(0, 120), total: players.length });
  }
  if (req.method === 'GET' && url === '/api/profile') {
    const q = new URL(req.url, 'http://x').searchParams, nm = (q.get('name') || '').trim().toLowerCase().slice(0, 20), id = nm ? (byName.get(nm) || '') : (q.get('id') || '').slice(0, 16), t = users.get(id);
    if (!t) return json(res, 404, { error: 'Нет такого игрока.' });
    const list = ranking(), idx = list.findIndex(x => x.id === id), c = Clan.clanOf(cstore, id);
    return json(res, 200, { pid: id, name: t.name, hall: t.state.b.hall, score: Core.score(t.state), rank: idx + 1, total: list.length,
      clan: c ? { tag: c.tag, name: c.name } : null, online: sctx.online(id), seen: (t.seen || 0), av: t.avatar || '', fr: t.frame || 0, me: id === u.id,
      hero: ((t.state.hero && t.state.hero.lv) || 1), look: ((t.state.hero && t.state.hero.look) || 1), eq: Object.fromEntries(Object.entries((t.state.eq && t.state.eq.s) || {}).filter(([, it]) => it).map(([k, it]) => [k, { slot: it.slot, r: it.r, il: it.il }])), stat: { wins: t.state.stat.wins || 0, pvpWins: t.state.stat.pvpWins || 0, campWins: t.state.stat.campWins || 0, defWins: t.state.stat.defWins || 0, trained: t.state.stat.trained || 0 },
      friend: (sstore.friends[u.id] || []).includes(id), blocked: (sstore.blocks[u.id] || []).includes(id) });
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
  else if (p === '/admin') p = '/admin.html';
  else if (p === '/privacy') p = '/privacy.html';
  else if (p === '/terms') p = '/terms.html';
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
ensureBots();
setTimeout(botsTick, 8000).unref(); setInterval(botsTick, 60000).unref();
server.listen(PORT, HOST, () => console.log(`Nordika запущена: http://${HOST}:${PORT}  (темп игры x${Core.CFG.t})`));
