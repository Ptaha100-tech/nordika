/* Nordika: общение. Общий чат мира, личные сообщения, друзья, чёрный список, жалобы.
   Хранилище (store) это обычный объект, его можно сохранить в JSON. Работает на сервере. */
(function (root) {
'use strict';

const MAXW = 80;        // сообщений в общем чате
const MAXD = 60;        // сообщений в одной переписке
const MAXF = 60;        // друзей
const MAXREP = 300;     // жалоб в очереди
const MUTE_MAX = 30 * 24 * 3600 * 1000;

function newStore() { return { world: [], dm: {}, friends: {}, reqs: {}, blocks: {}, mutes: {}, read: {}, reports: [], last: {} }; }
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const arr = (o, k) => (o[k] || (o[k] = []));
const has = (o, k, v) => !!(o[k] && o[k].includes(v));
const del = (o, k, v) => { if (o[k]) { o[k] = o[k].filter(x => x !== v); if (!o[k].length) delete o[k]; } };

/* Ссылки и грубая брань. Фильтр небольшой: он закрывает самое очевидное, остальное решают мут и жалобы. */
const LINK = /(https?:\/\/|www\.|t\.me\/|\b[a-z0-9-]{2,}\.(ru|com|net|org|su|рф|io|me|xyz|cc|ly)\b)/i;
const BAD = [/(?<!\p{L})(?:на|по|от|за|вы|до|о)?ху[йяеёию]\p{L}*/giu, /пизд\p{L}*/giu, /(?<!\p{L})(?:за|на|по|от|вы|у|до|с|раз|об)?[её]б(?:а[нтл]|у[тч]|ну|ыр|ёт)\p{L}*/giu, /бляд\p{L}*/giu, /(?<!\p{L})бля(?!\p{L})/giu, /(?<!\p{L})сук[аиу](?!\p{L})/giu, /мудак\p{L}*/giu, /пидор\p{L}*/giu, /залуп\p{L}*/giu];
function mask(t) { let o = t; for (const re of BAD) o = o.replace(re, w => '*'.repeat(Math.min(w.length, 6))); return o; }

function muteLeft(st, ctx, pid) { const u = st.mutes[pid] || 0, n = ctx.now(); if (u <= n) { if (u) delete st.mutes[pid]; return 0; } return u - n; }
function fmtLeft(ms) { const m = Math.ceil(ms / 60000); return m < 60 ? m + ' мин' : m < 1440 ? Math.ceil(m / 60) + ' ч' : Math.ceil(m / 1440) + ' дн'; }

function checkText(st, ctx, pid, raw, gap) {
  const left = muteLeft(st, ctx, pid);
  if (left) return { error: 'Вам запрещено писать ещё ' + fmtLeft(left) + '.' };
  const text = clean(raw, 200);
  if (!text) return { error: '' };
  if (LINK.test(text)) return { error: 'Ссылки в чате запрещены.' };
  const n = ctx.now(), l = st.last[pid] || { t: 0, x: '', xt: 0 };
  if (n - l.t < gap) return { error: 'Не так быстро.' };
  const clean2 = mask(text);
  if (l.x === clean2 && n - l.xt < 60000) return { error: 'Это вы уже писали.' };
  st.last[pid] = { t: n, x: clean2, xt: n };
  return { text: clean2 };
}

function blockedBy(st, a, b) { return has(st.blocks, b, a); }   // b заблокировал a

function unread(st, pid, peer) {
  const t = st.dm[key(pid, peer)]; if (!t) return 0;
  const seen = ((st.read[pid] || {})[peer]) || 0;
  let n = 0; for (const m of t) if (m.from === peer && m.t > seen) n++;
  return n;
}

function view(st, ctx, pid, peer) {
  const blk = st.blocks[pid] || [];
  const out = { me: pid, now: ctx.now(), muted: muteLeft(st, ctx, pid) };
  out.world = st.world.filter(m => !blk.includes(m.pid) || m.pid === pid).slice(-50);
  const fr = (st.friends[pid] || []).filter(x => ctx.exists(x));
  out.friends = fr.map(x => ({ pid: x, name: ctx.nameOf(x), hall: ctx.hallOf(x), score: ctx.scoreOf(x), online: ctx.online(x), unread: unread(st, pid, x) }))
    .sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
  out.reqs = (st.reqs[pid] || []).filter(x => ctx.exists(x)).map(x => ({ pid: x, name: ctx.nameOf(x), hall: ctx.hallOf(x) }));
  // список переписок: все, где есть сообщения
  const th = [];
  for (const k in st.dm) {
    const [a, b] = k.split('|'); if (a !== pid && b !== pid) continue;
    const o = a === pid ? b : a; if (!ctx.exists(o) || blk.includes(o)) continue;
    const msgs = st.dm[k], last = msgs[msgs.length - 1];
    th.push({ pid: o, name: ctx.nameOf(o), text: last.text, t: last.t, mine: last.from === pid, unread: unread(st, pid, o), online: ctx.online(o) });
  }
  th.sort((a, b) => b.t - a.t);
  out.threads = th.slice(0, 40);
  out.unread = th.reduce((s, x) => s + x.unread, 0) + out.reqs.length;
  out.blocks = blk.filter(x => ctx.exists(x)).map(x => ({ pid: x, name: ctx.nameOf(x) }));
  if (peer && ctx.exists(peer)) {
    out.thread = { pid: peer, name: ctx.nameOf(peer), online: ctx.online(peer), msgs: (st.dm[key(pid, peer)] || []).slice(-40),
      friend: has(st.friends, pid, peer), blocked: blk.includes(peer), sent: has(st.reqs, peer, pid), incoming: has(st.reqs, pid, peer) };
  }
  return out;
}

function act(st, ctx, pid, a, p) {
  p = p || {};
  const n = ctx.now();
  switch (a) {
    case 'wsay': {
      const r = checkText(st, ctx, pid, p.text, 2000); if (r.error != null) return r;
      st.world.push({ t: n, pid, name: ctx.nameOf(pid), tag: ctx.tagOf(pid) || '', vip: !!(ctx.isVip && ctx.isVip(pid)), text: r.text });
      if (st.world.length > MAXW) st.world.splice(0, st.world.length - MAXW);
      return { ok: true };
    }
    case 'dsay': {
      const to = String(p.to || '');
      if (to === pid || !ctx.exists(to)) return { error: 'Нет такого игрока.' };
      if (blockedBy(st, pid, to)) return { error: 'Этот игрок вас заблокировал.' };
      if (has(st.blocks, pid, to)) return { error: 'Вы заблокировали этого игрока. Сначала разблокируйте.' };
      const r = checkText(st, ctx, pid, p.text, 800); if (r.error != null) return r;
      const k = key(pid, to), t = st.dm[k] || (st.dm[k] = []);
      t.push({ t: n, from: pid, text: r.text });
      if (t.length > MAXD) t.splice(0, t.length - MAXD);
      (st.read[pid] || (st.read[pid] = {}))[to] = n;
      ctx.ping && ctx.ping(to);
      return { ok: true };
    }
    case 'read': { (st.read[pid] || (st.read[pid] = {}))[String(p.peer || '')] = n; return { ok: true }; }
    case 'fadd': {
      const to = String(p.pid || '');
      if (to === pid || !ctx.exists(to)) return { error: 'Нет такого игрока.' };
      if (has(st.friends, pid, to)) return { error: 'Вы уже друзья.' };
      if (blockedBy(st, pid, to)) return { error: 'Этот игрок не принимает заявки.' };
      if (has(st.blocks, pid, to)) return { error: 'Вы заблокировали этого игрока.' };
      if (has(st.reqs, pid, to)) return act(st, ctx, pid, 'faccept', { pid: to });   // он уже просил: считаем согласием
      if (has(st.reqs, to, pid)) return { error: 'Заявка уже отправлена.' };
      if ((st.friends[pid] || []).length >= MAXF) return { error: 'У вас слишком много друзей.' };
      if ((st.reqs[to] || []).length >= 30) return { error: 'У этого игрока слишком много заявок.' };
      arr(st.reqs, to).push(pid);
      ctx.ping && ctx.ping(to);
      return { ok: true, sent: true };
    }
    case 'faccept': {
      const f = String(p.pid || '');
      if (!has(st.reqs, pid, f)) return { error: 'Заявки больше нет.' };
      if ((st.friends[pid] || []).length >= MAXF || (st.friends[f] || []).length >= MAXF) return { error: 'Список друзей заполнен.' };
      del(st.reqs, pid, f); del(st.reqs, f, pid);
      if (!has(st.friends, pid, f)) arr(st.friends, pid).push(f);
      if (!has(st.friends, f, pid)) arr(st.friends, f).push(pid);
      return { ok: true };
    }
    case 'fdecline': { del(st.reqs, pid, String(p.pid || '')); return { ok: true }; }
    case 'fremove': { const f = String(p.pid || ''); del(st.friends, pid, f); del(st.friends, f, pid); return { ok: true }; }
    case 'block': {
      const b = String(p.pid || '');
      if (b === pid || !ctx.exists(b)) return { error: 'Нет такого игрока.' };
      if (!has(st.blocks, pid, b)) arr(st.blocks, pid).push(b);
      del(st.friends, pid, b); del(st.friends, b, pid); del(st.reqs, pid, b); del(st.reqs, b, pid);
      return { ok: true };
    }
    case 'unblock': { del(st.blocks, pid, String(p.pid || '')); return { ok: true }; }
    case 'report': {
      const who = String(p.pid || '');
      if (who === pid || !ctx.exists(who)) return { error: 'Нет такого игрока.' };
      if (st.reports.some(r => r.from === pid && r.target === who && n - r.t < 3600000)) return { error: 'Вы уже отправили жалобу на этого игрока.' };
      st.reports.push({ id: n.toString(36) + Math.random().toString(36).slice(2, 5), t: n, from: pid, fromName: ctx.nameOf(pid), target: who, targetName: ctx.nameOf(who), text: clean(p.text, 200) });
      if (st.reports.length > MAXREP) st.reports.splice(0, st.reports.length - MAXREP);
      return { ok: true };
    }
  }
  return { error: 'Неизвестное действие.' };
}

/* Действия владельца (используются админ-панелью). */
const admin = {
  mute(st, ctx, pid, minutes) { const ms = Math.max(0, Math.min(MUTE_MAX, Math.round(minutes * 60000))); if (ms) st.mutes[pid] = ctx.now() + ms; else delete st.mutes[pid]; },
  deleteWorld(st, t, pid) { st.world = st.world.filter(m => !(m.t === t && m.pid === pid)); },
  clearWorld(st, pid) { st.world = st.world.filter(m => m.pid !== pid); },
  dismissReport(st, id) { st.reports = st.reports.filter(r => r.id !== id); },
  say(st, ctx, text) { st.world.push({ t: ctx.now(), pid: 'sys', name: 'Вести фьорда', tag: '', text: clean(text, 300), sys: true }); if (st.world.length > MAXW) st.world.splice(0, st.world.length - MAXW); }
};

const API = { newStore, view, act, admin, MAXW };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Social = API;
})(typeof self !== 'undefined' ? self : globalThis);
