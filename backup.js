'use strict';
/* Ежедневные копии данных игры. Архив tar.gz кладётся в DATA_DIR/backups, хранится последние 10. */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

module.exports = function makeBackup(DATA_DIR, flush) {
  const DIR = path.join(DATA_DIR, 'backups');
  const KEEP = 10;
  let busy = false, lastErr = '';
  const list = () => { try { return fs.readdirSync(DIR).filter(f => /^nordika-\d{4}-\d\d-\d\d_\d\d-\d\d\.tar\.gz$/.test(f)).sort().reverse().map(f => { const s = fs.statSync(path.join(DIR, f)); return { name: f, size: s.size, t: s.mtimeMs }; }); } catch (e) { return []; } };
  function stamp() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}-${p(d.getUTCMinutes())}`; }
  function make(cb) {
    if (busy) return cb && cb(new Error('Копия уже делается'));
    busy = true;
    try { flush(); fs.mkdirSync(DIR, { recursive: true }); } catch (e) { busy = false; lastErr = e.message; return cb && cb(e); }
    const name = `nordika-${stamp()}.tar.gz`, tmp = path.join(DIR, name + '.part');
    execFile('tar', ['-czf', tmp, '-C', DATA_DIR, '--exclude=./backups', '--exclude=*.tmp', '.'], { timeout: 120000 }, err => {
      busy = false;
      if (err) { lastErr = err.message; try { fs.unlinkSync(tmp); } catch (e) { /* нет файла */ } console.error('Бэкап не удался:', err.message); return cb && cb(err); }
      try { fs.renameSync(tmp, path.join(DIR, name)); lastErr = ''; } catch (e) { lastErr = e.message; return cb && cb(e); }
      for (const o of list().slice(KEEP)) { try { fs.unlinkSync(path.join(DIR, o.name)); } catch (e) { /* уже удалён */ } }
      console.log('Бэкап готов:', name);
      cb && cb(null, name);
    });
  }
  function start() {
    const check = () => { const l = list(); if (!l.length || Date.now() - l[0].t > 23.5 * 3600000) make(); };
    setTimeout(check, 30000).unref();                  // после запуска, если копия давно не делалась
    setInterval(check, 30 * 60000).unref();            // и затем раз в полчаса проверяем: нужна ли новая
  }
  return { make, list, start, file: n => (/^nordika-[\d_-]+\.tar\.gz$/.test(n) ? path.join(DIR, n) : null), err: () => lastErr };
};
