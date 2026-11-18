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
  spear:  { n: 'Ополченец', pl: 'Ополченцы', atk: 10, def: 14, carry: 20, cost: { food: 30, wood: 25 }, t: 6,  need: 1, counters: 'cav' },
  archer: { n: 'Охотник',   pl: 'Охотники',   atk: 16, def: 8,  carry: 15, cost: { food: 20, wood: 40 }, t: 8,  need: 2, counters: 'spear' },
  cav:    { n: 'Всадник',  pl: 'Всадники',  atk: 18, def: 10, carry: 35, cost: { food: 50, iron: 40, silver: 5 }, t: 12, need: 3, counters: 'archer' }
};
/* Ступени воинов: улучшаются в Казарме, усиливают всех воинов этого вида сразу. */
const TIERN = {
  spear: ['Ополченец', 'Копейщик', 'Щитоносец', 'Дружинник', 'Хирдман', 'Гвардеец', 'Королевский страж'],
  archer: ['Охотник', 'Лучник', 'Следопыт', 'Меткий стрелок', 'Ловчий', 'Северный стрелок', 'Королевский лучник'],
  cav: ['Всадник', 'Конник', 'Разведчик', 'Конный дружинник', 'Латный всадник', 'Тяжёлый всадник', 'Королевский рыцарь']
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
  eco: { n: 'Дары земли',       d: '+5% к добыче за уровень', r: 'ᚠ' },
  bld: { n: 'Мастера-строители', d: '−3% ко времени стройки за уровень', r: 'ᛒ' },
  fast: { n: 'Быстрые драккары', d: '−3% ко времени походов за уровень', r: 'ᚱ' },
  drill: { n: 'Выучка дружины', d: '−3% ко времени обучения войск за уровень', r: 'ᛗ' }
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
  sameClan: () => false,
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
  { id: 'q13', t: 'Обучи или улучши воинов до 2 ступени',         cur: () => Object.keys(U).filter(k => tierOf(S, k) >= 2).length, max: 1, rw: { iron: 300, silver: 200, haste: 1 } },
  { id: 'q14', t: 'Подними Палату ярла до 10 уровня',   cur: () => lvl('hall'),    max: 10, rw: { food: 3000, wood: 3000, stone: 2000, haste: 3, gems: 10 } },
  { id: 'q15', t: 'Подними ярла до 10 уровня',          cur: () => heroOf(S).lv,   max: 10, rw: { silver: 1500, iron: 1500, haste: 3, gems: 8 } },
  { id: 'q16', t: 'Подними Палату ярла до 20 уровня',   cur: () => lvl('hall'),    max: 20, rw: { food: 12000, wood: 12000, stone: 8000, iron: 5000, haste: 6, gems: 20 } },
  { id: 'q17', t: 'Одержи 25 побед в походах',          cur: () => S.stat.wins,    max: 25, rw: { silver: 2000, iron: 2000, haste: 4, gems: 12 } },
  { id: 'q11', t: 'Разграбь город другого игрока',      cur: () => S.stat.pvpWins, max: 1,  rw: { silver: 400, iron: 300, haste: 2 } }
];

/* Дела-вехи: подними здание, воина или знание до уровня. Создаются по списку, награды растут с уровнем. */
(function () {
  const rw = (lv, kinds) => {
    const o = {}; kinds.forEach((k, i) => { o[k] = Math.round(lv * (i ? 90 : 140)); });
    if (lv >= 10) o.haste = Math.floor(lv / 5); if (lv >= 15) o.gems = Math.floor(lv / 5);
    return o;
  };
  const bl = { farm: ['Ферма', ['food', 'wood']], sawmill: ['Лесопилка', ['wood', 'stone']], quarry: ['Каменоломня', ['stone', 'iron']], ironmine: ['Рудник', ['iron', 'silver']], storehouse: ['Склад', ['wood', 'stone']], barracks: ['Казарма', ['iron', 'food']], oracle: ['Оракул', ['silver', 'stone']], vault: ['Хранилище', ['stone', 'iron']] };
  Object.keys(bl).forEach(id => [5, 10, 15, 20].forEach(L => {
    if (id === 'sawmill' && L === 3) return;
    QUESTS.push({ id: `b_${id}_${L}`, t: `${bl[id][0]}: подними до ${L} уровня`, cur: () => lvl(id), max: L, rw: rw(L, bl[id][1]) });
  }));
  Object.keys(U).forEach(k => [3, 5, 7].forEach(T => {
    QUESTS.push({ id: `t_${k}_${T}`, t: `Улучши ${U[k].pl.toLowerCase()} до ${T} ступени`, cur: () => tierOf(S, k), max: T, rw: { silver: T * 250, iron: T * 300, haste: T >= 5 ? T - 3 : 0 } });
  }));
  Object.keys(TECH).forEach(k => [3, 5, 10].forEach(L => {
    QUESTS.push({ id: `k_${k}_${L}`, t: `Знание «${TECH[k].n}»: ${L} уровень`, cur: () => S.tech[k] || 0, max: L, rw: { silver: L * 150, stone: L * 120, haste: L >= 5 ? 1 : 0 } });
  }));
  [[100, 'Обучи 100 воинов', 'trained'], [500, 'Обучи 500 воинов', 'trained'], [2000, 'Обучи 2000 воинов', 'trained'],
   [10, 'Разгроми 10 лагерей разбойников', 'campWins'], [50, 'Разгроми 50 лагерей разбойников', 'campWins'],
   [10, 'Собери ресурсы на точках 10 раз', 'gathered'], [50, 'Собери ресурсы на точках 50 раз', 'gathered'],
   [5, 'Разграбь города игроков 5 раз', 'pvpWins'], [20, 'Разграбь города игроков 20 раз', 'pvpWins'],
   [10, 'Отбей 10 набегов', 'defWins'], [50, 'Отбей 50 набегов', 'defWins'],
   [5, 'Изучи 5 знаний', 'researched'], [20, 'Изучи 20 знаний', 'researched']].forEach(([n, t, f]) => {
    QUESTS.push({ id: `s_${f}_${n}`, t, cur: () => (S.stat[f] || 0), max: n, rw: { silver: n * 20 + 200, iron: n * 20 + 200, haste: n >= 20 ? 3 : n >= 10 ? 1 : 0, gems: n >= 50 ? 5 : 0 } });
  });
  [5, 15, 20].forEach(L => QUESTS.push({ id: `h_${L}`, t: `Подними ярла до ${L} уровня`, cur: () => heroOf(S).lv, max: L, rw: { silver: L * 100, food: L * 150, haste: L >= 15 ? 4 : 1 } }));
  QUESTS.forEach(q => { Object.keys(q.rw).forEach(k => { if (!q.rw[k]) delete q.rw[k]; }); });
})();

const armyAtk = st => { let a = 0; for (const k in st.troops) if (validKey(k)) a += (st.troops[k] || 0) * U[stype(k)].atk * tmul(stier(k)); return a * atkB(st); };
/* ============ Снаряжение ярла ============ */
const SLOTS = {
  weapon: { n: 'Оружие',  stat: 'atk',  base: 3, w: 'к атаке всех воинов',      names: ['Дубовый топор', 'Стальная секира', 'Клинок ярла'] },
  armor:  { n: 'Броня',   stat: 'def',  base: 3, w: 'к защите всех воинов',     names: ['Кожаная броня', 'Кольчуга', 'Доспех берсерка'] },
  helm:   { n: 'Шлем',    stat: 'loot', base: 4, w: 'к ноше в походах',         names: ['Кожаный шлем', 'Шлем с наносником', 'Рогатый шлем'] },
  amulet: { n: 'Амулет',  stat: 'eco',  base: 3, w: 'к добыче в городе',        names: ['Костяной амулет', 'Молот Тора', 'Руна Одина'] },
  gloves: { n: 'Перчатки', stat: 'atk', base: 2, w: 'к атаке всех воинов',      names: ['Кожаные рукавицы', 'Стальные перчатки', 'Перчатки берсерка'] },
  pants:  { n: 'Штаны',   stat: 'def',  base: 2, w: 'к защите всех воинов',     names: ['Шерстяные штаны', 'Кольчужные поножи', 'Поножи ярла'] },
  cloak:  { n: 'Плащ',    stat: 'def',  base: 2, w: 'к защите всех воинов',     names: ['Тканый плащ', 'Волчий плащ', 'Медвежья шкура'] },
  belt:   { n: 'Пояс',    stat: 'loot', base: 3, w: 'к ноше в походах',         names: ['Кожаный пояс', 'Пояс с пряжкой', 'Пояс великана'] },
  ring:   { n: 'Кольцо',  stat: 'eco',  base: 2, w: 'к добыче в городе',        names: ['Медное кольцо', 'Серебряное кольцо', 'Золотое кольцо'] }
};
/* места на ярле: два кольца делят один тип предметов */
const EQS = ['helm', 'cloak', 'armor', 'gloves', 'pants', 'belt', 'weapon', 'amulet', 'ring1', 'ring2'];
const slotType = k => (k === 'ring1' || k === 'ring2') ? 'ring' : k;
const LOOKS = ['Берсерк', 'Щитоносец', 'Копейщик', 'Секирщик', 'Элитный воин'];
const SLOTK = Object.keys(SLOTS), RARN = ['Обычное', 'Редкое', 'Эпическое'], EQMAX = 30, EQ_IL = 5, BAG_STEP = 5, BAG_COST = [20, 30, 45, 65, 90];
const eqCap = st => EQMAX + BAG_STEP * ((st && st.eq && st.eq.bag) || 0);
const itemPct = it => Math.round(SLOTS[it.slot].base * [1, 1.7, 2.6][it.r] * (1 + 0.2 * (it.il - 1)) * 10) / 10;
function eqB(st, stat) {
  if (!st || !st.eq) return 0; let v = 0;
  EQS.forEach(k => { const it = st.eq.s[k]; if (it && SLOTS[slotType(k)].stat === stat) v += itemPct(it) / 100; });
  return v;
}
const itemName = it => SLOTS[it.slot].names[it.r];
const forgeLvl = () => Math.min(EQ_IL, 1 + Math.floor(lvl('hall') / 5));
const forgeCost = () => { const il = forgeLvl(); return { wood: 300 * il, iron: 200 * il, silver: 100 * il }; };
function newItem(il, w) {
  const x = Math.random() * (w[0] + w[1] + w[2]), r = x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2;
  return { id: 'i' + (S.mid++), slot: pick(SLOTK), r, il: Math.max(1, Math.min(EQ_IL, il)) };
}
function giveItem(it, why, t) {
  if (S.eq.inv.length >= eqCap(S)) { addLog(`Находка «${itemName(it)}» пропала: сумка полна.`, 'info', t); return false; }
  S.eq.inv.push(it); addLog(`${why}: ${RARN[it.r].toLowerCase()} «${itemName(it)}» (+${itemPct(it)}% ${SLOTS[it.slot].w}).`, 'good', t); toast(`Находка: ${itemName(it)}`);
  return true;
}
function buyBag() {
  const n = S.eq.bag || 0;
  if (n >= BAG_COST.length) { toast('Сумка уже расширена до предела'); return; }
  if ((S.gems || 0) < BAG_COST[n]) { toast('Не хватает рунных камней'); return; }
  S.gems -= BAG_COST[n]; S.eq.bag = n + 1; addLog(`Сумка расширена: теперь ${eqCap(S)} мест.`, 'good'); toast(`Сумка: ${eqCap(S)} мест`);
}
function forge() {
  if (lvl('hall') < 3) { toast('Ковка открывается с Палаты ярла 3'); return; }
  if (S.eq.inv.length >= eqCap(S)) { toast('Сумка полна'); return; }
  const c = forgeCost(); if (!canAfford(c)) { toast('Не хватает ресурсов'); return; }
  pay(c); giveItem(newItem(forgeLvl(), [72, 23, 5]), 'Кузнец выковал');
}
function equip(id) {
  const i = S.eq.inv.findIndex(x => x.id === id); if (i < 0) return;
  const it = S.eq.inv[i], sl = it.slot === 'ring' ? (!S.eq.s.ring1 ? 'ring1' : !S.eq.s.ring2 ? 'ring2' : 'ring1') : it.slot, old = S.eq.s[sl];
  S.eq.inv.splice(i, 1); S.eq.s[sl] = it; if (old) S.eq.inv.push(old);
}
function unequip(slot) {
  const it = S.eq.s[slot]; if (!it || S.eq.inv.length >= eqCap(S)) return;
  S.eq.s[slot] = null; S.eq.inv.push(it);
}
const scrapOf = it => ({ iron: 60 * it.il * (it.r + 1), silver: 30 * it.il * (it.r + 1) });
function scrap(id) {
  const i = S.eq.inv.findIndex(x => x.id === id); if (i < 0) return;
  const g = scrapOf(S.eq.inv[i]); S.eq.inv.splice(i, 1);
  for (const k in g) S.res[k] = Math.max(S.res[k], Math.min(cap(), S.res[k] + g[k]));
  toast('Разобрано: ' + fmtRes(g));
}
function scrapMany(ids) {
  if (!Array.isArray(ids)) return;
  const g = { iron: 0, silver: 0 }; let n = 0;
  ids.slice(0, 200).forEach(id => {
    const i = S.eq.inv.findIndex(x => x.id === id); if (i < 0) return;
    const r = scrapOf(S.eq.inv[i]); S.eq.inv.splice(i, 1); g.iron += r.iron; g.silver += r.silver; n++;
  });
  if (!n) return;
  for (const k in g) S.res[k] = Math.max(S.res[k], Math.min(cap(), S.res[k] + g[k]));
  toast(`Разобрано предметов: ${n}. ${fmtRes(g)}`);
}
function mergeItems(arg) {
  const [slot, r0] = String(arg).split(':'), r = Number(r0);
  if (!SLOTS[slot] || !(r >= 0 && r < 2)) return;
  const same = S.eq.inv.filter(x => x.slot === slot && x.r === r).slice(0, 3);
  if (same.length < 3) { toast('Нужно три одинаковых предмета'); return; }
  S.eq.inv = S.eq.inv.filter(x => !same.includes(x));
  const il = Math.round(same.reduce((a, x) => a + x.il, 0) / 3);
  S.eq.inv.push({ id: 'i' + (S.mid++), slot, r: r + 1, il }); toast('Слияние удалось: ' + RARN[r + 1].toLowerCase() + ' предмет');
}


/* ============ Состояние ============ */
function newState(name, pid) {
  const t = nowMs();
  return {
    v: 3, pid: pid || '', name: name || 'Ярл', t, created: t,
    res: { food: 800, wood: 800, stone: 600, iron: 300, silver: 150 },
    b: { hall: 1, farm: 1, sawmill: 1, quarry: 1, ironmine: 1, silvermine: 0, storehouse: 1, vault: 0, barracks: 1, oracle: 0 },
    tech: { atk: 0, def: 0, eco: 0, bld: 0, fast: 0, drill: 0 }, q: null, train: null, study: null,
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
  if (st.tech) { if (st.tech.bld === undefined) st.tech.bld = 0; if (st.tech.fast === undefined) st.tech.fast = 0; if (st.tech.drill === undefined) st.tech.drill = 0; }
  if (!st.eq) st.eq = { s: { weapon: null, armor: null, helm: null, amulet: null }, inv: [] };
  if (!st.tier) st.tier = { spear: 1, archer: 1, cav: 1 };
  if (!st.hero) st.hero = { lv: 1, xp: 0, sp: 0, sk: { atk: 0, def: 0, loot: 0 } };
  if (!(st.hero.look >= 1 && st.hero.look <= 5)) st.hero.look = 1;
  if (!Array.isArray(st.presets)) st.presets = [];
  if (st.upg === undefined) st.upg = null;
  if (st.q2 === undefined) st.q2 = null;
  if (!st.mini) st.mini = { d: -1, sp: 0, ps: 0, dc: 0, last: null };
  if (!st.stk) {          // перевод на стопки по ступеням: все нынешние воины встают в стопку своей ступени
    st.stk = 1;
    const T = k => (st.tier && st.tier[k]) || 1, conv = c => { const o = {}; for (const k in (c || {})) { const n = c[k] || 0; if (!validKey(k)) continue; const key = skey(k, T(k)); o[key] = (o[key] || 0) + n; } return o; };
    st.troops = conv(st.troops);
    if (Array.isArray(st.presets)) st.presets = st.presets.map(p => p ? conv(p) : p);
    (st.marches || []).forEach(m => { m.send = conv(m.send); if (m.tgt && m.tgt.comp && m.tgt.kind !== 'player') m.tgt.comp = botComp(m.tgt.comp, m.tgt.level || 1); });
    (st.targets || []).forEach(t => { if (t.comp && t.kind !== 'player') t.comp = botComp(t.comp, t.level || 1); });
    if (st.train && !st.train.t) st.train.t = T(st.train.type);
    if (st.upg && st.upg.key) { const c = tierCost(st.upg.key, st.upg.to); for (const r in c) st.res[r] = (st.res[r] || 0) + c[r]; st.upg = null; }
  }
  if (st.gems === undefined) { st.gems = 0; st.vip = 0; st.daily = 0; st.bought = {}; }
}
const tierOf = (st, k) => (st.tier && st.tier[k]) || 1;
const heroOf = st => st.hero || { lv: 1, xp: 0, sp: 0, sk: { atk: 0, def: 0, loot: 0 } };
const tmul = t => 1 + 0.3 * (t - 1);
const tiersOf = st => { const o = {}; for (const k in U) o[k] = tierOf(st, k); return o; };
const botTiers = L => { const t = Math.min(MAXT, 1 + Math.floor((Math.max(1, L) - 1) / 4)); return { spear: t, archer: t, cav: t }; };
const atkB = st => 1 + 0.06 * st.tech.atk + 0.03 * (heroOf(st).sk.atk || 0) + eqB(st, 'atk');
const defB = st => 1 + 0.06 * st.tech.def + 0.03 * (heroOf(st).sk.def || 0) + eqB(st, 'def');
const lootB = st => 1 + 0.05 * (heroOf(st).sk.loot || 0) + eqB(st, 'loot');
const unitName = (k, t) => TIERN[k][(t || 1) - 1];
/* Войска лежат отдельными стопками по ступеням: ключ 'spear' — 1 ступень, 'spear3' — 3 ступень. */
const stype = k => String(k).replace(/\d+$/, '');
const stier = k => { const m = /(\d+)$/.exec(String(k)); return m ? +m[1] : 1; };
const skey = (k, t) => t > 1 ? k + t : k;
const validKey = k => /^(spear|archer|cav)([2-7])?$/.test(String(k));
const sname = k => unitName(stype(k), stier(k));
const sortKeys = c => Object.keys(c).sort((a, b) => Object.keys(U).indexOf(stype(a)) - Object.keys(U).indexOf(stype(b)) || stier(a) - stier(b));
const byType = c => { const o = { spear: 0, archer: 0, cav: 0 }; for (const k in c) { if (validKey(k)) o[stype(k)] += c[k] || 0; } return o; };
const maxTier = () => { let t = 1; for (let i = 1; i < MAXT; i++) if (lvl('barracks') >= TIER_NEED[i]) t = i + 1; return t; };
const botComp = (c, L) => { const t = Math.min(MAXT, 1 + Math.floor((Math.max(1, L) - 1) / 4)), o = {}; for (const k in c) if (c[k] > 0) o[skey(stype(k), t)] = (o[skey(stype(k), t)] || 0) + c[k]; return o; };
const UPG_PCT = 0.65;     // улучшение стоит 65% разницы в цене найма
const costOf = (k, t, n) => { const o = {}, f = tmul(t); for (const r in U[k].cost) o[r] = Math.round(U[k].cost[r] * f * n); return o; };
function upgPlan(k, to, only) {
  const n = {}; let tot = 0, steps = 0; const cost = {};
  for (const key in S.troops) {
    if (!validKey(key) || stype(key) !== k) continue;
    const f = stier(key), c = S.troops[key] || 0;
    if (c < 1 || f >= to || (only && f !== only)) continue;
    n[f] = c; tot += c; steps += c * (to - f);
    for (const r in U[k].cost) cost[r] = (cost[r] || 0) + Math.ceil(U[k].cost[r] * UPG_PCT * (tmul(to) - tmul(f)) * c);
  }
  const secs = Math.max(5, Math.min(Math.round(1800 * CFG.t), Math.round(steps * U[k].t * 0.15 / trainRate() * CFG.t * techCut('drill'))));
  return { n, tot, cost, secs };
}
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
const ecoMul = () => (1 + 0.05 * S.tech.eco + eqB(S, 'eco')) * (isVip() ? 1.15 : 1);
const prot = () => 300 * lvl('vault');
/* Добыча и награды не превышают вместимость Амбара (уже лежащее сверху не отнимаем). */
const addCapped = (k, v) => { const c = cap(), cur = S.res[k] || 0; S.res[k] = Math.max(cur, Math.min(c, cur + v)); };
function prodAt(id, L) { const b = B[id]; return L ? Math.round(b.base * L * (1 + 0.12 * (L - 1)) * ecoMul()) : 0; }
function rate(rid) { const id = BORDER.find(k => B[k].res === rid); return prodAt(id, lvl(id)); }
const upCost = (id, L) => { const o = {}; for (const k in B[id].cost) o[k] = Math.round(B[id].cost[k] * grow(L, 1.55, 1.10)); return o; };
/* Первые уровни строятся быстро, чтобы новичок за первые минуты увидел результат. */
const techCut = (k) => (S && S.tech ? Math.max(0.55, 1 - 0.03 * (S.tech[k] || 0)) : 1);
const upSecs = (id, L) => Math.round(B[id].t * grow(L, 1.5, 1.12) * CFG.t * (L < 3 ? 0.3 : L < 4 ? 0.6 : 1) * techCut('bld'));
const canAfford = c => Object.keys(c).every(k => S.res[k] >= c[k]);
const pay = c => { for (const k in c) S.res[k] -= c[k]; };
const trainRate = () => 1 + 0.15 * (lvl('barracks') - 1);
const maxBatch = () => 10 * lvl('barracks') + 10;
const trainSecs = (k, n, t) => Math.max(3, Math.round(n * U[k].t * (1 + 0.15 * ((t || 1) - 1)) / trainRate() * CFG.t * techCut('drill') * (S && S.stat && S.stat.trained < 30 ? 0.4 : 1)));
const techCost = L => ({ silver: Math.round(120 * grow(L, 1.6, 1.1)), food: Math.round(100 * grow(L, 1.5, 1.1)) });
const techSecs = L => Math.round(40 * grow(L, 1.55, 1.1) * CFG.t);
const gatherSecs = () => 25 * CFG.t;
const marchSecs = d => Math.round(d * CFG.t * techCut('fast'));

function addLogTo(st, txt, k, t) { st.log.unshift({ t: t || nowMs(), txt, k: k || 'info' }); if (st.log.length > 60) st.log.pop(); }
const addLog = (txt, k, t) => addLogTo(S, txt, k, t);

function score(st) {
  let s = 0;
  for (const k in B) s += (st.b[k] || 0) * 40;
  const all = Object.assign({}, st.troops); (st.marches || []).forEach(m => { for (const k in (m.send || {})) all[k] = (all[k] || 0) + m.send[k]; });
  for (const k in all) if (validKey(k)) s += (all[k] || 0) * (U[stype(k)].atk + U[stype(k)].def) / 2 * tmul(stier(k));
  for (const k in st.tech) s += st.tech[k] * 50;
  s += heroOf(st).lv * 30;
  if (st.eq) EQS.forEach(k => { const it = st.eq.s[k]; if (it) s += 15 * (it.r + 1) * it.il; });
  return Math.round(s);
}

/* ============ Бой ============ */
function power(comp, other, key, bonus) {
  const ot = byType(other), tot = sum(ot) || 1; let p = 0;
  for (const kk in comp) {
    const n = comp[kk] || 0; if (!n || !validKey(kk)) continue;
    const k = stype(kk);
    const m = 1 + 0.5 * ((ot[U[k].counters] || 0) / tot) - 0.35 * ((ot[WEAK[k]] || 0) / tot);
    p += n * U[k][key] * tmul(stier(kk)) * m;
  }
  return p * bonus;
}
function battle(a, d, ab, db) {
  const pa = power(a, d, 'atk', ab), pd = power(d, a, 'def', db);
  const win = pa > pd; const W = Math.max(pa, pd), L = Math.min(pa, pd);
  const ratio = W > 0 ? L / W : 1;
  const lw = 0.55 * Math.pow(ratio, 1.7), ll = 0.7 + 0.25 * ratio;
  const fa = win ? lw : ll, fd = win ? ll : lw;
  const lose = (c, f) => { const lost = {}, surv = {}; for (const k in c) { if (!validKey(k)) continue; const n = c[k] || 0; const x = Math.min(n, Math.round(n * f)); lost[k] = x; surv[k] = n - x; } return { lost, surv }; };
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
  S.targets = S.targets.filter(t => !(t.kind === 'player' && HOOK.sameClan(S.pid, t.pid)));   // соклановцев не трогаем
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
  const loot = {}; let comp = {}, name, defb = 1, res = null;
  if (kind === 'camp') {
    comp = botComp(randComp(Math.round(5 * base + ri(0, 3)), shuffle(Object.keys(U)).slice(0, 2)), level);
    name = pick(CAMPS);
    const f = 110 * Math.pow(level, 1.3);
    shuffle(RES.map(r => r.id)).slice(0, 3).forEach(r => { loot[r] = Math.round(f * rnd(0.8, 1.3)); });
  } else if (kind === 'jarl') {
    comp = botComp(randComp(Math.round(7 * base + ri(0, 4)), shuffle(Object.keys(U))), level);
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
  if (S.q && S.q.end <= tn) c.push({ time: S.q.end, run: () => finishBuild('q') });
  if (S.q2 && S.q2.end <= tn) c.push({ time: S.q2.end, run: () => finishBuild('q2') });
  if (S.train && S.train.end <= tn) c.push({ time: S.train.end, run: finishTrain });
  if (S.study && S.study.end <= tn) c.push({ time: S.study.end, run: finishStudy });
  if (S.upg && S.upg.end <= tn) c.push({ time: S.upg.end, run: finishUpg });
  S.marches.forEach(m => {
    if (m.phase === 'gather' && m.gEnd <= tn) c.push({ time: m.gEnd, run: () => endGather(m) });
    if (m.phase === 'out' && m.arrive <= tn) c.push({ time: m.arrive, run: () => resolveMarch(m) });
    if (m.phase === 'back' && m.back <= tn) c.push({ time: m.back, run: () => returnMarch(m) });
  });
  c.sort((a, b) => a.time - b.time);
  return c[0];
}
function update() {
  ensure(S);
  wkSync(S);
  const tn = nowMs();
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
      if (S.q && S.q.end <= to) c.push({ time: S.q.end, run: () => finishBuild('q') });
      if (S.q2 && S.q2.end <= to) c.push({ time: S.q2.end, run: () => finishBuild('q2') });
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
function finishBuild(key) {
  key = key || 'q'; const q = S[key]; S.b[q.id] = q.to; S[key] = null; S.stat.built++;
  addLog(`${B[q.id].n} достигла уровня ${q.to}.`, 'good', q.end); toast(`${B[q.id].n}: уровень ${q.to}`);
}
function finishTrain() {
  const t = S.train, tr = t.t || 1, key = skey(t.type, tr); S.troops[key] = (S.troops[key] || 0) + t.n; S.stat.trained += t.n; S.train = null;
  if (tr > (S.tier[t.type] || 1)) S.tier[t.type] = tr;
  addLog(`Обучено: ${t.n} × ${unitName(t.type, tr)}.`, 'good', t.end); toast(`Обучено: ${t.n} × ${unitName(t.type, tr)}`);
}
function finishUpg() {
  const u = S.upg; let tot = 0; for (const f in u.n) tot += u.n[f];
  const key = skey(u.k, u.to); S.troops[key] = (S.troops[key] || 0) + tot; if (u.to > (S.tier[u.k] || 1)) S.tier[u.k] = u.to; S.upg = null;
  addLog(`Улучшено воинов: ${tot} → ${unitName(u.k, u.to)} (ступень ${u.to}).`, 'good', u.end); toast(`Улучшено: ${tot} → ${unitName(u.k, u.to)}`);
}
function finishStudy() {
  const s = S.study; S.tech[s.key] = s.to; S.stat.researched++; S.study = null;
  addLog(`Оракул открыл знание «${TECH[s.key].n}», уровень ${s.to}.`, 'good', s.end); toast(`Знание: ${TECH[s.key].n} ${s.to}`);
}
function fmtRes(o) { return Object.keys(o).filter(k => o[k] > 0 && RI[k]).map(k => `${RI[k].n} ${fmt(o[k])}`).join(' · ') || 'ничего'; }
function fmtComp(c) { return sortKeys(c).filter(k => validKey(k) && (c[k] || 0) > 0).map(k => `${sname(k)} ${c[k]}`).join(' · '); }
/* Разведка не выдаёт точных цифр: только приблизительно */
function approxN(n) { if (n <= 0) return 0; if (n < 10) return 10; const st = n < 100 ? 10 : n < 500 ? 50 : n < 2000 ? 100 : n < 10000 ? 500 : 1000; return Math.max(st, Math.round(n / st) * st); }
function fmtApprox(c) { return sortKeys(c).filter(k => validKey(k) && (c[k] || 0) > 0).map(k => `${sname(k)} ~${approxN(c[k])}`).join(' · '); }
const carryOf = (s, st) => { st = st || S; return Math.round(Object.keys(s).filter(validKey).reduce((a, k) => a + (s[k] || 0) * U[stype(k)].carry * tmul(stier(k)), 0) * lootB(st)); };

function resolveMarch(m) {
  const tg = m.tgt, t = m.arrive;
  if (tg.kind === 'node') {
    const carry = carryOf(m.send);
    m.loot = {}; for (const k in tg.loot) m.loot[k] = Math.min(carry, tg.loot[k]);
    m.phase = 'gather'; m.gStart = t; m.gEnd = t + gatherSecs() * 1000; return;
  }
  if (tg.kind === 'player') return resolvePlayer(m);
  const r = battle(m.send, tg.comp, atkB(S), tg.defb);
  if (r.win) {
    gainXp(tg.kind === 'camp' ? 25 + 10 * tg.level : 35 + 12 * tg.level);
    const carry = carryOf(r.survA);
    const tot = sum(tg.loot), f = tot > 0 ? Math.min(1, carry / tot) : 0;
    m.loot = {}; for (const k in tg.loot) m.loot[k] = Math.floor(tg.loot[k] * f);
    m.send = r.survA; m.phase = 'back'; m.back = t + m.dur;
    S.stat.wins++; if (tg.kind === 'camp') S.stat.campWins++;
    if (tg.kind === 'camp' && Math.random() < 0.15) giveItem(newItem(Math.ceil((tg.level || 1) / 4), [80, 18, 2]), 'Трофей из лагеря', t);
    S.targets = S.targets.filter(x => x.id !== tg.id); S.targets.push(genTarget(tg.kind));
    addLog(`Победа над «${tg.name}». Ваши потери: ${fmtComp(r.lostA) || 'нет'}. Потери врага: ${fmtComp(r.lostD) || 'нет'}. Добыча: ${fmtRes(m.loot)}.`, 'good', t);
    toast(`Победа над «${tg.name}»`);
  } else {
    m.loot = {}; m.send = r.survA;
    addLog(`Поражение у «${tg.name}». Ваши потери: ${fmtComp(r.lostA) || 'нет'}. Потери врага: ${fmtComp(r.lostD) || 'нет'}.`, 'bad', t);
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
  if (HOOK.sameClan(S.pid, tg.pid)) { m.loot = {}; home(); addLog(`Ярл «${tg.name}» теперь ваш соклановец. Отряд вернулся без боя.`, 'info', t); return; }
  if (D.shield > t) { m.loot = {}; home(); addLog(`Город «${tg.name}» под щитом. Отряд вернулся без боя.`, 'info', t); toast('Цель под щитом'); return; }
  const r = battle(m.send, D.troops, atkB(A), defB(D));
  D.troops = r.survD;
  const aName = A.name || 'Неизвестный ярл';
  const raid = (win, loot) => { (D.raids || (D.raids = [])).unshift({ t, pid: A.pid, name: aName, win, lost: fmtComp(r.lostD) || '', elost: fmtComp(r.lostA) || '', loot: loot || '' }); if (D.raids.length > 20) D.raids.pop(); };
  if (r.win) {
    const pr = 300 * (D.b.vault || 0), take = {}; let tot = 0;
    RES.forEach(x => { const a = Math.floor(Math.max(0, D.res[x.id] - pr) * 0.25); take[x.id] = a; tot += a; });
    const f = tot > 0 ? Math.min(1, carryOf(r.survA) / tot) : 0;
    m.loot = {}; RES.forEach(x => { const g = Math.floor(take[x.id] * f); m.loot[x.id] = g; D.res[x.id] -= g; });
    D.shield = t + 45 * 60000; raid(true, fmtRes(m.loot));
    addLogTo(D, `Ярл «${aName}» разграбил ваш город. Унесли: ${fmtRes(m.loot)}. Ваши потери: ${fmtComp(r.lostD) || 'нет'}. Нападавшие потеряли: ${fmtComp(r.lostA) || 'нет'}. Щит на 45 минут.`, 'bad', t);
    m.send = r.survA; home();
    A.stat.wins++; A.stat.pvpWins++; gainXp(60 + 15 * (tg.level || 1));
    addLog(`Победа над ярлом «${tg.name}». Ваши потери: ${fmtComp(r.lostA) || 'нет'}. Потери врага: ${fmtComp(r.lostD) || 'нет'}. Добыча: ${fmtRes(m.loot)}.`, 'good', t);
    toast(`Победа над «${tg.name}»`);
    S.targets = S.targets.filter(x => x.id !== tg.id); S.targets.push(genTarget('player'));
  } else {
    D.stat.defWins++; raid(false);
    addLogTo(D, `Вы отбили нападение ярла «${aName}». Ваши потери: ${fmtComp(r.lostD) || 'нет'}. Нападавшие потеряли: ${fmtComp(r.lostA) || 'нет'}.`, 'good', t);
    m.loot = {}; m.send = r.survA;
    addLog(`Поражение у ярла «${tg.name}». Ваши потери: ${fmtComp(r.lostA) || 'нет'}. Потери врага: ${fmtComp(r.lostD) || 'нет'}.`, 'bad', t);
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
  for (const k in m.loot) addCapped(k, m.loot[k]);
  S.marches = S.marches.filter(x => x !== m);
  toast('Дружина вернулась домой');
}
function enemyRaid() {
  const t = S.nextRaid; S.nextRaid = t + ri(150, 270) * 60000;      // раз в 2.5–4.5 часа
  if (S.shield > t) { S.nextRaid = Math.max(S.nextRaid, S.shield + ri(90, 150) * 60000); return; }   // после щита не сразу
  const H = lvl('hall');
  const n = Math.max(4, Math.round(4 * Math.pow(H, 1.55) * rnd(0.8, 1.5)));
  const comp = botComp(randComp(n, shuffle(Object.keys(U)).slice(0, 2)), H);
  const r = battle(comp, S.troops, 1, defB(S));
  S.troops = r.survD;
  if (r.win) {
    const lost = {};
    RES.forEach(x => { const l = Math.floor(Math.max(0, S.res[x.id] - prot()) * (H <= 3 ? 0.05 : H <= 6 ? 0.1 : 0.15)); S.res[x.id] -= l; lost[x.id] = l; });
    S.shield = t + 120 * 60000; S.nextRaid = Math.max(S.nextRaid, S.shield + ri(90, 150) * 60000);
    addLog(`Набег! ${n} врагов прорвались в город. Унесли: ${fmtRes(lost)}. Ваши потери: ${fmtComp(r.lostD) || 'нет'}. Враги потеряли: ${fmtComp(r.lostA) || 'нет'}. Щит на 2 часа.`, 'bad', t);
    toast('Враги разграбили город');
  } else {
    S.stat.defWins++;
    const killed = sum(r.lostA), tr = { food: killed * 20, wood: killed * 15, iron: killed * 8, silver: killed * 3 }, cp = cap();
    for (const k in tr) S.res[k] = Math.max(S.res[k], Math.min(cp, S.res[k] + tr[k]));
    let bonus = ''; if (Math.random() < 0.25) { S.haste += 1; bonus = ' и 1 ускорение'; }
    gainXp(20 + killed);
    addLog(`Набег отбит! ${n} врагов разбиты. Враги потеряли: ${fmtComp(r.lostA) || 'нет'}. Ваши потери: ${fmtComp(r.lostD) || 'нет'}. Трофеи: ${fmtRes(tr)}${bonus}.`, 'good', t);
    toast('Набег отбит, трофеи получены');
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
  if (!B[id] || canUp(id)) return;
  if ((S.q && S.q.id === id) || (S.q2 && S.q2.id === id)) return;
  const key = !S.q ? 'q' : (S.helper && !S.q2 ? 'q2' : null);
  if (!key) return;
  const L = lvl(id), c = upCost(id, L);
  if (!canAfford(c)) return;
  pay(c); const dur = upSecs(id, L) * 1000;
  S[key] = { id, to: L + 1, end: nowMs() + dur, dur, sid: 'j' + (S.mid++) };
}
function startTrain(k, n, t) {
  n = Math.floor(Number(n)); if (!isFinite(n)) return;
  t = Math.floor(Number(t)) || 1;
  const u = U[k]; if (!u) return;
  if (S.train || lvl('barracks') < u.need || n < 1 || n > maxBatch() || t < 1 || t > maxTier()) return;
  const c = costOf(k, t, n);
  if (!canAfford(c)) return;
  pay(c); const dur = trainSecs(k, n, t) * 1000;
  S.train = { type: k, t, n, end: nowMs() + dur, dur, sid: 'j' + (S.mid++) };
}
function startStudy(k) {
  if (!TECH[k]) return;
  const L = S.tech[k];
  if (S.study || L >= TMAX || lvl('oracle') < L + 1) return;
  const c = techCost(L); if (!canAfford(c)) return;
  pay(c); const dur = techSecs(L) * 1000;
  S.study = { key: k, to: L + 1, end: nowMs() + dur, dur, sid: 'j' + (S.mid++) };
}
function startUpg(k, to, only) {
  if (!U[k] || S.upg) return;
  to = Math.floor(Number(to)); only = Math.floor(Number(only)) || 0;
  if (!(to >= 2) || to > maxTier()) return;
  const p = upgPlan(k, to, only); if (!p.tot || !canAfford(p.cost)) return;
  pay(p.cost); for (const f in p.n) { const key = skey(k, +f); S.troops[key] -= p.n[f]; }
  const dur = p.secs * 1000;
  S.upg = { k, to, n: p.n, end: nowMs() + dur, dur, sid: 'j' + (S.mid++) };
}
function spendSkill(k) {
  const H = S.hero; if (!HSK[k] || H.sp < 1 || (H.sk[k] || 0) >= MAXSK) return;
  H.sp--; H.sk[k] = (H.sk[k] || 0) + 1;
}
function jobObj(kind) { return kind === 'q' ? S.q : kind === 'q2' ? S.q2 : kind === 'train' ? S.train : kind === 'study' ? S.study : kind === 'upg' ? S.upg : null; }
/* ---- клан: помощь соклановцев ---- */
const CLAN_COST = { wood: 500, stone: 500 }, CLAN_HALL = 3;
function jobInfo(kind) {
  const o = jobObj(kind); if (!o) return null;
  if (!o.sid) o.sid = 'j' + (S.mid++);
  const what = (kind === 'q' || kind === 'q2') ? `${B[o.id].n}, ур. ${o.to}` : kind === 'train' ? `${unitName(o.type, o.t || 1)} ×${o.n}` : kind === 'study' ? `${TECH[o.key].n}, ур. ${o.to}` : `Улучшение до ${unitName(o.k, o.to)}`;
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
  if (tg.kind === 'player' && HOOK.sameClan(S.pid, tg.pid)) { toast('Нельзя нападать на соклановца'); return false; }
  const s = {}; let tot = 0;
  for (const k in send) { if (!validKey(k)) continue; const v = Math.floor(Number(send[k])) || 0, x = Math.max(0, Math.min(S.troops[k] || 0, v)); if (x > 0) { s[k] = x; tot += x; } }
  if (!tot) return false;
  for (const k in s) S.troops[k] -= s[k];
  const t = nowMs(), dur = marchSecs(tg.dist) * 1000;
  if (tg.kind === 'player' && S.shield > t) { S.shield = 0; addLog('Вы напали на ярла. Ваш щит снят.', 'info'); toast('Щит снят: вы напали на игрока'); }
  S.marches.push({ id: 'm' + (S.mid++), tgt: JSON.parse(JSON.stringify(tg)), send: s, phase: 'out', arrive: t + dur, back: 0, loot: {}, dur });
  return true;
}
function claim(id) {
  const q = QUESTS.find(x => x.id === id);
  if (!q || S.claimed[id] || q.cur() < q.max) return;
  S.claimed[id] = true;
  for (const k in q.rw) { if (k === 'haste') S.haste += q.rw[k]; else if (k === 'gems') S.gems += q.rw[k]; else addCapped(k, q.rw[k]); }
  addLog(`Награда за дело «${q.t}».`, 'good'); toast('Награда получена');
}

/* ============ Магазин ============ */
/* Все покупки идут за рунные камни и проверяются на сервере. */
const SHOP = [
  { id: 'helper',  g: 'build',  t: 'Помощник строителя', d: 'Навсегда: вторая очередь стройки. Строите два здания одновременно.', gems: 300, helper: true, once: true },
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
const LAND = '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000000111111111111111111111111111111111111111111111111111111111111111111111111111111111100000000000000000111111111111111111111111111111111111111111111111111111111111111111111111111111111110000000000000000111111111111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000111111111111111111111111111111111111111111111111111111111111111111111111111111111111100000000000000111111111111111111111111111111111111111111111111111111111111111111111111111111111100000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111111100000000000000000000111111111111111111111111111111111111111111111111111111111111111111111110000001110000000000000000000001111111111111111111111111111111111111111111111111111111111111111111110000000011000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111000000001100000000000000000000000111111111111111111111111111111111111111111111111111111111111111111100000000110000000000000000000000001111111111111111111111111111111111111111111111111111111111111111100000000110000000000000000000000000111111111111111111111111111111111111111111111111111111111111111110000000011000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111000000000100000000000000000000000001111111111111111111111111111111111111111111111111111111111111111110000000000000000000000000000000000111111111111111111111111111111111111111111111111111111111111111111100000000000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111000000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111100000000000000000000000000000111111111111111111111111111111111111111111111111111111111111111111111110000000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111111100011111000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111100000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111111111110000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111000000000000000000000000000111111111111111111111111111111111111111111111111111111111111111111111111000000000000000000000000000111111111111111111111111111111111111111111111111111111111111111111111111100000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111111110000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111111111111100000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000000000000000111111111111111111111111111111111111111111111111111111111111111111111100000000000000000000000000000001111111111111111111111111111111111111111111111110000000111111111111100000000000000000110000000000000111111111111111111111111111111111111111111111110000000001111111111110000000000000000011000000000000011111111111111111111111111111111111111111111000000000000010001110000000000000000000000000000000000001111111111111111111111111111111111111111111000000000000000000010000000000000000000000000000000000001111111111111111111111111111111111111111111100000000000000000000000000000000011000000000000000000011111111111111111111111111111111111111111111110000000000000000000000000000001111000000000000000000011111111111111111111111111111111111111111111111000000000000000000000000000001111000000000000000000001111111111111111111111111111111111111111111111000000000000000000000000000011111100000000000000000000111111111111111111111111000111111110001111100000000000000000000000000000011111110000000000000000000001111111111111111110000000001111110000000000000000000011111100000000111111111111000000000000000000000111111111111111110000000000111000000000000000000000011111111100001111111111110000000000000000000000011111111111111110000000000001000000000000000000111111111111111111111111111110000000000000000000100011111111111111110000000000000100000000000000000011111111111111111111111111111000000000000000000011111111111111111111000000000000000000000000000000011111111111111111111111111111100000000000000000000111111111111111111000000000000000000000000000100011111111111111111111111111111111000000000000000000001111111111111111100000000000000000000000011111111111111111111111111111111111111110000000000010000000111111111111111110000000000000000000000001111000011111111111111111111111111111111111100001111000000011111111111111111000000000000000000000000000000000111111111111111111111111111111111111111111100000001111111111111111100000000000000000000000000000000011111111111111111111111111111111111111111110000001111111111111111110000000000000000000000000000000001111111111111111111111111111111111111111111000000011111111111111111000000000000000000000000000000001111111111111111111111111111111111111111111100000001111111111111111100000000000000000000000000000001111111111111111111111111111111111111111111110000000111111111111111111000000000000000000000000000000011111111111111111111111111111111111111111111000000001111111111111111100000000000000000000000000000000111111111111111111111111111111111111111111100000000111111111111111111000000001000000100000000000000001111111111111111111111111111111111111111110000000011111111111111111111100000111000110000000000000000011111111111111111111111111111111111111111000000001111111111111111111110000011111111000000000000000001111111111111111111111111111111111111111100000000111111111111111111111100011111111000000000000000000111111111111111111111111111111111111111110000000111111111111111111111111111111111100000000000000000111111111111111111111111111111111111111111000000011111111111111111111111111111111110000000000000000000000001111111111111111111111111111111111100000011111111111111111111111111111111110000000000000000000000000011111111111111111111111111111111110000111111111111111111111111111111111110000000000000000000000000000111111111111111111111111111111111000000111111111111111111111111111111110000000000000000000000000000011111111111111111111111111111111100000001111111111111111111111111111110000000000000000000000000000000111111111111111111111111111111110000000111111111111111111111111111110000000000000000000000000000000000001111111111111111111111111111000000011111111111111111111111111111000000000000000000000000000000000000011111111111111111111111111100000000111111111111111111111111111100000000000000000000000000000000000000111111111111111111111111110000000011111111111111111111111111100000000000000000000000000000000000000011111111111111111111111111000000000111111111111111111111111100000000000000000000000000000000000000001111111111111111000000111100000000001111111111111111111111110000000000000000000000000000000000000000111111111111111000000001110000000000011111111111111111111111000000000000000000000000000000000000000111111111111111100000000111000000000000111111111111111111111100000000000000000000000000000000000000011111111111111110000000001100000000000011111111111111111111111000000000000000000011000000000000000011111111111111110000000000010000000000000111111111111111111111110000000000000000011100000000000000001111111111111100000000000000000000000000011111111111111111111111100000000000000011000000000000000001111111111111100000000000000000000000000000011111111111111111111100000000000000000000000000000000000111111111111100000000000000000000000000000000111111111111111111110000000000000000000000000000000000111111111111000000000000000000000000000000000011111100001111111111000000000000000000000000000000000111111111000000000000000000000000000000000000000011100000011111111110000000000000000000000000000001111111100000000000000000000000000000000000000000000000000000111111111000000000000000000000000000111111111000000000000000000000000000000000000000000000000000000001111111110000000000000000000000000001111110000000000000000000000000000000000000000000000000000000000111111111000000000000000000000000000011100000000000000000000000000000000000000000000000000000000000011111111100000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000111111110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000011000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
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
/* Цена разведки: еда и дерево. Чем дальше цель и сильнее её Палата, тем дороже. */
const scoutCost = tg => { const d = (tg && tg.dist) || 10, h = (tg && tg.level) || 1; return { food: Math.round(40 + d * 6 + h * 12), wood: Math.round(30 + d * 4 + h * 9) }; };
function scout(tid) {
  const tg = S.targets.find(x => x.id === tid);
  if (!tg || tg.kind !== 'player') return false;
  const D = HOOK.getState(tg.pid);
  if (!D) { toast('Ярл исчез'); return false; }
  const sc = scoutCost(tg);
  if (!canAfford(sc)) { toast('Не хватает ресурсов для разведки'); return false; }
  pay(sc);
  settle(D, Math.max(nowMs(), D.t));
  tg.comp = Object.assign({}, D.troops); tg.shieldAt = D.shield; tg.level = D.b.hall; tg.seenAt = nowMs();
  toast('Разведка: данные обновлены');
  return true;
}
/* Добавляет живого игрока в список целей ПВП и возвращает цель. */
function addPlayerTarget(pid) {
  const D = HOOK.getState(pid);
  if (!D || pid === S.pid) { toast('Ярл не найден'); return null; }
  if (HOOK.sameClan(S.pid, pid)) { toast('Нельзя нападать на соклановца'); return null; }
  const ex = S.targets.find(x => x.kind === 'player' && x.pid === pid);
  if (ex) return ex;
  settle(D, Math.max(nowMs(), D.t));
  const t = playerTarget({ pid, name: D.name, level: D.b.hall, comp: Object.assign({}, D.troops), shield: D.shield, dist: HOOK.dist(S.pid, pid) });
  if (S.targets.filter(x => x.kind === 'player').length >= 6) { const i = S.targets.findIndex(x => x.kind === 'player'); if (i >= 0) S.targets.splice(i, 1); }
  S.targets.push(t);
  return t;
}
/* Месть: добавляет напавшего игрока в список целей. */
function revenge(pid) {
  const r = (S.raids || []).find(x => x.pid === pid && nowMs() - x.t < 48 * 3600000);
  if (!r) { toast('Этот набег уже забыт'); return false; }
  return !!addPlayerTarget(pid);
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
  if (it.once && S.bought[id]) { toast('Уже куплено'); return false; }
  if (S.gems < it.gems) { toast('Не хватает рунных камней'); return false; }
  const t = nowMs();
  S.gems -= it.gems;
  if (it.haste) S.haste += it.haste;
  if (it.shieldH) S.shield = Math.max(S.shield, t) + it.shieldH * 3600000;
  if (it.resH) { const c = cap(); for (const r of RES) { const id2 = r.id; if (id2 === 'silver' && !lvl('silvermine')) continue; S.res[id2] = Math.min(Math.max(c, S.res[id2]), S.res[id2] + rate(id2) * it.resH); } }
  if (it.helper) S.helper = true;
  if (it.vipD) S.vip = Math.max(S.vip || 0, t) + it.vipD * 86400000;
  S.bought[id] = (S.bought[id] || 0) + 1;
  addLog(`Покупка: ${it.t}.`, 'good'); toast('Куплено: ' + it.t);
  return true;
}
/* ============ Мини-игры ============ */
const WHEEL_SILVER = [1000, 1500, 2000, 3000, 4000], WHEEL_GEMS = 5, WHEEL_PAID_MAX = 15, DICE_BETS = [100, 500, 2000, 10000], DICE_MAX = 20;
const WHEEL = [
  { k: 'food', t: 'Еда', w: 14 }, { k: 'wood', t: 'Дерево', w: 14 }, { k: 'stone', t: 'Камень', w: 14 }, { k: 'iron', t: 'Железо', w: 14 },
  { k: 'silver', t: 'Серебро', w: 14 }, { k: 'haste', t: 'Ускорения', w: 12 }, { k: 'item', t: 'Предмет', w: 12 }, { k: 'gems', t: 'Рунные камни', w: 6 }
];
function miniDay() {
  const d = dayId(nowMs());
  if (!S.mini || S.mini.d !== d) S.mini = { d, sp: 0, ps: 0, dc: 0, last: null, seq: (S.mini && S.mini.seq) || 0 };
  return S.mini;
}
const wheelCost = () => { const m = miniDay(); return m.sp < WHEEL_SILVER.length ? { silver: WHEEL_SILVER[m.sp] } : null; };
function spinWheel() {
  const m = miniDay(); let paid = false;
  if (m.sp < WHEEL_SILVER.length) {
    const c = { silver: WHEEL_SILVER[m.sp] }; if (!canAfford(c)) { toast('Не хватает серебра'); return false; }
    pay(c); m.sp++;
  } else {
    if (m.ps >= WHEEL_PAID_MAX) { toast('На сегодня прокруток больше нет'); return false; }
    if ((S.gems || 0) < WHEEL_GEMS) { toast('Не хватает рунных камней'); return false; }
    S.gems -= WHEEL_GEMS; m.ps++; paid = true;
  }
  let x = Math.random() * 100, i = 0; for (; i < WHEEL.length - 1; i++) { if (x < WHEEL[i].w) break; x -= WHEEL[i].w; }
  const sec = WHEEL[i]; let text = '';
  if (['food', 'wood', 'stone', 'iron'].includes(sec.k)) { const v = Math.max(800, Math.round(rate(sec.k) * 3)); addCapped(sec.k, v); text = `${sec.t} +${fmt(v)}`; }
  else if (sec.k === 'silver') { const v = 1500 * (1 + Math.floor(lvl('hall') / 5)); addCapped('silver', v); text = `Серебро +${fmt(v)}`; }
  else if (sec.k === 'haste') { S.haste += 3; text = 'Ускорения +3'; }
  else if (sec.k === 'gems') { S.gems = (S.gems || 0) + 5; text = 'Рунные камни +5'; }
  else { const it = newItem(Math.ceil(lvl('hall') / 5), [80, 18, 2]); const ok = giveItem(it, 'Колесо фортуны'); text = ok ? `Предмет: ${itemName(it)}` : 'Сумка полна, предмет пропал'; }
  m.seq = (m.seq || 0) + 1; m.last = { k: 'wheel', i, text, paid, n: m.seq };
  return true;
}
function rollDice(bet) {
  bet = Math.floor(Number(bet)); const m = miniDay();
  if (!DICE_BETS.includes(bet)) return false;
  if (m.dc >= DICE_MAX) { toast('На сегодня игр в кости хватит'); return false; }
  if (!canAfford({ silver: bet })) { toast('Не хватает серебра'); return false; }
  const d = () => 1 + Math.floor(Math.random() * 6), p = [d(), d()], b = [d(), d()], sp = p[0] + p[1], sb = b[0] + b[1];
  m.dc++; let delta = 0;
  if (sp > sb) { delta = Math.round(bet * 0.9); addCapped('silver', delta); }
  else if (sp < sb) { S.res.silver -= bet; delta = -bet; }
  m.seq = (m.seq || 0) + 1; m.last = { k: 'dice', p, b, bet, delta, n: m.seq };
  return true;
}
function act(a, arg) {
  switch (a) {
    case 'up': if (typeof arg === 'string') startBuild(arg); break;
    case 'train': if (arg && typeof arg === 'object') startTrain(arg.k, arg.n, arg.t); break;
    case 'study': if (typeof arg === 'string') startStudy(arg); break;
    case 'tierup': if (arg && typeof arg === 'object') startUpg(arg.k, arg.to, arg.from); break;
    case 'skill': if (typeof arg === 'string') spendSkill(arg); break;
    case 'haste': if (typeof arg === 'string') useHaste(arg); break;
    case 'free': if (typeof arg === 'string') freeFinish(arg); break;
    case 'refresh': if (nowMs() >= S.tgtAt + 30000) refreshTargets(); break;
    case 'march': if (arg && typeof arg === 'object') sendMarch(String(arg.id), arg.send); break;
    case 'claim': if (typeof arg === 'string') claim(arg); break;
    case 'intro': S.introDone = true; break;
    case 'bag': buyBag(); break;
    case 'spin': spinWheel(); break;
    case 'dice': rollDice(arg); break;
    case 'preset': { const i = Math.floor(Number(arg && arg.i)); if (!(i >= 0 && i < 5) || !arg.comp || typeof arg.comp !== 'object') break; const c = {}; for (const k in arg.comp) { if (!validKey(k)) continue; const v = Math.max(0, Math.min(1e6, Math.floor(Number(arg.comp[k])) || 0)); if (v) c[k] = v; } if (!Array.isArray(S.presets)) S.presets = []; while (S.presets.length < 5) S.presets.push(null); S.presets[i] = c; break; }
    case 'look': { const n = Math.floor(Number(arg)); if (n >= 1 && n <= LOOKS.length) S.hero.look = n; break; }
    case 'buy': if (typeof arg === 'string') buy(arg); break;
    case 'daily': claimDaily(); break;
    case 'streak': claimStreak(); break;
    case 'scout': if (typeof arg === 'string') scout(arg); break;
    case 'ptarget': if (typeof arg === 'string') addPlayerTarget(arg); break;
    case 'revenge': if (typeof arg === 'string') revenge(arg); break;
    case 'forge': forge(); break;
    case 'equip': if (typeof arg === 'string') equip(arg); break;
    case 'unequip': if (typeof arg === 'string' && EQS.includes(arg)) unequip(arg); break;
    case 'scrap': if (typeof arg === 'string') scrap(arg); break;
    case 'scrapmany': scrapMany(arg); break;
    case 'merge': if (typeof arg === 'string') mergeItems(arg); break;
  }
}

/* Оценка боя для подсказки в окне похода */
function verdict(t) {
  if (t.kind === 'node') return { c: 'frost', t: 'Сбор' };
  if (!sum(S.troops)) return { c: 'mute', t: 'Нет войск' };
  const r = battle(S.troops, t.comp, atkB(S), t.defb);
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
  armyAtk, newItem, giveItem, SLOTS, SLOTK, LOOKS, EQS, slotType, EQ_IL, RARN, EQMAX, BAG_COST, BAG_STEP, eqCap, itemPct, itemName, forgeCost, forgeLvl, scrapOf, eqB,
  RES, RI, B, BORDER, U, WEAK, TECH, QUESTS, MAXL, TMAX, CFG, HOOK, NODE, TIERN, TIER_NEED, MAXT, HSK, MAXHL, MAXSK,
  get S() { return S; },
  use, ensure, newState, update, produce, settle, battle, act, score, verdict,
  lvl, slots, cap, capAt, rate, prodAt, upCost, upSecs, canUp, canAfford, trainRate, maxBatch, trainSecs, techCost, techSecs, gatherSecs, marchSecs,
  posOf, tgtPos, isLand, snapLand, SHOP, scoutCost, isVip, buy, claimDaily, dailyLeft, streakInfo, claimStreak, STREAK, CONTESTS, PRIZES, PRIZE_PART, weekId, weekEnd, contestOf, wkScoreOf, wkSync, dayId,
  jobInfo, helpJob, chargeClan, CLAN_COST, CLAN_HALL, jobObj,
  tierOf, heroOf, tmul, tiersOf, botTiers, WHEEL, WHEEL_SILVER, WHEEL_GEMS, WHEEL_PAID_MAX, DICE_BETS, DICE_MAX, miniDay, wheelCost, stype, stier, skey, validKey, sname, sortKeys, byType, maxTier, botComp, costOf, upgPlan, UPG_PCT, atkB, defB, lootB, unitName, xpNeed, tierCost, tierSecs,
  refreshTargets, topUpPlayers, addLogTo, fmt, fmtT, fmtRes, fmtComp, fmtApprox, carryOf,
  setNow(f) { nowMs = f; }, now() { return nowMs(); },
  onToast(f) { toastFn = f; }
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Core = API;
})(typeof self !== 'undefined' ? self : globalThis);
