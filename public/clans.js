/* Nordika: кланы. Логика одна и та же на сервере и в пробной версии.
   Хранилище (store) это обычный объект, его можно сохранить в JSON.
   ctx подсказывает, как узнать имя игрока, его силу и как применить помощь к его стройке. */
(function (root) {
'use strict';

const MAXM = 30;          // игроков в клане
const MAXCHAT = 60;       // сообщений в истории
const HELP_MAX = 10;      // сколько раз можно помочь одной стройке
const NAME_RE = /^[\p{L}\p{N}_\- ]{3,16}$/u;
const TAG_RE = /^[A-Za-zА-Яа-яЁё0-9]{2,4}$/;

function newStore() { return { clans: {}, of: {}, seq: 1, wars: {}, wseq: 1 }; }
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const clanOf = (st, pid) => { const id = st.of[pid]; return id ? st.clans[id] || null : null; };

function clog(c, ctx, text) {
  if (!c.log) c.log = c.chat.filter(m => m.sys).map(m => ({ t: m.t, text: m.text }));
  c.log.push({ t: ctx.now(), text }); if (c.log.length > 60) c.log.splice(0, c.log.length - 60);
}
function sys(c, ctx, text) {
  clog(c, ctx, text);
  c.chat.push({ t: ctx.now(), sys: true, text });
  if (c.chat.length > MAXCHAT) c.chat.splice(0, c.chat.length - MAXCHAT);
}
function dropMember(st, ctx, c, pid, why) {
  const m = c.members[pid]; if (!m) return;
  delete c.members[pid]; delete st.of[pid]; if (c.role) delete c.role[pid];
  c.reqs = c.reqs.filter(r => r.pid !== pid);
  const left = Object.keys(c.members);
  if (!left.length) { delete st.clans[c.id]; return; }
  if (c.leader === pid) {   // власть переходит к самому давнему из оставшихся
    left.sort((a, b) => c.members[a].joined - c.members[b].joined);
    c.leader = left[0];
    sys(c, ctx, `${c.members[left[0]].name} теперь предводитель клана.`);
  }
  sys(c, ctx, why === 'kick' ? `${m.name} исключён из клана.` : `${m.name} покинул клан.`);
}
function purge(c, ctx) {
  const t = ctx.now();
  c.reqs = c.reqs.filter(r => r.end > t + 3000 && r.n < r.max);
}

let cache = { at: 0, list: [] };
function power(c, ctx) { let s = 0; for (const p in c.members) s += ctx.scoreOf(p) || 0; return s; }
function topList(st, ctx) {
  const t = ctx.now();
  if (t - cache.at < 15000 && cache.n === Object.keys(st.clans).length) return cache.list;
  const list = Object.values(st.clans).map(c => ({ id: c.id, name: c.name, tag: c.tag, count: Object.keys(c.members).length, power: power(c, ctx), open: Object.keys(c.members).length < MAXM }));
  list.sort((a, b) => b.power - a.power);
  cache = { at: t, list: list.slice(0, 20), n: Object.keys(st.clans).length };
  return cache.list;
}

/* Что видит игрок: свой клан (если есть) и список лучших кланов. */
function view(st, ctx, pid) {
  const c = clanOf(st, pid);
  const out = { list: topList(st, ctx), me: pid, max: MAXM, helpMax: HELP_MAX };
  if (!c) { out.clan = null; return out; }
  purge(c, ctx);
  const members = Object.keys(c.members).map(p => ({ pid: p, name: c.members[p].name, hall: ctx.hallOf(p), score: ctx.scoreOf(p) || 0, helps: c.members[p].helps || 0, leader: p === c.leader, role: p === c.leader ? 'L' : ((c.role && c.role[p]) || ''), seen: ctx.seen ? ctx.seen(p) : 0, online: ctx.seen ? Date.now() - ctx.seen(p) < 180000 : false }));
  const RK = { L: 3, v: 2, o: 1, '': 0 }; members.sort((a, b) => (RK[b.role] - RK[a.role]) || (b.score - a.score));
  out.clan = {
    id: c.id, name: c.name, tag: c.tag, leader: c.leader, power: members.reduce((a, m) => a + m.score, 0), members,
    chat: c.chat.slice(-40),
    news: (c.news || []).slice(-10),
    log: (c.log || c.chat.filter(m => m.sys).map(m => ({ t: m.t, text: m.text }))).slice(-30),
    reqs: c.reqs.map(r => ({ id: r.id, pid: r.pid, name: c.members[r.pid] ? c.members[r.pid].name : '?', what: r.what, end: r.end, n: r.n, max: r.max, mine: r.pid === pid, done: r.by.includes(pid) }))
  };
  if (API.cwView) out.clan.cw = API.cwView(st, ctx, pid, c);
  return out;
}

function act(st, ctx, pid, a, p) {
  p = p || {};
  const c = clanOf(st, pid), t = ctx.now();
  switch (a) {
    case 'create': {
      if (c) return { error: 'Вы уже в клане.' };
      const name = clean(p.name, 16), tag = clean(p.tag, 4).toUpperCase();
      if (!NAME_RE.test(name)) return { error: 'Название: от 3 до 16 символов, буквы, цифры, пробел, дефис.' };
      if (!TAG_RE.test(tag)) return { error: 'Тег: от 2 до 4 букв или цифр.' };
      for (const k in st.clans) {
        if (st.clans[k].name.toLowerCase() === name.toLowerCase()) return { error: 'Такое название уже занято.' };
        if (st.clans[k].tag === tag) return { error: 'Такой тег уже занят.' };
      }
      const err = ctx.charge(pid); if (err) return { error: err };
      const id = 'c' + (st.seq++);
      const me = ctx.nameOf(pid);
      st.clans[id] = { id, name, tag, leader: pid, created: t, members: { [pid]: { name: me, joined: t, helps: 0 } }, chat: [], reqs: [], rid: 1 };
      st.of[pid] = id; sys(st.clans[id], ctx, `Клан «${name}» основан. Предводитель: ${me}.`);
      cache.at = 0;
      return { ok: true };
    }
    case 'join': {
      if (c) return { error: 'Вы уже в клане.' };
      const k = st.clans[p.id]; if (!k) return { error: 'Такого клана больше нет.' };
      if (Object.keys(k.members).length >= MAXM) return { error: 'В клане нет мест.' };
      const me = ctx.nameOf(pid);
      k.members[pid] = { name: me, joined: t, helps: 0 }; st.of[pid] = k.id;
      sys(k, ctx, `${me} вступил в клан.`); cache.at = 0;
      return { ok: true };
    }
    case 'leave': {
      if (!c) return { error: 'Вы не в клане.' };
      dropMember(st, ctx, c, pid, 'leave'); cache.at = 0; return { ok: true };
    }
    case 'kick': {
      const rk = { L: 3, v: 2, o: 1, '': 0 }, my = c ? (c.leader === pid ? 'L' : ((c.role && c.role[pid]) || '')) : '';
      if (!c || rk[my] < 1) return { error: 'Исключать могут предводитель, воеводы и офицеры.' };
      if (!c.members[p.pid] || p.pid === pid) return { error: 'Некого исключать.' };
      const tr = c.leader === p.pid ? 'L' : ((c.role && c.role[p.pid]) || '');
      if (rk[tr] >= rk[my]) return { error: 'Нельзя исключить того, кто выше или равен вам по роли.' };
      dropMember(st, ctx, c, p.pid, 'kick'); cache.at = 0; return { ok: true };
    }
    case 'transfer': {
      if (!c || c.leader !== pid) return { error: 'Передать власть может только предводитель.' };
      if (!c.members[p.pid] || p.pid === pid) return { error: 'Выберите соклановца.' };
      c.leader = p.pid; sys(c, ctx, `${c.members[p.pid].name} теперь предводитель клана.`); return { ok: true };
    }
    case 'news': {
      if (!c || !(c.leader === pid || (c.role && c.role[pid]))) return { error: 'Писать новости могут предводитель, воеводы и офицеры.' };
      const text = clean(p.text, 300); if (!text) return { error: '' };
      (c.news || (c.news = [])).push({ t, text });
      if (c.news.length > 20) c.news.splice(0, c.news.length - 20);
      return { ok: true };
    }
    case 'say': {
      if (!c) return { error: 'Вы не в клане.' };
      const text = clean(p.text, 200), img = (p.img && ctx.imgOk && ctx.imgOk(String(p.img))) ? String(p.img) : '';
      if (!text && !img) return { error: '' };
      const m = { id: t.toString(36) + Math.random().toString(36).slice(2, 6), t, pid, name: c.members[pid].name, text };
      if (img) m.img = img;
      const q = p.rp && c.chat.find(x => x.id === String(p.rp) && !x.sys); if (q) m.rp = { n: q.name || '', x: clean(q.text, 60) || (q.img ? 'Фото' : '') };
      c.chat.push(m);
      if (c.chat.length > MAXCHAT) c.chat.splice(0, c.chat.length - MAXCHAT);
      return { ok: true };
    }
    case 'sedit': case 'sdel': {
      if (!c) return { error: 'Вы не в клане.' };
      const i = c.chat.findIndex(x => x.id === String(p.id || '') && x.pid === pid);
      if (i < 0) return { error: 'Сообщение не найдено.' };
      const m = c.chat[i];
      if (a === 'sdel') { if (m.img && ctx.imgDrop) ctx.imgDrop(m.img); c.chat.splice(i, 1); return { ok: true }; }
      const text = clean(p.text, 200); if (!text && !m.img) return { error: 'Пустое сообщение.' };
      m.text = text; m.ed = 1; return { ok: true };
    }
    case 'ask': {
      if (!c) return { error: 'Вы не в клане.' };
      purge(c, ctx);
      const info = ctx.jobInfo(pid, p.kind);
      if (!info) return { error: 'Сейчас нечего ускорять.' };
      if (info.end - t < 60000) return { error: 'Осталось меньше минуты, помощь не нужна.' };
      if (c.reqs.some(r => r.pid === pid && r.sid === info.sid)) return { error: 'Вы уже просили помощь с этим делом.' };
      c.reqs.push({ id: 'r' + (c.rid++), pid, kind: p.kind, sid: info.sid, what: info.what, end: info.end, dur: info.dur, n: 0, max: HELP_MAX, by: [], at: t });
      return { ok: true };
    }
    case 'help': case 'helpall': {
      if (!c) return { error: 'Вы не в клане.' };
      purge(c, ctx);
      const list = a === 'help' ? c.reqs.filter(r => r.id === p.id) : c.reqs.slice();
      let done = 0, saved = 0;
      for (const r of list) {
        if (r.pid === pid || r.by.includes(pid) || r.n >= r.max) continue;
        const cut = Math.max(30000, Math.round(r.dur * 0.02));
        if (!ctx.helpApply(r.pid, r.kind, r.sid, cut)) { r.end = 0; continue; }
        r.n++; r.by.push(pid); r.end -= cut; done++; saved += cut;
        c.members[pid].helps = (c.members[pid].helps || 0) + 1;
        clog(c, ctx, `${c.members[pid].name} помог игроку ${c.members[r.pid] ? c.members[r.pid].name : '?'}: «${r.what}».`);
        ctx.notify(r.pid, `${c.members[pid].name} помог: «${r.what}» быстрее на ${Math.round(cut / 1000)} с.`);
      }
      purge(c, ctx);
      if (!done) return { error: a === 'help' ? 'Помощь уже не нужна.' : 'Сейчас некому помогать.' };
      return { ok: true, done, saved };
    }
  }
  if (API.cwAct) { const r = API.cwAct(st, ctx, pid, a, p, c); if (r) return r; }
  return { error: 'Неизвестное действие.' };
}

const API = { newStore, view, act, MAXM, HELP_MAX, clanOf };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Clan = API;
})(typeof self !== 'undefined' ? self : globalThis);
