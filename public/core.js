/* Nordika: общее ядро игры.
   Этот же файл работает на сервере (он считает всё по-настоящему) и в телефоне (только показывает). */
(function (root) {
'use strict';

/* ============ Данные ============ */
const RES = [
  { id: 'food', n: 'Еда', l: 'Food', r: 'ᚠ' }, { id: 'wood', n: 'Дерево', l: 'Wood', r: 'ᛒ' }, { id: 'stone', n: 'Камень', l: 'Stone', r: 'ᚲ' },
  { id: 'iron', n: 'Железо', l: 'Iron', r: 'ᛁ' }, { id: 'silver', n: 'Серебро', l: 'Silver', r: 'ᛊ' }
];
const RI = {}; RES.forEach(r => RI[r.id] = r);
const MAXL = 30;   // высший уровень зданий
const TMAX = 15;   // высший уровень знаний Оракула
/* Рост цен и времени: до 9 уровня круто (как раньше), дальше мягче, чтобы цены оставались по силам складу. */
const grow = (L, a, b) => Math.pow(a, Math.min(L, 9)) * Math.pow(b, Math.max(0, L - 9));
const B = {
  hall:       { n: 'Палата ярла',      r: 'ᛟ', cost: { wood: 120, stone: 100 }, t: 25 },
  farm:       { n: 'Ферма',            r: 'ᚠ', res: 'food',   base: 300, cost: { wood: 60, stone: 30 }, t: 15 },
  sawmill:    { n: 'Лесопилка',        r: 'ᛒ', res: 'wood',   base: 300, cost: { wood: 40, stone: 40 }, t: 15 },
  quarry:     { n: 'Каменоломня',      r: 'ᚲ', res: 'stone',  base: 260, cost: { wood: 70, stone: 20 }, t: 15 },
  ironmine:   { n: 'Железный рудник',  r: 'ᛁ', res: 'iron',   base: 200, cost: { wood: 80, stone: 60 }, t: 18 },
  silvermine: { n: 'Серебряная шахта', r: 'ᛊ', res: 'silver', base: 120, cost: { wood: 120, stone: 90, iron: 40 }, t: 22 },
  storehouse: { n: 'Амбар',            r: 'ᛉ', cost: { wood: 90, stone: 70 }, t: 18 },
  vault:      { n: 'Хранилище',        r: 'ᚺ', cost: { wood: 100, stone: 120, iron: 50 }, t: 20 },
  barracks:   { n: 'Казарма',          r: 'ᛏ', cost: { wood: 100, stone: 80, iron: 30 }, t: 20 },
  oracle:     { n: 'Оракул',           r: 'ᚨ', cost: { wood: 120, stone: 100, silver: 60 }, t: 25 }
};
const BORDER = ['hall', 'farm', 'sawmill', 'quarry', 'ironmine', 'silvermine', 'storehouse', 'vault', 'barracks', 'oracle'];
const U = {
  spear:  { n: 'Копейщик', pl: 'Копейщики', atk: 10, def: 14, carry: 20, cost: { food: 30, wood: 25 }, t: 6,  need: 1, counters: 'cav' },
  archer: { n: 'Лучник',   pl: 'Лучники',   atk: 16, def: 8,  carry: 15, cost: { food: 20, wood: 40 }, t: 8,  need: 2, counters: 'spear' },
  cav:    { n: 'Всадник',  pl: 'Всадники',  atk: 18, def: 10, carry: 35, cost: { food: 50, iron: 40, silver: 5 }, t: 12, need: 3, counters: 'archer' }
};
/* Ступени воинов: улучшаются в Казарме, усиливают всех воинов этого вида сразу. */
const TIERN = {
  spear: ['Ополченец', 'Копейщик', 'Щитоносец', 'Дружинник', 'Хирдман', 'Гвардеец', 'Королевский страж'],
  archer: ['Охотник', 'Лучник', 'Следопыт', 'Меткий стрелок', 'Ловчий', 'Северный стрелок', 'Королевский лучник'],
  cav: ['Наездник', 'Всадник', 'Разведчик', 'Конный дружинник', 'Латный всадник', 'Тяжёлый всадник', 'Королевский рыцарь']
};
const TIER_NEED = [1, 4, 8, 12, 16, 21, 26];   // какая Казарма нужна для ступени
const MAXT = 7;
const HSK = {
  atk:  { n: 'Ярость',   d: '+3% к атаке всех воинов за уровень' },
  def:  { n: 'Стойкость', d: '+3% к защите города за уровень' },
  loot: { n: 'Хватка',   d: '+5% к ноше воинов за уровень' }
};
const MAXHL = 30, MAXSK = 10;
const WEAK = {}; Object.keys(U).forEach(k => { WEAK[k] = Object.keys(U).find(x => U[x].counters === k); });
const TECH = {
  atk: { n: 'Закалённая сталь', d: '+6% к атаке за уровень', r: 'ᛏ' },
  def: { n: 'Стена щитов',      d: '+6% к защите за уровень', r: 'ᚺ' },
  eco: { n: 'Дары земли',       d: '+5% к добыче за уровень', r: 'ᚠ' }
};
const CAMPS = ['Лагерь разбойников', 'Стоянка мародёров', 'Логово берсерков', 'Засада изгоев'];
const N1 = ['Бьорн', 'Ульф', 'Рагнар', 'Гуннар', 'Эйрик', 'Свейн', 'Торвальд', 'Хальвдан', 'Ивар', 'Олаф', 'Харальд', 'Сигурд', 'Ингвар', 'Гейр'];
const N2 = ['Рыжий', 'Тихий', 'Сивый', 'Крепкий', 'Одноглазый', 'Кривой', 'Седой', 'Мрачный', 'Костолом'];
const NODE = { food: 'Поля', wood: 'Лес', stone: 'Каменная гряда', iron: 'Железная жила', silver: 'Серебряная жила' };

/* Множитель времени: 1 = быстро (для проверки), 10 = нормальный темп. Сервер присылает своё значение. */
const CFG = { t: 10 };

let nowMs = () => Date.now();
let S = null;
let quiet = false;
let toastFn = () => {};
const HOOK = {
  dist: () => 12,
  pickPlayers: () => [],
  getState: () => null,
  touch: () => {}
};

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sum = o => Object.values(o).reduce((x, y) => x + (y || 0), 0);
const toast = txt => { if (!quiet) toastFn(txt); };

const QUESTS = [
  { id: 'q1',  t: 'Подними Лесопилку до 3 уровня',      cur: () => lvl('sawmill'), max: 3,  rw: { wood: 300, stone: 150 } },
  { id: 'q2',  t: 'Подними Палату ярла до 3 уровня',    cur: () => lvl('hall'),    max: 3,  rw: { food: 400, wood: 400, haste: 1, gems: 3 } },
  { id: 'q3',  t: 'Обучи 20 воинов',                    cur: () => S.stat.trained, max: 20, rw: { food: 300, iron: 100 } },
  { id: 'q4',  t: 'Разгроми лагерь разбойников',        cur: () => S.stat.campWins, max: 1, rw: { silver: 200, haste: 1 } },
  { id: 'q5',  t: 'Построй Хранилище',                  cur: () => lvl('vault'),   max: 1,  rw: { stone: 400, iron: 150 } },
  { id: 'q6',  t: 'Изучи первое знание в Оракуле',      cur: () => S.stat.researched, max: 1, rw: { silver: 300, haste: 1 } },
  { id: 'q7',  t: 'Одержи 5 побед в походах',           cur: () => S.stat.wins,    max: 5,  rw: { food: 600, wood: 600, iron: 300, haste: 2, gems: 5 } },
  { id: 'q8',  t: 'Отбей набег врага',                  cur: () => S.stat.defWins, max: 1,  rw: { silver: 300, iron: 200, haste: 1 } },
  { id: 'q9',  t: 'Подними Казарму до 3 уровня',        cur: () => lvl('barracks'), max: 3, rw: { iron: 300, silver: 150 } },
  { id: 'q10', t: 'Собери ресурсы на точке карты',      cur: () => S.stat.gathered, max: 1, rw: { food: 300, wood: 300, haste: 1 } },
  { id: 'q12', t: 'Подними ярла до 3 уровня',            cur: () => heroOf(S).lv, max: 3, rw: { silver: 200, food: 300, haste: 1 } },
  { id: 'q13', t: 'Улучши воинов до 2 ступени',         cur: () => Object.keys(U).filter(k => tierOf(S, k) >= 2).length, max: 1, rw: { iron: 300, silver: 200, haste: 1 } },
  { id: 'q14', t: 'Подними Палату ярла до 10 уровня',   cur: () => lvl('hall'),    max: 10, rw: { food: 3000, wood: 3000, stone: 2000, haste: 3, gems: 10 } },
  { id: 'q15', t: 'Подними ярла до 10 уровня',          cur: () => heroOf(S).lv,   max: 10, rw: { silver: 1500, iron: 1500, haste: 3, gems: 8 } },
  { id: 'q16', t: 'Подними Палату ярла до 20 уровня',   cur: () => lvl('hall'),    max: 20, rw: { food: 12000, wood: 12000, stone: 8000, iron: 5000, haste: 6, gems: 20 } },
  { id: 'q17', t: 'Одержи 25 побед в походах',          cur: () => S.stat.wins,    max: 25, rw: { silver: 2000, iron: 2000, haste: 4, gems: 12 } },
  { id: 'q11', t: 'Разграбь город другого игрока',      cur: () => S.stat.pvpWins, max: 1,  rw: { silver: 400, iron: 300, haste: 2 } }
];

/* ============ Состояние ============ */
function newState(name, pid) {
  const t = nowMs();
  return {
    v: 3, pid: pid || '', name: name || 'Ярл', t, created: t,
    res: { food: 800, wood: 800, stone: 600, iron: 300, silver: 150 },
    b: { hall: 1, farm: 1, sawmill: 1, quarry: 1, ironmine: 1, silvermine: 0, storehouse: 1, vault: 0, barracks: 1, oracle: 0 },
    tech: { atk: 0, def: 0, eco: 0 }, q: null, train: null, study: null,
    troops: { spear: 12, archer: 0, cav: 0 }, marches: [], targets: [], tgtAt: 0,
    shield: t + 90 * 60000, nextRaid: t + 120 * 60000, haste: 2,
    stat: { trained: 0, wins: 0, campWins: 0, researched: 0, defWins: 0, built: 0, gathered: 0, pvpWins: 0 },
    tier: { spear: 1, archer: 1, cav: 1 }, upg: null, hero: { lv: 1, xp: 0, sp: 0, sk: { atk: 0, def: 0, loot: 0 } },
    claimed: {}, log: [], mid: 1, introDone: false,
    gems: 0, vip: 0, daily: 0, bought: {}
  };
}
function use(st) { S = st; }
/* Старые сохранения без героя и ступеней получают их при первом обновлении. */
function ensure(st) {
  if (!st.tier) st.tier = { spear: 1, archer: 1, cav: 1 };
  if (!st.hero) st.hero = { lv: 1, xp: 0, sp: 0, sk: { atk: 0, def: 0, loot: 0 } };
  if (st.upg === undefined) st.upg = null;
  if (st.gems === undefined) { st.gems = 0; st.vip = 0; st.daily = 0; st.bought = {}; }
}
const tierOf = (st, k) => (st.tier && st.tier[k]) || 1;
const heroOf = st => st.hero || { lv: 1, xp: 0, sp: 0, sk: { atk: 0, def: 0, loot: 0 } };
const tmul = t => 1 + 0.3 * (t - 1);
const tiersOf = st => { const o = {}; for (const k in U) o[k] = tierOf(st, k); return o; };
const botTiers = L => { const t = Math.min(MAXT, 1 + Math.floor((Math.max(1, L) - 1) / 4)); return { spear: t, archer: t, cav: t }; };
const atkB = st => 1 + 0.06 * st.tech.atk + 0.03 * (heroOf(st).sk.atk || 0);
const defB = st => 1 + 0.06 * st.tech.def + 0.03 * (heroOf(st).sk.def || 0);
const lootB = st => 1 + 0.05 * (heroOf(st).sk.loot || 0);
const unitName = (k, t) => TIERN[k][(t || 1) - 1];
const xpNeed = L => 80 + 60 * L;
const tierCost = (k, to) => { const f = Math.pow(2.2, to - 2); return { food: Math.round(300 * f), iron: Math.round(200 * f), silver: Math.round(120 * f) }; };
const tierSecs = to => Math.round(60 * Math.pow(2, to - 2) * CFG.t);
function gainXp(n) {
  const H = S.hero; if (H.lv >= MAXHL) return;
  H.xp += n;
  while (H.lv < MAXHL && H.xp >= xpNeed(H.lv)) { H.xp -= xpNeed(H.lv); H.lv++; H.sp++; addLog(`Ярл достиг ${H.lv} уровня. Есть очко навыка.`, 'good'); toast(`Ярл: уровень ${H.lv}`); }
  if (H.lv >= MAXHL) H.xp = 0;
}
const lvl = id => S.b[id] || 0;
const slots = h => 1 + (h >= 4 ? 1 : 0) + (h >= 8 ? 1 : 0) + (h >= 14 ? 1 : 0) + (h >= 20 ? 1 : 0);
const capAt = (st, h) => 2000 + 1500 * (st - 1) + 250 * (h - 1);
const isVip = () => (S.vip || 0) > nowMs();
const cap = () => Math.round(capAt(lvl('storehouse'), lvl('hall')) * (isVip() ? 1.2 : 1));
const ecoMul = () => (1 + 0.05 * S.tech.eco) * (isVip() ? 1.15 : 1);
const prot = () => 300 * lvl('vault');
function prodAt(id, L) { const b = B[id]; return L ? Math.round(b.base * L * (1 + 0.12 * (L - 1)) * ecoMul()) : 0; }
function rate(rid) { const id = BORDER.find(k => B[k].res === rid); return prodAt(id, lvl(id)); }
const upCost = (id, L) => { const o = {}; for (const k in B[id].cost) o[k] = Math.round(B[id].cost[k] * grow(L, 1.55, 1.10)); return o; };
const upSecs = (id, L) => Math.round(B[id].t * grow(L, 1.5, 1.12) * CFG.t);
const canAfford = c => Object.keys(c).every(k => S.res[k] >= c[k]);
const pay = c => { for (const k in c) S.res[k] -= c[k]; };
const trainRate = () => 1 + 0.15 * (lvl('barracks') - 1);
const maxBatch = () => 10 * lvl('barracks');
const trainSecs = (k, n) => Math.max(3, Math.round(n * U[k].t / trainRate() * CFG.t));
const techCost = L => ({ silver: Math.round(120 * grow(L, 1.6, 1.1)), food: Math.round(100 * grow(L, 1.5, 1.1)) });
const techSecs = L => Math.round(40 * grow(L, 1.55, 1.1) * CFG.t);
const gatherSecs = () => 25 * CFG.t;
const marchSecs = d => Math.round(d * CFG.t);

function addLogTo(st, txt, k, t) { st.log.unshift({ t: t || nowMs(), txt, k: k || 'info' }); if (st.log.length > 60) st.log.pop(); }
const addLog = (txt, k, t) => addLogTo(S, txt, k, t);

function score(st) {
  let s = 0;
  for (const k in B) s += (st.b[k] || 0) * 40;
  for (const k in U) s += (st.troops[k] || 0) * (U[k].atk + U[k].def) / 2;
  for (const k in st.tech) s += st.tech[k] * 50;
  s += heroOf(st).lv * 30;
  for (const k in U) s += (tierOf(st, k) - 1) * 60;
  return Math.round(s);
}

/* ============ Бой ============ */
function power(comp, other, key, bonus, tiers) {
  const tot = sum(other) || 1; let p = 0;
  for (const k in U) {
    const n = comp[k] || 0; if (!n) continue;
    const m = 1 + 0.5 * ((other[U[k].counters] || 0) / tot) - 0.35 * ((other[WEAK[k]] || 0) / tot);
    p += n * U[k][key] * tmul((tiers && tiers[k]) || 1) * m;
  }
  return p * bonus;
}
function battle(a, d, ab, db, ta, td) {
  const pa = power(a, d, 'atk', ab, ta), pd = power(d, a, 'def', db, td);
  const win = pa > pd; const W = Math.max(pa, pd), L = Math.min(pa, pd);
  const ratio = W > 0 ? L / W : 1;
  const lw = 0.55 * Math.pow(ratio, 1.7), ll = 0.7 + 0.25 * ratio;
  const fa = win ? lw : ll, fd = win ? ll : lw;
  const lose = (c, f) => { const lost = {}, surv = {}; for (const k in U) { const n = c[k] || 0; const x = Math.min(n, Math.round(n * f)); lost[k] = x; surv[k] = n - x; } return { lost, surv }; };
  const A = lose(a, fa), D = lose(d, fd);
  return { win, pa, pd, ratio, lostA: A.lost, survA: A.surv, lostD: D.lost, survD: D.surv };
}
function randComp(n, keys) {
  const c = { spear: 0, archer: 0, cav: 0 }; let left = n;
  keys.forEach((k, i) => { const x = i === keys.length - 1 ? left : Math.round(left * rnd(0.25, 0.65)); c[k] = x; left -= x; });
  return c;
}

/* ============ Цели на карте ============ */
function playerTarget(p) {
  return { id: 't' + (S.mid++), kind: 'player', pid: p.pid, name: p.name, level: p.level, comp: p.comp, loot: {}, defb: 1, res: null, dist: p.dist || ri(10, 35), shieldAt: p.shield, seenAt: nowMs() };
}
/* Если в списке нет живых игроков, а они появились, подменяем ими ботов-ярлов. */
function topUpPlayers() {
  if (S.targets.some(t => t.kind === 'player')) return;
  HOOK.pickPlayers(S, 2).forEach(p => {
    const i = S.targets.findIndex(t => t.kind === 'jarl'); if (i >= 0) S.targets.splice(i, 1);
    S.targets.push(playerTarget(p));
  });
}
function genTarget(kind) {
  const H = lvl('hall');
  kind = kind || pick(['camp', 'jarl', 'node']);
  if (kind === 'player') {
    const p = HOOK.pickPlayers(S, 1)[0];
    if (p) return playerTarget(p);
    kind = 'jarl';
  }
  const level = Math.max(1, Math.min(MAXL, ri(Math.max(1, H - 1), H + 2)));
  const base = Math.pow(level, 1.5);
  const loot = {}; let comp = { spear: 0, archer: 0, cav: 0 }, name, defb = 1, res = null;
  if (kind === 'camp') {
    comp = randComp(Math.round(5 * base + ri(0, 3)), shuffle(Object.keys(U)).slice(0, 2));
    name = pick(CAMPS);
    const f = 110 * Math.pow(level, 1.3);
    shuffle(RES.map(r => r.id)).slice(0, 3).forEach(r => { loot[r] = Math.round(f * rnd(0.8, 1.3)); });
  } else if (kind === 'jarl') {
    comp = randComp(Math.round(7 * base + ri(0, 4)), shuffle(Object.keys(U)));
    name = pick(N1) + ' ' + pick(N2); defb = 1.15;
    const f = 150 * Math.pow(level, 1.3);
    RES.forEach(r => { loot[r.id] = Math.round(f * rnd(0.7, 1.3)); });
  } else {
    res = pick(RES.map(r => r.id)); name = NODE[res];
    loot[res] = Math.round(350 * Math.pow(level, 1.2) * rnd(0.8, 1.3));
  }
  return { id: 't' + (S.mid++), kind, name, level, comp, loot, defb, res, dist: ri(8, 32) };
}
function refreshTargets() {
  S.targets = [];
  ['node', 'node', 'node', 'node', 'camp', 'camp', 'camp', 'camp'].forEach(k => S.targets.push(genTarget(k)));
  HOOK.pickPlayers(S, 4).forEach(p => S.targets.push(playerTarget(p)));
  while (S.targets.filter(t => t.kind === 'player' || t.kind === 'jarl').length < 2) S.targets.push(genTarget('jarl'));
  S.tgtAt = nowMs();
}

/* ============ Игровой цикл ============ */
function produce(to) {
  if (to <= S.t) return;
  const dt = (to - S.t) / 3600000, c = cap();
  RES.forEach(r => { const v = S.res[r.id]; if (v < c) S.res[r.id] = Math.min(c, v + rate(r.id) * dt); });
  S.t = to;
}
function nextEvent(tn) {
  const c = [];
  if (S.q && S.q.end <= tn) c.push({ time: S.q.end, run: finishBuild });
  if (S.train && S.train.end <= tn) c.push({ time: S.train.end, run: finishTrain });
  if (S.study && S.study.end <= tn) c.push({ time: S.study.end, run: finishStudy });
  if (S.upg && S.upg.end <= tn) c.push({ time: S.upg.end, run: finishUpg });
  S.marches.forEach(m => {
    if (m.phase === 'gather' && m.gEnd <= tn) c.push({ time: m.gEnd, run: () => endGather(m) });
    if (m.phase === 'out' && m.arrive <= tn) c.push({ time: m.arrive, run: () => resolveMarch(m) });
    if (m.phase === 'back' && m.back <= tn) c.push({ time: m.back, run: () => returnMarch(m) });
  });
  if (S.nextRaid <= tn) c.push({ time: S.nextRaid, run: enemyRaid });
  c.sort((a, b) => a.time - b.time);
  return c[0];
}
function update() {
  ensure(S);
  wkSync(S);
  const tn = nowMs();
  if (S.nextRaid < tn - 100 * 60000) S.nextRaid = tn - 100 * 60000;
  let g = 0, ev;
  while (g++ < 300 && (ev = nextEvent(tn))) { produce(Math.max(ev.time, S.t)); ev.run(); }
  produce(tn);
}
/* Довести чужой город до момента to (стройки, обучение, добыча). Походы и набеги не трогаем. */
function settle(D, to) {
  const keep = S, kq = quiet; S = D; quiet = true;
  try {
    for (let g = 0; g < 20; g++) {
      const c = [];
      if (S.q && S.q.end <= to) c.push({ time: S.q.end, run: finishBuild });
      if (S.train && S.train.end <= to) c.push({ time: S.train.end, run: finishTrain });
      if (S.study && S.study.end <= to) c.push({ time: S.study.end, run: finishStudy });
      if (S.upg && S.upg.end <= to) c.push({ time: S.upg.end, run: finishUpg });
      if (!c.length) break;
      c.sort((a, b) => a.time - b.time);
      produce(Math.max(c[0].time, S.t)); c[0].run();
    }
    produce(to);
  } finally { S = keep; quiet = kq; }
}
function finishBuild() {
  const q = S.q; S.b[q.id] = q.to; S.q = null; S.stat.built++;
  addLog(`${B[q.id].n} достигла уровня ${q.to}.`, 'good', q.end); toast(`${B[q.id].n}: уровень ${q.to}`);
}
function finishTrain() {
  const t = S.train; S.troops[t.type] += t.n; S.stat.trained += t.n; S.train = null;
  addLog(`Обучено: ${t.n} × ${U[t.type].n}.`, 'good', t.end); toast(`Обучено: ${t.n} × ${U[t.type].n}`);
}
function finishUpg() {
  const u = S.upg; S.tier[u.key] = u.to; S.upg = null;
  addLog(`Воины улучшены: ${unitName(u.key, u.to)} (ступень ${u.to}).`, 'good', u.end); toast(`Ступень ${u.to}: ${unitName(u.key, u.to)}`);
}
function finishStudy() {
  const s = S.study; S.tech[s.key] = s.to; S.stat.researched++; S.study = null;
  addLog(`Оракул открыл знание «${TECH[s.key].n}», уровень ${s.to}.`, 'good', s.end); toast(`Знание: ${TECH[s.key].n} ${s.to}`);
}
function fmtRes(o) { return Object.keys(o).filter(k => o[k] > 0 && RI[k]).map(k => `${RI[k].n} ${fmt(o[k])}`).join(' · ') || 'ничего'; }
function fmtComp(c) { return Object.keys(U).filter(k => (c[k] || 0) > 0).map(k => `${U[k].pl} ${c[k]}`).join(' · '); }
const carryOf = (s, st) => { st = st || S; return Math.round(Object.keys(U).reduce((a, k) => a + (s[k] || 0) * U[k].carry * tmul(tierOf(st, k)), 0) * lootB(st)); };

function resolveMarch(m) {
  const tg = m.tgt, t = m.arrive;
  if (tg.kind === 'node') {
    const carry = carryOf(m.send);
    m.loot = {}; for (const k in tg.loot) m.loot[k] = Math.min(carry, tg.loot[k]);
    m.phase = 'gather'; m.gStart = t; m.gEnd = t + gatherSecs() * 1000; return;
  }
  if (tg.kind === 'player') return resolvePlayer(m);
  const r = battle(m.send, tg.comp, atkB(S), tg.defb, tiersOf(S), botTiers(tg.level));
  if (r.win) {
    gainXp(tg.kind === 'camp' ? 25 + 10 * tg.level : 35 + 12 * tg.level);
    const carry = carryOf(r.survA);
    const tot = sum(tg.loot), f = tot > 0 ? Math.min(1, carry / tot) : 0;
    m.loot = {}; for (const k in tg.loot) m.loot[k] = Math.floor(tg.loot[k] * f);
    m.send = r.survA; m.phase = 'back'; m.back = t + m.dur;
    S.stat.wins++; if (tg.kind === 'camp') S.stat.campWins++;
    S.targets = S.targets.filter(x => x.id !== tg.id); S.targets.push(genTarget(tg.kind));
    addLog(`Победа над «${tg.name}». Потери: ${fmtComp(r.lostA) || 'нет'}. Добыча: ${fmtRes(m.loot)}.`, 'good', t);
    toast(`Победа над «${tg.name}»`);
  } else {
    m.loot = {}; m.send = r.survA;
    addLog(`Поражение у «${tg.name}». Потери: ${fmtComp(r.lostA) || 'нет'}.`, 'bad', t);
    toast(`Поражение у «${tg.name}»`);
    if (sum(r.survA) > 0) { m.phase = 'back'; m.back = t + m.dur; }
    else S.marches = S.marches.filter(x => x !== m);
  }
}
function resolvePlayer(m) {
  const tg = m.tgt, t = m.arrive, A = S;
  const home = () => { m.phase = 'back'; m.back = t + m.dur; };
  const D = HOOK.getState(tg.pid);
  if (!D) { m.loot = {}; home(); addLog(`Ярл «${tg.name}» исчез. Отряд вернулся.`, 'info', t); S.targets = S.targets.filter(x => x.id !== tg.id); S.targets.push(genTarget('player')); return; }
  settle(D, Math.max(t, D.t));
  if (D.shield > t) { m.loot = {}; home(); addLog(`Город «${tg.name}» под щитом. Отряд вернулся без боя.`, 'info', t); toast('Цель под щитом'); return; }
  const r = battle(m.send, D.troops, atkB(A), defB(D), tiersOf(A), tiersOf(D));
  D.troops = r.survD;
  const aName = A.name || 'Неизвестный ярл';
  const raid = (win, loot) => { (D.raids || (D.raids = [])).unshift({ t, pid: A.pid, name: aName, win, lost: fmtComp(r.lostD) || '', loot: loot || '' }); if (D.raids.length > 20) D.raids.pop(); };
  if (r.win) {
    const pr = 300 * (D.b.vault || 0), take = {}; let tot = 0;
    RES.forEach(x => { const a = Math.floor(Math.max(0, D.res[x.id] - pr) * 0.25); take[x.id] = a; tot += a; });
    const f = tot > 0 ? Math.min(1, carryOf(r.survA) / tot) : 0;
    m.loot = {}; RES.forEach(x => { const g = Math.floor(take[x.id] * f); m.loot[x.id] = g; D.res[x.id] -= g; });
    D.shield = t + 45 * 60000; raid(true, fmtRes(m.loot));
    addLogTo(D, `Ярл «${aName}» разграбил ваш город. Унесли: ${fmtRes(m.loot)}. Погибло: ${fmtComp(r.lostD) || 'никто'}. Щит на 45 минут.`, 'bad', t);
    m.send = r.survA; home();
    A.stat.wins++; A.stat.pvpWins++; gainXp(60 + 15 * (tg.level || 1));
    addLog(`Победа над ярлом «${tg.name}». Потери: ${fmtComp(r.lostA) || 'нет'}. Добыча: ${fmtRes(m.loot)}.`, 'good', t);
    toast(`Победа над «${tg.name}»`);
    S.targets = S.targets.filter(x => x.id !== tg.id); S.targets.push(genTarget('player'));
  } else {
    D.stat.defWins++; raid(false);
    addLogTo(D, `Вы отбили нападение ярла «${aName}». Павшие: ${fmtComp(r.lostD) || 'нет'}.`, 'good', t);
    m.loot = {}; m.send = r.survA;
    addLog(`Поражение у ярла «${tg.name}». Потери: ${fmtComp(r.lostA) || 'нет'}.`, 'bad', t);
    toast(`Поражение у «${tg.name}»`);
    if (sum(r.survA) > 0) home(); else S.marches = S.marches.filter(x => x !== m);
  }
  HOOK.touch(tg.pid);
}
function endGather(m) {
  const tg = m.tgt;
  m.phase = 'back'; m.back = m.gEnd + m.dur; S.stat.gathered = (S.stat.gathered || 0) + 1; gainXp(15);
  S.targets = S.targets.filter(x => x.id !== tg.id); S.targets.push(genTarget('node'));
  addLog(`Сбор у «${tg.name}» окончен. Несут: ${fmtRes(m.loot)}.`, 'good', m.gEnd);
  toast(`Сбор окончен: ${tg.name}`);
}
function returnMarch(m) {
  for (const k in m.send) S.troops[k] = (S.troops[k] || 0) + m.send[k];
  for (const k in m.loot) S.res[k] += m.loot[k];
  S.marches = S.marches.filter(x => x !== m);
  toast('Дружина вернулась домой');
}
function enemyRaid() {
  const t = S.nextRaid; S.nextRaid = t + ri(35, 60) * 60000;
  if (S.shield > t) return;
  const H = lvl('hall');
  const n = Math.max(4, Math.round(4 * Math.pow(H, 1.55) * rnd(0.8, 1.5)));
  const comp = randComp(n, shuffle(Object.keys(U)).slice(0, 2));
  const r = battle(comp, S.troops, 1, defB(S), botTiers(H), tiersOf(S));
  S.troops = r.survD;
  if (r.win) {
    const lost = {};
    RES.forEach(x => { const l = Math.floor(Math.max(0, S.res[x.id] - prot()) * 0.25); S.res[x.id] -= l; lost[x.id] = l; });
    S.shield = t + 45 * 60000;
    addLog(`Набег! ${n} врагов прорвались в город. Унесли: ${fmtRes(lost)}. Погибло: ${fmtComp(r.lostD) || 'никто'}. Щит на 45 минут.`, 'bad', t);
    toast('Враги разграбили город');
  } else {
    S.stat.defWins++; gainXp(20);
    addLog(`Набег отбит! ${n} врагов разбиты. Павшие: ${fmtComp(r.lostD) || 'нет'}.`, 'good', t);
    toast('Вы отбили набег');
  }
}

/* ============ Действия ============ */
function canUp(id) {
  const L = lvl(id);
  if (L >= MAXL) return 'Максимальный уровень';
  if (id !== 'hall' && L + 1 > lvl('hall')) return `Нужна Палата ярла ур. ${L + 1}`;
  return '';
}
function startBuild(id) {
  if (!B[id] || S.q || canUp(id)) return;
  const L = lvl(id), c = upCost(id, L);
  if (!canAfford(c)) return;
  pay(c); const dur = upSecs(id, L) * 1000;
  S.q = { id, to: L + 1, end: nowMs() + dur, dur, sid: 'j' + (S.mid++) };
}
function startTrain(k, n) {
  n = Math.floor(Number(n)); if (!isFinite(n)) return;
  const u = U[k]; if (!u) return;
  if (S.train || lvl('barracks') < u.need || n < 1 || n > maxBatch()) return;
  const c = {}; for (const r in u.cost) c[r] = u.cost[r] * n;
  if (!canAfford(c)) return;
  pay(c); const dur = trainSecs(k, n) * 1000;
  S.train = { type: k, n, end: nowMs() + dur, dur, sid: 'j' + (S.mid++) };
}
function startStudy(k) {
  if (!TECH[k]) return;
  const L = S.tech[k];
  if (S.study || L >= TMAX || lvl('oracle') < L + 1) return;
  const c = techCost(L); if (!canAfford(c)) return;
  pay(c); const dur = techSecs(L) * 1000;
  S.study = { key: k, to: L + 1, end: nowMs() + dur, dur, sid: 'j' + (S.mid++) };
}
function startUpg(k) {
  if (!U[k] || S.upg) return;
  const to = tierOf(S, k) + 1;
  if (to > MAXT || lvl('barracks') < TIER_NEED[to - 1]) return;
  const c = tierCost(k, to); if (!canAfford(c)) return;
  pay(c); const dur = tierSecs(to) * 1000;
  S.upg = { key: k, to, end: nowMs() + dur, dur, sid: 'j' + (S.mid++) };
}
function spendSkill(k) {
  const H = S.hero; if (!HSK[k] || H.sp < 1 || (H.sk[k] || 0) >= MAXSK) return;
  H.sp--; H.sk[k] = (H.sk[k] || 0) + 1;
}
function jobObj(kind) { return kind === 'q' ? S.q : kind === 'train' ? S.train : kind === 'study' ? S.study : kind === 'upg' ? S.upg : null; }
/* ---- клан: помощь соклановцев ---- */
const CLAN_COST = { wood: 500, stone: 500 }, CLAN_HALL = 3;
function jobInfo(kind) {
  const o = jobObj(kind); if (!o) return null;
  if (!o.sid) o.sid = 'j' + (S.mid++);
  const what = kind === 'q' ? `${B[o.id].n}, ур. ${o.to}` : kind === 'train' ? `${U[o.type].n} ×${o.n}` : kind === 'study' ? `${TECH[o.key].n}, ур. ${o.to}` : `${unitName(o.key, o.to)}`;
  return { kind, sid: o.sid, end: o.end, dur: o.dur, what };
}
function helpJob(kind, sid, cutMs) {
  const o = jobObj(kind); if (!o || o.sid !== sid || o.end <= nowMs() + 1000) return false;
  o.end = Math.max(nowMs() + 1000, o.end - cutMs); return true;
}
/* Создание клана стоит ресурсов и требует Палату ярла 3 уровня. Возвращает текст ошибки или ''. */
function chargeClan() {
  if (lvl('hall') < CLAN_HALL) return `Для клана нужна Палата ярла ${CLAN_HALL} уровня.`;
  if (!canAfford(CLAN_COST)) return 'Не хватает ресурсов: нужно 500 дерева и 500 камня.';
  pay(CLAN_COST); return '';
}
function useHaste(kind) { const o = jobObj(kind); if (!o || S.haste < 1) return; S.haste--; o.end -= 300000; }
function freeFinish(kind) { const o = jobObj(kind); if (!o) return; if (o.end - nowMs() <= 60000) o.end = nowMs(); }
function sendMarch(tid, send) {
  const tg = S.targets.find(x => x.id === tid);
  if (!tg || S.marches.length >= slots(lvl('hall')) || !send || typeof send !== 'object') return false;
  const s = {}; let tot = 0;
  for (const k in U) { const v = Math.floor(Number(send[k])) || 0; s[k] = Math.max(0, Math.min(S.troops[k] || 0, v)); tot += s[k]; }
  if (!tot) return false;
  for (const k in U) S.troops[k] -= s[k];
  const t = nowMs(), dur = marchSecs(tg.dist) * 1000;
  S.marches.push({ id: 'm' + (S.mid++), tgt: JSON.parse(JSON.stringify(tg)), send: s, phase: 'out', arrive: t + dur, back: 0, loot: {}, dur });
  return true;
}
function claim(id) {
  const q = QUESTS.find(x => x.id === id);
  if (!q || S.claimed[id] || q.cur() < q.max) return;
  S.claimed[id] = true;
  for (const k in q.rw) { if (k === 'haste') S.haste += q.rw[k]; else if (k === 'gems') S.gems += q.rw[k]; else S.res[k] += q.rw[k]; }
  addLog(`Награда за дело «${q.t}».`, 'good'); toast('Награда получена');
}

/* ============ Магазин ============ */
/* Все покупки идут за рунные камни и проверяются на сервере. */
const SHOP = [
  { id: 'haste5',   g: 'haste',  t: 'Ускорение ×5',    d: 'Пять ускорений. Каждое сокращает дело на 5 минут.',          gems: 15,  haste: 5 },
  { id: 'haste25',  g: 'haste',  t: 'Ускорение ×25',   d: 'Двадцать пять ускорений. Выгоднее на 20%.',                  gems: 60,  haste: 25 },
  { id: 'haste100', g: 'haste',  t: 'Ускорение ×100',  d: 'Сто ускорений. Выгоднее на 33%.',                            gems: 200, haste: 100 },
  { id: 'shield8',  g: 'shield', t: 'Щит на 8 часов',  d: 'Никто не сможет напасть на ваш город.',                      gems: 20,  shieldH: 8 },
  { id: 'shield24', g: 'shield', t: 'Щит на 24 часа',  d: 'Сутки покоя для вашего города.',                             gems: 50,  shieldH: 24 },
  { id: 'shield72', g: 'shield', t: 'Щит на 3 дня',    d: 'Три дня без набегов.',                                       gems: 120, shieldH: 72 },
  { id: 'res4',     g: 'res',    t: 'Мешок припасов',  d: 'Четыре часа добычи всех ресурсов сразу.',                    gems: 25,  resH: 4 },
  { id: 'res24',    g: 'res',    t: 'Сундук припасов', d: 'Сутки добычи всех ресурсов сразу (не больше места на складе).', gems: 120, resH: 24 },
  { id: 'vip7',     g: 'vip',    t: 'VIP на 7 дней',   d: 'Добыча +15%, склад +20%, ежедневный дар больше, звезда в чате.',   gems: 80,  vipD: 7 },
  { id: 'vip30',    g: 'vip',    t: 'VIP на 30 дней',  d: 'То же самое на месяц. Выгоднее на 25%.',                     gems: 250, vipD: 30 }
];
const DAILY_MS = 20 * 3600 * 1000;
function dailyLeft() { return Math.max(0, (S.daily || 0) + DAILY_MS - nowMs()); }
function claimDaily() {
  if (dailyLeft() > 0) return false;
  const v = isVip();
  S.daily = nowMs(); S.haste += v ? 3 : 1; S.gems += v ? 8 : 3;
  addLog(`Ежедневный дар: ${v ? 3 : 1} ускор., ${v ? 8 : 3} рунных камн.`, 'good'); toast('Ежедневный дар получен');
  return true;
}
/* Место города на карте 100 на 100 и место цели (лагеря, точки сбора). Считается одинаково на сервере и в игре. */
/* Суша на карте 100 на 100: «1» это земля. Города и цели ставятся только на сушу (маска снята с картинки карты). */
const LAND = '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001110000000000000000000000000000000000000000000001100001000000000000000000000000000000000000000000000111000001100000000000000000000000000000000000001110000110000000000000000000000000000000000000000000011110000010000000000000000000000000000000010000111000000100000000000000000000000000000000000000000000111000011100000000000000000000000000000001110011111000000000000000000000000000000000000000000000000111111001100000000000000000000000000000011111001111110110000000000000000000000000000000000000000000011111110010000000000000000000000000000001111110111111111100011000000000000000000000000000000000000011111111111000000000000000000000000000000111111001111111111011100000000000000000000000000000000000000001111111100000000000000000000000000000011111110111111111111110100000000000000000000000000000000000000011111100000000000000000000000000000001111111111111111111111111111100000000000000000000000000000000101111100000000000000000000000000000000011111111111111111111111111110010000000000000000000000000000111111100000000000000000000000000000000001111111111111111111111111111000000000000000000000000000000111001110000000000000000000000000000000011111111111111111111111111111100100000000000000000000000000011000010000000000000000000000000000000000111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000000000001111111111111111111111111111111000000000000000000000000000000000000000000000000000000000000000000000011111111111111111111111111111100000000000000000000000000000000000100000000000000000010000000000000001111111111111111111111111111000000000011000000000000000000000000000000000000000000011110000000000001111111111111111111111111111100000000111111110000000000000000000000000000000000001111111011001000111111111111111111111111111111111111000111111111000000000000000000000000000000000000111111111111111111111111111111111111111111111111111110011111111000001111100000000000000000000000000011111111111111111111111111111111111111111111111111111111111111000000111100000000000000000000000000001111111111111111111111111111111111111111111111111111111111111000000111100000000000000000000000000001111111111111111111111111111111111111111111111111111111111111000000011100000000000000000000000000000011111111111111111111111111111111111111111111111111111111111110010111111100000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111111110000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111110000000000000000000000000000111111111111111111111111111111111111111111111111111111111111111111111111100000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111111110000000000000000000000000001111111111111111111111111111110111111111111111111111111111111111111111111000000000000000000000000000111111111111111111111111111111011111111111111111111111111111111111111110000000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111111000000000000000000000000000000111111111111111111111011111111111111111101111111111111111111111111111000000000000000000000000000000000100000111111111111011111111111111111011111111111111111111111111111100000000000000000000000000000000000000001111111111101111111111111111011111111111111111111111011111110000000000000000000000000000000000011111111111111111011111111111111100111111111111111111111001000100000000000000000000000000000000000000111111111111111001110001111111110011111111111111111111110000000000000000000000000000000000000000000001111111111111000010011111111110011111111111111111111111000000000000000000000000000000000000000000000111111111110000000011111101110111111111111111111111111110000000000000000000000000000000000000000011111111111111100000001111111111111111111111111111111111111000000000000000000000000000000000000000001110111111111110000001111111111111111111111111111111111110000000000000000000000000000000000000000110100011111111110000000011111111111111111111111111011111110000000000000000000000000000000000000000011110011111111111000000000111111111111111111111111110001111000000000000000000000000000000000000000000111011111111111110000000111111111111111111011111111111001100000000000000000000000000000000000000000011000111111111111000000011111111111111110000011111111111000000000000000000000000000000000000000000000111101111111111100000000111111111111110000000111111111111110010000000000000000000000000000000000000111110011110100000000010111111111111110000000011111111111111001000000001000000000000000000000000000000011000100000000000001111111111111000000001111111111111111101110001101100000000000000000000000000000011100000000000000000000111111111100000001111111111111111111111001111111000000100000000000000000000000110000000000000000000011111111100000011111111111111111111111111111111111001110000000000000000000000100000000000000000000000001111110000011111111111111111111111111111111111111111100000000000000000000000000000000000000000000000011110000011101111111111111111111111111111111111111111111000000000000000000000000001000000000000000000111100000000111111111111111111111111111111111111111111110000000000000000000000001111100000000000000011110000000011111111111111111111111111111111111111111111100000000000000000000000111100000000000000000110000000011111111111111111111111111111111111111111111111000000000000000000000011110000000000000000000000000001001111111111111111111111111111111111111111111100000000000000000000011111100000000000000000000000000000011111111111111111111111111111111111111111100000000000000000000000111000000000000000000000000000000001111111111111111111111111111111111111111110000000000000000001000000000000000000000000000000000000000111111111111111111111111111111111111111111100000000000000001110000000000000000000000000000000000001111111111111111111111111111111111111111111110000000000000001111000000000000000000000000000000000000111111111111111111111111111111111111111111111000000000000000011110000000000000000000000000000000000011111111111111111111111111111111111111111111000000000000000000110000000000000000000000000000000000000111111111111111111111111111111111111110111100000000000000000000001110000000000000000000000000010000111111111111111111111111111111111111110000001000000000000000000000111000000000000000000000001111000011111111111111111111111111111111111110000000000000000000000000000011100000000000000000000000111100011111111111111111111111111111111111111000000000000000000000000000001110000000000000000000000001111011111111111111111111111111111111111100000000000000000000000000000000001000000000000000000000000011111111111111111111111111111111111111000000000000000000000000000000000000000000000000000000000000001111111111111111111111111111111111111000000000000000000000000000000000000000000010000000000000000000111111111111111111111111111111011111100000000000000000000000000000000000000000000000000000000000000011111111111111111111111111111101111110000000000000000000000000000000000000000000000000000000000000001011111111111111111111111111110000011100000000000000000000000000000000000000000000000000000000000000001111111111111111111111111111110000110000000000000000000000000000000000000000000000000000000000000000011111111111111111111111111111000000000000000000000000000000000000000000011000000000000000000000000011111111111111111111111111111100000000000000000000000000000000000000000011100000000000000000000000000111111111111111111111111111100000000000000000000000000000000000000000000000000000000000000000000000001111111111111111111111111110000000000000000000000000000000100000000000000000000000000000000000000001111111111111111111111111111000000000000000000000000000000000000000000000000000000000000000000000000111111011111111111111111111111000000000000000000000000000000000000000000000000000000000000000000000011111100111111111111111111110000000000000000000000000000000000000000000000000000000000000000000000000111110011001111111111111111000000000000000000000000000000000000000000010000000000000000000000000000011110000000111111111111111000000000000000000000000000000000000000000001100000000000000000000000000011111000000010011111111111000000000000000001000000000000000000000000100111111000000000000000000000011111100000000001111111111100000000000000000000000000000000000000000111111111110000000000000000000011111110000000000111111111110000000000000000000000000000000000000000001111111111000000000000000000001111100111100000011000111100000000000000000000000000000000000000000000001111111000000000000000000000001100000100000000000011000000000000000000011100000000000000000000000000111111100000000000000000000000010000000000000000001100000000000000000011100000000000000000000000000111101110000000000000000000000000000000000000000000010000000000000000001100000000000000000000000000001000110000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const isLand = (x, y) => { const i = Math.floor(x), j = Math.floor(y); return i >= 0 && j >= 0 && i < 100 && j < 100 && LAND.charCodeAt(j * 100 + i) === 49; };
const LANDCELLS = []; for (let k = 0; k < LAND.length; k++) if (LAND.charCodeAt(k) === 49) LANDCELLS.push([k % 100, Math.floor(k / 100)]);
const posOf = pid => {
  const s = String(pid), h = parseInt(s.slice(0, 8), 16) || 0, j = parseInt(s.slice(8, 12), 16) || 0, c = LANDCELLS[h % LANDCELLS.length];
  return { x: c[0] + 0.1 + (j & 255) / 320, y: c[1] + 0.1 + ((j >> 8) & 255) / 320 };
};
function snapLand(x, y) {
  if (isLand(x, y)) return { x, y };
  for (let r = 1; r <= 40; r++) {
    let best = null, bd = 1e9;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const cx = Math.floor(x) + di, cy = Math.floor(y) + dj;
      if (!isLand(cx + .5, cy + .5)) continue;
      const d = Math.hypot(cx + .5 - x, cy + .5 - y); if (d < bd) { bd = d; best = { x: cx + .5, y: cy + .5 }; }
    }
    if (best) return best;
  }
  return { x, y };
}
function tgtPos(pid, tg) {
  if (tg.kind === 'player' && tg.pid) return posOf(tg.pid);
  const key = String(pid) + String(tg.id); let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const a = (h % 628) / 100, r = Math.min(45, Math.max(4, (tg.dist || 10) * 2.6)), p = posOf(pid);
  return snapLand(Math.max(1, Math.min(98, p.x + r * Math.cos(a))), Math.max(1, Math.min(98, p.y + r * Math.sin(a))));
}

/* Разведка: обновляет данные о войске живого игрока. Стоит серебра. */
const SCOUT_COST = 25;
function scout(tid) {
  const tg = S.targets.find(x => x.id === tid);
  if (!tg || tg.kind !== 'player') return false;
  const D = HOOK.getState(tg.pid);
  if (!D) { toast('Ярл исчез'); return false; }
  if (S.res.silver < SCOUT_COST) { toast('Не хватает серебра'); return false; }
  S.res.silver -= SCOUT_COST;
  settle(D, Math.max(nowMs(), D.t));
  tg.comp = Object.assign({}, D.troops); tg.shieldAt = D.shield; tg.level = D.b.hall; tg.seenAt = nowMs();
  toast('Разведка: данные обновлены');
  return true;
}
/* Месть: добавляет напавшего игрока в список целей. */
function revenge(pid) {
  const r = (S.raids || []).find(x => x.pid === pid && nowMs() - x.t < 48 * 3600000);
  if (!r) { toast('Этот набег уже забыт'); return false; }
  const D = HOOK.getState(pid);
  if (!D) { toast('Ярл исчез'); return false; }
  const ex = S.targets.find(x => x.kind === 'player' && x.pid === pid);
  if (ex) { toast('Этот ярл уже в списке ПВП'); return true; }
  settle(D, Math.max(nowMs(), D.t));
  const t = playerTarget({ pid, name: D.name, level: D.b.hall, comp: Object.assign({}, D.troops), shield: D.shield, dist: HOOK.dist(S.pid, pid) });
  const i = S.targets.findIndex(x => x.kind === 'jarl' || x.kind === 'player');
  if (i >= 0 && S.targets.filter(x => x.kind === 'player').length >= 6) S.targets.splice(i, 1);
  S.targets.push(t); toast('Цель для мести добавлена в раздел ПВП');
  return true;
}

/* ============ События: серия входов и недельное состязание ============ */
const MSK = 3 * 3600000;
const dayId = t => Math.floor((t + MSK) / 86400000);
const weekId = t => Math.floor((t + MSK - 4 * 86400000) / (7 * 86400000));          // неделя начинается в понедельник 00:00 по Москве
const weekEnd = w => w * 7 * 86400000 + 4 * 86400000 - MSK + 7 * 86400000;
const CONTESTS = [
  { k: 'camp',   f: 'campWins', t: 'Охотник на разбойников', d: 'Разгромите больше всех лагерей разбойников.' },
  { k: 'gather', f: 'gathered', t: 'Добытчик',                d: 'Совершите больше всех сборов на ресурсных точках.' },
  { k: 'pvp',    f: 'pvpWins',  t: 'Гроза ярлов',             d: 'Выиграйте больше всех боёв с живыми игроками.' }
];
const PRIZES = [{ gems: 50, haste: 5 }, { gems: 30, haste: 3 }, { gems: 15, haste: 2 }];
const PRIZE_PART = { gems: 5 };           // остальные из первой десятки
const contestOf = w => CONTESTS[((w % 3) + 3) % 3];
function wkScoreOf(st, w) {
  if (st.wk && st.wk.id === w) return Math.max(0, (st.stat[contestOf(w).f] || 0) - st.wk.base);
  if (st.wkPrev && st.wkPrev.id === w) return st.wkPrev.v;
  return 0;
}
function wkSync(st) {
  const w = weekId(nowMs());
  if (st.wk && st.wk.id === w) return;
  if (st.wk) st.wkPrev = { id: st.wk.id, v: wkScoreOf(st, st.wk.id) };
  st.wk = { id: w, base: st.stat[contestOf(w).f] || 0 };
}
const STREAK = [{ gems: 2 }, { gems: 3, haste: 1 }, { res: 2 }, { gems: 4, haste: 2 }, { gems: 5 }, { gems: 6, haste: 3 }, { gems: 15, haste: 5, res: 4 }];
function streakInfo() {
  const d = dayId(nowMs()), st = S.streak || { n: 0, day: -9 };
  const claimed = st.day === d;
  const n = claimed ? (st.n - 1) % 7 + 1 : (st.day === d - 1 ? st.n % 7 + 1 : 1);   // номер дня 1..7, который отмечается сегодня (или отмечен)
  return { claimed, n, total: claimed || st.day === d - 1 ? st.n : 0 };
}
function claimStreak() {
  const d = dayId(nowMs()), i = streakInfo();
  if (i.claimed) return false;
  const rw = STREAK[i.n - 1], parts = [];
  const cont = (S.streak && S.streak.day === d - 1) ? S.streak.n : 0;
  S.streak = { n: cont + 1, day: d };
  if (rw.gems) { S.gems += rw.gems; parts.push(rw.gems + ' рунных камней'); }
  if (rw.haste) { S.haste += rw.haste; parts.push(rw.haste + ' ускорений'); }
  if (rw.res) { const c = cap(); for (const r of RES) { if (r.id === 'silver' && !lvl('silvermine')) continue; S.res[r.id] = Math.min(Math.max(c, S.res[r.id]), S.res[r.id] + rate(r.id) * rw.res); } parts.push(rw.res + ' ч добычи'); }
  addLog(`Награда за ${i.n}-й день подряд: ${parts.join(', ')}.`, 'good'); toast('Награда за вход получена');
  return true;
}
function buy(id) {
  const it = SHOP.find(x => x.id === id);
  if (!it) return false;
  if (S.gems < it.gems) { toast('Не хватает рунных камней'); return false; }
  const t = nowMs();
  S.gems -= it.gems;
  if (it.haste) S.haste += it.haste;
  if (it.shieldH) S.shield = Math.max(S.shield, t) + it.shieldH * 3600000;
  if (it.resH) { const c = cap(); for (const r of RES) { const id2 = r.id; if (id2 === 'silver' && !lvl('silvermine')) continue; S.res[id2] = Math.min(Math.max(c, S.res[id2]), S.res[id2] + rate(id2) * it.resH); } }
  if (it.vipD) S.vip = Math.max(S.vip || 0, t) + it.vipD * 86400000;
  S.bought[id] = (S.bought[id] || 0) + 1;
  addLog(`Покупка: ${it.t}.`, 'good'); toast('Куплено: ' + it.t);
  return true;
}
function act(a, arg) {
  switch (a) {
    case 'up': if (typeof arg === 'string') startBuild(arg); break;
    case 'train': if (arg && typeof arg === 'object') startTrain(arg.k, arg.n); break;
    case 'study': if (typeof arg === 'string') startStudy(arg); break;
    case 'tierup': if (typeof arg === 'string') startUpg(arg); break;
    case 'skill': if (typeof arg === 'string') spendSkill(arg); break;
    case 'haste': if (typeof arg === 'string') useHaste(arg); break;
    case 'free': if (typeof arg === 'string') freeFinish(arg); break;
    case 'refresh': if (nowMs() >= S.tgtAt + 30000) refreshTargets(); break;
    case 'march': if (arg && typeof arg === 'object') sendMarch(String(arg.id), arg.send); break;
    case 'claim': if (typeof arg === 'string') claim(arg); break;
    case 'intro': S.introDone = true; break;
    case 'buy': if (typeof arg === 'string') buy(arg); break;
    case 'daily': claimDaily(); break;
    case 'streak': claimStreak(); break;
    case 'scout': if (typeof arg === 'string') scout(arg); break;
    case 'revenge': if (typeof arg === 'string') revenge(arg); break;
  }
}

/* Оценка боя для подсказки в окне похода */
function verdict(t) {
  if (t.kind === 'node') return { c: 'frost', t: 'Сбор' };
  if (!sum(S.troops)) return { c: 'mute', t: 'Нет войск' };
  const r = battle(S.troops, t.comp, atkB(S), t.defb, tiersOf(S), botTiers(t.level || 1));
  if (!r.win) return { c: 'bad', t: 'Поражение' };
  return r.ratio < 0.4 ? { c: 'good', t: 'Лёгкая победа' } : { c: 'warn', t: 'Тяжёлый бой' };
}

/* ============ Форматирование ============ */
function fmt(n) { n = Math.floor(n); if (n < 1000) return String(n); if (n < 1e6) return (n / 1000).toFixed(1).replace('.', ',') + 'к'; return (n / 1e6).toFixed(2).replace('.', ',') + 'м'; }
function fmtT(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec >= 3600) return `${Math.floor(sec / 3600)}ч ${String(Math.floor(sec % 3600 / 60)).padStart(2, '0')}м`;
  if (sec >= 60) return `${Math.floor(sec / 60)}м ${String(sec % 60).padStart(2, '0')}с`;
  return `${sec}с`;
}

const API = {
  RES, RI, B, BORDER, U, WEAK, TECH, QUESTS, MAXL, TMAX, CFG, HOOK, NODE, TIERN, TIER_NEED, MAXT, HSK, MAXHL, MAXSK,
  get S() { return S; },
  use, newState, update, produce, settle, battle, act, score, verdict,
  lvl, slots, cap, capAt, rate, prodAt, upCost, upSecs, canUp, canAfford, trainRate, maxBatch, trainSecs, techCost, techSecs, gatherSecs, marchSecs,
  posOf, tgtPos, isLand, SHOP, SCOUT_COST, isVip, buy, claimDaily, dailyLeft, streakInfo, claimStreak, STREAK, CONTESTS, PRIZES, PRIZE_PART, weekId, weekEnd, contestOf, wkScoreOf, wkSync, dayId,
  jobInfo, helpJob, chargeClan, CLAN_COST, CLAN_HALL, jobObj,
  tierOf, heroOf, tmul, tiersOf, botTiers, atkB, defB, lootB, unitName, xpNeed, tierCost, tierSecs,
  refreshTargets, topUpPlayers, addLogTo, fmt, fmtT, fmtRes, fmtComp, carryOf,
  setNow(f) { nowMs = f; }, now() { return nowMs(); },
  onToast(f) { toastFn = f; }
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Core = API;
})(typeof self !== 'undefined' ? self : globalThis);
