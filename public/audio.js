/* Nordika: звук. Всё синтезируется на лету (Web Audio), никаких файлов не нужно.
   Музыка: тихий бурдон и редкие ноты флейты в дорийском ладу. Звуки: нажатие, награда, горн, победа, поражение. */
(function (root) {
'use strict';
let ctx = null, master = null, musicG = null, sfxG = null, delay = null, timer = 0, started = false;
const KEY = 'nd_snd';
let cfg = { music: true, sfx: true };
try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* без хранилища */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* не страшно */ } };
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
  try { ctx = new AC(); } catch (e) { return false; }
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  musicG = ctx.createGain(); musicG.gain.value = 0; musicG.connect(master);
  sfxG = ctx.createGain(); sfxG.gain.value = cfg.sfx ? 0.5 : 0; sfxG.connect(master);
  // эхо для флейты
  delay = ctx.createDelay(1.5); delay.delayTime.value = 0.45;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicG);
  return true;
}

function tone(dest, type, f, t0, a, d, vol, extra) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (extra && extra.to) o.frequency.exponentialRampToValueAtTime(extra.to, t0 + a + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + a + d + 0.05);
  return o;
}

/* ---------- музыка ---------- */
const SCALE = [50, 53, 55, 57, 60, 62, 65, 67, 69];   // D F G A C D F G A (дорийская пентатоника)
let drone = null, last = 4;
function startDrone() {
  if (drone) return;
  const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = 0.16;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 2;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 160; lfo.connect(lg); lg.connect(f.frequency); lfo.start(t);
  const os = [hz(38), hz(45), hz(50)].map((fr, i) => { const o = ctx.createOscillator(); o.type = i === 1 ? 'triangle' : 'sawtooth'; o.frequency.value = fr; o.detune.value = i * 4 - 4; o.connect(f); o.start(t); return o; });
  f.connect(g); g.connect(musicG); drone = { os, lfo, g };
}
function stopDrone() { if (!drone) return; const d = drone; drone = null; try { d.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { d.os.forEach(o => { try { o.stop(); } catch (e) { /* уже остановлен */ } }); try { d.lfo.stop(); } catch (e) { /* уже */ } }, 2500); } catch (e) { /* нет */ } }
function note() {
  if (!ctx || !cfg.music || document.hidden) return;
  const t = ctx.currentTime + 0.05;
  const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
  last = Math.max(0, Math.min(SCALE.length - 1, last + step));
  const f = hz(SCALE[last] + 12);
  const o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f; vib.frequency.value = 5; vg.gain.value = f * 0.006; vib.connect(vg); vg.connect(o.frequency);
  const len = 1.6 + Math.random() * 1.8;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(musicG); g.connect(delay); o.start(t); vib.start(t); o.stop(t + len + 0.1); vib.stop(t + len + 0.1);
  if (Math.random() < 0.25) tone(musicG, 'sine', hz(SCALE[Math.max(0, last - 3)]), t + 0.1, 0.4, 2.2, 0.08);   // тихая нижняя нота
}
function loop() {
  clearTimeout(timer);
  if (!cfg.music) return;
  note(); timer = setTimeout(loop, 2600 + Math.random() * 3800);
}
/* Свои треки: положите файлы music1.mp3, music2.mp3 ... (до 5) в папку public/audio. Если они есть, играют они, иначе синтезированная мелодия. */
let tracks = null, el = null, ti = 0, mode = '';
async function probe() {
  if (tracks) return tracks; tracks = [];
  for (let i = 1; i <= 5; i++) { const u = '/audio/music' + i + '.mp3'; try { const r = await fetch(u, { method: 'HEAD', cache: 'no-store' }); if (r.ok && /audio|mpeg|octet/i.test(r.headers.get('content-type') || '')) tracks.push(u); } catch (e) { /* нет сети */ } }
  return tracks;
}
function playTrack() {
  if (!cfg.music || !ctx) return;
  if (!el) {
    el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous';
    try { ctx.createMediaElementSource(el).connect(musicG); } catch (e) { /* без маршрута: громкость сам элемент */ el.volume = 0.5; }
    el.onended = () => { ti = (ti + 1) % tracks.length; playTrack(); };
    el.onerror = () => { mode = 'synth'; startSynth(); };
  }
  el.loop = tracks.length === 1; el.src = tracks[ti]; el.play().catch(() => { /* ждём следующего нажатия */ });
}
function startSynth() { if (!cfg.music || !ctx) return; startDrone(); musicG.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2); loop(); }
function applyMusic() {
  if (!ctx) return;
  if (!cfg.music) { musicG.gain.setTargetAtTime(0, ctx.currentTime, 0.3); clearTimeout(timer); stopDrone(); if (el) el.pause(); return; }
  musicG.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);
  probe().then(t => { if (!cfg.music) return; if (t.length) { mode = 'files'; if (el && !el.paused) return; playTrack(); } else { mode = 'synth'; startSynth(); } });
}

/* ---------- короткие звуки ---------- */
const FX = {
  click: t => { tone(sfxG, 'triangle', 520, t, 0.005, 0.07, 0.28, { to: 380 }); },
  err:   t => { tone(sfxG, 'square', 150, t, 0.005, 0.14, 0.18, { to: 110 }); },
  ok:    t => { [392, 523].forEach((f, i) => tone(sfxG, 'triangle', f, t + i * 0.09, 0.01, 0.22, 0.3)); },
  reward: t => { [523, 659, 784, 1047].forEach((f, i) => tone(sfxG, 'triangle', f, t + i * 0.08, 0.01, 0.32, 0.28)); tone(sfxG, 'sine', 2093, t + 0.32, 0.01, 0.5, 0.08); },
  horn:  t => { tone(sfxG, 'sawtooth', 110, t, 0.18, 0.9, 0.2, { to: 146 }); tone(sfxG, 'sawtooth', 165, t, 0.18, 0.9, 0.12, { to: 220 }); },
  win:   t => { [392, 392, 523, 659, 784].forEach((f, i) => tone(sfxG, 'sawtooth', f, t + i * 0.14, 0.02, 0.35, 0.16)); tone(sfxG, 'sine', 196, t, 0.02, 1.0, 0.25); },
  lose:  t => { [330, 294, 262, 196].forEach((f, i) => tone(sfxG, 'sawtooth', f, t + i * 0.2, 0.03, 0.45, 0.14)); },
  build: t => { for (let i = 0; i < 3; i++) tone(sfxG, 'square', 220 + i * 6, t + i * 0.13, 0.002, 0.06, 0.2, { to: 90 }); tone(sfxG, 'triangle', 523, t + 0.45, 0.01, 0.3, 0.22); },
  alarm: t => { [0, 0.22].forEach(d => tone(sfxG, 'square', 440, t + d, 0.01, 0.16, 0.14, { to: 330 })); }
};
/* Звуки из файлов: public/audio/<имя>.mp3. Если файла нет, играет синтезированный вариант. */
const FILES = { march: '/audio/march.mp3' }, bufs = {};
function loadFiles() {
  Object.keys(FILES).forEach(n => {
    if (bufs[n] !== undefined) return; bufs[n] = null;
    fetch(FILES[n]).then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(a => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no))).then(b => { bufs[n] = b; }).catch(() => { bufs[n] = false; });
  });
}
function sfx(name) {
  if (!cfg.sfx || !init()) return;
  try {
    if (FILES[name]) loadFiles();
    if (bufs[name]) { const src = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 1.4; src.buffer = bufs[name]; src.connect(g); g.connect(sfxG); src.start(); return; }
    if (FX[name]) FX[name](ctx.currentTime + 0.01); else if (FX.horn && name === 'march') FX.horn(ctx.currentTime + 0.01);
  } catch (e) { /* звук не критичен */ }
}

/* Включить звук можно только после нажатия: так требует браузер. */
function unlock() {
  if (started) return; started = true;
  if (init()) { applyMusic(); loadFiles(); }
}
function set(k, v) {
  cfg[k] = !!v; save();
  if (k === 'sfx' && sfxG) sfxG.gain.setTargetAtTime(cfg.sfx ? 0.5 : 0, ctx.currentTime, 0.05);
  if (k === 'music') { if (init()) applyMusic(); }
}
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) { ctx.suspend(); } else { ctx.resume(); } });

root.Snd = { sfx, unlock, set, get cfg() { return cfg; }, get mode() { return mode; }, get playing() { return !!el && !el.paused; } };
})(typeof self !== 'undefined' ? self : globalThis);
