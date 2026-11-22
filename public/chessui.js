/* «Шахматы Нордики» — экран игры. Подключается после index.html-скрипта; использует его $, call, toast, ui, sync, render. */
(function () {
  'use strict';
  const C = window.Chess, TICK = C.TICK;
  const CCOL = { 1: '#8a8f98', 2: '#4fae5b', 3: '#4a86e0', 4: '#a05be0', 5: '#e8b230' };
  const st = { on: false, v: null, sel: null, item: -1, tm: 0, busy: false, round: 0, rep: null, tab: 0, shown: 0, rwDone: false };
  const $c = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stars = n => '★'.repeat(n || 1);

  const css = `
#chs{position:fixed;inset:0;z-index:60;background:#14110d;color:#f2e8d5;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;--cs:min(11.4vw,calc((100vh - 395px)/9),64px);padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0);font-family:inherit}
#chs[hidden]{display:none}
#chs:before{content:"";position:fixed;inset:-6%;background:url(/img/ch-arena.webp?v=1) center/cover;filter:brightness(.5) saturate(1.1);pointer-events:none;animation:chdrift 40s ease-in-out infinite alternate}
@keyframes chdrift{from{transform:scale(1.02) translate(-1.5%,-1%)}to{transform:scale(1.1) translate(1.5%,1%)}}
#chs:after{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 8% 12%,rgba(90,190,255,.35),transparent 18%),radial-gradient(circle at 92% 12%,rgba(90,190,255,.35),transparent 18%),radial-gradient(circle at 10% 55%,rgba(90,190,255,.3),transparent 16%),radial-gradient(circle at 90% 60%,rgba(90,190,255,.3),transparent 16%);animation:chglow 3.2s ease-in-out infinite alternate}
@keyframes chglow{from{opacity:.25}to{opacity:1}}
.chbd:after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;background:linear-gradient(115deg,transparent 40%,rgba(180,230,255,.22) 50%,transparent 60%);background-size:250% 100%;animation:chsweep 6s linear infinite}
@keyframes chsweep{from{background-position:130% 0}to{background-position:-130% 0}}
.chw{position:relative;z-index:1;max-width:560px;margin:0 auto;padding:6px 6px 14px}
.chtop{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.chtop .btn{padding:6px 9px;font-size:13px;min-height:34px}
.chrd{flex:1;text-align:center;font-weight:700;font-size:15px;line-height:1.15}.chrd small{display:block;font-weight:400;opacity:.8;font-size:12px}
.chst{display:flex;gap:5px;font-weight:700;font-size:14px;align-items:center}.chst span{background:rgba(0,0,0,.45);border:1px solid #5a4a30;border-radius:8px;padding:3px 7px;white-space:nowrap}
.chpl{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;margin-bottom:6px}
.chp{background:rgba(0,0,0,.5);border:1px solid #4a3d28;border-radius:6px;padding:2px 1px;text-align:center;font-size:10px;line-height:1.1;overflow:hidden;position:relative}
.chp b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}.chp i{display:block;height:4px;margin:2px 2px 0;background:#3a2a22;border-radius:2px;overflow:hidden}.chp i u{display:block;height:100%;background:#d2584c}
.chp.me{border-color:#e8b230;background:rgba(232,178,48,.18)}.chp.dead{opacity:.35}.chp.foe{border-color:#d2584c}
.chbd{position:relative;width:calc(var(--cs)*8);height:calc(var(--cs)*8);margin:0 auto;border:2px solid #6a5434;border-radius:6px;box-shadow:0 4px 14px #000;background:#2b2418 url(/img/ch-board.webp?v=2) 0 0/100% 100%;touch-action:manipulation}
.chcell{position:absolute;width:var(--cs);height:var(--cs);box-sizing:border-box}
\.chcell{box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}.chcell.t0,.chcell.t1{background:rgba(60,140,255,.07)}.chcell.e0,.chcell.e1{background:rgba(220,60,40,.14)}.chcell:has(.sel){z-index:30}
.chcell.ok{box-shadow:inset 0 0 0 2px rgba(120,220,120,.7)}.chcell.sel{box-shadow:inset 0 0 0 3px #ffe27a}
.chmid{position:absolute;left:0;right:0;top:calc(var(--cs)*4 - 2px);height:3px;background:linear-gradient(90deg,transparent,#ffd35a,transparent);opacity:.8;pointer-events:none;z-index:3}
.chcd{position:relative;width:100%;height:100%;box-sizing:border-box;border:2px solid var(--cc,#888);border-radius:7px;background:linear-gradient(160deg,#4a3d2c,#241c13);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:calc(var(--cs)*.58);line-height:1}
.chcd img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 12%}
.chcd .st{position:absolute;left:1px;top:0;font-size:calc(var(--cs)*.22);color:#ffd35a;text-shadow:0 0 2px #000,0 0 2px #000;letter-spacing:-1px}
.chcd .it{position:absolute;right:1px;bottom:0;font-size:calc(var(--cs)*.2);text-shadow:0 0 2px #000}
.chcd{transition:transform .14s}.chcd.sel{transform:scale(1.32);z-index:30;box-shadow:0 0 0 2px #ffe27a,0 0 14px 4px rgba(255,226,122,.8),0 6px 12px #000}
.chbn{display:grid;grid-template-columns:repeat(8,var(--cs));gap:0;justify-content:center;margin:8px auto;width:calc(var(--cs)*8);background:#2b2418 url(/img/ch-bench.webp?v=2) 0 0/100% 100%;border:2px solid #6a5434;border-radius:6px;box-shadow:0 3px 10px #000}
.chbn .chcell{position:relative}
.chsy{display:flex;flex-wrap:wrap;gap:4px;min-height:24px;margin:4px 0}
.chsy span{background:rgba(0,0,0,.5);border:1px solid #5a4a30;border-radius:12px;padding:2px 7px;font-size:12px;opacity:.65}.chsy span.on{opacity:1;border-color:#e8b230;background:rgba(232,178,48,.2)}
.chit{display:flex;gap:5px;margin:4px 0;flex-wrap:wrap}.chit b{width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);border:1px solid #6a5434;border-radius:7px;font-size:20px;font-weight:400}.chit b.sel{border-color:#ffe27a;box-shadow:0 0 0 2px #ffe27a}
.chinfo{background:rgba(0,0,0,.72);border:1px solid #6a5434;border-radius:8px;padding:5px 8px;margin:4px 0;font-size:12px;line-height:1.3}.chinfo .btn{margin-top:3px;padding:3px 10px;min-height:28px;font-size:12px}
.chshop{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-top:8px}
.chsc{position:relative;aspect-ratio:5/8;border:0;border-radius:7px;background:#241c13;overflow:hidden;cursor:pointer;padding:0;color:inherit;font-family:inherit;box-shadow:0 3px 8px #000}
.chsc img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.chsc .em{position:absolute;left:0;right:0;top:22%;text-align:center;font-size:calc(var(--cs)*.9);line-height:1}
.chsc .pr{position:absolute;left:3%;top:1%;width:29%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:clamp(12px,4.8vw,22px);font-weight:800;color:#fff;text-shadow:0 1px 3px #000,0 0 3px #000}
.chsc .nm{position:absolute;left:11%;right:11%;bottom:2.5%;text-align:center;font-size:clamp(8px,2.6vw,12px);font-weight:700;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chsc .tr{position:absolute;right:6%;top:3%;display:flex;flex-direction:column;gap:1px;font-size:clamp(11px,3.4vw,16px);text-shadow:0 0 3px #000,0 0 3px #000}
.chsc:active{transform:scale(1.06)}.chsc.no{filter:brightness(.55) saturate(.6)}.chsc.empty{visibility:hidden}
.chinfo{display:flex;gap:9px}.chinfo .cimg{width:48px;flex:none;aspect-ratio:5/8;border-radius:6px;overflow:hidden;position:relative;box-shadow:0 2px 6px #000}.chinfo .cimg img{position:absolute;inset:0;width:100%;height:100%}.chinfo .ctx{min-width:0}
.chbt{display:grid;grid-template-columns:1fr 1fr auto;gap:5px;margin-top:6px}.chbt .btn{padding:8px 4px;font-size:13px;min-height:38px}
.chxp{height:6px;background:#3a2a22;border-radius:3px;margin:5px 0;overflow:hidden}.chxp i{display:block;height:100%;background:#4a86e0}
.cbn{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);background:rgba(10,8,6,.92);border:2px solid #e8b230;border-radius:14px;padding:14px 22px;text-align:center;z-index:70;font-size:18px;font-weight:700;pointer-events:none;animation:chfade 2.6s forwards}
@keyframes chfade{0%{opacity:0;transform:translate(-50%,-40%)}10%{opacity:1;transform:translate(-50%,-50%)}80%{opacity:1}100%{opacity:0}}
.cu{position:absolute;width:var(--cs);height:var(--cs);box-sizing:border-box;padding:1px;transition:left .45s linear,top .45s linear,opacity .5s;z-index:4}
.cu .chcd{border-radius:6px}.cu .hp{position:absolute;left:2px;right:2px;top:1px;height:4px;background:#000a;border-radius:2px;overflow:hidden;z-index:2}.cu .hp i{display:block;height:100%;background:#58c86a}.cu.t1 .hp i{background:#d8584c}
.cu .mn{position:absolute;left:2px;right:2px;top:5px;height:3px;background:#000a;z-index:2}.cu .mn i{display:block;height:100%;background:#4aa0ff}
.cu .sh{position:absolute;left:2px;right:2px;top:0;height:2px;background:#fff;z-index:2}
.cu.dead{opacity:0}.cu.stun .chcd{filter:grayscale(.8) brightness(1.2)}
.cu.hit .chcd{animation:chhit .25s}@keyframes chhit{50%{filter:brightness(2.2)}}
.cu.go .chcd{animation:chgo .3s}@keyframes chgo{50%{transform:scale(1.18)}}
.cfx{position:absolute;pointer-events:none;z-index:9;font-weight:700;font-size:calc(var(--cs)*.3);text-shadow:0 0 3px #000,0 0 3px #000;animation:chup 1s forwards;white-space:nowrap}
@keyframes chup{to{transform:translateY(-26px);opacity:0}}
.cspell{position:absolute;pointer-events:none;z-index:8;border-radius:50%;border:3px solid #ffd35a;animation:chring .7s forwards}
@keyframes chring{from{opacity:.9;transform:scale(.3)}to{opacity:0;transform:scale(1)}}
.chend{text-align:center;padding:30px 14px}.chend h2{margin:6px 0}.chend .big{font-size:60px}
.chlob{text-align:center;padding:40px 14px}.chlob .big{font-size:56px}
`;
  const stl = document.createElement('style'); stl.textContent = css; document.head.appendChild(stl);

  function art(id, cls) {
    const c = C.CARDS[id];
    return `<img src="/img/chp-${id}.webp?v=1" alt="" onerror="this.remove()">`;
  }
  function cardHtml(u, sel, extraCls) {
    const c = C.CARDS[u.c];
    return `<div class="chcd${sel ? ' sel' : ''}${extraCls ? ' ' + extraCls : ''}" style="--cc:${CCOL[c.c]}">${c.e}${art(u.c)}<span class="st">${stars(u.s)}</span>${u.i && u.i.length ? `<span class="it">${u.i.map(i => C.ITEMS[i].e).join('')}</span>` : ''}</div>`;
  }

  function open() {
    if (st.on) return;
    st.on = true; ui.mgOpen = true; closeModal();
    let el = $c('chs'); if (!el) { el = document.createElement('div'); el.id = 'chs'; document.body.appendChild(el); }
    el.hidden = false; el.innerHTML = '<div class="chlob"><div class="big">♟</div><p>Подключаемся…</p></div>';
    st.v = null; st.round = 0; st.rep = null; st.sel = null; st.item = -1; st.rwDone = false;
    el.onclick = onClick;
    poll(true);
    clearInterval(st.tm); st.tm = setInterval(() => poll(false), 1000);
    clearInterval(st.rt); st.rt = setInterval(tickClock, 250);
  }
  async function close(leave) {
    if (leave && st.v && !st.v.none) { try { await call('POST', '/api/chess', { a: 'leave' }); } catch (e) {} }
    st.on = false; ui.mgOpen = false; clearInterval(st.tm); clearInterval(st.rt); stopRep();
    const el = $c('chs'); if (el) { el.hidden = true; el.innerHTML = ''; }
    try { await sync(); } catch (e) {} render();
  }

  async function poll(first) {
    if (!st.on || st.busy) return;
    try {
      const have = st.rep && st.rep.round === (st.v && st.v.round) ? st.v.round : 0;
      const v = await call('GET', '/api/chess?have=' + have);
      take(v);
    } catch (e) { if (first) { toast(e.message); close(false); } }
  }
  async function act(b) {
    if (st.busy) return; st.busy = true;
    try { const have = st.v && st.rep && st.rep.round === st.v.round ? st.v.round : 0; take(await call('POST', '/api/chess', Object.assign({ have }, b))); }
    catch (e) { toast(e.message); }
    st.busy = false;
  }
  function take(v) {
    const old = st.v;
    if (v.fight && !v.fight.log && old && old.fight && old.fight.log && old.round === v.round) v.fight.log = old.fight.log;
    st.v = v; v.skew = v.now ? (Date.now() - v.now) : 0;
    const changed = !old || old.rev !== v.rev || old.phase !== v.phase || old.round !== v.round || !!old.none !== !!v.none || (v.me && old.me && (old.me.rw !== v.me.rw));
    if (v.phase === 'prep' && (!old || old.phase !== 'prep' || old.round !== v.round)) { st.sel = null; st.item = -1; stopRep(); if (v.me && v.me.last && old) banner(v.me.last); }
    if (v.phase === 'combat' && v.fight && v.fight.log && (!st.rep || st.rep.round !== v.round)) startRep(v);
    if (v.phase === 'end' || (v.me && !v.me.alive)) { if (!st.rwDone && v.me && v.me.rw !== undefined) { st.rwDone = true; sync(); } }
    if (changed) draw();
  }
  function banner(l) {
    const d = document.createElement('div'); d.className = 'cbn';
    d.innerHTML = (l.res === 'win' ? '🏆 Победа!' : l.res === 'lose' ? '💔 Поражение' : '🤝 Ничья') + (l.dmg ? `<br><small>−${l.dmg} здоровья</small>` : '') + (l.drop ? `<br><small>Добыча: ${C.ITEMS[l.drop].e} ${C.ITEMS[l.drop].n}</small>` : '');
    document.body.appendChild(d); setTimeout(() => d.remove(), 2700);
  }

  // ---------- рисование ----------
  function fmt(ms) { return Math.max(0, Math.ceil(ms / 1000)) + ' с'; }
  function tickClock() {
    const v = st.v; if (!v || !st.on) return; const el = $c('chclk'); if (!el) return;
    const left = v.dl - (Date.now() - v.skew);
    el.textContent = v.phase === 'prep' ? 'Подготовка ' + fmt(left) : v.phase === 'combat' ? 'Бой' : v.phase === 'lobby' ? 'Ожидание ' + fmt(left) : '';
  }
  function plStrip(v) {
    const opp = v.fight ? v.fight.opp : '';
    return `<div class="chpl">${v.players.map(p => `<div class="chp${p.me ? ' me' : ''}${p.a ? '' : ' dead'}${opp && p.n === opp && !p.me ? ' foe' : ''}"><b>${esc(p.n)}</b>${p.a ? p.hp : '☠' + p.pl}<i><u style="width:${p.hp}%"></u></i></div>`).join('')}</div>`;
  }
  function topBar(v) {
    const me = v.me;
    const title = v.phase === 'lobby' ? 'Таверна ожидания' : `Раунд ${v.round}${v.pve ? ' · нечисть' : ''}`;
    return `<div class="chtop"><button class="btn small ghost" data-c="exit" type="button">‹ Выйти</button><div class="chrd">${title}<small id="chclk"></small></div>${me ? `<div class="chst"><span>❤ ${me.hp}</span><span>🪙 ${me.gold}</span></div>` : ''}</div>`;
  }
  function draw() {
    const el = $c('chs'); if (!el || !st.on) return; const v = st.v; if (!v) return;
    if (v.none) { el.innerHTML = `<div class="chw"><div class="chtop"><button class="btn small ghost" data-c="exit" type="button">‹ Назад</button><div class="chrd">Шахматы Нордики</div></div><div class="chlob"><div class="big">♟</div><h3>Шахматы Нордики</h3><p class="muted">8 игроков. Покупайте героев, собирайте тройки, стройте дружины и побеждайте соперников. Последний выживший — победитель.</p><p class="sm muted">Свободные места займут воины-боты.</p><button class="btn" data-c="join" type="button">Начать партию</button></div></div>`; return; }
    if (v.phase === 'lobby') { el.innerHTML = `<div class="chw">${topBar(v)}${plStrip(v)}<div class="chlob"><div class="big">⏳</div><h3>Ищем соперников…</h3><p class="muted">В партии ${v.players.length} из 8. Свободные места займут боты.</p><button class="btn" data-c="start" type="button">Начать сейчас</button></div></div>`; tickClock(); return; }
    const me = v.me; if (!me) return;
    if (v.phase === 'end' || !me.alive) { endScreen(el, v); return; }
    const keepScroll = el.scrollTop;
    el.innerHTML = `<div class="chw">${topBar(v)}${plStrip(v)}${boardHtml(v)}${v.phase === 'prep' ? prepHtml(v) : combatInfo(v)}</div>`;
    el.scrollTop = keepScroll; tickClock();
    if (v.phase === 'combat' && st.rep) st.rep.build();
  }
  function endScreen(el, v) {
    const me = v.me, rw = me.rw;
    el.innerHTML = `<div class="chw"><div class="chend"><div class="big">${me.place === 1 ? '🏆' : me.place <= 3 ? '🥈' : '⚔'}</div><h2>${me.place === 1 ? 'Победа!' : 'Ваше место: ' + me.place}</h2><p>Раундов: ${v.round}</p>${rw ? `<p>Награда: 🪙 ${rw.sil}${rw.mats ? ' · материалы ×' + rw.mats : ''}${rw.bp ? ' · очки пропуска +' + rw.bp : ''}</p>${rw.sil === 0 ? '<p class="sm muted">Дневной предел наград достигнут.</p>' : ''}` : '<p class="muted">Подсчитываем награду…</p>'}<button class="btn" data-c="exit" type="button">Закрыть</button> <button class="btn ghost" data-c="again" type="button">Играть ещё</button></div></div>`;
  }
  function boardHtml(v) {
    const me = v.me, combat = v.phase === 'combat';
    let h = '<div class="chbd" id="chbd">';
    for (let i = 0; i < 64; i++) {
      const x = i % 8, y = Math.floor(i / 8), mine = y >= 4, k = (x + y) & 1;
      let cls = 'chcell ' + (mine ? 't' : 'e') + k;
      h += `<div class="${cls}" style="left:calc(var(--cs)*${x});top:calc(var(--cs)*${y})" data-c="cell" data-i="${mine ? (y - 4) * 8 + x : -1}">`;
      if (!combat && mine) { const u = me.board[(y - 4) * 8 + x]; if (u) h += cardHtml(u, st.sel === 'f' + ((y - 4) * 8 + x)); }
      h += '</div>';
    }
    h += '<div class="chmid"></div>';
    if (combat) h += '<div id="chfx"></div>';
    h += '</div>';
    if (v.phase === 'prep') {
      h += `<div class="chbn">${me.bench.map((u, i) => `<div class="chcell" data-c="bench" data-i="${i}">${u ? cardHtml(u, st.sel === 'b' + i) : ''}</div>`).join('')}</div>`;
    }
    return h;
  }
  function synHtml(v) {
    const cards = v.me.board.filter(Boolean).map(u => u.c), s = C.synergies(cards);
    const keys = Object.keys(s).sort((a, b) => s[b].lv - s[a].lv || s[b].n - s[a].n);
    return `<div class="chsy">${keys.map(t => { const T = C.TRAITS[t], x = s[t], nx = T.th.find(q => q > x.n) || T.th[T.th.length - 1]; return `<span class="${x.lv ? 'on' : ''}" data-c="syn" data-t="${t}">${T.e} ${T.n} ${x.n}/${nx}</span>`; }).join('') || '<span>Выставьте героев — получите бонусы родов и классов</span>'}</div>`;
  }
  function infoHtml(v) {
    const me = v.me;
    if (st.item >= 0 && me.items[st.item]) { const it = C.ITEMS[me.items[st.item]]; return `<div class="chinfo"><b>${it.e} ${it.n}</b><br>${it.d}<br><span class="sm">Нажмите на героя, чтобы выдать предмет.</span></div>`; }
    if (st.sel) {
      const w = st.sel[0], i = +st.sel.slice(1), u = (w === 'f' ? me.board : me.bench)[i];
      if (u) {
        const c = C.CARDS[u.c], R = C.TRAITS[c.r], K = C.TRAITS[c.k], sp = C.SP[c.sp], s = C.stats(u.c, u.s, u.i, {});
        const price = c.c * [0, 1, 3, 9][u.s];
        return `<div class="chinfo"><div class="cimg" style="background:#241c13"><img src="/img/ch-${u.c}.webp?v=1" alt="" onerror="this.remove()"></div><div class="ctx"><b>${c.e} ${c.n}</b> ${stars(u.s)} · ${R.e}${R.n} · ${K.e}${K.n}<br>❤ ${s.hp} · ⚔ ${s.atk} · дальность ${s.rg}<br><b>${sp.n}:</b> ${sp.d}${u.i.length ? '<br>' + u.i.map(q => C.ITEMS[q].e + ' ' + C.ITEMS[q].n).join(', ') : ''}<br><button class="btn small" data-c="sell" type="button">Продать за ${price} 🪙</button></div></div>`;
      }
    }
    return '';
  }
  function prepHtml(v) {
    const me = v.me;
    const shop = me.shop.map((id, i) => { if (!id) return '<div class="chsc empty"></div>'; const c = C.CARDS[id], no = me.gold < c.c; return `<button class="chsc${no ? ' no' : ''}" data-c="buy" data-i="${i}" type="button"><span class="em">${c.e}</span><img src="/img/ch-${id}.webp?v=1" alt="" onerror="this.remove()"><span class="pr">${c.c}</span><span class="tr"><i>${C.TRAITS[c.r].e}</i><i>${C.TRAITS[c.k].e}</i></span><span class="nm">${c.n}</span></button>`; }).join('');
    const onB = me.board.filter(Boolean).length;
    return `${synHtml(v)}<div class="sm" style="text-align:center">На поле: ${onB} из ${me.lvl} · Ур. ${me.lvl}${me.xpn ? ` · опыт ${me.xp}/${me.xpn}` : ' (максимум)'}</div>${me.xpn ? `<div class="chxp"><i style="width:${Math.min(100, me.xp / me.xpn * 100)}%"></i></div>` : ''}${me.items.length ? '<div class="chit">' : '<div class="chit" hidden>'}${me.items.map((q, i) => `<b class="${st.item === i ? 'sel' : ''}" data-c="item" data-i="${i}">${C.ITEMS[q].e}</b>`).join('')}</div>${infoHtml(v)}<div class="chshop">${shop}</div><div class="chbt"><button class="btn" data-c="reroll" type="button">🔄 Обновить · 2🪙</button><button class="btn" data-c="xp" type="button">⬆ Опыт · 5🪙</button><button class="btn ghost" data-c="lock" type="button">${me.lock ? '🔒' : '🔓'}</button></div>${me.income ? `<p class="sm muted" style="text-align:center">Доход за раунд: ${me.income.total}🪙 (база 5${me.income.inter ? ' + проценты ' + me.income.inter : ''}${me.income.streak ? ' + серия ' + me.income.streak : ''})</p>` : ''}`;
  }
  function combatInfo(v) {
    const f = v.fight; if (!f) return '<p class="sm muted" style="text-align:center">Ваш бой окончен, ждём остальных…</p>';
    return `${synHtml(v)}<p class="sm" style="text-align:center">Соперник: <b>${esc(f.opp)}</b>${f.ghost ? ' (отражение дружины)' : ''}</p>`;
  }

  // ---------- повтор боя ----------
  function stopRep() { if (st.rep) { clearInterval(st.rep.tm); st.rep = null; } }
  function startRep(v) {
    stopRep();
    const lg = v.fight.log, side = v.fight.side;
    const R = { round: v.round, i: 0, els: {}, tm: 0 };
    const fx = (x, y, txt, col) => { const b = $c('chbd'); if (!b) return; const d = document.createElement('div'); d.className = 'cfx'; d.style.cssText = `left:calc(var(--cs)*${x} + var(--cs)*.15);top:calc(var(--cs)*${y});color:${col}`; d.textContent = txt; b.appendChild(d); setTimeout(() => d.remove(), 1000); };
    const pos = (x, y) => side === 1 ? [7 - x, 7 - y] : [x, y];
    R.build = () => {
      const b = $c('chbd'); if (!b) return; R.els = {};
      lg.init.forEach(a => {
        const [id, team, card, emo, img, star, x, y, mhp, hp, mm, mana, items] = a;
        const [px, py] = pos(x, y), d = document.createElement('div'); d.className = 'cu t' + (team === side ? 0 : 1);
        d.style.cssText = `left:calc(var(--cs)*${px});top:calc(var(--cs)*${py})`;
        const cc = card ? C.CARDS[card] : null, col = cc ? CCOL[cc.c] : '#b0463a';
        d.innerHTML = `<div class="chcd" style="--cc:${col}">${cc ? cc.e : (emo || '💀')}${cc ? art(card) : (img ? `<img src="/img/${img}.webp?v=1" alt="" onerror="this.remove()">` : '')}<span class="st">${stars(star)}</span></div><div class="hp"><i style="width:100%"></i></div><div class="mn"><i style="width:0"></i></div>`;
        b.appendChild(d); R.els[id] = { d, mhp, mm, x: px, y: py };
      });
      show(R.i - 1 >= 0 ? R.i - 1 : -1, true);
    };
    function show(i, quiet) {
      const f = i >= 0 ? lg.frames[Math.min(i, lg.frames.length - 1)] : null; if (!f) return;
      const live = new Set();
      f.s.forEach(a => {
        const [id, x, y, hp, mana, sh, stun] = a, e = R.els[id]; if (!e) return; live.add(id);
        const [px, py] = pos(x, y); e.x = px; e.y = py;
        e.d.style.left = `calc(var(--cs)*${px})`; e.d.style.top = `calc(var(--cs)*${py})`;
        e.d.classList.toggle('dead', hp <= 0); e.d.classList.toggle('stun', !!stun);
        e.d.querySelector('.hp i').style.width = Math.max(0, hp / e.mhp * 100) + '%';
        e.d.querySelector('.mn i').style.width = (e.mm ? Math.min(100, mana / e.mm * 100) : 0) + '%';
      });
      for (const id in R.els) if (!live.has(+id)) R.els[id].d.classList.add('dead');
      if (quiet) return;
      f.e.forEach(ev => {
        const t = ev[0], e = R.els[ev[1]];
        if (t === 'a') { const tg = R.els[ev[2]]; if (e) { e.d.classList.remove('go'); void e.d.offsetWidth; e.d.classList.add('go'); } if (tg) { tg.d.classList.remove('hit'); void tg.d.offsetWidth; tg.d.classList.add('hit'); fx(tg.x, tg.y, (ev[4] ? '💥' : '') + '-' + ev[3], ev[4] ? '#ffcf4a' : '#fff'); } }
        else if (t === 's' && e) { const sp = C.SP[ev[2]]; fx(e.x, e.y - .2, sp ? sp.n : '', '#8fd0ff'); const r = document.createElement('div'); r.className = 'cspell'; r.style.cssText = `left:calc(var(--cs)*${e.x} - var(--cs)*.4);top:calc(var(--cs)*${e.y} - var(--cs)*.4);width:calc(var(--cs)*1.8);height:calc(var(--cs)*1.8)`; const b = $c('chbd'); if (b) { b.appendChild(r); setTimeout(() => r.remove(), 700); } }
        else if (t === 'h' && e) fx(e.x, e.y, '+' + ev[2], '#6fe08a');
        else if (t === 'sh' && e) fx(e.x, e.y, '🛡', '#fff');
        else if (t === 'd' && e) fx(e.x, e.y, 'мимо', '#ccc');
      });
    }
    R.tm = setInterval(() => {
      if (R.i >= lg.frames.length) { clearInterval(R.tm); return; }
      show(R.i); R.i++;
    }, TICK);
    st.rep = R;
  }

  // ---------- нажатия ----------
  async function onClick(e) {
    const t = e.target.closest('[data-c]'); if (!t) return; const a = t.dataset.c, v = st.v;
    if (a === 'exit') { close(true); return; }
    if (a === 'join') { await act({ a: 'join' }); return; }
    if (a === 'again') { st.rwDone = false; st.v = null; try { await call('POST', '/api/chess', { a: 'leave' }); } catch (x) {} await act({ a: 'join' }); return; }
    if (a === 'start') { await act({ a: 'start' }); return; }
    if (!v || v.phase !== 'prep' || !v.me) { if (a === 'syn') synTip(t.dataset.t); return; }
    const me = v.me;
    if (a === 'syn') { synTip(t.dataset.t); return; }
    if (a === 'buy') { st.sel = null; st.item = -1; await act({ a: 'buy', i: +t.dataset.i }); return; }
    if (a === 'reroll') { await act({ a: 'reroll' }); return; }
    if (a === 'xp') { await act({ a: 'xp' }); return; }
    if (a === 'lock') { await act({ a: 'lock' }); return; }
    if (a === 'sell') { if (st.sel) { const f = st.sel; st.sel = null; await act({ a: 'sell', f }); } return; }
    if (a === 'item') { const i = +t.dataset.i; st.item = st.item === i ? -1 : i; st.sel = null; draw(); return; }
    if (a === 'cell' || a === 'bench') {
      const i = +t.dataset.i; if (i < 0) return;
      const key = (a === 'cell' ? 'f' : 'b') + i, u = (a === 'cell' ? me.board : me.bench)[i];
      if (st.item >= 0) { if (u) { const it = st.item; st.item = -1; await act({ a: 'equip', item: it, t: key }); } else { st.item = -1; draw(); } return; }
      if (st.sel) {
        if (st.sel === key) { st.sel = null; draw(); return; }
        const f = st.sel; st.sel = null; await act({ a: 'move', f, t: key }); return;
      }
      if (u) { st.sel = key; draw(); }
    }
  }
  function synTip(tid) {
    const T = C.TRAITS[tid]; if (!T) return;
    toast(T.e + ' ' + T.n + ': ' + T.th.map((n, i) => n + ' — ' + T.d[i]).join('; '));
  }

  window.ChessUI = { open, close };
})();
