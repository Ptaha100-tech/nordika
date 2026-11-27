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
  silvermine: { n: 'Хижина шамана', r: 'ᛊ', cost: { wood: 120, stone: 90, iron: 40 }, t: 22 },
  storehouse: { n: 'Амбар',            r: 'ᛉ', cost: { wood: 90, stone: 70 }, t: 18 },
  vault:      { n: 'Хранилище',        r: 'ᚺ', cost: { wood: 100, stone: 120, iron: 50 }, t: 20 },
  barracks:   { n: 'Казарма',          r: 'ᛏ', cost: { wood: 100, stone: 80, iron: 30 }, t: 20 },
  oracle:     { n: 'Оракул',           r: 'ᚨ', cost: { wood: 120, stone: 100, silver: 60 }, t: 25 },
  wall:       { n: 'Городская стена',  r: 'ᛞ', cost: { wood: 150, stone: 220, iron: 60 }, t: 30, need: 5 },
  tower:      { n: 'Сторожевая башня', r: 'ᛚ', cost: { wood: 120, stone: 160, iron: 120, silver: 40 }, t: 30, need: 8 }
};
const BORDER = ['hall', 'farm', 'sawmill', 'quarry', 'ironmine', 'silvermine', 'storehouse', 'vault', 'barracks', 'oracle', 'wall', 'tower'];
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
  atk:  { n: 'Ярость',        d: '+3% к атаке всех воинов за уровень', b: 'w' },
  jstr: { n: 'Мощь удара',    d: '+3% к силе ярла (арена) за уровень', b: 'w' },
  jcrt: { n: 'Меткий глаз',   d: '+0,6% к шансу крита ярла за уровень', b: 'w' },
  def:  { n: 'Стойкость',     d: '+3% к защите города за уровень', b: 's' },
  jvit: { n: 'Крепкое тело',  d: '+4% к здоровью ярла (арена) за уровень', b: 's' },
  jarm: { n: 'Закалка',       d: '+3% к броне ярла (арена) за уровень', b: 's' },
  loot: { n: 'Хватка',        d: '+5% к ноше воинов за уровень', b: 'd' },
  eco:  { n: 'Хозяйственность', d: '+3% к добыче ресурсов в городе за уровень', b: 'd' },
  xp:   { n: 'Мудрость',      d: '+5% к опыту ярла за уровень', b: 'd' }
};
const HBR = { w: { n: 'Воин', t: 'Воин' }, s: { n: 'Страж', t: 'Страж' }, d: { n: 'Добытчик', t: 'Добытчик' } };
const skillPts = st => { let n = 0; const k = (st.hero && st.hero.sk) || {}; for (const x in k) n += k[x] || 0; return n; };
function jarlTitle(st) {
  const k = (st.hero && st.hero.sk) || {}, sum = { w: 0, s: 0, d: 0 };
  for (const x in k) if (HSK[x]) sum[HSK[x].b] += k[x] || 0;
  const t = sum.w + sum.s + sum.d; if (t < 5) return '';
  const b = Object.keys(sum).sort((a, c) => sum[c] - sum[a])[0];
  return sum[b] >= 0.6 * t ? (t >= 30 ? 'Великий ' : t >= 15 ? 'Опытный ' : '') + HBR[b].t : 'Универсал';
}
const MAXHL = 30, MAXSK = 10;
const WEAK = {}; Object.keys(U).forEach(k => { WEAK[k] = Object.keys(U).find(x => U[x].counters === k); });
const TECH = {
  atk: { n: 'Закалённая сталь', d: '+6% к атаке за уровень', r: 'ᛏ' },
  def: { n: 'Стена щитов',      d: '+6% к защите за уровень', r: 'ᚺ' },
  eco: { n: 'Дары земли',       d: '+5% к добыче за уровень', r: 'ᚠ' },
  bld: { n: 'Мастера-строители', d: '−3% ко времени стройки за уровень', r: 'ᛒ' },
  fast: { n: 'Быстрые драккары', d: '−3% ко времени походов за уровень', r: 'ᚱ' },
  drill: { n: 'Выучка дружины', d: '−3% ко времени обучения войск за уровень', r: 'ᛗ' },
  jstr: { n: 'Мощь удара',   d: '+4% к силе удара ярла за уровень', r: 'ᛏ', j: 1 },
  jvit: { n: 'Крепость тела', d: '+5% к здоровью ярла за уровень', r: 'ᛃ', j: 1 },
  jarm: { n: 'Закалка брони', d: '+4% к броне ярла за уровень', r: 'ᚺ', j: 1 },
  jcrt: { n: 'Глаз ворона',   d: '+0,5% к шансу крита ярла за уровень', r: 'ᚨ', j: 1 }
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
  touch: () => {},
  alert: () => {},
  mines: () => ({}),
  setMine: () => {},
  mineBan: () => 0,
  pvp: () => {},
  enemyIds: () => []
};

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sum = o => Object.values(o).reduce((x, y) => x + (y || 0), 0);
const toast = txt => { if (!quiet) toastFn(txt); };

const QUESTS = [
  { id: 'q1',  t: 'Подними Лесопилку до 3 уровня',      cur: () => lvl('sawmill'), max: 3,  rw: { wood: 300, stone: 150 } },
  { id: 'q2',  t: 'Подними Палату ярла до 3 уровня',    cur: () => lvl('hall'),    max: 3,  rw: { food: 400, wood: 400, haste: 1, gems: 1 } },
  { id: 'q3',  t: 'Обучи 20 воинов',                    cur: () => S.stat.trained, max: 20, rw: { food: 300, iron: 100 } },
  { id: 'q4',  t: 'Разгроми лагерь разбойников',        cur: () => S.stat.campWins, max: 1, rw: { silver: 200, haste: 1 } },
  { id: 'q5',  t: 'Построй Хранилище',                  cur: () => lvl('vault'),   max: 1,  rw: { stone: 400, iron: 150 } },
  { id: 'q6',  t: 'Изучи первое знание в Оракуле',      cur: () => S.stat.researched, max: 1, rw: { silver: 300, haste: 1 } },
  { id: 'q7',  t: 'Одержи 5 побед в походах',           cur: () => S.stat.wins,    max: 5,  rw: { food: 600, wood: 600, iron: 300, haste: 2, gems: 2 } },
  { id: 'q8',  t: 'Отбей набег врага',                  cur: () => S.stat.defWins, max: 1,  rw: { silver: 300, iron: 200, haste: 1 } },
  { id: 'q9',  t: 'Подними Казарму до 3 уровня',        cur: () => lvl('barracks'), max: 3, rw: { iron: 300, silver: 150 } },
  { id: 'q10', t: 'Собери ресурсы на точке карты',      cur: () => S.stat.gathered, max: 1, rw: { food: 300, wood: 300, haste: 1 } },
  { id: 'q12', t: 'Подними ярла до 3 уровня',            cur: () => heroOf(S).lv, max: 3, rw: { silver: 200, food: 300, haste: 1 } },
  { id: 'q13', t: 'Обучи или улучши воинов до 2 ступени',         cur: () => Object.keys(U).filter(k => tierOf(S, k) >= 2).length, max: 1, rw: { iron: 300, silver: 200, haste: 1 } },
  { id: 'q14', t: 'Подними Палату ярла до 10 уровня',   cur: () => lvl('hall'),    max: 10, rw: { food: 3000, wood: 3000, stone: 2000, haste: 3, gems: 4 } },
  { id: 'q15', t: 'Подними ярла до 10 уровня',          cur: () => heroOf(S).lv,   max: 10, rw: { silver: 1500, iron: 1500, haste: 3, gems: 3 } },
  { id: 'q16', t: 'Подними Палату ярла до 20 уровня',   cur: () => lvl('hall'),    max: 20, rw: { food: 12000, wood: 12000, stone: 8000, iron: 5000, haste: 6, gems: 8 } },
  { id: 'q17', t: 'Одержи 25 побед в походах',          cur: () => S.stat.wins,    max: 25, rw: { silver: 2000, iron: 2000, haste: 4, gems: 5 } },
  { id: 'q11', t: 'Разграбь город другого игрока',      cur: () => S.stat.pvpWins, max: 1,  rw: { silver: 400, iron: 300, haste: 2 } }
];

/* Дела-вехи: подними здание, воина или знание до уровня. Создаются по списку, награды растут с уровнем. */
(function () {
  const rw = (lv, kinds) => {
    const o = {}; kinds.forEach((k, i) => { o[k] = Math.round(lv * (i ? 90 : 140)); });
    if (lv >= 10) o.haste = Math.floor(lv / 5); if (lv >= 20) o.gems = Math.floor(lv / 10);
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
    QUESTS.push({ id: `s_${f}_${n}`, t, cur: () => (S.stat[f] || 0), max: n, rw: { silver: n * 20 + 200, iron: n * 20 + 200, haste: n >= 20 ? 3 : n >= 10 ? 1 : 0, gems: n >= 50 ? 2 : 0 } });
  });
  [5, 15, 20].forEach(L => QUESTS.push({ id: `h_${L}`, t: `Подними ярла до ${L} уровня`, cur: () => heroOf(S).lv, max: L, rw: { silver: L * 100, food: L * 150, haste: L >= 15 ? 4 : 1 } }));
  QUESTS.forEach(q => { Object.keys(q.rw).forEach(k => { if (!q.rw[k]) delete q.rw[k]; }); });
})();

const armyAtk = st => { let a = 0; for (const k in st.troops) if (validKey(k)) a += (st.troops[k] || 0) * U[stype(k)].atk * tmul(stier(k)); return a * atkB(st); };
/* ============ Снаряжение ярла ============ */
const SLOTS = {
  weapon: { n: 'Оружие',  stat: 'atk',  base: 3, w: 'к атаке всех воинов',      js: ['str', 12], names: ['Дубовый топор', 'Серебряная секира', 'Золотой клинок', 'Секира Рагнарёка'] },
  armor:  { n: 'Броня',   stat: 'def',  base: 3, w: 'к защите всех воинов',     js: ['arm', 8],  names: ['Кожаная броня', 'Серебряная кольчуга', 'Золотой доспех', 'Доспех Валгаллы'] },
  helm:   { n: 'Шлем',    stat: 'loot', base: 4, w: 'к ноше в походах',         js: ['vit', 40], names: ['Кожаный шлем', 'Серебряный шлем', 'Золотой шлем', 'Корона бури'] },
  amulet: { n: 'Амулет',  stat: 'eco',  base: 3, w: 'к добыче в городе',        js: ['crt', 3],  names: ['Костяной амулет', 'Серебряный молот Тора', 'Золотая руна', 'Око Одина'] },
  gloves: { n: 'Перчатки', stat: 'atk', base: 2, w: 'к атаке всех воинов',      js: ['str', 6],  names: ['Кожаные рукавицы', 'Серебряные перчатки', 'Золотые перчатки', 'Хватка Фенрира'] },
  pants:  { n: 'Штаны',   stat: 'def',  base: 2, w: 'к защите всех воинов',     js: ['arm', 5],  names: ['Шерстяные штаны', 'Серебряные поножи', 'Золотые поножи', 'Поножи Хеймдалля'] },
  cloak:  { n: 'Плащ',    stat: 'def',  base: 2, w: 'к защите всех воинов',     js: ['vit', 20], names: ['Тканый плащ', 'Волчий плащ', 'Золотой плащ', 'Крыло ворона'] },
  belt:   { n: 'Пояс',    stat: 'loot', base: 3, w: 'к ноше в походах',         js: ['vit', 25], names: ['Кожаный пояс', 'Серебряный пояс', 'Золотой пояс', 'Пояс Йормунганда'] },
  ring:   { n: 'Кольцо',  stat: 'eco',  base: 2, w: 'к добыче в городе',        js: ['crt', 2],  names: ['Медное кольцо', 'Серебряное кольцо', 'Золотое кольцо', 'Кольцо Драупнир'] }
};
/* места на ярле: два кольца делят один тип предметов */
const EQS = ['helm', 'cloak', 'armor', 'gloves', 'pants', 'belt', 'weapon', 'amulet', 'ring1', 'ring2'];
const slotType = k => (k === 'ring1' || k === 'ring2') ? 'ring' : k;
const LOOKS = ['Берсерк', 'Щитоносец', 'Копейщик', 'Секирщик', 'Элитный воин'];
const SLOTK = Object.keys(SLOTS), RARN = ['Обычное', 'Серебряное', 'Золотое', 'Эпическое'], EQMAX = 30, EQ_IL = 0, BAG_STEP = 5, BAG_COST = [20, 30, 45, 65, 90], MAXPLUS = 10;
const heroOn = st => !!(st && st.hst && st.hst.until > nowMs());
const eqCap = st => EQMAX + BAG_STEP * ((st && st.eq && st.eq.bag) || 0) + (heroOn(st) ? 5 : 0);
/* Сила предмета: тир и заточка. Для армии и города рост мягче, для ярла (арена) круче. */
const TM = [1, 2.2, 4.2, 8], AM = [1, 1.5, 2, 2.6];
const plusOf = it => Math.max(0, Math.min(MAXPLUS, it.plus || 0));
const jMul = it => TM[it.r] * (1 + 0.1 * plusOf(it));
const aMul = it => AM[it.r] * (1 + 0.05 * plusOf(it));
/* Добавка предмета: [вид, множитель разброса 0.7..1.3]. Виды: личные (str vit arm crt) и армейские (atk def loot eco). */
const AFF = { str: 4, vit: 15, arm: 3, crt: 1, atk: 1.5, def: 1.5, loot: 2, eco: 1.5 };
const AFN = { str: 'Сила', vit: 'Живучесть', arm: 'Броня', crt: 'Крит, %', atk: 'атака армии, %', def: 'защита армии, %', loot: 'ноша, %', eco: 'добыча, %' };
const itemPct = it => Math.round(SLOTS[it.slot].base * aMul(it) * 10) / 10;
const affVal = it => !it.af ? 0 : (it.af[0] in { atk: 1, def: 1, loot: 1, eco: 1 } ? Math.round(AFF[it.af[0]] * it.af[1] * aMul(it) * 10) / 10 : Math.round(AFF[it.af[0]] * it.af[1] * jMul(it) * 10) / 10);
const jMain = it => Math.round(SLOTS[it.slot].js[1] * jMul(it) * 10) / 10;
function eqB(st, stat) {
  if (!st || !st.eq) return 0; let v = 0;
  EQS.forEach(k => { const it = st.eq.s[k]; if (!it) return; if (SLOTS[slotType(k)].stat === stat) v += itemPct(it) / 100; if (it.af && it.af[0] === stat) v += affVal(it) / 100; });
  return v * (1 + setBonus(st));
}
/* Полный набор из 10 вещей даёт надбавку к бонусам армии по самому слабому тиру. */
const SETB = [0.05, 0.08, 0.12, 0.18];
function setBonus(st) {
  if (!st || !st.eq) return 0; let mn = 9;
  for (const k of EQS) { const it = st.eq.s[k]; if (!it) return 0; mn = Math.min(mn, it.r); }
  return SETB[mn] || 0;
}
const itemName = it => SLOTS[it.slot].names[it.r];
/* Личные характеристики ярла: уровень, предметы, знания Оракула. */
function jarlStats(st) {
  const H = heroOf(st), T = st.tech || {};
  const sum = { str: 0, vit: 0, arm: 0, crt: 0 };
  if (st.eq) EQS.forEach(k => { const it = st.eq.s[k]; if (!it) return; const m = SLOTS[slotType(k)].js; sum[m[0]] += jMain(it); if (it.af && it.af[0] in sum) sum[it.af[0]] += affVal(it); });
  const sb = 1 + setBonus(st) * 2;
  return {
    str: Math.round((10 + 2 * H.lv + sum.str * sb) * (1 + 0.04 * (T.jstr || 0) + 0.03 * ((H.sk || {}).jstr || 0))),
    hp: Math.round((300 + 40 * H.lv + sum.vit * sb) * (1 + 0.05 * (T.jvit || 0) + 0.04 * ((H.sk || {}).jvit || 0))),
    arm: Math.round((5 + H.lv + sum.arm * sb) * (1 + 0.04 * (T.jarm || 0) + 0.03 * ((H.sk || {}).jarm || 0))),
    crt: Math.min(60, Math.round((5 + sum.crt * sb + 0.5 * (T.jcrt || 0) + 0.6 * ((H.sk || {}).jcrt || 0)) * 10) / 10)
  };
}
/* Мощь ярла: уровень, очки навыков, вещи и знания Оракула. */
const itemPower = it => Math.round(30 * jMul(it) * (SLOTS[it.slot].base >= 3 ? 1 : 0.7));
function jarlPower(st) {
  const H = heroOf(st), T = st.tech || {}; let p = 50 * H.lv;
  for (const k in (H.sk || {})) p += 25 * (H.sk[k] || 0);
  if (st.eq) EQS.forEach(k => { const it = st.eq.s[k]; if (it) p += itemPower(it); });
  for (const k in T) p += (TECH[k] && TECH[k].j ? 30 : 10) * (T[k] || 0);
  return Math.round(p * (1 + setBonus(st)));
}
/* Обычная ковка: нужна Палата 3, предмет всегда обычный, слот выбирает игрок. */
const FORGE_COST = { wood: 220, iron: 140, silver: 40 };
const forgeCost = () => Object.assign({}, FORGE_COST);
const forgeLvl = () => 1;
function rollAf() { const k = pick(Object.keys(AFF)); return [k, Math.round(rnd(0.7, 1.3) * 100) / 100]; }
/* Предмет из награды: w = веса [обычное, серебряное, золотое]; золотые и эпические добываются только ковкой по рецептам. */
function newItem(il, w, slot) {
  const x = Math.random() * ((w ? w[0] + w[1] : 1) || 1), r = w && x >= w[0] ? 1 : 0;
  return { id: 'i' + (S.mid++), slot: slot && SLOTS[slot] ? slot : pick(SLOTK), r, plus: 0, af: rollAf() };
}
function giveItem(it, why, t) {
  if (bagUsed(S) >= eqCap(S)) { addLog(`Находка «${itemName(it)}» пропала: сумка полна.`, 'info', t); return false; }
  S.eq.inv.push(it); addLog(`${why}: ${RARN[it.r].toLowerCase()} «${itemName(it)}» (+${itemPct(it)}% ${SLOTS[it.slot].w}).`, 'good', t); toast(`Находка: ${itemName(it)}`);
  return true;
}
function buyBag() {
  const n = S.eq.bag || 0;
  if (n >= BAG_COST.length) { toast('Сумка уже расширена до предела'); return; }
  if ((S.gems || 0) < BAG_COST[n]) { toast('Не хватает рунных камней'); return; }
  S.gems -= BAG_COST[n]; S.eq.bag = n + 1; addLog(`Сумка расширена: теперь ${eqCap(S)} мест.`, 'good'); toast(`Сумка: ${eqCap(S)} мест`);
}
function forge(slot) {
  if (lvl('hall') < 3) { toast('Ковка открывается с Палаты ярла 3'); return; }
  if (bagUsed(S) >= eqCap(S)) { toast('Сумка полна'); return; }
  if (!SLOTS[slot]) { toast('Выберите, что ковать'); return; }
  const c = forgeCost(); if (!canAfford(c)) { toast('Не хватает ресурсов'); return; }
  pay(c); giveItem(newItem(1, null, slot), 'Кузнец выковал');
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
const SCRAP_K = [1, 3, 8, 20];
const scrapOf = it => { const k = SCRAP_K[it.r] * (1 + 0.2 * plusOf(it)); return { iron: Math.round(50 * k), silver: Math.round(20 * k) }; };
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
  st.clk = clkFix(st.clk || {});
  if (!st.chs) st.chs = { day: '', g: 0, w: 0, sil: 0, mat: 0, bp: 0, best: 0 };
  if (st.tech) { if (st.tech.bld === undefined) st.tech.bld = 0; if (st.tech.fast === undefined) st.tech.fast = 0; if (st.tech.drill === undefined) st.tech.drill = 0; }
  if (st.tech) ['jstr', 'jvit', 'jarm', 'jcrt'].forEach(k => { if (st.tech[k] === undefined) st.tech[k] = 0; });
  if (!st.eq) st.eq = { s: { weapon: null, armor: null, helm: null, amulet: null }, inv: [] };
  { const fix = it => { if (it && it.plus === undefined) { it.plus = 0; if (!(it.r >= 0 && it.r <= 3)) it.r = 0; delete it.il; } }; (st.eq.inv || []).forEach(fix); Object.keys(st.eq.s || {}).forEach(k => fix(st.eq.s[k])); }
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
  if (!st.wounded) st.wounded = {};
  if (!st.rec) st.rec = {};
  if (!st.camp || typeof st.camp.ch !== 'number') st.camp = { ch: 0, out: '' };
  if (st.hst && !(st.hst.s === 'a' || st.hst.s === 'b')) st.hst.s = 'a';
  if (!st.scr) st.scr = {};
  if (!st.mats) st.mats = {};
  ensureMobs(st);
  if (st.gems === undefined) { st.gems = 0; st.vip = 0; st.daily = 0; st.bought = {}; }
}
const tierOf = (st, k) => (st.tier && st.tier[k]) || 1;
const heroOf = st => st.hero || { lv: 1, xp: 0, sp: 0, sk: { atk: 0, def: 0, loot: 0 } };
const tmul = t => 1 + 0.3 * (t - 1);
const tiersOf = st => { const o = {}; for (const k in U) o[k] = tierOf(st, k); return o; };
const botTiers = L => { const t = Math.min(MAXT, 1 + Math.floor((Math.max(1, L) - 1) / 4)); return { spear: t, archer: t, cav: t }; };
const atkB = st => 1 + 0.06 * st.tech.atk + 0.03 * (heroOf(st).sk.atk || 0) + eqB(st, 'atk');
const defB = st => 1 + 0.06 * st.tech.def + 0.03 * (heroOf(st).sk.def || 0) + eqB(st, 'def') + 0.04 * ((st.b && st.b.wall) || 0);
/* Сторожевая башня: перед боем обстреливает нападающих, 1% воинов за уровень, не больше 30%. */
function towerVolley(comp, L) {
  const f = Math.min(0.3, 0.01 * (L || 0)), left = {}, lost = {};
  for (const k in comp) { const n = comp[k] || 0, x = Math.min(n, Math.round(n * f)); lost[k] = x; left[k] = n - x; }
  return { left, lost, n: sum(lost) };
}
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
  H.xp += Math.round(n * (1 + 0.05 * ((H.sk || {}).xp || 0)));
  while (H.lv < MAXHL && H.xp >= xpNeed(H.lv)) { H.xp -= xpNeed(H.lv); H.lv++; H.sp += (H.lv === 10 || H.lv === 20 || H.lv === 30) ? 2 : 1; addLog(`Ярл достиг ${H.lv} уровня. Есть очко навыка.`, 'good'); toast(`Ярл: уровень ${H.lv}`); }
  if (H.lv >= MAXHL) H.xp = 0;
}
const lvl = id => S.b[id] || 0;
const slots = h => 1 + (h >= 4 ? 1 : 0) + (h >= 8 ? 1 : 0) + (h >= 14 ? 1 : 0) + (h >= 20 ? 1 : 0);
const capAt = (st, h) => Math.round(3000 + 1800 * (st - 1) * (1 + 0.1 * (st - 1)) + 300 * (h - 1));
const isVip = () => (S.vip || 0) > nowMs() || heroOn(S);
const cap = () => Math.round(capAt(lvl('storehouse'), lvl('hall')) * (isVip() ? 1.2 : 1));
const ecoMul = () => (1 + 0.05 * S.tech.eco + 0.03 * (S.hero.sk.eco || 0) + eqB(S, 'eco')) * (isVip() ? 1.15 : 1);
const prot = () => 300 * lvl('vault');
/* Добыча и награды не превышают вместимость Амбара (уже лежащее сверху не отнимаем). */
const addCapped = (k, v) => { const c = cap(), cur = S.res[k] || 0; S.res[k] = Math.max(cur, Math.min(c, cur + v)); };
function prodAt(id, L) { const b = B[id]; return L ? Math.round(b.base * L * (1 + 0.12 * (L - 1)) * ecoMul()) : 0; }
function rate(rid) { if (rid === 'silver') return Math.round(25 * lvl('hall') * ecoMul()); const id = BORDER.find(k => B[k].res === rid); return prodAt(id, lvl(id)); }
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
  s += jarlPower(st) * 0.3;
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
  kind = kind || pick(['jarl', 'node']);
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
  const mobs = S.targets.filter(t => t.kind === 'mob');
  S.targets = mobs;
  ['node', 'node', 'node', 'node', 'node', 'node'].forEach(k => S.targets.push(genTarget(k)));
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
  if (S.heal && S.heal.end <= tn) c.push({ time: S.heal.end, run: finishHeal });
  S.marches.forEach(m => {
    if (m.phase === 'hold' && m.hEnd <= tn) c.push({ time: m.hEnd, run: () => endHold(m) });
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
      if (S.heal && S.heal.end <= to) c.push({ time: S.heal.end, run: finishHeal });
      if (!c.length) break;
      c.sort((a, b) => a.time - b.time);
      produce(Math.max(c[0].time, S.t)); c[0].run();
    }
    produce(to);
  } finally { S = keep; quiet = kq; }
}
function finishBuild(key) {
  key = key || 'q'; const q = S[key]; S.b[q.id] = q.to; S[key] = null; S.stat.built++; bpAdd(10);
  addLog(`${B[q.id].n} достигла уровня ${q.to}.`, 'good', q.end); toast(`${B[q.id].n}: уровень ${q.to}`);
}
function finishTrain() {
  const t = S.train, tr = t.t || 1, key = skey(t.type, tr); S.troops[key] = (S.troops[key] || 0) + t.n; S.stat.trained += t.n; S.train = null; bpAdd(8);
  if (tr > (S.tier[t.type] || 1)) S.tier[t.type] = tr;
  addLog(`Обучено: ${t.n} × ${unitName(t.type, tr)}.`, 'good', t.end); toast(`Обучено: ${t.n} × ${unitName(t.type, tr)}`);
}
function finishUpg() {
  const u = S.upg; let tot = 0; for (const f in u.n) tot += u.n[f];
  const key = skey(u.k, u.to); S.troops[key] = (S.troops[key] || 0) + tot; if (u.to > (S.tier[u.k] || 1)) S.tier[u.k] = u.to; S.upg = null;
  addLog(`Улучшено воинов: ${tot} → ${unitName(u.k, u.to)} (ступень ${u.to}).`, 'good', u.end); toast(`Улучшено: ${tot} → ${unitName(u.k, u.to)}`);
}
function finishStudy() {
  const s = S.study; S.tech[s.key] = s.to; S.stat.researched++; S.study = null; bpAdd(15);
  addLog(`Оракул открыл знание «${TECH[s.key].n}», уровень ${s.to}.`, 'good', s.end); toast(`Знание: ${TECH[s.key].n} ${s.to}`);
}
function fmtRes(o) { return Object.keys(o).filter(k => o[k] > 0 && RI[k]).map(k => `${RI[k].n} ${fmt(o[k])}`).join(' · ') || 'ничего'; }
function fmtComp(c) { return sortKeys(c).filter(k => validKey(k) && (c[k] || 0) > 0).map(k => `${sname(k)} ${c[k]}`).join(' · '); }
/* Разведка не выдаёт точных цифр: только приблизительно */
function approxN(n) { if (n <= 0) return 0; if (n < 10) return 10; const st = n < 100 ? 10 : n < 500 ? 50 : n < 2000 ? 100 : n < 10000 ? 500 : 1000; return Math.max(st, Math.round(n / st) * st); }
function fmtApprox(c) { return sortKeys(c).filter(k => validKey(k) && (c[k] || 0) > 0).map(k => `${sname(k)} ~${approxN(c[k])}`).join(' · '); }
const carryOf = (s, st) => { st = st || S; return Math.round(Object.keys(s).filter(validKey).reduce((a, k) => a + (s[k] || 0) * U[stype(k)].carry * tmul(stier(k)), 0) * lootB(st)); };

/* ============ Раненые, материалы, мобы, рудники ============ */
const HUT = 'silvermine';
const hutCap = st => { const L = (st.b && st.b[HUT]) || 0; return L ? Math.round(40 * L * (1 + 0.2 * (L - 1))) : 0; };
/* Из потерь 60% становятся ранеными (пока есть место в Хижине шамана), остальные гибнут. */
function woundSt(st, lost) {
  if (!st.wounded) st.wounded = {};
  let room = hutCap(st) - sum(st.wounded), dead = 0, hurt = 0;
  for (const k in lost) {
    const n = lost[k] || 0; if (!n || !validKey(k)) continue;
    const w = Math.min(Math.round(n * 0.6), Math.max(0, room)); room -= w;
    if (w) { st.wounded[k] = (st.wounded[k] || 0) + w; hurt += w; }
    dead += n - w;
  }
  return { dead, hurt };
}
const wnote = w => w && w.hurt ? ` Раненых: ${w.hurt}.` : '';
const healCost = st => { const o = { food: 0, wood: 0 }; for (const k in (st.wounded || {})) { const n = st.wounded[k] || 0, c = U[stype(k)].cost; for (const r in c) o[r] = (o[r] || 0) + Math.ceil(c[r] * 0.4 * n); } return o; };
const healSecs = st => { const n = sum(st.wounded || {}), L = (st.b && st.b[HUT]) || 1; return Math.max(10, Math.round(n * 4 * CFG.t / (1 + 0.15 * (L - 1)))); };
function startHeal() {
  if (!lvl(HUT)) { toast('Постройте Хижину шамана'); return; }
  if (S.heal) return;
  const n = sum(S.wounded || {}); if (!n) { toast('Раненых нет'); return; }
  const c = healCost(S); if (!canAfford(c)) { toast('Не хватает ресурсов'); return; }
  pay(c); const d = healSecs(S) * 1000;
  S.heal = { n: Object.assign({}, S.wounded), start: nowMs(), end: nowMs() + d, dur: d }; S.wounded = {};
}
function finishHeal() {
  const h = S.heal; let tot = 0;
  for (const k in h.n) { S.troops[k] = (S.troops[k] || 0) + h.n[k]; tot += h.n[k]; }
  S.heal = null; addLog(`Шаман исцелил воинов: ${tot}.`, 'good', h.end); toast(`Исцелено воинов: ${tot}`);
}
/* Материалы для крафта живут в той же сумке, что и вещи (стопка до 99). */
const MATS = { pelt: 'Волчья шкура', fang: 'Клык вепря', bone: 'Кость тролля', amber: 'Янтарь', frost: 'Ледяной осколок', ash: 'Вулканический пепел', rune: 'Рунная пыль', scale: 'Чешуя змея', heart: 'Сердце дракона' };
const MATK = Object.keys(MATS), STACK = 99;
const bagUsed = st => (st.eq.inv || []).length + Object.values(st.mats || {}).reduce((a, n) => a + Math.ceil((n || 0) / STACK), 0);
function giveMat(id, n) {
  if (!MATS[id] || !(n > 0)) return false;
  if (!S.mats) S.mats = {};
  const cur = S.mats[id] || 0, need = Math.ceil((cur + n) / STACK) - Math.ceil(cur / STACK);
  if (bagUsed(S) + need > eqCap(S)) return false;
  S.mats[id] = cur + n; return true;
}
const MOBS = [
  { n: 'Лесные волки',      lv: 1, silver: [30, 60],   rs: 20, drops: [['pelt', 0.38], ['fang', 0.15]] },
  { n: 'Дикие вепри',       lv: 2, silver: [50, 100],  rs: 20, drops: [['fang', 0.35], ['bone', 0.12]] },
  { n: 'Горные тролли',     lv: 3, silver: [80, 150],  rs: 30, drops: [['bone', 0.31], ['pelt', 0.15], ['amber', 0.1]] },
  { n: 'Ледяные ётуны',     lv: 5, silver: [150, 260], rs: 30, drops: [['frost', 0.28], ['bone', 0.15], ['amber', 0.12]] },
  { n: 'Огненные великаны', lv: 7, silver: [250, 400], rs: 45, drops: [['ash', 0.25], ['amber', 0.15], ['frost', 0.1]] },
  { n: 'Морские змеи',      lv: 9, silver: [400, 650], rs: 60, drops: [['scale', 0.25], ['rune', 0.15], ['ash', 0.12]] },
  { n: 'Дракон Нидхёгг',    lv: 12, silver: [900, 1400], rs: 60, boss: 1, drops: [['heart', 0.15], ['rune', 0.31], ['scale', 0.25]] }
];
function mobTarget(i) {
  const d = MOBS[i], n = Math.round(d.boss ? 18 * Math.pow(d.lv, 1.9) : 8 * Math.pow(d.lv, 1.8) + 3);
  const keys = shuffle(Object.keys(U)).slice(0, 2);
  return { id: 'mob' + i, kind: 'mob', mi: i, name: d.n, level: d.lv, comp: botComp(randComp(n, keys), d.lv), loot: {}, defb: 1, dist: 6 + 2 * i, until: 0 };
}
function ensureMobs(st) {
  if (!Array.isArray(st.targets)) return;
  st.targets = st.targets.filter(t => t.kind !== 'camp');
  const keepS = S; S = st;
  try { MOBS.forEach((d, i) => { if (!st.targets.some(t => t.id === 'mob' + i)) st.targets.push(mobTarget(i)); }); } finally { S = keepS; }
}
const MINEC = [
  { n: 'Малая жила',        min: 15,  silver: 300,   dist: 9 },
  { n: 'Медная копь',       min: 30,  silver: 700,   dist: 13 },
  { n: 'Серебряная копь',   min: 60,  silver: 1600,  dist: 17 },
  { n: 'Глубокий рудник',   min: 120, silver: 3500,  dist: 22 },
  { n: 'Королевская шахта', min: 240, silver: 8000,  dist: 28 }
];
const MINE_PER = 4;
const MINE_IDS = []; MINEC.forEach((d, t) => { for (let i = 0; i < MINE_PER; i++) MINE_IDS.push('m' + t + '_' + i); });
function mineTarget(id) {
  const m = /^m([0-4])_([0-3])$/.exec(String(id)); if (!m) return null;
  const ti = +m[1], d = MINEC[ti];
  return { id: 'mine:' + id, kind: 'mine', mine: id, ti, name: d.n + ' №' + (+m[2] + 1), level: ti + 1, dist: d.dist, comp: {}, loot: { silver: d.silver }, defb: 1 };
}
const mineDur = ti => MINEC[ti].min * 60000;
const MINE_MIN = [10, 40, 100, 250, 600];
const mineBusy = (id, t) => { const o = HOOK.mines()[id]; return o && o.end > (t || nowMs()) ? o : null; };
function endHold(m) {
  const ti = m.tgt.ti, d = MINEC[ti];
  S.stat.mines = (S.stat.mines || 0) + 1; bpAdd(40);
  m.loot = { silver: d.silver }; m.phase = 'back'; m.back = m.hEnd + m.dur; gainXp(20 + 10 * (ti + 1));
  const o = HOOK.mines()[m.tgt.mine]; if (o && o.mid === m.id) HOOK.setMine(m.tgt.mine, null);
  addLog(`Рудник «${m.tgt.name}» удержан. Отряд несёт ${d.silver} серебра.`, 'good', m.hEnd); toast(`Рудник удержан: ${m.tgt.name}`);
}
function resolveMine(m) {
  const tg = m.tgt, t = m.arrive, d = MINEC[tg.ti], id = tg.mine, o = mineBusy(id, t);
  const home = () => { m.phase = 'back'; m.back = t + m.dur; };
  const occupy = () => {
    const dur = mineDur(tg.ti); m.phase = 'hold'; m.hEnd = t + dur; m.hDur = dur; m.loot = {};
    HOOK.setMine(id, { pid: S.pid, name: S.name || 'Ярл', mid: m.id, end: m.hEnd, since: t });
    addLog(`Рудник «${tg.name}» занят. Держим ${d.min} мин, награда ${d.silver} серебра.`, 'good', t); toast(`Рудник занят: ${tg.name}`);
  };
  if (o && o.pid === S.pid) { home(); return; }
  if (!o) { occupy(); return; }
  const D = HOOK.getState(o.pid), m2 = D && (D.marches || []).find(x => x.id === o.mid && x.phase === 'hold');
  if (!m2) { HOOK.setMine(id, null); occupy(); return; }
  const r = battle(m.send, m2.send, atkB(S), defB(D));
  const wa = woundSt(S, r.lostA), wd = woundSt(D, r.lostD);
  m2.send = r.survD; m.send = r.survA;
  const aName = S.name || 'Ярл';
  if (r.win) {
    const f = Math.max(0, Math.min(1, (t - (m2.hEnd - m2.hDur)) / m2.hDur));
    m2.loot = { silver: Math.floor(d.silver * f * 0.5) }; m2.phase = 'back'; m2.back = t + m2.dur; HOOK.setMine(id, null);
    HOOK.alert(D.pid, `⛏ Ярл «${aName}» отбил у вас рудник «${tg.name}».`, 'a');
    addLogTo(D, `Ярл «${aName}» отбил у вас рудник «${tg.name}». Ваши потери: ${fmtComp(r.lostD) || 'нет'}.${wnote(wd)} Отряд несёт ${m2.loot.silver} серебра.`, 'bad', t);
    addLog(`Вы отбили рудник «${tg.name}» у ярла «${o.name}». Ваши потери: ${fmtComp(r.lostA) || 'нет'}.${wnote(wa)}`, 'good', t);
    occupy();
  } else {
    HOOK.alert(D.pid, `🛡 Вы удержали рудник «${tg.name}» против ярла «${aName}».`, 'a');
    addLogTo(D, `Вы удержали рудник «${tg.name}» против ярла «${aName}». Ваши потери: ${fmtComp(r.lostD) || 'нет'}.${wnote(wd)}`, 'good', t);
    addLog(`Не удалось отбить рудник «${tg.name}». Ваши потери: ${fmtComp(r.lostA) || 'нет'}.${wnote(wa)}`, 'bad', t); toast(`Рудник удержан врагом: ${tg.name}`);
    if (sum(r.survA) > 0) home(); else S.marches = S.marches.filter(x => x !== m);
  }
  HOOK.touch(o.pid);
}
function mscout(id) {
  const tg = mineTarget(id); if (!tg) return;
  const o = mineBusy(id); if (!o) { toast('Рудник свободен'); return; }
  if (o.pid === S.pid) return;
  const sc = { food: 60 * (tg.ti + 1), wood: 50 * (tg.ti + 1) };
  if (!canAfford(sc)) { toast('Не хватает ресурсов для разведки'); return; }
  pay(sc);
  const D = HOOK.getState(o.pid), m2 = D && (D.marches || []).find(x => x.id === o.mid && x.phase === 'hold');
  if (!S.mscout) S.mscout = {};
  S.mscout[id] = { t: nowMs(), name: o.name, comp: m2 ? fmtApprox(m2.send) : '', end: o.end };
  toast('Разведка рудника выполнена');
}

/* ============ Купец, эпический крафт, заточка ============ */
const REC_PRICE = [500, 2500, 12000], EC_SILVER = [300, 1500, 6000], EC_QTY = [2, 3, 4];
const SCROLLS = { n: { n: 'Обычный свиток', silver: 200 }, s: { n: 'Надёжный свиток', silver: 2000 }, g: { n: 'Свиток 100%', gems: 30 } };
const MATBASE = ['pelt', 'fang', 'bone', 'amber', 'frost', 'ash', 'rune', 'scale'];
function epicReq(slot, t) {
  const i = SLOTK.indexOf(slot); if (i < 0 || !(t >= 1 && t <= 3)) return null;
  const cnt = t + 2, mats = {}, base = t === 3 ? cnt - 1 : cnt;
  for (let j = 0; j < base; j++) mats[MATBASE[(i + j * 3 + t) % 8]] = EC_QTY[t - 1];
  if (t === 3) mats.heart = 1;
  return { mats, silver: EC_SILVER[t - 1] };
}
function buyMerchant(arg) {
  if (!arg || typeof arg !== 'object') return;
  if (arg.k === 'rec') {
    const t = Math.floor(Number(arg.t)); if (!SLOTS[arg.slot] || !(t >= 1 && t <= 3)) return;
    const pr = REC_PRICE[t - 1]; if (S.res.silver < pr) { toast('Не хватает серебра'); return; }
    S.res.silver -= pr; if (!S.rec) S.rec = {}; const k = arg.slot + ':' + t; S.rec[k] = (S.rec[k] || 0) + 1; toast('Рецепт куплен');
  } else if (arg.k === 'scr') {
    const d = SCROLLS[arg.s]; if (!d) return;
    if (d.gems) { if ((S.gems || 0) < d.gems) { toast('Не хватает рунных камней'); return; } S.gems -= d.gems; }
    else { if (S.res.silver < d.silver) { toast('Не хватает серебра'); return; } S.res.silver -= d.silver; }
    if (!S.scr) S.scr = {}; S.scr[arg.s] = (S.scr[arg.s] || 0) + 1; toast(d.n + ' куплен');
  }
}
function epicCraft(arg) {
  if (!arg || typeof arg !== 'object') return;
  const slot = arg.slot, t = Math.floor(Number(arg.t)), rq = epicReq(slot, t); if (!rq) return;
  const rk = slot + ':' + t;
  if (!((S.rec || {})[rk] > 0)) { toast('Нужен рецепт от купца'); return; }
  const cand = S.eq.inv.filter(x => x.slot === slot && x.r === t - 1).sort((a, b) => plusOf(a) - plusOf(b));
  const base = (arg.id && cand.find(x => x.id === arg.id)) || cand[0];
  if (!base) { toast('Нужна вещь прошлого тира'); return; }
  for (const m in rq.mats) if (((S.mats || {})[m] || 0) < rq.mats[m]) { toast('Не хватает материалов'); return; }
  if (S.res.silver < rq.silver) { toast('Не хватает серебра'); return; }
  S.res.silver -= rq.silver; S.rec[rk]--;
  for (const m in rq.mats) { S.mats[m] -= rq.mats[m]; if (S.mats[m] <= 0) delete S.mats[m]; }
  S.eq.inv.splice(S.eq.inv.indexOf(base), 1);
  const it = { id: 'i' + (S.mid++), slot, r: t, plus: 0, af: rollAf() };
  S.stat.epic = (S.stat.epic || 0) + 1; S.eq.inv.push(it); addLog(`Кузнец выковал: ${RARN[t].toLowerCase()} «${itemName(it)}».`, 'good'); toast(`Выковано: ${itemName(it)}`);
}
/* Заточка: до +3 всегда успех; дальше обычный свиток 65% (провал: вещь пропала), надёжный 85% (провал: сброс до +3), свиток 100%. */
const ENH_P = { n: 0.65, s: 0.85, g: 1 };
function enhance(arg) {
  if (!arg || typeof arg !== 'object' || !SCROLLS[arg.s]) return;
  let it = S.eq.inv.find(x => x.id === arg.id), where = 'inv';
  if (!it) { for (const k of Object.keys(S.eq.s)) if (S.eq.s[k] && S.eq.s[k].id === arg.id) { it = S.eq.s[k]; where = k; } }
  if (!it) return;
  const p = plusOf(it); if (p >= MAXPLUS) { toast('Заточка уже максимальна'); return; }
  if (!((S.scr || {})[arg.s] > 0)) { toast('Нет такого свитка'); return; }
  S.scr[arg.s]--;
  const ok = p < 3 || Math.random() < ENH_P[arg.s];
  if (ok) { it.plus = p + 1; addLog(`Заточка удалась: «${itemName(it)}» +${it.plus}.`, 'good'); toast(`Заточка +${it.plus}`); return; }
  if (arg.s === 's') { it.plus = 3; addLog(`Заточка не удалась: «${itemName(it)}» сброшена до +3.`, 'bad'); toast('Не вышло: сброс до +3'); return; }
  const back = 100 * (it.r + 1) * (p - 2);
  if (where === 'inv') S.eq.inv.splice(S.eq.inv.indexOf(it), 1); else S.eq.s[where] = null;
  S.res.silver += back; addLog(`Заточка не удалась: «${itemName(it)}» пропала. Осколки дали ${back} серебра.`, 'bad'); toast('Вещь пропала');
}

function resolveMarch(m) {
  const tg = m.tgt, t = m.arrive;
  if (tg.kind === 'node') {
    const carry = carryOf(m.send);
    m.loot = {}; for (const k in tg.loot) m.loot[k] = Math.min(carry, tg.loot[k]);
    m.phase = 'gather'; m.gStart = t; m.gEnd = t + gatherSecs() * 1000; return;
  }
  if (tg.kind === 'player') return resolvePlayer(m);
  if (tg.kind === 'mine') return resolveMine(m);
  const r = battle(m.send, tg.comp, atkB(S), tg.defb);
  const wa = woundSt(S, r.lostA);
  if (r.win) {
    gainXp(tg.kind === 'camp' || tg.kind === 'mob' ? 25 + 10 * tg.level : 35 + 12 * tg.level);
    const carry = carryOf(r.survA);
    const tot = sum(tg.loot), f = tot > 0 ? Math.min(1, carry / tot) : 0;
    m.loot = {}; for (const k in tg.loot) m.loot[k] = Math.floor(tg.loot[k] * f);
    if (tg.kind === 'mob') {
      const md = MOBS[tg.mi]; m.loot = { silver: ri(md.silver[0], md.silver[1]) }; m.mats = {};
      md.drops.forEach(([id, p]) => { if (Math.random() < p) m.mats[id] = 1; });
      const real = S.targets.find(x => x.id === tg.id); if (real) real.until = t + md.rs * 60000;
    }
    m.send = r.survA; m.phase = 'back'; m.back = t + m.dur;
    S.stat.wins++; bpAdd(tg.kind === 'mob' && MOBS[tg.mi] && MOBS[tg.mi].boss ? 80 : 15); if (tg.kind === 'camp' || tg.kind === 'mob') S.stat.campWins++;
    if (tg.kind === 'mob' && MOBS[tg.mi] && MOBS[tg.mi].boss) S.stat.boss = (S.stat.boss || 0) + 1;
    if (tg.kind !== 'mob') { S.targets = S.targets.filter(x => x.id !== tg.id); S.targets.push(genTarget(tg.kind)); }
    addLog(`Победа над «${tg.name}». Ваши потери: ${fmtComp(r.lostA) || 'нет'}.${wnote(wa)} Потери врага: ${fmtComp(r.lostD) || 'нет'}. Добыча: ${fmtRes(m.loot)}.`, 'good', t);
    toast(`Победа над «${tg.name}»`);
  } else {
    m.loot = {}; m.send = r.survA;
    addLog(`Поражение у «${tg.name}». Ваши потери: ${fmtComp(r.lostA) || 'нет'}.${wnote(wa)} Потери врага: ${fmtComp(r.lostD) || 'нет'}.`, 'bad', t);
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
  const vol = towerVolley(m.send, (D.b && D.b.tower) || 0); m.send = vol.left;
  const r = battle(m.send, D.troops, atkB(A), defB(D));
  D.troops = r.survD;
  try { HOOK.pvp(A.pid, D.pid, r.win); } catch (e) {}
  const wa = woundSt(A, r.lostA), wd = woundSt(D, r.lostD);
  const aName = A.name || 'Неизвестный ярл';
  const raid = (win, loot) => { (D.raids || (D.raids = [])).unshift({ t, pid: A.pid, name: aName, win, lost: fmtComp(r.lostD) || '', elost: fmtComp(r.lostA) || '', loot: loot || '' }); if (D.raids.length > 20) D.raids.pop(); };
  if (r.win) {
    const pr = 300 * (D.b.vault || 0), take = {}; let tot = 0;
    RES.forEach(x => { const a = Math.floor(Math.max(0, D.res[x.id] - pr) * 0.25); take[x.id] = a; tot += a; });
    const f = tot > 0 ? Math.min(1, carryOf(r.survA) / tot) : 0;
    m.loot = {}; RES.forEach(x => { const g = Math.floor(take[x.id] * f); m.loot[x.id] = g; D.res[x.id] -= g; });
    D.shield = t + 45 * 60000; raid(true, fmtRes(m.loot)); HOOK.alert(D.pid, `⚔ Ярл «${aName}» разграбил ваш город. Унесли: ${fmtRes(m.loot)}.`, 'a');
    addLogTo(D, `Ярл «${aName}» разграбил ваш город. Унесли: ${fmtRes(m.loot)}. Ваши потери: ${fmtComp(r.lostD) || 'нет'}.${wnote(wd)} Нападавшие потеряли: ${fmtComp(r.lostA) || 'нет'}. Щит на 45 минут.`, 'bad', t);
    m.send = r.survA; home();
    A.stat.wins++; A.stat.pvpWins++; bpAddTo(A, 20); gainXp(60 + 15 * (tg.level || 1));
    addLog(`Победа над ярлом «${tg.name}».${vol.n ? ` Башня врага сразила ${vol.n}.` : ''} Ваши потери: ${fmtComp(r.lostA) || 'нет'}.${wnote(wa)} Потери врага: ${fmtComp(r.lostD) || 'нет'}. Добыча: ${fmtRes(m.loot)}.`, 'good', t);
    toast(`Победа над «${tg.name}»`);
    S.targets = S.targets.filter(x => x.id !== tg.id); S.targets.push(genTarget('player'));
  } else {
    D.stat.defWins++; raid(false); HOOK.alert(D.pid, `🛡 Вы отбили нападение ярла «${aName}».`, 'a');
    addLogTo(D, `Вы отбили нападение ярла «${aName}». Ваши потери: ${fmtComp(r.lostD) || 'нет'}.${wnote(wd)} Нападавшие потеряли: ${fmtComp(r.lostA) || 'нет'}.`, 'good', t);
    m.loot = {}; m.send = r.survA;
    addLog(`Поражение у ярла «${tg.name}».${vol.n ? ` Башня врага сразила ${vol.n}.` : ''} Ваши потери: ${fmtComp(r.lostA) || 'нет'}.${wnote(wa)} Потери врага: ${fmtComp(r.lostD) || 'нет'}.`, 'bad', t);
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
  for (const k in m.loot) { if (k === 'silver') S.res.silver = (S.res.silver || 0) + (m.loot[k] || 0); else addCapped(k, m.loot[k]); }
  let lostM = 0; for (const id in (m.mats || {})) { if (!giveMat(id, m.mats[id])) lostM += m.mats[id]; else addLog(`Добыча: ${MATS[id]} × ${m.mats[id]}.`, 'good'); }
  if (lostM) { addLog(`Сумка полна: пропало материалов ${lostM}.`, 'info'); toast('Сумка полна, часть добычи пропала'); }
  S.marches = S.marches.filter(x => x !== m);
  toast('Дружина вернулась домой');
}
function enemyRaid() {
  const t = S.nextRaid; S.nextRaid = t + ri(150, 270) * 60000;      // раз в 2.5–4.5 часа
  if (S.shield > t) { S.nextRaid = Math.max(S.nextRaid, S.shield + ri(90, 150) * 60000); return; }   // после щита не сразу
  const H = lvl('hall');
  const n = Math.max(4, Math.round(4 * Math.pow(H, 1.55) * rnd(0.8, 1.5)));
  const comp0 = botComp(randComp(n, shuffle(Object.keys(U)).slice(0, 2)), H), vol = towerVolley(comp0, lvl('tower')), comp = vol.left;
  const r = battle(comp, S.troops, 1, defB(S));
  S.troops = r.survD;
  const wd = woundSt(S, r.lostD);
  if (r.win) {
    const lost = {};
    RES.forEach(x => { const l = Math.floor(Math.max(0, S.res[x.id] - prot()) * (H <= 3 ? 0.05 : H <= 6 ? 0.1 : 0.15)); S.res[x.id] -= l; lost[x.id] = l; });
    S.shield = t + 120 * 60000; S.nextRaid = Math.max(S.nextRaid, S.shield + ri(90, 150) * 60000);
    addLog(`Набег! ${n} врагов прорвались в город.${vol.n ? ` Башня сразила ${vol.n}.` : ''} Унесли: ${fmtRes(lost)}. Ваши потери: ${fmtComp(r.lostD) || 'нет'}.${wnote(wd)} Враги потеряли: ${fmtComp(r.lostA) || 'нет'}. Щит на 2 часа.`, 'bad', t);
    toast('Враги разграбили город');
  } else {
    S.stat.defWins++;
    const killed = sum(r.lostA), tr = { food: killed * 20, wood: killed * 15, iron: killed * 8, silver: killed * 3 }, cp = cap();
    for (const k in tr) S.res[k] = Math.max(S.res[k], Math.min(cp, S.res[k] + tr[k]));
    let bonus = ''; if (Math.random() < 0.25) { S.haste += 1; bonus = ' и 1 ускорение'; }
    gainXp(20 + killed);
    addLog(`Набег отбит! ${n} врагов разбиты.${vol.n ? ` Башня сразила ${vol.n}.` : ''} Враги потеряли: ${fmtComp(r.lostA) || 'нет'}. Ваши потери: ${fmtComp(r.lostD) || 'нет'}.${wnote(wd)} Трофеи: ${fmtRes(tr)}${bonus}.`, 'good', t);
    toast('Набег отбит, трофеи получены');
  }
}

/* ============ Действия ============ */
function canUp(id) {
  const L = lvl(id);
  if (L >= MAXL) return 'Максимальный уровень';
  if (B[id].need && L === 0 && lvl('hall') < B[id].need) return `Нужна Палата ярла ур. ${B[id].need}`;
  if (id !== 'hall' && L + 1 > lvl('hall')) return `Нужна Палата ярла ур. ${L + 1}`;
  return '';
}
function startBuild(id) {
  if (!B[id] || canUp(id)) return;
  if ((S.q && S.q.id === id) || (S.q2 && S.q2.id === id)) return;
  const key = !S.q ? 'q' : ((S.helper || isVip()) && !S.q2 ? 'q2' : null);
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
const respecCost = () => 300 * (S.hero ? S.hero.lv : 1);
function spendSkill(k) {
  const H = S.hero; if (!HSK[k] || H.sp < 1 || (H.sk[k] || 0) >= MAXSK) return;
  H.sp--; H.sk[k] = (H.sk[k] || 0) + 1;
}
function jobObj(kind) { return kind === 'q' ? S.q : kind === 'q2' ? S.q2 : kind === 'train' ? S.train : kind === 'study' ? S.study : kind === 'upg' ? S.upg : kind === 'heal' ? S.heal : null; }
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
  const tg = String(tid).startsWith('mine:') ? mineTarget(String(tid).slice(5)) : S.targets.find(x => x.id === tid);
  if (!tg || S.marches.length >= slots(lvl('hall')) || !send || typeof send !== 'object') return false;
  if (tg.kind === 'mob') { const real = S.targets.find(x => x.id === tg.id); if (real && real.until > nowMs()) { toast('Враги ещё не вернулись'); return false; } if (S.marches.some(x => x.tgt && x.tgt.id === tg.id)) { toast('Отряд уже идёт на этих врагов'); return false; } }
  if (tg.kind === 'mine' && HOOK.mineBan(S.pid) > nowMs()) { toast('Ваш клан проиграл войну: шахты закрыты до ' + new Date(HOOK.mineBan(S.pid)).toLocaleTimeString().slice(0, 5)); return false; }
  if (tg.kind === 'mine') { if (sum(send) < MINE_MIN[tg.ti]) { toast(`Для этого рудника нужно не меньше ${MINE_MIN[tg.ti]} воинов`); return false; } const o = mineBusy(tg.mine); if (o && o.pid === S.pid) { toast('Этот рудник уже ваш'); return false; } if (S.marches.some(x => x.tgt && x.tgt.mine === tg.mine)) { toast('Отряд уже идёт к руднику'); return false; } }
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

/* ============ Сюжетная кампания «Сага Нордики» ============ */
const sg = k => () => (S.stat[k] || 0);
const CAMP = [
  { n: 'Пепел и ветер', intro: 'Ваш род изгнан из родных земель. Ветер носит пепел над пустым берегом, а старый воин говорит: «Хочешь стать ярлом, начни с крыши над головой и топора в руке».',
    goals: [{ t: 'Подними Палату ярла до 3 уровня', cur: () => lvl('hall'), max: 3 }, { t: 'Обучи 20 воинов', cur: sg('trained'), max: 20 }],
    out: 'К вечеру над берегом поднялся дым очагов. Люди смотрят на вас иначе: так смотрят на вождя.', rw: { wood: 500, food: 500, gems: 2, haste: 2 } },
  { n: 'Первая кровь', intro: 'Разбойники грабят рыбацкие лодки. Они не прощают слабости, но и вам нельзя показать её первым.',
    goals: [{ t: 'Разгроми лагерь разбойников', cur: sg('campWins'), max: 1 }, { t: 'Одержи 5 побед в походах', cur: sg('wins'), max: 5 }],
    out: 'Лагерь пуст, дым над ним стелется низко. Дружина возвращается с трофеями и песней.', rw: { silver: 500, scr: { n: 2 } } },
  { n: 'Голос Оракула', intro: 'В горах живёт Оракул. Он видит узоры судьбы в трещинах льда и продаёт знание тем, кто умеет слушать. Но сначала нужен надёжный погреб.',
    goals: [{ t: 'Изучи первое знание в Оракуле', cur: sg('researched'), max: 1 }, { t: 'Построй Хранилище', cur: () => lvl('vault'), max: 1 }],
    out: '«Сильный сражается, мудрый выбирает бой», шепчет Оракул. Руны на камне гаснут, но слова остаются.', rw: { silver: 600, gems: 2, haste: 2 } },
  { n: 'Охота на зверя', intro: 'С гор спустились волки и вепри, лес за деревней стал опасен. Кто очистит его, тот получит и шкуры, и славу.',
    goals: [{ t: 'Победи монстров или лагеря 8 раз', cur: sg('campWins'), max: 8 }, { t: 'Подними ярла до 5 уровня', cur: () => heroOf(S).lv, max: 5 }],
    out: 'Лес снова шумит спокойно. У костра ярл слышит, что о нём уже поют в соседних селениях.', rw: { silver: 1000, haste: 3, rec: ['weapon:1'] } },
  { n: 'Хозяин рудника', intro: 'Серебро течёт из недр, как кровь из раны. Кто держит рудник, тот держит и казну. Но шахты не отдают себя даром.',
    goals: [{ t: 'Удержи рудник до конца', cur: sg('mines'), max: 1 }, { t: 'Подними Палату ярла до 8 уровня', cur: () => lvl('hall'), max: 8 }],
    out: 'Первая тачка серебра выкатилась на свет. Казначей пересчитывает её дважды и улыбается.', rw: { silver: 2000, gems: 3, scr: { s: 1 } } },
  { n: 'Арена ярлов', intro: 'В долине построили арену, и каждый ярл хочет доказать там своё имя. Слава бывает громкой, но недолгой.',
    goals: [{ t: 'Выиграй 3 боя на арене', cur: sg('arenaWins'), max: 3 }, { t: 'Подними ярла до 10 уровня', cur: () => heroOf(S).lv, max: 10 }],
    out: 'Песок арены помнит ваши шаги. Зрители скандируют имя ярла, пока он поднимает щит.', rw: { silver: 3000, gems: 4, rec: ['armor:1'] } },
  { n: 'Кузница богов', intro: 'Старый кузнец говорит, что в огне можно закалить не только железо, но и судьбу. Принеси ему всё нужное, и он покажет.',
    goals: [{ t: 'Выкуй вещь по рецепту купца', cur: sg('epic'), max: 1 }, { t: 'Одержи 15 побед в походах', cur: sg('wins'), max: 15 }],
    out: 'Молот звенит в такт сердцу. Новая вещь тяжела и тепла, будто живая.', rw: { gems: 6, scr: { s: 2 }, haste: 5 } },
  { n: 'Зов Рагнарёка', intro: 'Небо на западе багровеет. Старики шепчутся о конце времён, но воины ждут приказа. Пора показать, что фьорд готов.',
    goals: [{ t: 'Подними Палату ярла до 15 уровня', cur: () => lvl('hall'), max: 15 }, { t: 'Подними ярла до 15 уровня', cur: () => heroOf(S).lv, max: 15 }, { t: 'Одержи 25 побед в походах', cur: sg('wins'), max: 25 }],
    out: 'Дружина стоит строем на ветру. Никто не отводит глаз от красного неба.', rw: { silver: 8000, gems: 8, haste: 8 } },
  { n: 'Змей Нидхёгг', intro: 'Под корнями мирового древа ворочается Нидхёгг. Его дыхание плавит камень, но его сердце хранит ключ к твоей судьбе.',
    goals: [{ t: 'Победи дракона Нидхёгг', cur: sg('boss'), max: 1 }],
    out: 'Змей пал. Над долиной тишина, пока не прозвучал первый рог, возвещающий победу.', rw: { gems: 12, scr: { g: 1 }, rec: ['helm:2'] } },
  { n: 'Сердце фьорда', intro: 'Вы прошли путь от изгнанника до вождя. Остался последний шаг: стать тем, чьё имя произносят шёпотом даже за морем.',
    goals: [{ t: 'Подними Палату ярла до 20 уровня', cur: () => lvl('hall'), max: 20 }, { t: 'Подними ярла до 20 уровня', cur: () => heroOf(S).lv, max: 20 }, { t: 'Выиграй 10 боёв на арене', cur: sg('arenaWins'), max: 10 }],
    out: 'Фьорд выдохнул. Теперь это ваш дом, ваша сила и ваше сердце. Сага Нордики записана в камне.', rw: { silver: 20000, gems: 20, haste: 10, heroD: 3 } }
];
const campDone = st => (st.camp ? st.camp.ch : 0) >= CAMP.length;
function campReady() { const c = CAMP[S.camp.ch]; return !!c && c.goals.every(g => g.cur() >= g.max); }
function giveRw(rw) {
  for (const k in rw) {
    if (k === 'haste') S.haste += rw[k]; else if (k === 'gems') S.gems += rw[k];
    else if (k === 'scr') { if (!S.scr) S.scr = {}; for (const x in rw.scr) S.scr[x] = (S.scr[x] || 0) + rw.scr[x]; }
    else if (k === 'rec') { if (!S.rec) S.rec = {}; rw.rec.forEach(x => { S.rec[x] = (S.rec[x] || 0) + 1; }); }
    else if (k === 'heroD') S.hst = { s: (S.hst && S.hst.s) || 'a', until: Math.max((S.hst && S.hst.until) || 0, nowMs()) + rw.heroD * 86400000 };
    else if (k === 'silver') S.res.silver += rw[k];
    else addCapped(k, rw[k]);
  }
}
function campClaim() {
  const c = CAMP[S.camp.ch]; if (!c || !campReady()) return;
  giveRw(c.rw); S.camp.out = c.out; S.camp.ch++; bpAdd(100);
  addLog(`Глава «${c.n}» завершена.`, 'good'); toast('Глава завершена: ' + c.n);
}

/* ============ Боевой пропуск: сезон 4 недели, 30 уровней ============ */
const BP_EPOCH = Date.UTC(2026, 10, 16), BP_DAYS = 28, BP_LV = 30, BP_PTS = 100, BP_PRICE = 400;
const bpSeason = t => Math.floor((t - BP_EPOCH) / (BP_DAYS * 86400000));
const bpEnd = t => BP_EPOCH + (bpSeason(t) + 1) * BP_DAYS * 86400000;
function bpInit(st) {
  const sid = bpSeason(nowMs());
  if (!st.bp || st.bp.s !== sid) st.bp = { s: sid, pts: 0, f: [], p: [], pro: false };
  return st.bp;
}
const bpLevel = st => Math.min(BP_LV, Math.floor(bpInit(st).pts / BP_PTS));
function bpAddTo(st, n) { const b = bpInit(st); b.pts = Math.min(BP_LV * BP_PTS, b.pts + Math.max(0, Math.round(n))); }
const bpAdd = n => bpAddTo(S, n);
const BP_REC = ['weapon:2', 'armor:2', 'helm:2', 'amulet:2', 'ring:2', 'cloak:2', 'gloves:2', 'pants:2'];
function bpRw(L, pro) {
  if (!pro) {
    if (L % 10 === 0) return { gems: 5, scr: { s: 1 } };
    if (L % 5 === 0) return { gems: 3, haste: 2 };
    return L % 2 ? { silver: 150 + L * 40 } : { wood: L * 100, food: L * 100 };
  }
  if (L === 30) return { heroD: 7, gems: 30, scr: { g: 1 }, rec: ['weapon:3'] };
  if (L === 20) return { gems: 20, scr: { s: 3 }, rec: ['amulet:3'] };
  if (L === 10) return { heroD: 2, gems: 15, scr: { s: 2 } };
  if (L % 5 === 0) return { gems: 6, rec: [BP_REC[(L / 5) % BP_REC.length]] };
  return L % 2 ? { gems: 2, haste: 2 } : { silver: 300 + L * 80, scr: { n: 2 } };
}
function bpClaim(arg) {
  const q = String(arg || '').split(':'), L = Math.floor(Number(q[0])), pro = q[1] === 'p', b = bpInit(S);
  if (!(L >= 1 && L <= BP_LV) || L > bpLevel(S)) return false;
  if (pro && !b.pro) { toast('Нужна платная линия'); return false; }
  const arr = pro ? b.p : b.f; if (arr.includes(L)) return false;
  arr.push(L); giveRw(bpRw(L, pro)); return true;
}
function bpClaimAll() { let n = 0; for (let L = 1; L <= bpLevel(S); L++) { if (bpClaim(L + ':f')) n++; if (bpInit(S).pro && bpClaim(L + ':p')) n++; } if (n) toast('Награды пропуска получены'); }

function claim(id) {
  const q = QUESTS.find(x => x.id === id);
  if (!q || S.claimed[id] || q.cur() < q.max) return;
  S.claimed[id] = true; bpAdd(25);
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
  { id: 'vip7',     g: 'vip',    t: 'VIP на 7 дней',   d: 'Добыча +15%, склад +20%, помощник строителя (вторая очередь стройки), ежедневный дар больше, метка VIP в чате.',   gems: 80,  vipD: 7 },
  { id: 'vip30',    g: 'vip',    t: 'VIP на 30 дней',  d: 'То же самое на месяц. Выгоднее на 25%.',                     gems: 250, vipD: 30 },
  { id: 'bp', g: 'pass', t: 'Боевой пропуск: платная линия', d: 'На весь сезон (4 недели): ещё 30 наград, среди них рунные камни, свитки, рецепты и Hero на 9 дней. Очки идут за обычную игру.', gems: 400, bp: 1 },
  { id: 'hero_a',   g: 'hero',   t: 'Hero · Золото и руны', d: '30 дней. Золотой переливающийся ник и особый цвет сообщений в чате, значок HERO, рамка на арене, анонс входа в игру, все бонусы VIP, +1 бой на арене в день, +5 ячеек сумки.', gems: 400, heroS: 'a', heroD: 30 },
  { id: 'hero_b',   g: 'hero',   t: 'Hero · Огонь',         d: '30 дней. Пылающий ник и тёплый цвет сообщений в чате, значок HERO, рамка на арене, анонс входа в игру, все бонусы VIP, +1 бой на арене в день, +5 ячеек сумки.', gems: 400, heroS: 'b', heroD: 30 }
];
const DAILY_MS = 20 * 3600 * 1000;
function dailyLeft() { return Math.max(0, (S.daily || 0) + DAILY_MS - nowMs()); }
function claimDaily() {
  if (dailyLeft() > 0) return false;
  const v = isVip();
  bpAdd(20); S.daily = nowMs(); S.haste += v ? 3 : 1; S.gems += v ? 3 : 1;
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
const PRIZE_PART = { gems: 2 };           // остальные из первой десятки
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
const STREAK = [{ gems: 1 }, { haste: 1 }, { res: 2 }, { gems: 1, haste: 2 }, { gems: 2 }, { haste: 3 }, { gems: 4, haste: 5, res: 4 }];
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
  S.streak = { n: cont + 1, day: d }; bpAdd(20);
  if (rw.gems) { S.gems += rw.gems; parts.push(rw.gems + ' рунных камней'); }
  if (rw.haste) { S.haste += rw.haste; parts.push(rw.haste + ' ускорений'); }
  if (rw.res) { const c = cap(); for (const r of RES) { S.res[r.id] = Math.min(Math.max(c, S.res[r.id]), S.res[r.id] + rate(r.id) * rw.res); } parts.push(rw.res + ' ч добычи'); }
  addLog(`Награда за ${i.n}-й день подряд: ${parts.join(', ')}.`, 'good'); toast('Награда за вход получена');
  return true;
}
function buy(id) {
  const it = SHOP.find(x => x.id === id);
  if (!it) return false;
  if (it.once && S.bought[id]) { toast('Уже куплено'); return false; }
  if (it.bp && bpInit(S).pro) { toast('Платная линия уже куплена'); return false; }
  if (S.gems < it.gems) { toast('Не хватает рунных камней'); return false; }
  const t = nowMs();
  S.gems -= it.gems;
  if (it.haste) S.haste += it.haste;
  if (it.shieldH) S.shield = Math.max(S.shield, t) + it.shieldH * 3600000;
  if (it.resH) { const c = cap(); for (const r of RES) { const id2 = r.id; S.res[id2] = Math.min(Math.max(c, S.res[id2]), S.res[id2] + rate(id2) * it.resH); } }
  if (it.helper) S.helper = true;
  if (it.bp) bpInit(S).pro = true;
  if (it.vipD) S.vip = Math.max(S.vip || 0, t) + it.vipD * 86400000;
  if (it.heroS) S.hst = { s: it.heroS, until: Math.max((S.hst && S.hst.until) || 0, t) + it.heroD * 86400000 };
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
  else if (sec.k === 'gems') { S.gems = (S.gems || 0) + 2; text = 'Рунные камни +2'; }
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
    case 'respec': { const H = S.hero, n = skillPts(S), c = respecCost(); if (!n) break; if (S.res.silver < c) { toast('Не хватает серебра'); break; } S.res.silver -= c; H.sp += n; H.sk = {}; toast('Навыки сброшены'); break; }
    case 'haste': if (typeof arg === 'string') useHaste(arg); break;
    case 'free': if (typeof arg === 'string') freeFinish(arg); break;
    case 'refresh': if (nowMs() >= S.tgtAt + 30000) refreshTargets(); break;
    case 'march': if (arg && typeof arg === 'object') sendMarch(String(arg.id), arg.send); break;
    case 'claim': if (typeof arg === 'string') claim(arg); break;
    case 'campgo': campClaim(); break;
    case 'ckb': ckBatch(arg); break;
    case 'ckbuy': ckBuy(arg); break;
    case 'ckrb': ckRebirth(); break;
    case 'ckfarm': { const c = S.clk; if (c.farm) { c.farm = 0; c.k = 0; } else { if (ckBoss(c)) c.st = Math.max(1, c.st - 1); c.farm = 1; c.k = 0; c.hp = null; } break; }
    case 'bpc': if (bpClaim(arg)) toast('Награда получена'); break;
    case 'bpall': bpClaimAll(); break;
    case 'intro': S.introDone = true; break;
    case 'bag': buyBag(); break;
    case 'heal': startHeal(); break;
    case 'hstyle': if ((arg === 'a' || arg === 'b') && heroOn(S)) { S.hst.s = arg; toast('Стиль Hero изменён'); } break;
    case 'mbuy': buyMerchant(arg); break;
    case 'ecraft': epicCraft(arg); break;
    case 'enh': enhance(arg); break;
    case 'mscout': if (typeof arg === 'string') mscout(arg); break;
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
    case 'forge': forge(String(arg || '')); break;
    case 'equip': if (typeof arg === 'string') equip(arg); break;
    case 'unequip': if (typeof arg === 'string' && EQS.includes(arg)) unequip(arg); break;
    case 'scrap': if (typeof arg === 'string') scrap(arg); break;
    case 'sellx': {
      const q = String(arg || '').split('|');
      if (q[0] === 'r') { const k = q[1], n = (S.rec || {})[k] || 0, t = +k.split(':')[1]; if (n > 0 && REC_PRICE[t - 1]) { S.rec[k]--; if (!S.rec[k]) delete S.rec[k]; const g = Math.round(REC_PRICE[t - 1] * 0.4); S.res.silver += g; toast('Рецепт разобран: +' + g + ' серебра'); } }
      else if (q[0] === 's') { const k = q[1], n = (S.scr || {})[k] || 0; if (n > 0 && SCROLLS[k] && SCROLLS[k].silver) { S.scr[k]--; const g = Math.round(SCROLLS[k].silver * 0.5); S.res.silver += g; toast('Свиток разобран: +' + g + ' серебра'); } }
      break;
    }
    case 'scrapmany': scrapMany(arg); break;
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

/* ---------- кликер «Нашествие нечести» ---------- */
const CK_UP = { p: { t: 'Сила удара', b: 15, g: 1.17 }, c: { t: 'Меткость', b: 40, g: 1.32, max: 70 }, m: { t: 'Ярость', b: 60, g: 1.3, max: 80 }, g: { t: 'Жажда душ', b: 50, g: 1.27, max: 80 } };
const CK_SK = { d: { t: 'Двойной удар', b: 150, g: 1.5, cd: 25000, max: 30 }, a: { t: 'Автобой', b: 200, g: 1.5, cd: 45000, max: 30 }, f: { t: 'Огненный шар', b: 180, g: 1.5, cd: 30000, max: 30 }, s: { t: 'Удар щитом', b: 220, g: 1.5, cd: 35000, max: 30 } };
const CK_AUTO_RATE = 8, CK_PER = 5, CK_BOSS_EVERY = 10, CK_REB_MIN = 25;
function clkNew() { return { st: 1, mx: 1, k: 0, hp: null, n: 0, dbl: 0, souls: 0, up: { p: 0, c: 0, m: 0, g: 0 }, sk: { d: 1, a: 1, f: 1, s: 1 }, cd: { d: 0, a: 0, f: 0, s: 0 }, auto: 0, seal: 0, rb: 0, t: 0, farm: 0, kills: 0, bk: 0, best: 1, ms: {}, day: '', dsil: 0, dmat: 0, dbp: 0, dh: 0 }; }
function clkFix(c) {
  const n = clkNew(); for (const k in n) if (c[k] === undefined) c[k] = n[k];
  for (const k in n.up) if (!(c.up[k] >= 0)) c.up[k] = 0;
  for (const k in n.sk) if (!(c.sk[k] >= 1)) c.sk[k] = 1;
  for (const k in n.cd) if (!(c.cd[k] >= 0)) c.cd[k] = 0;
  return c;
}
const ckBoss = c => c.st % CK_BOSS_EVERY === 0;
const ckHpOf = (st, boss) => Math.max(5, Math.round(30 * Math.pow(1.36, st - 1) * (boss ? 8 : 1)));
const ckPow = c => 1 + 0.15 * (c.seal || 0);
const ckTap = c => Math.max(1, Math.round((3 + 2.2 * c.up.p) * Math.pow(1.04, c.up.p) * ckPow(c)));
const ckCritCh = c => Math.min(0.75, 0.05 + 0.01 * c.up.c);
const ckCritMul = c => 2 + 0.08 * c.up.m;
const ckSouls = (c, st, boss) => Math.max(1, Math.round(ckHpOf(st, boss) * 0.07 * (boss ? 1.2 : 1) * (1 + 0.08 * c.up.g) * (1 + 0.1 * (c.seal || 0))));
function ckRng(n) { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }
function ckCost(kind, k, lv) { const d = (kind === 's' ? CK_SK : CK_UP)[k]; return Math.round(d.b * Math.pow(d.g, lv - (kind === 's' ? 1 : 0))); }
function ckMax(kind, k) { return (kind === 's' ? CK_SK : CK_UP)[k].max || 9999; }
// Один шаг боя. loc=true — предсказание на телефоне (без проверок), иначе проверяет сервер.
function ckStep(c, b, now, loc) {
  const res = { kills: 0, boss: [] };
  const span = loc ? 0 : Math.max(0, Math.min(30000, now - (c.t || now - 5000)));
  let taps = Math.max(0, Math.min(500, b.taps | 0));
  if (!loc) taps = Math.min(taps, Math.ceil(13 * span / 1000) + 8);
  const use = {};
  for (const x in CK_SK) {
    const u = Math.max(0, Math.min(3, b[x] | 0)); if (!u) continue;
    const cdm = CK_SK[x].cd;
    if (loc) { use[x] = u; c.cd[x] = Math.max(c.cd[x] || 0, now) + cdm * u; continue; }
    const start = Math.max(c.cd[x] || 0, now - span); let ok = 0;
    while (ok < u && start + ok * cdm <= now + 1500) ok++;
    if (ok) c.cd[x] = start + ok * cdm; use[x] = ok;
  }
  c.t = now;
  if (ckBoss(c) && c.farm) c.farm = 0;
  if (b.fl && ckBoss(c) && !c.farm) { c.st = Math.max(1, c.st - 1); c.farm = 1; c.k = 0; c.hp = null; }
  const kill = () => {
    const boss = ckBoss(c);
    c.souls += ckSouls(c, c.st, boss); c.kills++; res.kills++;
    if (boss) { c.bk++; res.boss.push(c.st); c.st++; c.k = 0; c.farm = 0; if (c.st > c.mx) c.mx = c.st; }
    else { c.k++; if (c.k >= CK_PER) { c.k = 0; if (!c.farm) { c.st++; if (c.st > c.mx) c.mx = c.st; } } }
    if (c.st > c.best) c.best = c.st;
  };
  const hit = d => {
    if (c.hp == null) c.hp = ckHpOf(c.st, ckBoss(c));
    c.hp -= d;
    let g = 0;
    while (c.hp <= 0 && g++ < 400) { const left = c.hp; kill(); c.hp = ckHpOf(c.st, ckBoss(c)) + left; }
  };
  const base = ckTap(c), cc = ckCritCh(c), cm = ckCritMul(c);
  const tapHit = (mult) => { let d = base * (mult || 1); if (ckRng(c.n++) < cc) d *= cm; hit(Math.round(d)); };
  if (use.d) c.dbl = Math.min(600, (c.dbl || 0) + use.d * Math.round(13 * (6 + 0.3 * c.sk.d)));
  const td = Math.max(0, Math.min(taps, b.td | 0, c.dbl || 0));
  for (let i = 0; i < taps; i++) tapHit(i < td ? 2 : 1);
  c.dbl = Math.max(0, (c.dbl || 0) - td);
  if (use.a) c.auto = Math.min(900, (c.auto || 0) + use.a * Math.round(CK_AUTO_RATE * (10 + 0.5 * c.sk.a)));
  { let ah = Math.max(0, Math.min(400, b.ah | 0)); ah = Math.min(ah, c.auto || 0); if (!loc) ah = Math.min(ah, Math.ceil((CK_AUTO_RATE + 1) * span / 1000) + 6);
    const am = 1 + 0.05 * c.sk.a; for (let i = 0; i < ah; i++) tapHit(am); c.auto = Math.max(0, (c.auto || 0) - ah); }
  if (use.f) hit(Math.round(base * (20 + 3 * c.sk.f) * use.f));
  if (use.s) hit(Math.round(base * (8 + 2 * c.sk.s) * use.s));
  return res;
}
const CK_MS = { 10: 1, 20: 2, 30: 3, 50: 5, 75: 6, 100: 8, 150: 12, 200: 16 };
function ckBatch(arg) {
  const c = S.clk, b = arg && typeof arg === 'object' ? arg : {}, now = nowMs();
  const day = new Date(now).toISOString().slice(0, 10);
  if (c.day !== day) { c.day = day; c.dsil = 0; c.dmat = 0; c.dbp = 0; c.dh = 0; }
  const r = ckStep(c, b, now, false);
  const keys = Object.keys(MATS);
  r.boss.forEach(st => {
    const z = Math.floor(st / CK_BOSS_EVERY);
    const sil = Math.min(Math.round(250 * Math.pow(z, 1.3)), Math.max(0, 40000 - c.dsil)); if (sil > 0) { S.res.silver += sil; c.dsil += sil; }
    if (c.dmat < 8) { const pool = st >= 80 ? keys : keys.filter(k => k !== 'heart'); const mk = pool[(z - 1) % pool.length]; if (!S.mats) S.mats = {}; S.mats[mk] = (S.mats[mk] || 0) + 1; c.dmat++; }
    if (c.dbp < 10) { bpAdd(5); c.dbp++; }
    if (c.bk % 5 === 0 && c.dh < 3) { S.haste += 1; c.dh++; }
    gainXp(4 * z);
    for (const m in CK_MS) if (st >= +m && !c.ms[m]) { c.ms[m] = 1; S.gems += CK_MS[m]; }
  });
  if (S.stat) S.stat.clk = Math.max(S.stat.clk || 0, c.best);
}

/* Шахматы Нордики: награда по месту. Дневные лимиты как у кликера. Возвращает текст для игрока. */
const CHS_RW = { 1: [12000, 2, 8], 2: [7000, 1, 5], 3: [3500, 1, 3], 4: [1500, 0, 2] };
function chessReward(st, place) {
  const prev = S; S = st;
  try {
    const c = st.chs, day = new Date(nowMs()).toISOString().slice(0, 10);
    if (c.day !== day) { c.day = day; c.sil = 0; c.mat = 0; c.bp = 0; }
    const rw = CHS_RW[place] || [500, 0, 1];
    const sil = Math.min(rw[0], Math.max(0, 30000 - c.sil)), keys = Object.keys(MATS);
    S.res.silver += sil; c.sil += sil;
    let mats = 0; while (mats < rw[1] && c.mat < 6) { const mk = keys[(c.g + mats) % keys.filter(k => k !== 'heart').length]; if (!S.mats) S.mats = {}; S.mats[mk] = (S.mats[mk] || 0) + 1; c.mat++; mats++; }
    const bp = Math.min(rw[2], Math.max(0, 20 - c.bp)); if (bp > 0) { bpAdd(bp); c.bp += bp; }
    c.g++; if (place === 1) c.w++; c.best = c.best ? Math.min(c.best, place) : place;
    gainXp(place <= 3 ? 6 : 2);
    return { sil, mats, bp };
  } finally { S = prev; }
}
function ckBuy(arg) {
  if (!arg || typeof arg !== 'object') return; const c = S.clk, kind = arg.t === 's' ? 's' : 'u', k = String(arg.k);
  const tbl = kind === 's' ? CK_SK : CK_UP; if (!tbl[k]) return;
  const store = kind === 's' ? c.sk : c.up; let want = arg.n === 'max' ? 999 : Math.max(1, Math.min(100, arg.n | 0)), got = 0;
  while (got < want && store[k] < ckMax(kind, k)) { const cost = ckCost(kind, k, store[k]); if (c.souls < cost) break; c.souls -= cost; store[k]++; got++; }
  if (!got) toast('Не хватает душ');
}
function ckRebirth() {
  const c = S.clk; if (c.mx < CK_REB_MIN) { toast('Нужно дойти хотя бы до ' + CK_REB_MIN + ' этапа'); return; }
  const g = Math.floor((c.mx - 15) / 10); if (g < 1) return;
  const keep = { seal: c.seal + g, rb: c.rb + 1, bk: c.bk, kills: c.kills, best: c.best, ms: c.ms, day: c.day, dsil: c.dsil, dmat: c.dmat, dbp: c.dbp, dh: c.dh, n: c.n };
  S.clk = Object.assign(clkNew(), keep); toast('Возрождение! Печатей тьмы: +' + g);
}
const API = {
  CK_UP, CK_SK, CK_AUTO_RATE, CK_PER, CK_BOSS_EVERY, CK_REB_MIN, CK_MS, clkNew, ckStep, ckBoss, ckHpOf, ckTap, ckCritCh, ckCritMul, ckSouls, ckCost, ckMax,
  armyAtk, newItem, giveItem, SLOTS, SLOTK, LOOKS, EQS, slotType, EQ_IL, RARN, EQMAX, BAG_COST, BAG_STEP, eqCap, itemPct, itemName, forgeCost, forgeLvl, scrapOf, eqB, jarlStats, jarlPower, setBonus, jMain, affVal, plusOf, itemPower, AFN, MAXPLUS, TM, SETB,
  heroOn, REC_PRICE, SCROLLS, ENH_P, epicReq, hutCap, wnote, healCost, healSecs, MATS, MATK, STACK, bagUsed, giveMat, MOBS, MINEC, MINE_MIN, MINE_IDS, mineTarget, mineBusy, mineDur,
  RES, RI, B, BORDER, U, WEAK, TECH, QUESTS, MAXL, TMAX, CFG, HOOK, NODE, TIERN, TIER_NEED, MAXT, BP_LV, BP_PTS, BP_PRICE, bpInit, bpLevel, bpEnd, bpRw, bpAddTo, CAMP, campReady, campDone, HSK, HBR, MAXHL, MAXSK, skillPts, jarlTitle, respecCost,
  get S() { return S; },
  use, ensure, newState, update, produce, settle, battle, act, score, verdict,
  chessReward, lvl, slots, cap, capAt, rate, prodAt, upCost, upSecs, canUp, canAfford, trainRate, maxBatch, trainSecs, techCost, techSecs, gatherSecs, marchSecs,
  posOf, tgtPos, isLand, snapLand, SHOP, scoutCost, isVip, buy, claimDaily, dailyLeft, streakInfo, claimStreak, STREAK, CONTESTS, PRIZES, PRIZE_PART, weekId, weekEnd, contestOf, wkScoreOf, wkSync, dayId,
  jobInfo, helpJob, chargeClan, CLAN_COST, CLAN_HALL, jobObj,
  tierOf, heroOf, tmul, tiersOf, botTiers, WHEEL, WHEEL_SILVER, WHEEL_GEMS, WHEEL_PAID_MAX, DICE_BETS, DICE_MAX, miniDay, wheelCost, stype, stier, skey, validKey, sname, sortKeys, byType, maxTier, botComp, costOf, upgPlan, UPG_PCT, atkB, defB, lootB, unitName, xpNeed, tierCost, tierSecs,
  refreshTargets, topUpPlayers, addLogTo, fmt, fmtT, fmtRes, fmtComp, fmtApprox, carryOf,
  setNow(f) { nowMs = f; }, now() { return nowMs(); },
  onToast(f) { toastFn = f; }
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Core = API;
})(typeof self !== 'undefined' ? self : globalThis);
