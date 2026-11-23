/* «Шахматы Нордики» — автобаттлер в духе Dota Auto Chess. Общие данные и боевая симуляция (сервер + клиент). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Chess = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const COLS = 5, HALF = 3, ROWS = 2 * HALF + 1, BENCH = 5, MAXLV = 9, TICK = 500;

  // ---- Родства и классы (синергии) ----
  const TRAITS = {
    viking: { n: 'Викинг', k: 'race', e: '🪓', th: [2, 4, 6], d: ['+15% к атаке', '+30% к атаке', '+55% к атаке и +15% к скорости'] },
    draugr: { n: 'Драугр', k: 'race', e: '💀', th: [2, 4], d: ['+20% здоровья', '+40% здоровья и вампиризм 20%'] },
    troll: { n: 'Тролль', k: 'race', e: '🧌', th: [2, 4], d: ['Регенерация 2% здоровья в секунду', 'Регенерация 5% здоровья в секунду'] },
    elf: { n: 'Эльф', k: 'race', e: '🧝', th: [2, 4], d: ['Уклонение 20%', 'Уклонение 40%'] },
    giant: { n: 'Великан', k: 'race', e: '🗿', th: [2], d: ['+28% здоровья и +8 брони'] },
    spirit: { n: 'Дух', k: 'race', e: '👻', th: [2, 4], d: ['Мана копится на 40% быстрее', 'Мана копится вдвое быстрее, заклинания +25%'] },
    warrior: { n: 'Воин', k: 'cls', e: '⚔️', th: [3, 6], d: ['+10 брони', '+22 брони'] },
    archer: { n: 'Лучник', k: 'cls', e: '🏹', th: [2, 4], d: ['+25% скорости атаки', '+55% скорости атаки'] },
    mage: { n: 'Маг', k: 'cls', e: '🔮', th: [2, 4], d: ['Заклинания +30%', 'Заклинания +65%, старт с половиной маны'] },
    assassin: { n: 'Убийца', k: 'cls', e: '🗡️', th: [2, 4], d: ['Крит 20% (×2)', 'Крит 40% (×2,5)'] },
    guardian: { n: 'Страж', k: 'cls', e: '🛡️', th: [2, 4], d: ['+20% здоровья', '+45% здоровья'] },
    priest: { n: 'Жрец', k: 'cls', e: '✨', th: [2], d: ['Союзники лечатся на 1,5% здоровья в секунду'] }
  };

  // ---- Заклинания ----
  const SP = {
    cleave: { n: 'Рубящий удар', t: 'aoe', r: 1, m: 1.7, mana: 60, d: 'Удар по цели и врагам рядом' },
    volley: { n: 'Меткий залп', t: 'dmg', m: 2.6, mana: 65, d: 'Мощный выстрел по цели' },
    bolt: { n: 'Молния', t: 'dmg', m: 3.2, mana: 80, d: 'Магический удар по цели' },
    stab: { n: 'Удар в спину', t: 'dmg', m: 3.4, mana: 60, d: 'Огромный урон по цели' },
    smash: { n: 'Оглушающий удар', t: 'stun', m: 1.6, d2: 3, mana: 80, d: 'Удар и оглушение на 1,5 секунды' },
    heal: { n: 'Исцеление', t: 'heal', m: 3.5, mana: 70, d: 'Лечит союзника с наименьшим здоровьем' },
    shield: { n: 'Каменная кожа', t: 'shield', m: 0.3, mana: 70, d: 'Щит на 30% здоровья' },
    rage: { n: 'Ярость берсерка', t: 'buff', self: 1, as: 0.7, d2: 10, mana: 60, d: 'Скорость атаки +70% на 5 секунд' },
    warcry: { n: 'Боевой клич', t: 'buff', as: 0.3, atk: 0.25, d2: 12, mana: 90, d: 'Вся команда бьёт сильнее на 6 секунд' },
    nova: { n: 'Ледяная волна', t: 'aoe', r: 2, m: 1.5, stun: 2, mana: 90, d: 'Урон по области и заморозка на секунду' },
    meteor: { n: 'Метеор', t: 'aoe', r: 2, m: 2.7, mana: 100, d: 'Огненный удар по большой области' },
    leech: { n: 'Пожиратель', t: 'leech', m: 2.4, mana: 70, d: 'Бьёт цель и лечит себя на этот урон' },
    ward: { n: 'Защитный круг', t: 'shield', all: 1, m: 0.18, mana: 90, d: 'Щит всей команде' }
  };

  // ---- Герои (карточки): id, имя, цена, родство, класс, роль, заклинание, эмодзи, подпись ----
  const U = [
    ['thrall', 'Трэль', 1, 'viking', 'warrior', 'melee', 'cleave', '🪓'],
    ['skald', 'Скальд', 1, 'viking', 'priest', 'support', 'heal', '🎻'],
    ['bonetoss', 'Костеметатель', 1, 'draugr', 'archer', 'ranged', 'volley', '🦴'],
    ['ghoul', 'Гуль', 1, 'draugr', 'warrior', 'melee', 'cleave', '🧟'],
    ['rockling', 'Каменюка', 1, 'troll', 'guardian', 'tank', 'shield', '🪨'],
    ['sprite', 'Лесной дух', 1, 'spirit', 'mage', 'mage', 'bolt', '🍃'],
    ['scout', 'Следопыт', 1, 'elf', 'archer', 'ranged', 'volley', '🏹'],
    ['cutthroat', 'Головорез', 1, 'viking', 'assassin', 'assassin', 'stab', '🔪'],
    ['berserker', 'Берсерк', 2, 'viking', 'warrior', 'melee', 'rage', '😡'],
    ['shieldmaiden', 'Щитоносица', 2, 'viking', 'guardian', 'tank', 'shield', '🛡️'],
    ['wight', 'Мертвец', 2, 'draugr', 'assassin', 'assassin', 'stab', '☠️'],
    ['cryptpriest', 'Жрец склепа', 2, 'draugr', 'priest', 'support', 'heal', '⚰️'],
    ['cavetroll', 'Пещерный тролль', 2, 'troll', 'warrior', 'melee', 'smash', '👹'],
    ['hexer', 'Колдун болот', 2, 'troll', 'mage', 'mage', 'bolt', '🐸'],
    ['ranger', 'Лучница леса', 2, 'elf', 'archer', 'ranged', 'volley', '🧝'],
    ['frostsprite', 'Ледяной дух', 2, 'spirit', 'mage', 'mage', 'nova', '❄️'],
    ['huskarl', 'Хускарл', 3, 'viking', 'warrior', 'melee', 'warcry', '⚔️'],
    ['runepriest', 'Рунный жрец', 3, 'viking', 'priest', 'support', 'ward', '🔯'],
    ['revenant', 'Ревенант', 3, 'draugr', 'guardian', 'tank', 'leech', '🦇'],
    ['stonemage', 'Каменный маг', 3, 'giant', 'mage', 'mage', 'meteor', '🌋'],
    ['elfblade', 'Эльфийский клинок', 3, 'elf', 'assassin', 'assassin', 'stab', '🗡️'],
    ['banshee', 'Банши', 3, 'spirit', 'priest', 'support', 'heal', '😱'],
    ['hillgiant', 'Холмовой великан', 3, 'giant', 'warrior', 'tank', 'smash', '🧔'],
    ['jarl', 'Ярл', 4, 'viking', 'guardian', 'tank', 'warcry', '👑'],
    ['deathknight', 'Рыцарь смерти', 4, 'draugr', 'warrior', 'melee', 'leech', '🐴'],
    ['trollshaman', 'Шаман троллей', 4, 'troll', 'priest', 'support', 'ward', '🥁'],
    ['starelf', 'Звёздная лучница', 4, 'elf', 'archer', 'ranged', 'volley', '🌟'],
    ['stormspirit', 'Дух бури', 4, 'spirit', 'mage', 'mage', 'nova', '⛈️'],
    ['frostgiant', 'Ледяной великан', 4, 'giant', 'guardian', 'tank', 'smash', '🏔️'],
    ['valkyrie', 'Валькирия', 5, 'viking', 'archer', 'ranged', 'volley', '🪽'],
    ['lich', 'Король-лич', 5, 'draugr', 'mage', 'mage', 'meteor', '🧙'],
    ['trollwarlord', 'Тролль-вождь', 5, 'troll', 'assassin', 'assassin', 'leech', '🦣'],
    ['elfqueen', 'Королева эльфов', 5, 'elf', 'mage', 'mage', 'nova', '🧚'],
    ['fenrir', 'Фенрир', 5, 'giant', 'assassin', 'melee', 'rage', '🐺']
  ];
  const ROLES = { // множители hp, atk, дальность, интервал (тики по 0.5с), мана
    melee: { hp: 1, atk: 1, rg: 1, ai: 2, mm: 1 },
    tank: { hp: 1.5, atk: 0.7, rg: 1, ai: 2, mm: 1 },
    assassin: { hp: 0.8, atk: 1.1, rg: 1, ai: 2, mm: 1 },
    ranged: { hp: 0.75, atk: 1.05, rg: 4, ai: 2, mm: 1 },
    mage: { hp: 0.7, atk: 0.8, rg: 3, ai: 2, mm: 0.9 },
    support: { hp: 0.85, atk: 0.6, rg: 3, ai: 2, mm: 0.9 }
  };
  const BASE_HP = [0, 480, 680, 920, 1250, 1650], BASE_ATK = [0, 24, 32, 42, 56, 72], BASE_AR = [0, 4, 6, 8, 11, 14];
  const CARDS = {}, ORDER = [];
  U.forEach(a => { CARDS[a[0]] = { id: a[0], n: a[1], c: a[2], r: a[3], k: a[4], ro: a[5], sp: a[6], e: a[7] }; ORDER.push(a[0]); });
  const POOL = { 1: 22, 2: 18, 3: 14, 4: 10, 5: 8 };
  const ODDS = [null, [100, 0, 0, 0, 0], [100, 0, 0, 0, 0], [75, 25, 0, 0, 0], [55, 35, 10, 0, 0], [40, 35, 22, 3, 0], [30, 35, 25, 10, 0], [22, 30, 30, 15, 3], [15, 25, 32, 20, 8], [10, 18, 30, 27, 15]];
  const XP_NEED = [0, 0, 2, 4, 8, 12, 16, 20, 24, 28]; // сколько опыта нужно, чтобы с (уровня-1) перейти на уровень
  const STAR_MUL = [0, 1, 1.85, 3.4];

  // ---- Предметы ----
  const ITEMS = {
    sword: { n: 'Меч ярла', e: '🗡️', d: '+25% к атаке', atk: 0.25 },
    plate: { n: 'Латы', e: '🛡️', d: '+12 брони', ar: 12 },
    heart: { n: 'Сердце тролля', e: '❤️', d: '+30% здоровья', hp: 0.3 },
    boots: { n: 'Сапоги вихря', e: '👢', d: '+30% скорости атаки', as: 0.3 },
    rune: { n: 'Руна маны', e: '🔷', d: 'Мана копится на 50% быстрее', mr: 0.5 },
    claw: { n: 'Коготь', e: '🦅', d: 'Крит 20%', crit: 0.2 },
    fang: { n: 'Клык вампира', e: '🦷', d: 'Вампиризм 20%', ls: 0.2 },
    cloak: { n: 'Плащ тени', e: '🧥', d: 'Уклонение 20%', dodge: 0.2 },
    staff: { n: 'Посох бури', e: '🪄', d: 'Заклинания +35%', sp: 0.35 },
    crown: { n: 'Корона войны', e: '👑', d: '+12% к атаке и здоровью', atk: 0.12, hp: 0.12 }
  };
  const ITEM_IDS = Object.keys(ITEMS);

  // ---- Расчёт синергий команды ----
  function synergies(cards) { // cards: массив id (уникальные по виду считаются один раз)
    const seen = {}, cnt = {};
    cards.forEach(id => { if (seen[id] || !CARDS[id]) return; seen[id] = 1; const c = CARDS[id]; cnt[c.r] = (cnt[c.r] || 0) + 1; cnt[c.k] = (cnt[c.k] || 0) + 1; });
    const out = {};
    for (const t in cnt) { const th = TRAITS[t].th; let lv = 0; for (let i = 0; i < th.length; i++) if (cnt[t] >= th[i]) lv = i + 1; out[t] = { n: cnt[t], lv }; }
    return out;
  }

  // ---- Характеристики одного героя в бою ----
  function stats(card, star, items, syn) {
    const c = CARDS[card], R = ROLES[c.ro], sm = STAR_MUL[star || 1];
    let hp = BASE_HP[c.c] * R.hp * sm, atk = BASE_ATK[c.c] * R.atk * sm, ar = BASE_AR[c.c], as = 1, crit = 0, cm = 2, dodge = 0, ls = 0, regen = 0, mr = 1, sp = 1, hpm = 1, atkm = 1, mana0 = 0;
    const L = t => (syn[t] ? syn[t].lv : 0);
    let v;
    if ((v = L('viking'))) { atkm += [0, 0.15, 0.3, 0.55][v]; if (v >= 3) as += 0.15; }
    if ((v = L('draugr'))) { hpm += v >= 2 ? 0.4 : 0.2; if (v >= 2) ls += 0.2; }
    if ((v = L('troll'))) regen += v >= 2 ? 0.05 : 0.02;
    if ((v = L('elf'))) dodge += v >= 2 ? 0.4 : 0.2;
    if (L('giant')) { hpm += 0.28; ar += 8; }
    if ((v = L('spirit'))) { mr += v >= 2 ? 1 : 0.4; if (v >= 2) sp += 0.25; }
    if ((v = L('warrior'))) ar += v >= 2 ? 22 : 10;
    if ((v = L('archer'))) as += v >= 2 ? 0.55 : 0.25;
    if ((v = L('mage'))) { sp += v >= 2 ? 0.65 : 0.3; if (v >= 2) mana0 = 0.5; }
    if ((v = L('assassin'))) { crit += v >= 2 ? 0.4 : 0.2; cm = v >= 2 ? 2.5 : 2; }
    if ((v = L('guardian'))) hpm += v >= 2 ? 0.45 : 0.2;
    (items || []).forEach(id => { const it = ITEMS[id]; if (!it) return; atkm += it.atk || 0; hpm += it.hp || 0; ar += it.ar || 0; as += it.as || 0; mr += it.mr || 0; crit += it.crit || 0; ls += it.ls || 0; dodge += it.dodge || 0; sp += it.sp || 0; });
    const spell = SP[c.sp];
    return { card, star: star || 1, hp: Math.round(hp * hpm), atk: Math.round(atk * atkm), ar, as, crit: Math.min(1, crit), cm, dodge: Math.min(0.7, dodge), ls, regen, mr, sp, rg: R.rg, ai: R.ai,
      mana: Math.round(spell.mana * R.mm), mana0: Math.round(spell.mana * R.mm * mana0) };
  }

  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  /* Бой. A — нижняя команда (свои), B — верхняя. Каждый юнит: {card,star,x,y (в своей половине: x 0..7, y 0..3, y=0 — передний ряд), items[]}.
     Для чужих «существ» можно передать {st:{...готовые статы}, e:'эмодзи', img:'ck-mN'}. */
  function simulate(A, B, seed, synA, synB) {
    const R = rng(seed || 1), units = [];
    const add = (arr, team, syn) => arr.forEach((u, i) => {
      const st = u.st || stats(u.card, u.star, u.items, syn);
      const x = team === 0 ? u.x : COLS - 1 - u.x, y = team === 0 ? HALF + 1 + u.y : HALF - 1 - u.y;
      units.push({ id: units.length, team, card: u.card || '', e: u.e || '', img: u.img || '', star: st.star || 1, x, y, mhp: st.hp, hp: st.hp, atk: st.atk, ar: st.ar, as: st.as, crit: st.crit, cm: st.cm, dodge: st.dodge, ls: st.ls, regen: st.regen, mr: st.mr, sp: st.sp, rg: st.rg, ai: st.ai,
        mm: st.mana, mana: st.mana0 || 0, spell: u.card ? CARDS[u.card].sp : (u.sp || ''), cd: 0, stun: 0, buff: [], shield: 0, tgt: -1, items: (u.items || []).length, pri: syn && syn.priest ? syn.priest.lv : 0 });
    });
    add(A, 0, synA || {}); add(B, 1, synB || {});
    units.forEach(u => { if (u.pri === undefined) u.pri = 0; });
    const priA = synA && synA.priest && synA.priest.lv > 0, priB = synB && synB.priest && synB.priest.lv > 0;
    const init = units.map(u => [u.id, u.team, u.card, u.e, u.img, u.star, u.x, u.y, u.mhp, u.hp, u.mm, u.mana, u.items]);
    const frames = [];
    const occ = new Map(); units.forEach(u => occ.set(u.x + ',' + u.y, u));
    const alive = t => units.filter(u => u.hp > 0 && (t === undefined || u.team === t));
    const asOf = u => { let m = u.as; u.buff.forEach(b => { m += b.as || 0; }); return Math.max(0.3, m); };
    const atkOf = u => { let m = 1; u.buff.forEach(b => { m += b.atk || 0; }); return u.atk * m; };
    function dealt(src, dst, amt, ev, magic, ticks) {
      if (dst.hp <= 0) return 0;
      if (!magic && dst.dodge > 0 && R() < dst.dodge) { ev.push(['d', dst.id]); return 0; }
      let d = amt;
      if (!magic) d = d * 100 / (100 + dst.ar);
      d = Math.max(1, Math.round(d));
      if (dst.shield > 0) { const s = Math.min(dst.shield, d); dst.shield -= s; d -= s; }
      dst.hp -= d; if (dst.hp < 0) dst.hp = 0;
      dst.mana = Math.min(dst.mm || 9999, dst.mana + 5);
      if (src && src.ls > 0 && d > 0) src.hp = Math.min(src.mhp, src.hp + Math.round(d * src.ls));
      if (dst.hp <= 0) { occ.delete(dst.x + ',' + dst.y); ev.push(['k', dst.id]); }
      return d;
    }
    function nearest(u) {
      let best = null, bd = 99;
      for (const o of units) { if (o.hp <= 0 || o.team === u.team) continue; const d = cheb(u, o); if (d < bd || (d === bd && best && o.id < best.id)) { bd = d; best = o; } }
      return best;
    }
    function step(u, t) {
      const dx = Math.sign(t.x - u.x), dy = Math.sign(t.y - u.y);
      let best = null, bd = 1e9;
      for (let ax = -1; ax <= 1; ax++) for (let ay = -1; ay <= 1; ay++) {
        if (!ax && !ay) continue; const nx = u.x + ax, ny = u.y + ay;
        if (nx < 0 || nx > COLS - 1 || ny < 0 || ny > ROWS - 1 || occ.has(nx + ',' + ny)) continue;
        const d = Math.max(Math.abs(t.x - nx), Math.abs(t.y - ny)) * 10 + Math.hypot(t.x - nx, t.y - ny);
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      const cur = Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) * 10 + Math.hypot(t.x - u.x, t.y - u.y);
      if (best && bd < cur) { occ.delete(u.x + ',' + u.y); u.x = best[0]; u.y = best[1]; occ.set(u.x + ',' + u.y, u); }
    }
    function cast(u, tgt, ev) {
      const s = SP[u.spell]; if (!s) return;
      const pw = u.sp * (u.card ? 1 : 1), a = atkOf(u);
      u.mana = 0; ev.push(['s', u.id, u.spell, tgt ? tgt.id : -1]);
      if (s.t === 'dmg') dealt(u, tgt, a * s.m * pw, ev, true);
      else if (s.t === 'leech') { const d = dealt(u, tgt, a * s.m * pw, ev, true); u.hp = Math.min(u.mhp, u.hp + d); }
      else if (s.t === 'stun') { dealt(u, tgt, a * s.m * pw, ev, true); tgt.stun = Math.max(tgt.stun, s.d2); }
      else if (s.t === 'aoe') {
        units.forEach(o => { if (o.hp > 0 && o.team !== u.team && cheb(o, tgt) <= s.r) { dealt(u, o, a * s.m * pw, ev, true); if (s.stun) o.stun = Math.max(o.stun, s.stun); } });
      } else if (s.t === 'heal') {
        let w = null; units.forEach(o => { if (o.hp > 0 && o.team === u.team && o.hp < o.mhp && (!w || o.hp / o.mhp < w.hp / w.mhp)) w = o; });
        if (w) { const h = Math.round(a * s.m * pw); w.hp = Math.min(w.mhp, w.hp + h); ev.push(['h', w.id, h]); }
      } else if (s.t === 'shield') {
        const list = s.all ? units.filter(o => o.hp > 0 && o.team === u.team) : [u];
        list.forEach(o => { o.shield += Math.round(o.mhp * s.m * pw); ev.push(['sh', o.id]); });
      } else if (s.t === 'buff') {
        const list = s.self ? [u] : units.filter(o => o.hp > 0 && o.team === u.team);
        list.forEach(o => o.buff.push({ as: s.as || 0, atk: s.atk || 0, t: s.d2 }));
      }
    }
    const MAXT = 130;
    let tick = 0, winner = -1;
    for (; tick < MAXT; tick++) {
      const ev = [];
      for (const u of units) {
        if (u.hp <= 0) continue;
        u.buff = u.buff.filter(b => (b.t -= 1) > 0);
        if (u.regen) u.hp = Math.min(u.mhp, u.hp + u.mhp * u.regen * 0.5);
        if (u.team === 0 ? priA : priB) u.hp = Math.min(u.mhp, u.hp + u.mhp * 0.0075);
        if (tick > 70) { u.hp -= u.mhp * 0.02 * (1 + (tick - 70) / 8); if (u.hp <= 0) { u.hp = 0; occ.delete(u.x + ',' + u.y); ev.push(['k', u.id]); } } // внезапная смерть
        if (u.hp <= 0) continue;
        if (u.stun > 0) { u.stun--; continue; }
        let t = u.tgt >= 0 ? units[u.tgt] : null;
        if (!t || t.hp <= 0) { t = nearest(u); u.tgt = t ? t.id : -1; }
        if (!t) continue;
        if (u.mm > 0 && u.spell && u.mana >= u.mm) {
          const sp = SP[u.spell];
          if (sp.t === 'heal' || sp.t === 'shield' || sp.t === 'buff' || cheb(u, t) <= Math.max(u.rg, 1) + (sp.r || 0)) { cast(u, t, ev); continue; }
        }
        if (cheb(u, t) <= u.rg) {
          u.cd -= 1;
          if (u.cd <= 0) {
            u.cd += u.ai / asOf(u);
            let d = atkOf(u); const cr = u.crit > 0 && R() < u.crit; if (cr) d *= u.cm;
            const got = dealt(u, t, d, ev, false);
            ev.push(['a', u.id, t.id, got, cr ? 1 : 0]);
            u.mana = Math.min(u.mm || 9999, u.mana + 10 * u.mr);
          }
        } else step(u, t);
      }
      frames.push({ s: units.map(u => [u.id, u.x, u.y, Math.round(u.hp), Math.round(u.mana), u.shield > 0 ? 1 : 0, u.stun > 0 ? 1 : 0]), e: ev });
      const a0 = units.some(u => u.team === 0 && u.hp > 0), a1 = units.some(u => u.team === 1 && u.hp > 0);
      if (!a0 || !a1) { winner = a0 ? 0 : a1 ? 1 : -1; tick++; break; }
    }
    if (winner < 0 && tick >= MAXT) { const h0 = units.filter(u => u.team === 0).reduce((s, u) => s + Math.max(0, u.hp), 0), h1 = units.filter(u => u.team === 1).reduce((s, u) => s + Math.max(0, u.hp), 0); winner = h0 > h1 ? 0 : h1 > h0 ? 1 : -1; }
    const surv = [units.filter(u => u.team === 0 && u.hp > 0).length, units.filter(u => u.team === 1 && u.hp > 0).length];
    return { init, frames, winner, surv, ticks: frames.length };
  }

  function rollCost(lv, r) { const o = ODDS[Math.max(1, Math.min(MAXLV, lv))]; let x = r * 100, c = 1; for (let i = 0; i < 5; i++) { x -= o[i]; if (x < 0) { c = i + 1; break; } } return c; }

  return { COLS, HALF, ROWS, BENCH, MAXLV, TICK, TRAITS, SP, CARDS, ORDER, ROLES, POOL, ODDS, XP_NEED, STAR_MUL, ITEMS, ITEM_IDS, synergies, stats, simulate, rng, rollCost };
});
