/* «Шахматы Нордики» — экран игры. Подключается после index.html-скрипта; использует его $, call, toast, ui, sync, render. */
(function () {
  'use strict';
  const C = window.Chess, TICK = C.TICK;
  const CCOL = { 1: '#8a8f98', 2: '#4fae5b', 3: '#4a86e0', 4: '#a05be0', 5: '#e8b230' };
  const st = { on: false, v: null, sel: null, item: -1, tm: 0, busy: false, round: 0, rep: null, tab: 0, shown: 0, rwDone: false, shop: true };
  const $c = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stars = n => '★'.repeat(n || 1);

  const css = `
#chs{position:fixed;inset:0;z-index:60;background:#14110d;color:#f2e8d5;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;--cw:min(18.6vw,96px);--chh:calc(var(--cw)*1.2);padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0);font-family:inherit}
#chs[hidden]{display:none}
.chw{position:relative;z-index:1;max-width:640px;margin:0 auto;padding:6px 2px 14px}#chs.dk .chw{padding-bottom:175px}#chs.sh .chw{padding-bottom:178px}
.chsheet{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:min(100vw,640px);z-index:40;box-sizing:border-box;background:rgba(14,11,8,.95);border-top:2px solid #e8b230;border-radius:14px 14px 0 0;padding:6px 6px calc(8px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 22px rgba(0,0,0,.8);--cw:min(17vw,84px);--chh:calc(var(--cw)*1.15)}
@keyframes chup2{from{transform:translate(-50%,40px);opacity:0}}
.chsheet .chbt{margin-top:6px;grid-template-columns:1fr 1fr auto auto}
.chsheet .chbt .btn{padding:6px 4px;min-height:34px}.chsheet .chshop{margin-top:6px}
.chpill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:40;background:#3a2a10;border:2px solid #e8b230;color:#ffe9b0;border-radius:22px;padding:9px 20px;font-weight:800;font-size:15px;font-family:inherit;box-shadow:0 4px 14px #000}.chtop,.chpl,.chsy,.chvs{margin-left:4px;margin-right:4px}
.chtop{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.chtop .btn{padding:6px 9px;font-size:13px;min-height:34px}
.chrd{flex:1;text-align:center;font-weight:700;font-size:15px;line-height:1.15}.chrd small{display:block;font-weight:400;opacity:.8;font-size:12px}
.chst{display:flex;gap:5px;font-weight:700;font-size:14px;align-items:center}.chst span{background:rgba(0,0,0,.45);border:1px solid #5a4a30;border-radius:8px;padding:3px 7px;white-space:nowrap}
.chpl{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;margin-bottom:6px}
.chp{background:rgba(0,0,0,.5);border:1px solid #4a3d28;border-radius:6px;padding:2px 1px;text-align:center;font-size:10px;line-height:1.1;overflow:hidden;position:relative}
.chp b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}.chp i{display:block;height:4px;margin:2px 2px 0;background:#3a2a22;border-radius:2px;overflow:hidden}.chp i u{display:block;height:100%;background:#d2584c}
.chp.me{border-color:#e8b230;background:rgba(232,178,48,.18)}.chp.dead{opacity:.35}.chp.foe{border-color:#d2584c}
.chbd{position:relative;width:calc(var(--cw)*5);height:calc(var(--chh)*6);margin:0 auto;border:0;border-radius:4px;box-shadow:0 4px 14px #000;background:#2b2418 url(/img/ch-board.webp?v=4) 0 0/100% 100%;touch-action:manipulation;box-sizing:content-box}
.chcell{position:absolute;width:var(--cw);height:var(--chh);box-sizing:border-box}
.chcell.t0,.chcell.t1,.chcell.e0,.chcell.e1{background:none}#chs.dk .chcell.t0,#chs.dk .chcell.t1{background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 2px rgba(255,236,160,.55);border-radius:6px}.chcell:has(.sel){z-index:30}
.chmid{position:absolute;left:0;right:0;top:calc(var(--chh)*3 - 2px);height:3px;background:linear-gradient(90deg,transparent,#ffd35a,transparent);opacity:.85;pointer-events:none;z-index:3}
.chcd{position:relative;width:100%;height:100%;box-sizing:border-box;border:2px solid var(--cc,#888);border-radius:6px;background:linear-gradient(160deg,#4a3d2c,#241c13);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:calc(var(--cw)*.6);line-height:1;transition:transform .14s}
.chcd img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 0}
.chcd .cn{position:absolute;left:4%;top:1%;width:27%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:calc(var(--cw)*.2);font-weight:800;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}
.chcd .nm{position:absolute;left:0;right:0;bottom:0;padding:8px 2px 1px;text-align:center;font-size:calc(var(--cw)*.14);font-weight:700;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.85));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chcd .st{position:absolute;right:3px;top:2px;font-size:calc(var(--cw)*.17);color:#ffd35a;text-shadow:0 0 2px #000,0 0 2px #000;letter-spacing:-1px}
.chcd .it{position:absolute;left:2px;bottom:calc(var(--cw)*.16);font-size:calc(var(--cw)*.17);text-shadow:0 0 2px #000}
.chcd.sel{transform:scale(1.18);z-index:30;box-shadow:0 0 0 2px #ffe27a,0 0 16px 5px rgba(255,226,122,.85),0 6px 14px #000}
.chbn{display:grid;grid-template-columns:repeat(5,var(--cw));justify-content:center;margin:8px auto;width:calc(var(--cw)*5);background:#2b2418 url(/img/ch-bench.webp?v=4) 0 0/100% 100%;border:0;border-radius:4px;box-shadow:0 3px 10px #000;box-sizing:content-box}
.chbn .chcell{position:relative}
.chsy{display:flex;flex-wrap:wrap;gap:4px;min-height:24px;margin:4px 0}
.chsy span{background:rgba(0,0,0,.5);border:1px solid #5a4a30;border-radius:12px;padding:2px 7px;font-size:12px;opacity:.65}.chsy span.on{opacity:1;border-color:#e8b230;background:rgba(232,178,48,.2)}
.chit{display:flex;gap:5px;margin:4px 0;flex-wrap:wrap}.chit b{width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);border:1px solid #6a5434;border-radius:7px;font-size:20px;font-weight:400}.chit b.sel{border-color:#ffe27a;box-shadow:0 0 0 2px #ffe27a}
.chinfo{background:rgba(0,0,0,.72);border:1px solid #6a5434;border-radius:8px;padding:6px 8px;margin:4px 0;font-size:12px;line-height:1.3}
.chdock{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(4px + env(safe-area-inset-bottom,0px));width:min(98vw,600px);height:150px;z-index:40;box-sizing:border-box;background:#c9c4b8 center/100% 100% no-repeat;border-radius:10px;box-shadow:0 -4px 18px rgba(0,0,0,.8);color:#2a2118;overflow:hidden}
.chdock .dn{position:absolute;left:16%;right:16%;top:7px;text-align:center;font-weight:800;font-size:14px;color:#fff;text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chdock .dt{position:absolute;left:8%;right:8%;top:42px;bottom:8px;font-size:12px;line-height:1.3;overflow:hidden}
.chdock .dt b{color:#1b140c}.chdock .btn{padding:3px 12px;min-height:28px;font-size:12px;margin-top:3px}
.chdock .dx{position:absolute;right:8px;top:4px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.5);border:1px solid #fff5;color:#fff;font-size:15px;line-height:1;padding:0}
.chdock.it{background:#d1cbbc;border:3px solid #6a5434}.chdock.it .dn{color:#2a2118;text-shadow:none}
.chshop{display:grid;grid-template-columns:repeat(5,var(--cw));justify-content:center;gap:0;margin-top:8px}
.chsc{position:relative;width:var(--cw);height:var(--chh);border:2px solid var(--cc);border-radius:6px;background:#241c13;overflow:hidden;cursor:pointer;padding:0;color:inherit;font-family:inherit;box-sizing:border-box;box-shadow:0 3px 8px #000}
.chsc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 0}
.chsc .em{position:absolute;left:0;right:0;top:20%;text-align:center;font-size:calc(var(--cw)*.6);line-height:1}
.chsc .cn{position:absolute;left:4%;top:1%;width:27%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:calc(var(--cw)*.2);font-weight:800;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}
.chsc .nm{position:absolute;left:0;right:0;bottom:0;padding:8px 2px 1px;text-align:center;font-size:calc(var(--cw)*.14);font-weight:700;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.85));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chsc .tr{position:absolute;right:3px;top:2px;display:flex;flex-direction:column;gap:1px;font-size:calc(var(--cw)*.2);text-shadow:0 0 3px #000,0 0 3px #000}
.chsc:active{transform:scale(1.06)}.chsc.no{filter:brightness(.55) saturate(.6)}.chsc.empty{visibility:hidden}
.chbt{display:grid;grid-template-columns:1fr 1fr auto;gap:5px;margin-top:6px}.chbt .btn{padding:8px 4px;font-size:13px;min-height:38px}
.chxp{height:6px;background:#3a2a22;border-radius:3px;margin:5px 0;overflow:hidden}.chxp i{display:block;height:100%;background:#4a86e0}
.cbn{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);background:rgba(10,8,6,.92);border:2px solid #e8b230;border-radius:14px;padding:14px 22px;text-align:center;z-index:70;font-size:18px;font-weight:700;pointer-events:none;animation:chfade 2.6s forwards}
@keyframes chfade{0%{opacity:0;transform:translate(-50%,-40%)}10%{opacity:1;transform:translate(-50%,-50%)}80%{opacity:1}100%{opacity:0}}
.cu{position:absolute;width:var(--cw);height:var(--chh);box-sizing:border-box;padding:1px;transition:left .45s linear,top .45s linear,opacity .5s;z-index:4}
.cu .chcd{border-radius:7px;border-width:3px;border-color:#3fd070;box-shadow:0 0 8px rgba(60,220,110,.7),0 3px 6px #000}.cu.t1 .chcd{border-color:#e0483c;box-shadow:0 0 8px rgba(230,70,60,.8),0 3px 6px #000}.cu .chcd img{object-position:50% 10%}.chvs{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px;font-weight:700;font-size:14px}.chvs span{flex:1;background:rgba(0,0,0,.6);border-radius:8px;padding:5px 8px;border:2px solid #3fd070;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chvs span.foe{border-color:#e0483c;text-align:right}.chvs b{font-size:16px;color:#ffd35a}.cu .hp{position:absolute;left:2px;right:2px;top:1px;height:6px;border:1px solid #000;box-sizing:border-box;background:#000a;border-radius:2px;overflow:hidden;z-index:2}.cu .hp i{display:block;height:100%;background:#58c86a}.cu.t1 .hp i{background:#d8584c}
.cu .mn{position:absolute;left:2px;right:2px;top:7px;height:3px;background:#000a;z-index:2}.cu .mn i{display:block;height:100%;background:#4aa0ff}
.cu .sh{position:absolute;left:2px;right:2px;top:0;height:2px;background:#fff;z-index:2}
.cu.dead{opacity:0}.cu.stun .chcd{filter:grayscale(.8) brightness(1.2)}
.cu.hit .chcd{animation:chhit .25s}@keyframes chhit{50%{filter:brightness(2.2)}}
.cu.go .chcd{animation:chgo .3s}@keyframes chgo{50%{transform:scale(1.18)}}
.cfx{position:absolute;pointer-events:none;z-index:9;font-weight:800;font-size:calc(var(--cw)*.3);text-shadow:0 0 3px #000,0 0 3px #000;animation:chup 1s forwards;white-space:nowrap}
@keyframes chup{to{transform:translateY(-26px);opacity:0}}
.cspell{position:absolute;pointer-events:none;z-index:8;border-radius:50%;border:3px solid #ffd35a;animation:chring .7s forwards}
@keyframes chring{from{opacity:.9;transform:scale(.3)}to{opacity:0;transform:scale(1)}}
.chend{text-align:center;padding:30px 14px}.chend h2{margin:6px 0}.chend .big{font-size:60px}
.chlob{text-align:center;padding:40px 14px}.chlob .big{font-size:56px}

#chs{background:#0a1120}
.chw{max-width:none;padding:0 0 14px}
.stg{position:relative;margin:0 auto;width:var(--S);height:var(--S);background:#0a1120 url(/img/ch-stage.webp?v=1) 0 0/100% 100%;overflow:hidden;--cw:calc(var(--S)*.1);--chh:calc(var(--cw)*1.2);--u:calc(var(--S)/1932);user-select:none;-webkit-user-select:none;touch-action:manipulation}
.stg>*{position:absolute;box-sizing:border-box}
.stg .hb{background:linear-gradient(#4a3320,#2a1c10);border:1px solid #c9a24a;border-radius:calc(var(--u)*18);color:#ffe9b0;font-family:inherit;font-weight:700;font-size:max(8px,calc(var(--u)*34));padding:0}
.stg .hpl{background:linear-gradient(#2c3442,#1a202b);border:1px solid #8a93a8;border-radius:calc(var(--u)*16);text-align:center;display:flex;flex-direction:column;justify-content:center;line-height:1.1;color:#f4e6bd;font-weight:800;font-size:max(8px,calc(var(--u)*36))}
.stg .hpl small{font-weight:500;font-size:max(7px,calc(var(--u)*28));opacity:.9;color:#dfe8f5}
.stg .hch{background:rgba(10,14,22,.78);border:1px solid #5a6480;border-radius:calc(var(--u)*18);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:max(8px,calc(var(--u)*38));white-space:nowrap}
.stg .p8{background:rgba(10,14,22,.72);border:1px solid #4a5470;border-radius:calc(var(--u)*14);text-align:center;font-size:max(7px,calc(var(--u)*30));line-height:1.1;display:flex;flex-direction:column;justify-content:center;overflow:hidden;color:#eee}
.stg .p8 b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;padding:0 2px}.stg .p8.me{border-color:#e8b230;background:rgba(232,178,48,.28)}.stg .p8.foe{border-color:#e0483c}.stg .p8.dead{opacity:.4}
.stg .qc{background:none}#chs.dk .stg .qc.my{background:rgba(255,236,160,.3)}
.stg .ln{height:.5%;background:linear-gradient(90deg,transparent,#ffd35a,transparent);opacity:.8;pointer-events:none;z-index:3}
.stg .sk,.stg .cu{--cw:calc(var(--S)*.1);transition:left .45s linear,top .45s linear,width .45s linear,height .45s linear,opacity .5s}
.stg .sk{transition:none}.stg .sk:has(.sel){z-index:80!important}
.stg .sk .chcd,.stg .cu .chcd{border-width:max(1.5px,calc(var(--u)*5));border-radius:calc(var(--u)*14)}
.stg .chcd .cn{font-size:max(7px,calc(var(--cw)*.24));width:32%}
.stg .chcd .st{font-size:max(6px,calc(var(--cw)*.2))}
.stg .chcd .nm{display:none}
.stg .chcd.sel{transform:scale(1.22);transform-origin:50% 100%}
.stg .bs{background:rgba(10,14,22,.55);border:1px solid #c9a24a;border-radius:calc(var(--u)*16);--cw:calc(var(--S)*.1)}
.stg .bs .chcd{border-radius:calc(var(--u)*14)}
.stg .tray{background:rgba(10,14,22,.62);border:2px solid #8a7240;border-radius:calc(var(--u)*30);pointer-events:none}
.stg .chsc{--cw:calc(var(--S)*.144);width:auto;height:auto}
.stg .sb{background:linear-gradient(#5a3a1c,#2e1d0e);border:1px solid #e8b230;border-radius:calc(var(--u)*22);color:#ffe9b0;font-family:inherit;font-weight:800;font-size:max(8px,calc(var(--u)*38));padding:0;white-space:nowrap}
.stg .sb.lk{font-size:max(10px,calc(var(--u)*52))}
.stg .vs{display:flex;align-items:center;justify-content:center;gap:calc(var(--u)*30);font-weight:800;font-size:max(9px,calc(var(--u)*44));text-shadow:0 1px 3px #000;pointer-events:none}
.stg .vs span{background:rgba(0,0,0,.55);border:2px solid #3fd070;border-radius:calc(var(--u)*24);padding:calc(var(--u)*14) calc(var(--u)*30);white-space:nowrap}.stg .vs span.foe{border-color:#e0483c}
.stg .ul{inset:0;pointer-events:none;z-index:50}
.stg .ul .cu{pointer-events:none}
.stg .cu .hp{height:max(2px,calc(var(--u)*14));left:0;right:0;top:-3px}.stg .cu .mn{display:none}
.stg .cfx{transform:translateX(-50%);font-size:max(9px,calc(var(--S)*.03))}
.stg .sk,.stg .cu{filter:drop-shadow(0 2px 3px rgba(0,0,0,.7))}
`;
  const stl = document.createElement('style'); stl.textContent = css; document.head.appendChild(stl);


  // ---------- сцена: картинка и наклонная сетка 5×6 ----------
  const PT = [[[0.30131,0.26073],[0.38154,0.26073],[0.46176,0.26073],[0.54199,0.26073],[0.62222,0.26073],[0.70244,0.26073]],[[0.29539,0.30826],[0.37787,0.30826],[0.46035,0.30826],[0.54284,0.30826],[0.62532,0.30826],[0.7078,0.30826]],[[0.28788,0.36845],[0.37322,0.36845],[0.45856,0.36845],[0.54391,0.36845],[0.62925,0.36845],[0.71459,0.36845]],[[0.27825,0.44575],[0.36726,0.44575],[0.45627,0.44575],[0.54528,0.44575],[0.63429,0.44575],[0.7233,0.44575]],[[0.26532,0.54941],[0.35926,0.54941],[0.45319,0.54941],[0.54712,0.54941],[0.64105,0.54941],[0.73499,0.54941]],[[0.25015,0.67115],[0.34986,0.67115],[0.44957,0.67115],[0.54928,0.67115],[0.649,0.67115],[0.74871,0.67115]],[[0.23719,0.7751],[0.34183,0.7751],[0.44648,0.7751],[0.55113,0.7751],[0.65578,0.7751],[0.76043,0.7751]]];
  const KS = 1 / 1932, pc = (x0, y0, x1, y1) => `left:${x0 * KS * 100}%;top:${y0 * KS * 100}%;width:${(x1 - x0) * KS * 100}%;height:${(y1 - y0) * KS * 100}%`;
  let ASP = 1;
  function cellBox(c, r) {
    const a = PT[r][c], b = PT[r][c + 1], d = PT[r + 1][c], e = PT[r + 1][c + 1];
    const w = ((b[0] - a[0]) + (e[0] - d[0])) / 2 * 0.96, rh = ((d[1] - a[1]) + (e[1] - b[1])) / 2, cx = (d[0] + e[0]) / 2, by = (d[1] + e[1]) / 2 - rh * 0.1, h = w * 1.18 * ASP;
    return { l: cx - w / 2, t: by - h, w, h, z: 10 + r, cx, rh };
  }
  const unitStyle = (c, r) => { const q = cellBox(c, r); return `left:${q.l * 100}%;top:${q.t * 100}%;width:${q.w * 100}%;height:${q.h * 100}%;z-index:${q.z}`; };
  function stageS() { const w = innerWidth, h = innerHeight; if (w >= h) { const s = Math.floor(Math.min(h - 4, w, 760)); return { W: s, H: s }; } const W = Math.floor(Math.min(w, 760)); return { W, H: Math.floor(Math.max(W, Math.min(h * 0.7, W * 1.6))) }; }

  function art(id) { return `<img src="/img/ch-${id}.webp?v=2" alt="" onerror="this.remove()">`; }
  function cardHtml(u, sel) {
    const c = C.CARDS[u.c];
    return `<div class="chcd${sel ? ' sel' : ''}" style="--cc:${CCOL[c.c]}">${c.e}${art(u.c)}<span class="cn">${c.c}</span><span class="st">${stars(u.s)}</span>${u.i && u.i.length ? `<span class="it">${u.i.map(i => C.ITEMS[i].e).join('')}</span>` : ''}<span class="nm">${c.n}</span></div>`;
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
    if (v.phase === 'prep' && (!old || old.phase !== 'prep' || old.round !== v.round)) { st.sel = null; st.item = -1; st.shop = true; stopRep(); if (v.me && v.me.last && old) banner(v.me.last); }
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
    const inPrep = v.phase === 'prep'; el.classList.toggle('dk', inPrep && !!(st.sel || st.item >= 0));
    el.innerHTML = `<div class="chw">${stageHtml(v)}${v.phase === 'prep' ? prepHtml(v) : combatInfo(v)}</div>`;
    el.scrollTop = keepScroll; tickClock();
    if (v.phase === 'combat' && st.rep) st.rep.build();
  }
  function endScreen(el, v) {
    const me = v.me, rw = me.rw;
    el.innerHTML = `<div class="chw"><div class="chend"><div class="big">${me.place === 1 ? '🏆' : me.place <= 3 ? '🥈' : '⚔'}</div><h2>${me.place === 1 ? 'Победа!' : 'Ваше место: ' + me.place}</h2><p>Раундов: ${v.round}</p>${rw ? `<p>Награда: 🪙 ${rw.sil}${rw.mats ? ' · материалы ×' + rw.mats : ''}${rw.bp ? ' · очки пропуска +' + rw.bp : ''}</p>${rw.sil === 0 ? '<p class="sm muted">Дневной предел наград достигнут.</p>' : ''}` : '<p class="muted">Подсчитываем награду…</p>'}<button class="btn" data-c="exit" type="button">Закрыть</button> <button class="btn ghost" data-c="again" type="button">Играть ещё</button></div></div>`;
  }
  function stageHtml(v) {
    const me = v.me, combat = v.phase === 'combat', prep = v.phase === 'prep', CO = C.COLS, HA = C.HALF, SS = stageS(), S = SS.W; ASP = SS.W / SS.H;
    const title = `Раунд ${v.round}${v.pve ? ' · нечисть' : ''}`;
    let h = `<div class="stg" id="stg" style="--S:${S}px;width:${S}px;height:${SS.H}px">`;
    h += `<button class="hb" data-c="exit" type="button" style="${pc(487, 72, 677, 155)}">‹ Выйти</button>`;
    h += `<div class="hpl" style="${pc(690, 60, 1140, 165)}"><span>${title}</span><small id="chclk"></small></div>`;
    h += `<div class="hch" style="${pc(1145, 80, 1315, 148)}">❤ ${me.hp}</div><div class="hch" style="${pc(1325, 80, 1445, 148)}">🪙 ${me.gold}</div>`;
    const opp = v.fight ? v.fight.opp : '';
    h += v.players.map((p, i) => `<div class="p8${p.me ? ' me' : ''}${p.a ? '' : ' dead'}${opp && p.n === opp && !p.me ? ' foe' : ''}" style="${pc(487 + i * 120, 178, 487 + i * 120 + 112, 270)}"><b>${esc(p.n)}</b>${p.a ? p.hp : '☠'}</div>`).join('');
    if (prep) {
      for (let r = 0; r < 2 * HA; r++) for (let c = 0; c < CO; c++) {
        const a = PT[r][c], b = PT[r][c + 1], d = PT[r + 1][c], e = PT[r + 1][c + 1];
        const xs = [a[0], b[0], d[0], e[0]], ys = [a[1], b[1], d[1], e[1]], x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), W = x1 - x0, Hh = y1 - y0;
        const pt = p => `${((p[0] - x0) / W * 100).toFixed(1)}% ${((p[1] - y0) / Hh * 100).toFixed(1)}%`;
        const mine = r >= HA, i = (r - HA) * CO + c;
        h += `<div class="qc${mine ? ' my' : ''}" data-c="cell" data-i="${mine ? i : -1}" style="left:${x0 * 100}%;top:${y0 * 100}%;width:${W * 100}%;height:${Hh * 100}%;z-index:1;clip-path:polygon(${pt(a)},${pt(b)},${pt(e)},${pt(d)})"></div>`;
      }
      for (let i = 0; i < me.board.length; i++) { const u = me.board[i]; if (u) h += `<div class="sk" data-c="cell" data-i="${i}" style="${unitStyle(i % CO, HA + Math.floor(i / CO))}">${cardHtml(u, st.sel === 'f' + i)}</div>`; }
      me.bench.forEach((u, i) => { h += `<div class="bs" data-c="bench" data-i="${i}" style="${pc(70, 540 + i * 180, 280, 540 + i * 180 + 168)}">${u ? cardHtml(u, st.sel === 'b' + i) : ''}</div>`; });
    }
    h += `<div class="ln" style="left:${PT[3][0][0] * 100}%;top:${PT[3][0][1] * 100 - .25}%;width:${(PT[3][5][0] - PT[3][0][0]) * 100}%"></div>`;
    h += `<div class="ul" id="chbd"></div>`;
    h += `<div class="tray" style="${pc(160, 1500, 1772, 1905)}"></div>`;
    if (prep) {
      me.shop.forEach((id, i) => {
        if (!id) return; const c = C.CARDS[id], no = me.gold < c.c;
        h += `<button class="chsc${no ? ' no' : ''}" style="--cc:${CCOL[c.c]};${pc(212 + i * 307, 1525, 212 + i * 307 + 278, 1745)}" data-c="buy" data-i="${i}" type="button"><span class="em">${c.e}</span>${art(id)}<span class="cn">${c.c}</span><span class="tr"><i>${C.TRAITS[c.r].e}</i><i>${C.TRAITS[c.k].e}</i></span><span class="nm">${c.n}</span></button>`;
      });
      h += `<button class="sb" data-c="reroll" type="button" style="${pc(478, 1765, 918, 1855)}">🔄 Обновить · 2🪙</button><button class="sb" data-c="xp" type="button" style="${pc(945, 1765, 1345, 1855)}">⬆ Опыт · 5🪙</button><button class="sb lk" data-c="lock" type="button" style="${pc(1368, 1765, 1455, 1855)}">${me.lock ? '🔒' : '🔓'}</button>`;
    } else if (v.fight) {
      const foe = v.players.find(p => p.n === v.fight.opp);
      h += `<div class="vs" style="${pc(180, 1560, 1750, 1700)}"><span>🟢 Вы · ❤ ${me.hp}</span><b>⚔</b><span class="foe">${esc(v.fight.opp)}${foe ? ' · ❤ ' + foe.hp : ''}${v.fight.ghost ? ' (тень)' : ''} 🔴</span></div>`;
    } else h += `<div class="vs" style="${pc(180, 1560, 1750, 1700)}"><span>Ваш бой окончен, ждём остальных…</span></div>`;
    return h + '</div>';
  }
  function synHtml(v) {
    const cards = v.me.board.filter(Boolean).map(u => u.c), s = C.synergies(cards);
    const keys = Object.keys(s).sort((a, b) => s[b].lv - s[a].lv || s[b].n - s[a].n);
    return `<div class="chsy">${keys.map(t => { const T = C.TRAITS[t], x = s[t], nx = T.th.find(q => q > x.n) || T.th[T.th.length - 1]; return `<span class="${x.lv ? 'on' : ''}" data-c="syn" data-t="${t}">${T.e} ${T.n} ${x.n}/${nx}</span>`; }).join('') || '<span>Выставьте героев — получите бонусы родов и классов</span>'}</div>`;
  }
  function infoHtml(v) {
    const me = v.me;
    if (st.item >= 0 && me.items[st.item]) { const it = C.ITEMS[me.items[st.item]]; return `<div class="chdock it"><button class="dx" data-c="desel" type="button">✕</button><div class="dn">${it.e} ${it.n}</div><div class="dt">${it.d}<br><span>Нажмите на героя, чтобы выдать предмет.</span></div></div>`; }
    if (st.sel) {
      const w = st.sel[0], i = +st.sel.slice(1), u = (w === 'f' ? me.board : me.bench)[i];
      if (u) {
        const c = C.CARDS[u.c], R = C.TRAITS[c.r], K = C.TRAITS[c.k], sp = C.SP[c.sp], s = C.stats(u.c, u.s, u.i, {});
        const price = c.c * [0, 1, 3, 9][u.s];
        return `<div class="chdock" style="background-image:url(/img/chb-${u.c}.webp?v=2)"><button class="dx" data-c="desel" type="button">✕</button><div class="dn">${c.n} ${stars(u.s)}</div><div class="dt"><b>${R.e}${R.n} · ${K.e}${K.n}</b> · ❤ ${s.hp} · ⚔ ${s.atk} · дальность ${s.rg}<br><b>${sp.n}:</b> ${sp.d}${u.i.length ? '<br>' + u.i.map(q => C.ITEMS[q].e + ' ' + C.ITEMS[q].n).join(', ') : ''}<br><button class="btn small" data-c="sell" type="button">Продать за ${price} 🪙</button></div></div>`;
      }
    }
    return '';
  }
  function sheetHtml(v, shop) {
    const me = v.me;
    if (st.sel || st.item >= 0) return '';
    if (!st.shop) return `<button class="chpill" data-c="shopt" type="button">🛒 Магазин · 🪙 ${me.gold}</button>`;
    return `<div class="chsheet"><div class="chshop">${shop}</div><div class="chbt"><button class="btn" data-c="reroll" type="button">🔄 Обновить · 2🪙</button><button class="btn" data-c="xp" type="button">⬆ Опыт · 5🪙</button><button class="btn ghost" data-c="lock" type="button">${me.lock ? '🔒' : '🔓'}</button><button class="btn ghost" data-c="shopt" type="button">▾</button></div></div>`;
  }
  function prepHtml(v) {
    const me = v.me;
    const shop = '', _unused = me.shop.map((id, i) => { if (!id) return ''; const c = C.CARDS[id], no = me.gold < c.c; return `<button class="chsc${no ? ' no' : ''}" style="--cc:${CCOL[c.c]}" data-c="buy" data-i="${i}" type="button"><span class="em">${c.e}</span>${art(id)}<span class="cn">${c.c}</span><span class="tr"><i>${C.TRAITS[c.r].e}</i><i>${C.TRAITS[c.k].e}</i></span><span class="nm">${c.n}</span></button>`; }).join('');
    const onB = me.board.filter(Boolean).length;
    return `${synHtml(v)}<div class="sm" style="text-align:center">На поле: ${onB} из ${me.lvl} · Ур. ${me.lvl}${me.xpn ? ` · опыт ${me.xp}/${me.xpn}` : ' (максимум)'}</div>${me.xpn ? `<div class="chxp"><i style="width:${Math.min(100, me.xp / me.xpn * 100)}%"></i></div>` : ''}${me.items.length ? '<div class="chit">' : '<div class="chit" hidden>'}${me.items.map((q, i) => `<b class="${st.item === i ? 'sel' : ''}" data-c="item" data-i="${i}">${C.ITEMS[q].e}</b>`).join('')}</div>${infoHtml(v)}${me.income ? `<p class="sm muted" style="text-align:center">Доход за раунд: ${me.income.total}🪙 (база 5${me.income.inter ? ' + проценты ' + me.income.inter : ''}${me.income.streak ? ' + серия ' + me.income.streak : ''})</p>` : ''}`;
  }
  function vsBar(v) {
    const f = v.fight; if (!f) return '';
    const mine = v.me, foe = v.players.find(p => p.n === f.opp);
    return `<div class="chvs"><span>🟢 Вы · ❤ ${mine.hp}</span><b>⚔</b><span class="foe">${esc(f.opp)}${foe ? ' · ❤ ' + foe.hp : ''}${f.ghost ? ' (тень)' : ''} 🔴</span></div>`;
  }
  function combatInfo(v) {
    const f = v.fight; if (!f) return '<p class="sm muted" style="text-align:center">Ваш бой окончен, ждём остальных…</p>';
    return synHtml(v);
  }

  // ---------- повтор боя ----------
  function stopRep() { if (st.rep) { clearInterval(st.rep.tm); st.rep = null; } }
  function startRep(v) {
    stopRep();
    const lg = v.fight.log, side = v.fight.side;
    const R = { round: v.round, i: 0, els: {}, tm: 0 };
    const fx = (x, y, txt, col) => { const b = $c('chbd'); if (!b) return; const q = cellBox(x, Math.max(0, Math.min(5, Math.round(y)))), d = document.createElement('div'); d.className = 'cfx'; d.style.cssText = `left:${q.cx * 100}%;top:${q.t * 100}%;color:${col}`; d.textContent = txt; b.appendChild(d); setTimeout(() => d.remove(), 1000); };
    const pos = (x, y) => side === 1 ? [C.COLS - 1 - x, 2 * C.HALF - 1 - y] : [x, y];
    R.build = () => {
      const b = $c('chbd'); if (!b) return; R.els = {};
      lg.init.forEach(a => {
        const [id, team, card, emo, img, star, x, y, mhp, hp, mm, mana, items] = a;
        const [px, py] = pos(x, y), d = document.createElement('div'); d.className = 'cu t' + (team === side ? 0 : 1);
        d.style.cssText = unitStyle(px, py);
        const cc = card ? C.CARDS[card] : null, col = cc ? CCOL[cc.c] : '#b0463a';
        d.innerHTML = `<div class="chcd" style="--cc:${col}">${cc ? cc.e : (emo || '💀')}${cc ? art(card) : (img ? `<img src="/img/${img}.webp?v=1" alt="" onerror="this.remove()">` : '')}${cc ? `<span class="cn">${cc.c}</span>` : ''}<span class="st">${stars(star)}</span></div><div class="hp"><i style="width:100%"></i></div><div class="mn"><i style="width:0"></i></div>`;
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
        e.d.style.cssText = unitStyle(px, py);
        e.d.classList.toggle('dead', hp <= 0); e.d.classList.toggle('stun', !!stun);
        e.d.querySelector('.hp i').style.width = Math.max(0, hp / e.mhp * 100) + '%';
        e.d.querySelector('.mn i').style.width = (e.mm ? Math.min(100, mana / e.mm * 100) : 0) + '%';
      });
      for (const id in R.els) if (!live.has(+id)) R.els[id].d.classList.add('dead');
      if (quiet) return;
      f.e.forEach(ev => {
        const t = ev[0], e = R.els[ev[1]];
        if (t === 'a') { const tg = R.els[ev[2]]; if (e) { e.d.classList.remove('go'); void e.d.offsetWidth; e.d.classList.add('go'); } if (tg) { tg.d.classList.remove('hit'); void tg.d.offsetWidth; tg.d.classList.add('hit'); fx(tg.x, tg.y, (ev[4] ? '💥' : '') + '-' + ev[3], ev[4] ? '#ffcf4a' : '#fff'); } }
        else if (t === 's' && e) { const sp = C.SP[ev[2]]; fx(e.x, e.y - .2, sp ? sp.n : '', '#8fd0ff'); const r = document.createElement('div'); r.className = 'cspell'; const q = cellBox(e.x, Math.max(0, Math.min(5, Math.round(e.y)))); r.style.cssText = `left:${(q.cx - q.w * .9) * 100}%;top:${(q.t + q.h / 2 - q.w * .9 * ASP) * 100}%;width:${q.w * 180}%;height:${q.w * 180 * ASP}%`; const b = $c('chbd'); if (b) { b.appendChild(r); setTimeout(() => r.remove(), 700); } }
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
        if (a === 'desel') { st.sel = null; st.item = -1; draw(); return; }
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
