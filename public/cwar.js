/* Nordika: клановая казна, постройки, роли и войны кланов. Работает на сервере (хранится внутри хранилища кланов). */
(function (root) {
'use strict';

const RES = ['food', 'wood', 'stone', 'iron', 'silver'];
const RN = { food: 'Еда', wood: 'Дерево', stone: 'Камень', iron: 'Железо', silver: 'Серебро' };
const VAL = { food: 1, wood: 1, stone: 1.5, iron: 2, silver: 4 };
const MIN_GIVE = { food: 2000, wood: 2000, stone: 2000, iron: 1000, silver: 500 };
const H = 3600000, DAY = 86400000;
const PREP = 3 * H, WAR = 24 * H, SHIELD = 12 * H, BAN = 24 * H, DECL_GAP = 12 * H, DECL_COST = 3000;
const MIN_WAR_MEMBERS = 3, RATIO_MIN = 0.5, RATIO_MAX = 2, BATTLE_PTS = 60, LOSE_PTS = 10, MAXV = 2, MAXO = 5, PVP_PTS = 8, PVP_CAP = 40, WGIVE_CAP = 20, MINE_PTS = 10;
const BLD = {
  keep:    { n: 'Крепость',   e: '🏰', d: 'Ополчение защищает лагерь, даже когда все спят: +5% к ополчению и +6% к защите за уровень.', base: { wood: 6000, stone: 6000, iron: 3000, silver: 1500 } },
  forge:   { n: 'Боевая кузница', e: '⚒', d: 'Отряд клана бьёт сильнее: +5% к атаке за уровень.', base: { wood: 3000, stone: 2000, iron: 6000, silver: 3000 } },
  granary: { n: 'Общий амбар', e: '🌾', d: 'Каждый участник раз в сутки получает подарок из амбара. Растёт с уровнем.', base: { food: 8000, wood: 4000, stone: 2000, silver: 1000 } },
  vault:   { n: 'Сокровищница', e: '🔒', d: 'Враг при победе забирает из казны на 15% меньше за уровень.', base: { stone: 8000, wood: 2000, iron: 4000, silver: 3000 } }
};
const BMAX = 5;
const bcost = (id, lv) => { const o = {}; for (const k in BLD[id].base) o[k] = BLD[id].base[k] * lv * lv; return o; };
const GIFT = { food: 400, wood: 400, stone: 300, iron: 200, silver: 100 };
const ROLEN = { L: 'Предводитель', v: 'Воевода', o: 'Офицер', '': 'Воин' };

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const lvlOf = (c, id) => (c.bl && c.bl[id]) || 0;
const roleOf = (c, pid) => c.leader === pid ? 'L' : ((c.role && c.role[pid]) || '');
const canWar = (c, pid) => { const r = roleOf(c, pid); return r === 'L' || r === 'v'; };
const valOf = o => { let s = 0; for (const k in o) s += (o[k] || 0) * (VAL[k] || 1); return s; };

function fix(c) {
  if (!c.tr) c.tr = {}; RES.forEach(k => { if (!(c.tr[k] >= 0)) c.tr[k] = 0; });
  if (!c.bl) c.bl = {}; if (!c.role) c.role = {}; if (!c.gave) c.gave = {}; if (!c.gift) c.gift = {};
  if (c.sh === undefined) c.sh = 0; if (c.quiet === undefined) c.quiet = 20; if (c.ld === undefined) c.ld = 0;
  if (c.mban === undefined) c.mban = 0; if (!c.hist) c.hist = []; if (!c.wc) c.wc = { w: 0, l: 0 };
  return c;
}
function wars(st) { if (!st.wars) st.wars = {}; if (!st.wseq) st.wseq = 1; return st.wars; }
const warOf = (st, c) => c.war ? (wars(st)[c.war] || null) : null;
function note(c, ctx, text) { // запись в хронику и чат клана
  const t = ctx.now();
  if (!c.log) c.log = [];
  c.log.push({ t, text }); if (c.log.length > 60) c.log.splice(0, c.log.length - 60);
  c.chat.push({ t, sys: true, text }); if (c.chat.length > 60) c.chat.splice(0, c.chat.length - 60);
}
function tellAll(c, ctx, text) { for (const p in c.members) ctx.notify(p, text); }
function power(c, ctx) { let s = 0; for (const p in c.members) s += ctx.scoreOf(p) || 0; return s; }
const inQuiet = (h0, t) => { const h = new Date(t).getUTCHours(); return ((h - h0 + 24) % 24) < 8; };
const hex = id => { let s = ''; for (const ch of String(id)) s += ch.charCodeAt(0).toString(16).padStart(2, '0'); return (s + '00000000000000').slice(0, 14); };
const compSum = c => { let n = 0; for (const k in c) n += c[k] || 0; return n; };

/* ---------- казна, постройки, роли ---------- */
function give(st, ctx, pid, c, p) {
  const k = String(p.res || ''); if (!RES.includes(k)) return { error: 'Выберите ресурс.' };
  const n = Math.floor(Number(p.n) || 0);
  if (n < MIN_GIVE[k]) return { error: `Минимальный вклад: ${MIN_GIVE[k]} (${RN[k].toLowerCase()}). Вносите сразу большой порцией.` };
  if (n > 1e7) return { error: 'Слишком много.' };
  const e = ctx.take(pid, { [k]: n }); if (e) return { error: e };
  c.tr[k] += n; c.gave[pid] = Math.round((c.gave[pid] || 0) + valOf({ [k]: n }));
  note(c, ctx, `${c.members[pid].name} вложил в казну: ${RN[k].toLowerCase()} ${n}.`);
  const w = warOf(st, c); if (w && w.ph !== 'done') {
    w.part[pid] = 1; const g = (w.wg[pid] || 0), add = Math.min(WGIVE_CAP - g, Math.floor(valOf({ [k]: n }) / 2000));
    if (add > 0) { w.wg[pid] = g + add; w.pts[c.id] += add; }
  }
  return { ok: true };
}
function build(st, ctx, pid, c, p) {
  if (!canWar(c, pid)) return { error: 'Строить на клановую казну могут предводитель и воеводы.' };
  const id = String(p.id || ''); if (!BLD[id]) return { error: 'Нет такой постройки.' };
  const lv = lvlOf(c, id); if (lv >= BMAX) return { error: 'Постройка уже на высшем уровне.' };
  const cost = bcost(id, lv + 1);
  for (const k in cost) if ((c.tr[k] || 0) < cost[k]) return { error: 'В казне не хватает ресурсов.' };
  for (const k in cost) c.tr[k] -= cost[k];
  c.bl[id] = lv + 1;
  note(c, ctx, `${c.members[pid].name} улучшил «${BLD[id].n}» до ${lv + 1} уровня.`);
  return { ok: true };
}
function gift(st, ctx, pid, c) {
  const lv = lvlOf(c, 'granary'); if (lv < 1) return { error: 'Общий амбар ещё не построен.' };
  const d = Math.floor(ctx.now() / DAY);
  if (c.gift[pid] === d) return { error: 'Сегодняшний подарок уже получен.' };
  const g = {}; RES.forEach(k => { g[k] = GIFT[k] * lv; });
  ctx.give(pid, g); c.gift[pid] = d;
  return { ok: true, gift: g };
}
function setRole(st, ctx, pid, c, p) {
  if (c.leader !== pid) return { error: 'Назначать роли может только предводитель.' };
  const t = String(p.pid || ''), r = String(p.role || '');
  if (!c.members[t] || t === pid) return { error: 'Выберите соклановца.' };
  if (!['', 'v', 'o'].includes(r)) return { error: 'Неизвестная роль.' };
  const cnt = x => Object.keys(c.role).filter(q => c.role[q] === x && c.members[q] && q !== t).length;
  if (r === 'v' && cnt('v') >= MAXV) return { error: `Воевод может быть не больше ${MAXV}.` };
  if (r === 'o' && cnt('o') >= MAXO) return { error: `Офицеров может быть не больше ${MAXO}.` };
  if (r) c.role[t] = r; else delete c.role[t];
  note(c, ctx, `${c.members[t].name}: ${r ? 'теперь ' + ROLEN[r].toLowerCase() : 'снова простой воин'}.`);
  return { ok: true };
}
function setQuiet(st, ctx, pid, c, p) {
  if (!canWar(c, pid)) return { error: 'Менять часы покоя могут предводитель и воеводы.' };
  const h = Math.floor(Number(p.h)); if (!(h >= 0 && h <= 23)) return { error: 'Неверный час.' };
  c.quiet = h; return { ok: true };
}

/* ---------- война ---------- */
function declare(st, ctx, pid, c, p) {
  if (!canWar(c, pid)) return { error: 'Объявить войну может предводитель или воевода.' };
  const t = ctx.now(), d = st.clans[String(p.id || '')];
  if (!d || d === c) return { error: 'Выберите другой клан.' };
  fix(d);
  if (warOf(st, c) && warOf(st, c).ph !== 'done') return { error: 'Ваш клан уже воюет.' };
  if (warOf(st, d) && warOf(st, d).ph !== 'done') return { error: 'Этот клан уже воюет.' };
  if (Object.keys(c.members).length < MIN_WAR_MEMBERS) return { error: `Для войны нужно хотя бы ${MIN_WAR_MEMBERS} участника.` };
  if (Object.keys(d.members).length < MIN_WAR_MEMBERS) return { error: 'В этом клане слишком мало участников: маленьких кланов не трогаем.' };
  if (c.sh > t) return { error: 'У вашего клана ещё действует щит после прошлой войны.' };
  if (d.sh > t) return { error: 'Клан под щитом после недавней войны.' };
  if (t - c.ld < DECL_GAP) return { error: 'Войну можно объявлять не чаще раза в 12 часов.' };
  const pa = power(c, ctx) || 1, pd = power(d, ctx);
  if (pd / pa < RATIO_MIN || pd / pa > RATIO_MAX) return { error: 'Силы кланов слишком разные: воевать можно с кланом вдвое слабее или вдвое сильнее.' };
  if (inQuiet(d.quiet, t + PREP)) return { error: `Бой пришёлся бы на часы покоя этого клана. Попробуйте позже.` };
  if (c.tr.silver < DECL_COST) return { error: `Для объявления войны нужно ${DECL_COST} серебра в казне.` };
  c.tr.silver -= DECL_COST; c.ld = t;
  const id = 'w' + (st.wseq++);
  const w = { id, a: c.id, d: d.id, t0: t, tb: t + PREP, te: t + WAR, ph: 'prep', sq: { [c.id]: { by: {} }, [d.id]: { by: {} } }, pts: { [c.id]: 0, [d.id]: 0 }, part: {}, wg: {}, pv: {}, ev: [], won: null, camp: null };
  wars(st)[id] = w; c.war = id; d.war = id;
  w.ev.push({ t, text: `Клан «${c.name}» объявил войну клану «${d.name}».` });
  note(c, ctx, `Война объявлена клану «${d.name}». Через 3 часа атака. Отправляйте солдат в общий отряд!`);
  note(d, ctx, `Клан «${c.name}» объявил вам войну! Через 3 часа они атакуют ваш лагерь. Отправляйте солдат в общий отряд защиты!`);
  tellAll(c, ctx, `⚔ Война клану «${d.name}». Атака через 3 часа: отправьте солдат в общий отряд.`);
  tellAll(d, ctx, `⚔ Клан «${c.name}» напал: через 3 часа бой за лагерь. Отправьте солдат в общий отряд.`);
  return { ok: true };
}
function send(st, ctx, pid, c, p) {
  const w = warOf(st, c); if (!w || w.ph !== 'prep') return { error: 'Отряд собирается только до начала боя.' };
  const comp = {}; let tot = 0;
  for (const k in (p.comp || {})) { if (!ctx.validKey(k)) continue; const n = Math.floor(Number(p.comp[k]) || 0); if (n > 0) { comp[k] = n; tot += n; } }
  if (!tot) return { error: 'Выберите солдат.' };
  const got = ctx.takeTroops(pid, comp); if (!got || !compSum(got)) return { error: 'Нет таких солдат дома.' };
  const by = w.sq[c.id].by; if (!by[pid]) by[pid] = {};
  for (const k in got) by[pid][k] = (by[pid][k] || 0) + got[k];
  if (!w.part[pid]) { w.part[pid] = 1; w.pts[c.id] += 5; }
  note(c, ctx, `${c.members[pid].name} отправил в общий отряд ${compSum(got)} солдат.`);
  return { ok: true };
}
function recall(st, ctx, pid, c) {
  const w = warOf(st, c); if (!w || w.ph !== 'prep') return { error: 'Отряд уже ушёл в бой.' };
  const by = w.sq[c.id].by; if (!by[pid]) return { error: 'Вы ничего не отправляли.' };
  ctx.giveTroops(pid, by[pid]); delete by[pid]; return { ok: true };
}
function returnSquad(w, cid, ctx, surv, was) {
  // surv: что осталось у общего отряда по видам; возвращаем долями
  const by = w.sq[cid].by;
  for (const pid in by) {
    const back = {};
    for (const k in by[pid]) { const f = was[k] ? Math.min(1, (surv[k] || 0) / was[k]) : 0; const n = Math.floor(by[pid][k] * f); if (n > 0) back[k] = n; }
    if (compSum(back)) ctx.giveTroops(pid, back);
  }
  w.sq[cid].by = {};
}
function addComp(o, x) { for (const k in x) o[k] = (o[k] || 0) + x[k]; }
function squadOf(w, cid) { const o = {}; for (const p in w.sq[cid].by) addComp(o, w.sq[cid].by[p]); return o; }

function runBattle(st, ctx, w) {
  const A = st.clans[w.a], D = st.clans[w.d]; const t = ctx.now();
  w.ph = 'war';
  if (!A || !D) return;
  fix(A); fix(D);
  const aComp = squadOf(w, A.id), dDon = squadOf(w, D.id), gar = {};
  const gf = 0.25 + 0.05 * lvlOf(D, 'keep');
  for (const p in D.members) { const tr = ctx.troopsOf(p); for (const k in tr) gar[k] = (gar[k] || 0) + Math.floor((tr[k] || 0) * gf); }
  const dComp = {}; addComp(dComp, dDon); addComp(dComp, gar);
  const ab = 1 + 0.05 * lvlOf(A, 'forge'), db = 1 + 0.06 * lvlOf(D, 'keep');
  let attWin = false, r = null;
  if (!compSum(aComp)) { attWin = false; w.ev.push({ t, text: `Отряд клана «${A.name}» не собрался: лагерь «${D.name}» устоял без боя.` }); }
  else {
    r = ctx.battle(aComp, dComp, ab, db); attWin = r.win;
    returnSquad(w, A.id, ctx, r.survA, aComp);
    // защитникам возвращаем долю выживших от общего (отряд + ополчение)
    returnSquad(w, D.id, ctx, r.survD, dComp);
    w.ev.push({ t, text: attWin ? `Лагерь «${D.name}» пал: отряд «${A.name}» победил.` : `Лагерь «${D.name}» отбил нападение «${A.name}».` });
  }
  if (!r) returnSquad(w, D.id, ctx, dDon, dDon);
  if (attWin) { w.pts[A.id] += BATTLE_PTS; w.pts[D.id] += LOSE_PTS; } else { w.pts[D.id] += BATTLE_PTS; if (r && r.ratio > 0.7) w.pts[A.id] += LOSE_PTS; }
  if (attWin) { // грабёж казны
    const keep = 1 - Math.min(0.75, 0.15 * lvlOf(D, 'vault')), took = {};
    RES.forEach(k => { const x = Math.floor(D.tr[k] * 0.10 * keep); if (x > 0) { D.tr[k] -= x; A.tr[k] += x; took[k] = x; } });
    w.camp = { win: true, took };
    const s = RES.filter(k => took[k]).map(k => `${RN[k].toLowerCase()} ${took[k]}`).join(', ');
    note(D, ctx, `Лагерь разгромлен! Из казны унесли: ${s || 'ничего'}.`); note(A, ctx, `Лагерь врага разгромлен! В нашу казну: ${s || 'ничего'}.`);
  } else { w.camp = { win: false }; note(D, ctx, `Лагерь устоял! Враг отбит.`); note(A, ctx, `Штурм лагеря не удался.`); }
  tellAll(A, ctx, attWin ? '⚔ Победа в штурме лагеря врага!' : '⚔ Штурм лагеря не удался.');
  tellAll(D, ctx, attWin ? '⚔ Наш лагерь разгромлен. Война продолжается: очки решат всё.' : '⚔ Наш лагерь устоял!');
}

function endWar(st, ctx, w) {
  const t = ctx.now(), A = st.clans[w.a], D = st.clans[w.d];
  w.ph = 'done';
  const clear = x => { if (x && x.war === w.id) delete x.war; };
  if (A) { fix(A); (w.sq[A.id].by && Object.keys(w.sq[A.id].by).length) && returnSquad(w, A.id, ctx, squadOf(w, A.id), squadOf(w, A.id)); }
  if (D) { fix(D); (w.sq[D.id].by && Object.keys(w.sq[D.id].by).length) && returnSquad(w, D.id, ctx, squadOf(w, D.id), squadOf(w, D.id)); }
  // очки за удерживаемые рудники
  [A, D].forEach(c => { if (!c) return; let n = 0; for (const p in c.members) n += ctx.minesHeld(p); if (n) { w.pts[c.id] += n * MINE_PTS; w.ev.push({ t, text: `Клан «${c.name}» держит рудников: ${n} (+${n * MINE_PTS} очков).` }); } });
  const pa = w.pts[w.a] || 0, pd = w.pts[w.d] || 0;
  const winId = pa > pd ? w.a : w.d, loseId = winId === w.a ? w.d : w.a, W = st.clans[winId], L = st.clans[loseId];
  w.won = winId; w.fin = t;
  const res = { id: w.id, t, a: A ? A.name : '?', d: D ? D.name : '?', pa, pd, won: W ? W.name : '?' };
  [A, D].forEach(c => { if (c) { c.hist.push(res); if (c.hist.length > 5) c.hist.shift(); c.sh = t + SHIELD; clear(c); } });
  if (W) { W.wc.w++; note(W, ctx, `Война окончена победой над «${L ? L.name : '?'}» со счётом ${W === A ? pa : pd}:${W === A ? pd : pa}.`);
    for (const p in W.members) { if (w.part[p]) { ctx.reward(p, { gems: 3, haste: 1, silver: 2500 }); ctx.notify(p, '🏆 Победа в войне кланов! Награда: 3 рунных камня, ускорение и 2500 серебра.'); } else ctx.notify(p, '🏆 Наш клан победил в войне!'); } }
  if (L) { L.wc.l++; L.mban = t + BAN; note(L, ctx, `Война проиграна. 24 часа клан не может занимать шахты.`); tellAll(L, ctx, '⚔ Война проиграна: 24 часа шахты для клана закрыты.'); ctx.releaseMines(Object.keys(L.members)); }
}

function tick(st, ctx) {
  let ch = false; const t = ctx.now(), W = wars(st);
  for (const id in W) {
    const w = W[id];
    if (w.ph === 'done') { if (t - w.fin > 3 * DAY) { delete W[id]; ch = true; } continue; }
    if (!st.clans[w.a] || !st.clans[w.d]) { // один клан распался
      const gone = !st.clans[w.a] ? w.a : w.d; w.ph = 'done'; w.fin = t; w.won = gone === w.a ? w.d : w.a;
      for (const c of [st.clans[w.a], st.clans[w.d]]) if (c) { delete c.war; for (const cid of Object.keys(w.sq)) { const by = w.sq[cid].by; for (const p in by) ctx.giveTroops(p, by[p]); } }
      ch = true; continue;
    }
    if (w.ph === 'prep' && t >= w.tb) { runBattle(st, ctx, w); ch = true; }
    if (w.ph === 'war' && t >= w.te) { endWar(st, ctx, w); ch = true; }
  }
  return ch;
}
/* Победа члена клана над членом вражеского клана на карте даёт очки. */
function pvp(st, ctx, ap, dp, win) {
  const a = st.clans[st.of[ap]], d = st.clans[st.of[dp]]; if (!a || !d || a === d || !win) return false;
  const w = warOf(st, a); if (!w || w.ph === 'done' || warOf(st, d) !== w) return false;
  const g = w.pv[ap] || 0; if (g >= PVP_CAP) return false;
  w.pv[ap] = g + PVP_PTS; w.pts[a.id] += PVP_PTS; w.part[ap] = 1;
  note(a, ctx, `${a.members[ap].name} победил ${d.members[dp] ? d.members[dp].name : 'врага'} в походе: +${PVP_PTS} очков.`);
  return true;
}
const enemyOf = (st, pid) => { const c = st.clans[st.of[pid]]; if (!c) return null; const w = warOf(st, c); if (!w || w.ph === 'done') return null; return st.clans[w.a === c.id ? w.d : w.a] || null; };

/* ---------- что видит игрок ---------- */
function view(st, ctx, pid, c) {
  fix(c); const t = ctx.now(), w = warOf(st, c), me = roleOf(c, pid);
  const out = {
    tr: c.tr, bl: Object.keys(BLD).map(id => { const lv = lvlOf(c, id); return { id, n: BLD[id].n, e: BLD[id].e, d: BLD[id].d, lv, max: BMAX, cost: lv < BMAX ? bcost(id, lv + 1) : null }; }),
    role: me, gave: c.gave, quiet: c.quiet, shield: c.sh > t ? c.sh : 0, mban: c.mban > t ? c.mban : 0, canWar: canWar(c, pid),
    giftOk: lvlOf(c, 'granary') > 0 && c.gift[pid] !== Math.floor(t / DAY), giftLv: lvlOf(c, 'granary'),
    min: MIN_GIVE, wins: c.wc.w, losses: c.wc.l, hist: c.hist.slice(-3).reverse(), declCost: DECL_COST,
    roles: Object.keys(c.members).map(p => ({ pid: p, role: roleOf(c, p) })).filter(x => x.role && x.role !== 'L')
  };
  if (w) {
    const eid = w.a === c.id ? w.d : w.a, e = st.clans[eid];
    const mine = squadOf(w, c.id), mineN = compSum(mine);
    out.war = { id: w.id, ph: w.ph, att: w.a === c.id, tb: w.tb, te: w.te, enemy: e ? { id: e.id, name: e.name, tag: e.tag, count: Object.keys(e.members).length } : null,
      pts: w.pts[c.id] || 0, epts: w.pts[eid] || 0, sq: mineN, esq: compSum(squadOf(w, eid)), my: compSum(w.sq[c.id].by[pid] || {}), mycomp: w.sq[c.id].by[pid] || {}, join: Object.keys(w.part).filter(p => c.members[p]).length,
      ev: w.ev.slice(-8), camp: w.camp, won: w.won, wg: w.wg[pid] || 0, pv: w.pv[pid] || 0, wgCap: WGIVE_CAP, pvCap: PVP_CAP };
  }
  const list = [], pc = power(c, ctx) || 1;
  for (const k in st.clans) { const d = st.clans[k]; if (d === c) continue; fix(d); const n = Object.keys(d.members).length, pd = power(d, ctx), r = pd / pc;
    let why = ''; const dw = warOf(st, d);
    if (n < MIN_WAR_MEMBERS) why = 'слишком мал'; else if (dw && dw.ph !== 'done') why = 'уже воюет'; else if (d.sh > t) why = 'под щитом'; else if (r < RATIO_MIN || r > RATIO_MAX) why = r < RATIO_MIN ? 'слишком слаб' : 'слишком силён'; else if (inQuiet(d.quiet, t + PREP)) why = 'часы покоя';
    list.push({ id: d.id, name: d.name, tag: d.tag, count: n, power: pd, why }); }
  list.sort((a, b) => (a.why ? 1 : 0) - (b.why ? 1 : 0) || b.power - a.power);
  out.targets = list.slice(0, 20);
  return out;
}
/* Кланы с лагерями для карты. */
function camps(st, ctx, Core) {
  const t = ctx.now(), out = [];
  for (const k in st.clans) { const c = fix(st.clans[k]); const p = Core.posOf(hex(c.id)); const w = warOf(st, c);
    out.push({ id: c.id, tag: c.tag, name: c.name, x: p.x, y: p.y, n: Object.keys(c.members).length, war: !!(w && w.ph !== 'done'), sh: c.sh > t }); }
  return out;
}

function act(st, ctx, pid, a, p, c) {
  if (!c) return null; fix(c);
  switch (a) {
    case 'give': return give(st, ctx, pid, c, p);
    case 'build': return build(st, ctx, pid, c, p);
    case 'gift': return gift(st, ctx, pid, c);
    case 'role': return setRole(st, ctx, pid, c, p);
    case 'quiet': return setQuiet(st, ctx, pid, c, p);
    case 'declare': return declare(st, ctx, pid, c, p);
    case 'send': return send(st, ctx, pid, c, p);
    case 'recall': return recall(st, ctx, pid, c);
  }
  return null;
}

const API = { RES, RN, BLD, BMAX, ROLEN, MIN_GIVE, PREP, WAR, view, act, tick, pvp, enemyOf, camps, bcost, roleOf, canWar, fix, hex };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CWar = API;
})(typeof self !== 'undefined' ? self : globalThis);
