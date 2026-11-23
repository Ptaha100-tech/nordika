'use strict';
/* Сервер «Шахмат Нордики»: комнаты на 8 мест (игроки + боты), раунды, магазин, экономика, бои. Всё хранится в памяти. */
const Chess = require('./chess.js');
const { CARDS, ORDER, POOL, XP_NEED, TICK, ITEM_IDS } = Chess;

const LOBBY_WAIT = 20000, PREP_MS = 30000, PREP_FIRST = 38000, SEATS = 8, START_HP = 100, START_GOLD = 4, START_LV = 3;
const BOT_NAMES = ['Рагнар', 'Бьорн', 'Свейн', 'Хельга', 'Ивар', 'Гуннар', 'Астрид', 'Торбьорн', 'Сигурд', 'Ульф', 'Ингрид', 'Эйнар', 'Рурик', 'Хальфдан', 'Сольвейг', 'Гудрун'];
let uid = 1, mid = 1;
const matches = new Map(), byUser = new Map();
let lobby = null;
let hooks = { reward: () => {}, name: id => id };

const isPve = r => r <= 3 || (r >= 10 && r % 5 === 0);
const CELLS = Chess.COLS * Chess.HALF, XS = [2, 1, 3, 0, 4];
const emptyBoard = () => Array(CELLS).fill(null);

function newPlayer(id, name, bot) {
  return { id, name, bot: !!bot, hp: START_HP, gold: START_GOLD, lvl: START_LV, xp: 0, bench: Array(Chess.BENCH).fill(null), board: emptyBoard(), shop: [null, null, null, null, null], items: [], streak: 0, alive: true, place: 0, seen: Date.now(), left: false, last: null, skill: 0.7 + Math.random() * 0.3, rewarded: false, lock: false };
}

function lobbyGet() {
  if (!lobby) { lobby = { id: mid++, phase: 'lobby', round: 0, dl: 0, players: [], pool: {}, fights: [], rev: 1, created: Date.now(), over: 0 }; matches.set(lobby.id, lobby); }
  return lobby;
}

function initPool(m) { for (const id of ORDER) m.pool[id] = POOL[CARDS[id].c]; }

function join(u) {
  const ex = byUser.get(u.id); if (ex && matches.has(ex)) return matches.get(ex);
  const m = lobbyGet();
  if (m.players.length >= SEATS) return null;
  m.players.push(newPlayer(u.id, u.name, false));
  byUser.set(u.id, m.id);
  if (m.players.length === 1) m.dl = Date.now() + LOBBY_WAIT;
  if (m.players.length >= SEATS) startMatch(m);
  m.rev++;
  return m;
}

function startMatch(m) {
  if (m.phase !== 'lobby') return;
  const used = new Set(m.players.map(p => p.name));
  let bi = 0;
  while (m.players.length < SEATS) {
    let nm; do { nm = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + (Math.random() < 0.3 ? ' ' + (2 + Math.floor(Math.random() * 8)) : ''); } while (used.has(nm)); used.add(nm);
    m.players.push(newPlayer('bot' + (bi++) + '_' + m.id, nm, true));
  }
  for (let i = m.players.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [m.players[i], m.players[j]] = [m.players[j], m.players[i]]; }
  initPool(m);
  if (lobby === m) lobby = null;
  startPrep(m);
}

// ---------- пул и магазин ----------
function giveBack(m, card, n) { m.pool[card] = (m.pool[card] || 0) + (n || 1); }
function rollShop(m, p) {
  for (const c of p.shop) if (c) giveBack(m, c);
  p.shop = [null, null, null, null, null];
  for (let i = 0; i < 5; i++) {
    for (let tries = 0; tries < 6; tries++) {
      const cost = Chess.rollCost(p.lvl, Math.random());
      const list = ORDER.filter(id => CARDS[id].c === cost && m.pool[id] > 0);
      if (!list.length) continue;
      const id = list[Math.floor(Math.random() * list.length)];
      m.pool[id]--; p.shop[i] = id; break;
    }
  }
}

// ---------- юниты ----------
const unitCount = p => p.board.filter(Boolean).length;
function allUnits(p) { const a = []; p.bench.forEach((u, i) => { if (u) a.push({ u, w: 'b', i }); }); p.board.forEach((u, i) => { if (u) a.push({ u, w: 'f', i }); }); return a; }
function setAt(p, w, i, u) { (w === 'b' ? p.bench : p.board)[i] = u; }
function getAt(p, w, i) { return (w === 'b' ? p.bench : p.board)[i]; }
function autoMerge(p) {
  let again = true;
  while (again) {
    again = false;
    const g = {};
    allUnits(p).forEach(e => { if (e.u.star < 3) (g[e.u.card + ':' + e.u.star] = g[e.u.card + ':' + e.u.star] || []).push(e); });
    for (const k in g) {
      if (g[k].length >= 3) {
        const three = g[k].sort((a, b) => (a.w === 'f' ? 0 : 1) - (b.w === 'f' ? 0 : 1)).slice(0, 3);
        const keep = three[0], items = [];
        three.forEach(e => { items.push(...e.u.items); setAt(p, e.w, e.i, null); });
        const nu = { id: uid++, card: keep.u.card, star: keep.u.star + 1, items: items.slice(0, 3) };
        items.slice(3).forEach(it => p.items.push(it));
        setAt(p, keep.w, keep.i, nu);
        again = true; break;
      }
    }
  }
}
const sellPrice = u => CARDS[u.card].c * [0, 1, 3, 9][u.star];
function freeBench(p) { return p.bench.findIndex(x => !x); }

function addXp(p, n) {
  p.xp += n;
  while (p.lvl < Chess.MAXLV && p.xp >= XP_NEED[p.lvl + 1]) { p.xp -= XP_NEED[p.lvl + 1]; p.lvl++; }
  if (p.lvl >= Chess.MAXLV) p.xp = 0;
}

// ---------- действия игрока ----------
function act(m, p, b) {
  if (m.phase === 'lobby') {
    if (b.a === 'start') { startMatch(m); m.rev++; return {}; }
    return { error: 'Партия ещё не началась.' };
  }
  if (b.a === 'leave') { leave(m, p); return {}; }
  if (m.phase !== 'prep') return { error: 'Подождите окончания боя.' };
  if (!p.alive) return { error: 'Вы выбыли из игры.' };
  const lim = unitCount(p);
  if (b.a === 'buy') {
    const i = b.i | 0, id = p.shop[i]; if (!id) return { error: 'Пусто.' };
    const c = CARDS[id].c; if (p.gold < c) return { error: 'Не хватает золота.' };
    const bi = freeBench(p);
    // место на скамейке или слияние освободит
    if (bi < 0) {
      const same = allUnits(p).filter(e => e.u.card === id && e.u.star === 1).length;
      if (same < 2) return { error: 'Скамейка заполнена.' };
      const slot = p.board.findIndex(x => !x);
      if (slot < 0 && same < 2) return { error: 'Скамейка заполнена.' };
      p.gold -= c; p.shop[i] = null;
      p.bench[0] = p.bench[0] || null;
      const tmp = { id: uid++, card: id, star: 1, items: [] };
      const sp = p.bench.findIndex(x => !x); if (sp >= 0) p.bench[sp] = tmp; else { p.gold += c; p.shop[i] = id; return { error: 'Скамейка заполнена.' }; }
    } else { p.gold -= c; p.shop[i] = null; p.bench[bi] = { id: uid++, card: id, star: 1, items: [] }; }
    autoMerge(p);
  } else if (b.a === 'reroll') {
    if (p.gold < 2) return { error: 'Не хватает золота.' };
    p.gold -= 2; rollShop(m, p);
  } else if (b.a === 'xp') {
    if (p.lvl >= Chess.MAXLV) return { error: 'Максимальный уровень.' };
    if (p.gold < 5) return { error: 'Не хватает золота.' };
    p.gold -= 5; addXp(p, 5);
  } else if (b.a === 'move') {
    const fw = b.f && b.f[0] === 'f' ? 'f' : 'b', tw = b.t && b.t[0] === 'f' ? 'f' : 'b', fi = parseInt(String(b.f).slice(1), 10), ti = parseInt(String(b.t).slice(1), 10);
    const mx = n => (n >= 0 && n < (n === n ? 99 : 0));
    if (!(fi >= 0) || !(ti >= 0) || (fw === 'b' && fi >= Chess.BENCH) || (tw === 'b' && ti >= Chess.BENCH) || (fw === 'f' && fi >= CELLS) || (tw === 'f' && ti >= CELLS)) return { error: 'Неверная клетка.' };
    const a = getAt(p, fw, fi), t = getAt(p, tw, ti);
    if (!a) return { error: 'Тут никого нет.' };
    if (fw === 'b' && tw === 'f' && !t && lim >= p.lvl) return { error: 'На поле можно не больше ' + p.lvl + ' героев. Повысьте уровень.' };
    setAt(p, fw, fi, t || null); setAt(p, tw, ti, a);
  } else if (b.a === 'sell') {
    const w = b.f && b.f[0] === 'f' ? 'f' : 'b', i = parseInt(String(b.f).slice(1), 10), u = getAt(p, w, i);
    if (!u) return { error: 'Тут никого нет.' };
    p.gold += sellPrice(u); giveBack(m, u.card, [0, 1, 3, 9][u.star]); u.items.forEach(it => p.items.push(it)); setAt(p, w, i, null);
  } else if (b.a === 'equip') {
    const ii = b.item | 0, it = p.items[ii]; if (!it) return { error: 'Нет такого предмета.' };
    const w = b.t && b.t[0] === 'f' ? 'f' : 'b', i = parseInt(String(b.t).slice(1), 10), u = getAt(p, w, i);
    if (!u) return { error: 'Выберите героя.' };
    if (u.items.length >= 3) return { error: 'У героя уже 3 предмета.' };
    u.items.push(it); p.items.splice(ii, 1);
  } else if (b.a === 'lock') { p.lock = !p.lock; }
  else return { error: 'Неизвестное действие.' };
  m.rev++;
  return {};
}

function leave(m, p) {
  p.left = true; p.bot = true; byUser.delete(p.id);
  if (m.phase === 'lobby') { m.players = m.players.filter(x => x !== p); if (!m.players.length) { matches.delete(m.id); if (lobby === m) lobby = null; } }
  m.rev++;
}

// ---------- ИИ ботов ----------
function botTurn(m, p) {
  const owned = c => allUnits(p).filter(e => e.u.card === c).length;
  for (let k = 0; k < 8; k++) {
    let best = -1, bs = -1;
    p.shop.forEach((id, i) => { if (!id || p.gold < CARDS[id].c) return; let s = CARDS[id].c * 10 + owned(id) * 25 + Math.random() * 5; if (s > bs) { bs = s; best = i; } });
    const reserve = p.gold >= 50 ? 50 : p.gold >= 30 ? 30 : p.gold >= 20 ? 20 : p.gold >= 10 ? 10 : 0;
    if (best < 0) break;
    const id = p.shop[best], c = CARDS[id].c;
    if (p.gold - c < Math.min(reserve, 10) * (m.round > 6 ? 0 : 1) && owned(id) < 2) break;
    if (act(m, p, { a: 'buy', i: best }).error) break;
  }
  if (p.lvl < Chess.MAXLV && p.gold >= 15 && m.round >= 4 && Math.random() < 0.7 * p.skill + 0.2) act(m, p, { a: 'xp' });
  if (p.gold >= 14 && Math.random() < 0.5) { act(m, p, { a: 'reroll' }); for (let k = 0; k < 3; k++) { let bi = -1, bsc = 0; p.shop.forEach((id, i) => { if (id && p.gold >= CARDS[id].c) { const s = CARDS[id].c + owned(id) * 3; if (s > bsc) { bsc = s; bi = i; } } }); if (bi < 0 || act(m, p, { a: 'buy', i: bi }).error) break; } }
  while (p.items.length) { const us = allUnits(p).filter(e => e.w === 'f' && e.u.items.length < 3); if (!us.length) break; us.sort((a, b) => CARDS[b.u.card].c - CARDS[a.u.card].c); us[0].u.items.push(p.items.shift()); }
  // расстановка: сильнейшие на поле
  const all = allUnits(p).sort((a, b) => (CARDS[b.u.card].c * (1 + b.u.star * 1.5) + b.u.items.length) - (CARDS[a.u.card].c * (1 + a.u.star * 1.5) + a.u.items.length));
  const take = all.slice(0, p.lvl);
  p.bench = Array(Chess.BENCH).fill(null); p.board = emptyBoard();
  const rest = all.slice(p.lvl).map(e => e.u);
  rest.forEach((u, i) => { if (i < Chess.BENCH) p.bench[i] = u; else { p.gold += CARDS[u.card].c * [0, 1, 3, 9][u.star]; } });
  const rowOf = u => { const r = CARDS[u.card].ro; return r === 'tank' ? 0 : (r === 'melee' || r === 'assassin') ? 1 : 2; };
  const rowCnt = [0, 0, 0];
  take.forEach(e => { let y = rowOf(e.u); while (rowCnt[y] >= Chess.COLS) y = (y + 1) % Chess.HALF; p.board[y * Chess.COLS + XS[rowCnt[y]++]] = e.u; });
}

// ---------- ход игры ----------
function creepBoard(r) {
  const pve = r <= 3 ? r : 3 + (r - 5) * 0.5; // сила растёт
  const n = Math.min(8, 2 + Math.floor(pve * 0.9));
  const hp = 220 + pve * 170 + (r >= 10 ? 500 : 0), atk = 9 + pve * 5.5, boss = r >= 10;
  const out = [], pos = []; for (let y = 0; y < 2; y++) XS.forEach(x => { if (!(boss && x === 2 && y === 0)) pos.push([x, y]); });
  const imgs = [1, 2, 3, 4, 5];
  for (let i = 0; i < n; i++) out.push({ e: '💀', img: 'ck-m' + imgs[(i + r) % 5], x: pos[i][0], y: pos[i][1], st: { star: 1, hp: Math.round(hp), atk: Math.round(atk), ar: 4 + pve, as: 1, crit: 0, cm: 2, dodge: 0, ls: 0, regen: 0, mr: 1, sp: 1, rg: 1, ai: 2, mana: 0, mana0: 0 } });
  if (boss) { const bi = (r / 5) % 5; out.push({ e: '👹', img: 'ck-m' + (6 + bi), x: 2, y: 0, st: { star: 3, hp: Math.round(hp * 3.4), atk: Math.round(atk * 1.7), ar: 10 + pve, as: 1, crit: 0, cm: 2, dodge: 0, ls: 0, regen: 0, mr: 1, sp: 1, rg: 1, ai: 2, mana: 0, mana0: 0 } }); }
  return out;
}
function playerBoard(p) { const a = []; p.board.forEach((u, i) => { if (u) a.push({ card: u.card, star: u.star, items: u.items, x: i % Chess.COLS, y: Math.floor(i / Chess.COLS) }); }); return a; }

function startPrep(m) {
  m.round++; m.phase = 'prep';
  m.dl = Date.now() + (m.round === 1 ? PREP_FIRST : PREP_MS);
  for (const p of m.players) {
    if (!p.alive) continue;
    if (m.round > 1) {
      const inter = Math.min(5, Math.floor(p.gold / 10)), sk = Math.abs(p.streak) >= 6 ? 3 : Math.abs(p.streak) >= 4 ? 2 : Math.abs(p.streak) >= 2 ? 1 : 0;
      const inc = 5 + inter + sk; p.gold += inc; addXp(p, 2);
      p.income = { base: 5, inter, streak: sk, total: inc };
    } else p.income = null;
    if (!(p.lock && !p.bot)) rollShop(m, p); else p.lock = false;
    if (p.bot) botTurn(m, p);
  }
  m.fights = []; m.rev++;
}

function startCombat(m) {
  m.phase = 'combat';
  const alive = m.players.filter(p => p.alive);
  for (const p of alive) { // убрать лишних с поля
    let c = unitCount(p);
    for (let i = CELLS - 1; i >= 0 && c > p.lvl; i--) if (p.board[i]) { const bi = freeBench(p); if (bi < 0) break; p.bench[bi] = p.board[i]; p.board[i] = null; c--; }
    if (p.bot) botTurn(m, p);
  }
  const pve = isPve(m.round), fights = [];
  const seed0 = (m.id * 7919 + m.round * 104729) >>> 0;
  if (pve) {
    alive.forEach((p, k) => {
      const A = playerBoard(p), B = creepBoard(m.round), synA = Chess.synergies(A.map(u => u.card));
      const log = Chess.simulate(A, B, seed0 + k, synA, {});
      fights.push({ a: p, b: null, ghost: false, log, pve: true });
    });
  } else {
    const order = alive.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let i = 0; i + 1 < order.length; i += 2) fights.push(mk(order[i], order[i + 1], false));
    if (order.length % 2) { const lone = order[order.length - 1], other = order.filter(x => x !== lone)[Math.floor(Math.random() * (order.length - 1))]; fights.push(mk(lone, other, true)); }
  }
  function mk(a, b, ghost) {
    const A = playerBoard(a), B = playerBoard(b);
    const log = Chess.simulate(A, B, seed0 + fights.length * 31 + 5, Chess.synergies(A.map(u => u.card)), Chess.synergies(B.map(u => u.card)));
    return { a, b, ghost, log, pve: false };
  }
  m.fights = fights;
  const maxT = fights.reduce((s, f) => Math.max(s, f.log.ticks), 0);
  m.dl = Date.now() + maxT * TICK + 3500; m.rev++;
}

function endCombat(m) {
  const dmgOf = (r, surv) => 4 + Math.round(surv * 1.4) + Math.floor(r * 0.8) + Math.max(0, r - 30);
  for (const f of m.fights) {
    const w = f.log.winner;
    const res = (side) => w === -1 ? 'draw' : (w === side ? 'win' : 'lose');
    const upd = (p, side, enemySurv, ghostSide) => {
      const r = res(side); let dmg = 0;
      if (r === 'lose' && !f.pve) dmg = dmgOf(m.round, enemySurv);
      if (r === 'lose' && f.pve) dmg = 0;
      if (dmg) p.hp -= dmg;
      if (r === 'win') p.streak = p.streak > 0 ? p.streak + 1 : 1; else if (r === 'lose') p.streak = p.streak < 0 ? p.streak - 1 : -1; else p.streak = 0;
      let drop = null, gb = 0;
      if (f.pve && r === 'win') { drop = ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)]; p.items.push(drop); gb = m.round <= 3 ? 2 : 4; p.gold += gb; }
      if (!f.pve && r === 'win') { p.gold += 1; gb = 1; }
      p.last = { r: m.round, res: r, dmg, drop, gold: gb, opp: f.pve ? 'Нечисть' : (side === 0 ? f.b.name : f.a.name), pve: f.pve };
    };
    upd(f.a, 0, f.log.surv[1]);
    if (f.b && !f.ghost) upd(f.b, 1, f.log.surv[0]);
  }
  // выбывшие
  const dead = m.players.filter(p => p.alive && p.hp <= 0).sort((a, b) => a.hp - b.hp);
  let aliveN = m.players.filter(p => p.alive).length;
  dead.forEach(p => { p.alive = false; p.place = aliveN; aliveN--; p.hp = 0; finish(m, p); });
  const left = m.players.filter(p => p.alive);
  if (left.length <= 1) {
    if (left.length === 1) { left[0].place = 1; finish(m, left[0]); }
    m.phase = 'end'; m.over = Date.now(); m.dl = 0; m.rev++;
    return;
  }
  m.fights = []; startPrep(m);
}

function finish(m, p) {
  if (p.rewarded) return; p.rewarded = true;
  if (!p.bot || !p.left) { if (!String(p.id).startsWith('bot')) try { p.rw = hooks.reward(p.id, p.place, m.round) || null; } catch (e) { console.error('chess reward', e); } }
  if (!String(p.id).startsWith('bot') && !p.left) { /* игрок остаётся в комнате для просмотра итогов */ }
}

function tick() {
  const now = Date.now();
  for (const m of [...matches.values()]) {
    if (m.phase === 'lobby') { if (m.players.length && now >= m.dl) startMatch(m); continue; }
    // игроки без связи превращаются в ботов
    for (const p of m.players) if (!p.bot && now - p.seen > 60000) { p.bot = true; p.left = true; byUser.delete(p.id); }
    if (m.phase === 'prep' && now >= m.dl) startCombat(m);
    else if (m.phase === 'combat' && now >= m.dl) endCombat(m);
    else if (m.phase === 'end' && now - m.over > 60000) { m.players.forEach(p => { if (byUser.get(p.id) === m.id) byUser.delete(p.id); }); matches.delete(m.id); }
    // все люди ушли — удаляем матч
    if (m.phase !== 'lobby' && !m.players.some(p => !p.bot) && m.phase !== 'end') { matches.delete(m.id); }
  }
}

// ---------- вид для клиента ----------
function view(uidKey, have) {
  const mid_ = byUser.get(uidKey); const m = mid_ ? matches.get(mid_) : null;
  if (!m) return { none: true, open: lobby ? lobby.players.length : 0 };
  const p = m.players.find(x => x.id === uidKey); if (!p) return { none: true };
  p.seen = Date.now();
  const out = { id: m.id, phase: m.phase, round: m.round, dl: m.dl, now: Date.now(), rev: m.rev, pve: isPve(m.round), npve: null,
    players: m.players.map((x, i) => ({ n: x.name, hp: Math.max(0, Math.round(x.hp)), a: x.alive, pl: x.place, me: x === p, bot: x.bot && !!String(x.id).startsWith('bot'), lv: x.lvl, st: x.streak })) };
  if (m.phase === 'lobby') return out;
  const bs = u => u ? { id: u.id, c: u.card, s: u.star, i: u.items } : null;
  out.me = { gold: p.gold, lvl: p.lvl, xp: p.xp, xpn: p.lvl >= Chess.MAXLV ? 0 : XP_NEED[p.lvl + 1], hp: Math.max(0, Math.round(p.hp)), shop: p.shop, bench: p.bench.map(bs), board: p.board.map(bs), items: p.items, streak: p.streak, alive: p.alive, place: p.place, last: p.last, rw: p.rw || null, income: p.income || null, lock: p.lock };
  if (m.phase === 'combat') {
    const f = m.fights.find(x => x.a === p || x.b === p);
    if (f) {
      const side = f.a === p ? 0 : 1, lg = f.log;
      out.fight = { r: m.round, side, opp: f.pve ? 'Нечисть' : (side === 0 ? f.b.name : f.a.name), pve: f.pve, ghost: f.ghost && side === 0, w: lg.winner, surv: lg.surv, ticks: lg.ticks };
      if (have !== m.round) { out.fight.log = { init: lg.init, frames: lg.frames }; }
    }
  }
  return out;
}

function playerOf(uidKey) { const m = matches.get(byUser.get(uidKey)); return m ? { m, p: m.players.find(x => x.id === uidKey) } : null; }
function setHooks(h) { hooks = Object.assign(hooks, h); }
setInterval(tick, 300).unref();

module.exports = { join, act, view, playerOf, setHooks, tick, _matches: matches, _debug: { startMatch, startPrep, startCombat, endCombat, botTurn } };
