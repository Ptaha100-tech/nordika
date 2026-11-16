'use strict';
/* Админ-панель «Nordika». Доступна только владельцу по секретному ключу.
   Ключ не хранится в открытом виде: в файле admin.json лежит только его хэш. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function makeAdmin(env) {
  const { users, byName, byToken, DATA_DIR, Core, Clan, Social, sstore, cstore, sctx, cctx, json, readBody, limited, ipOf, markDirty, touchState, ranking, flush, setSdirty, setCdirty, hashPw, newsApi, backup } = env;
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'admin.json'), 'utf8')); } catch (e) { cfg = null; }
  const sessions = new Map();               // токен -> до какого времени действует
  const SESSION_MS = 12 * 3600 * 1000;
  const LOG = path.join(DATA_DIR, 'admin.log');
  const recent = [];

  function audit(what) {
    const line = { t: Date.now(), what };
    recent.unshift(line); if (recent.length > 40) recent.pop();
    try { fs.appendFileSync(LOG, JSON.stringify(line) + '\n'); } catch (e) { /* не критично */ }
  }
  function checkKey(key) {
    if (!cfg || typeof key !== 'string' || key.length < 16 || key.length > 80) return false;
    const h = crypto.scryptSync(key, cfg.salt, 32);
    return crypto.timingSafeEqual(h, Buffer.from(cfg.hash, 'hex'));
  }
  function authed(req) {
    const m = /^Bearer ([0-9a-f]{48})$/.exec(req.headers['authorization'] || ''); if (!m) return false;
    const until = sessions.get(m[1]); if (!until) return false;
    if (until < Date.now()) { sessions.delete(m[1]); return false; }
    return true;
  }
  const row = u => {
    const c = Clan.clanOf(cstore, u.id);
    return { id: u.id, name: u.name, hall: u.state.b.hall, score: Core.score(u.state), seen: u.seen || 0, created: u.state.created || 0,
      banned: u.banned ? u.banned.reason || 'да' : '', muted: sstore.mutes[u.id] && sstore.mutes[u.id] > Date.now() ? sstore.mutes[u.id] : 0,
      clan: c ? c.tag : '', gems: u.state.gems || 0, vip: (u.state.vip || 0) > Date.now() ? u.state.vip : 0, online: sctx.online(u.id) };
  };

  async function handle(req, res, url) {
    const ip = ipOf(req);
    if (!cfg) return json(res, 503, { error: 'Админ-панель не настроена: нет файла admin.json.' });
    if (req.method === 'POST' && url === '/api/admin/login') {
      if (limited('adm:' + ip, 6, 600000)) return json(res, 429, { error: 'Слишком много попыток. Подождите 10 минут.' });
      let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
      if (!checkKey(String(b.key || '').trim())) { audit('Неудачная попытка входа с ' + ip); return json(res, 401, { error: 'Неверный ключ.' }); }
      const tok = crypto.randomBytes(24).toString('hex'); sessions.set(tok, Date.now() + SESSION_MS);
      audit('Вход в панель с ' + ip);
      return json(res, 200, { token: tok });
    }
    if (!authed(req)) return json(res, 401, { error: 'Нужно войти.' });
    const q = new URL(req.url, 'http://x').searchParams;

    if (req.method === 'GET' && url === '/api/admin/overview') {
      const t = Date.now(), all = [...users.values()];
      const bought = {}; let gems = 0, vip = 0, buys = 0;
      for (const u of all) { gems += u.state.gems || 0; if ((u.state.vip || 0) > t) vip++; for (const k in (u.state.bought || {})) { bought[k] = (bought[k] || 0) + u.state.bought[k]; buys += u.state.bought[k]; } }
      return json(res, 200, {
        players: all.length, online: all.filter(u => sctx.online(u.id)).length,
        new24: all.filter(u => (u.state.created || 0) > t - 86400000).length, new7: all.filter(u => (u.state.created || 0) > t - 7 * 86400000).length,
        active24: all.filter(u => (u.seen || 0) > t - 86400000).length, active7: all.filter(u => (u.seen || 0) > t - 7 * 86400000).length,
        clans: Object.keys(cstore.clans).length, worldMsgs: sstore.world.length, reports: sstore.reports.length,
        banned: all.filter(u => u.banned).length, gems, vip, buys, bought, timeMul: Core.CFG.t,
        newest: all.sort((a, b) => (b.state.created || 0) - (a.state.created || 0)).slice(0, 8).map(row), log: recent, backups: backup.list().slice(0, 5), backupErr: backup.err()
      });
    }
    if (req.method === 'GET' && url === '/api/admin/players') {
      const s = (q.get('q') || '').toLowerCase().trim().slice(0, 20), page = Math.max(0, Number(q.get('page')) || 0), sort = q.get('sort') || 'seen';
      let list = [...users.values()]; if (s) list = list.filter(u => u.nameKey.includes(s) || u.id.startsWith(s));
      const rs = list.map(row);
      rs.sort(sort === 'score' ? (a, b) => b.score - a.score : sort === 'new' ? (a, b) => b.created - a.created : (a, b) => b.seen - a.seen);
      return json(res, 200, { total: rs.length, page, rows: rs.slice(page * 25, page * 25 + 25) });
    }
    if (req.method === 'GET' && url === '/api/admin/player') {
      const u = users.get(q.get('id') || ''); if (!u) return json(res, 404, { error: 'Нет такого игрока.' });
      touchState(u);
      const st = u.state, c = Clan.clanOf(cstore, u.id);
      return json(res, 200, Object.assign(row(u), {
        res: st.res, b: st.b, troops: st.troops, tier: st.tier, hero: st.hero, haste: st.haste, shield: st.shield, stat: st.stat, bought: st.bought || {},
        clanName: c ? c.name : '', friends: (sstore.friends[u.id] || []).length, log: (st.log || []).slice(0, 8), ban: u.banned || null
      }));
    }
    if (req.method === 'GET' && url === '/api/admin/backup') {
      const f = backup.file(q.get('name') || ''); if (!f || !fs.existsSync(f)) return json(res, 404, { error: 'Нет такой копии.' });
      audit('Скачана копия ' + q.get('name'));
      res.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Length': fs.statSync(f).size, 'Content-Disposition': 'attachment; filename="' + path.basename(f) + '"', 'Cache-Control': 'no-store' });
      return fs.createReadStream(f).pipe(res);
    }
    if (req.method === 'GET' && url === '/api/admin/news') return json(res, 200, { news: newsApi.list().slice().sort((a, b) => b.t - a.t) });
    if (req.method === 'GET' && url === '/api/admin/chat') {
      return json(res, 200, { world: sstore.world.slice(-80), reports: sstore.reports.slice(-60).reverse() });
    }
    if (req.method === 'POST' && url === '/api/admin/act') {
      let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { error: 'Некорректный запрос' }); }
      const a = String(b.a || ''), u = users.get(String(b.id || ''));
      const need = () => { if (!u) { json(res, 404, { error: 'Нет такого игрока.' }); return false; } return true; };
      const ok = (msg) => json(res, 200, { ok: true, msg });
      switch (a) {
        case 'backup': return backup.make(err => err ? json(res, 500, { error: 'Не удалось: ' + err.message }) : (audit('Создана копия данных'), ok('Копия создана')));
        case 'say': { const t = String(b.text || '').trim(); if (!t) return json(res, 400, { error: 'Пустое сообщение.' }); Social.admin.say(sstore, sctx, t); setSdirty(); audit('Объявление в чат: ' + t.slice(0, 80)); return ok('Отправлено в общий чат'); }
        case 'newsadd': { const ti = String(b.title || '').trim().slice(0, 80), tx = String(b.text || '').trim().slice(0, 600); if (!ti || !tx) return json(res, 400, { error: 'Нужны заголовок и текст.' }); newsApi.add(ti, tx); audit('Новость: ' + ti); return ok('Новость опубликована на сайте'); }
        case 'newsdel': newsApi.del(String(b.nid || '')); audit('Удалена новость'); return ok('Новость удалена');
        case 'delmsg': Social.admin.deleteWorld(sstore, Number(b.t), String(b.pid || '')); setSdirty(); audit('Удалено сообщение'); return ok('Удалено');
        case 'dismiss': Social.admin.dismissReport(sstore, String(b.rid || '')); setSdirty(); return ok('Жалоба закрыта');
        case 'ban': { if (!need()) return; u.banned = { reason: String(b.reason || 'Нарушение правил').slice(0, 100), t: Date.now() }; u.tokens.forEach(h => byToken.delete(h)); u.tokens = []; markDirty(u); flush(); audit(`Бан: ${u.name} (${u.banned.reason})`); return ok('Игрок заблокирован'); }
        case 'unban': { if (!need()) return; delete u.banned; markDirty(u); audit('Разбан: ' + u.name); return ok('Игрок разблокирован'); }
        case 'mute': { if (!need()) return; const m = Number(b.minutes) || 0; Social.admin.mute(sstore, sctx, u.id, m); setSdirty(); audit(`Мут: ${u.name} на ${m} мин`); return ok(m ? 'Мут выдан' : 'Мут снят'); }
        case 'rename': {
          if (!need()) return;
          const nn = String(b.name || '').trim().replace(/\s+/g, ' '), key = nn.toLowerCase();
          if (!/^[\p{L}\p{N}_\- ]{3,16}$/u.test(nn)) return json(res, 400, { error: 'Имя: от 3 до 16 символов, буквы, цифры, пробел, дефис или подчёркивание.' });
          if (byName.has(key) && byName.get(key) !== u.id) return json(res, 409, { error: 'Это имя уже занято.' });
          const old = u.name;
          byName.delete(u.nameKey); u.name = nn; u.nameKey = key; byName.set(key, u.id);
          if (u.state) u.state.name = nn;
          for (const c of Object.values(cstore.clans || {})) if (c.members && c.members[u.id]) { c.members[u.id].name = nn; setCdirty(); }
          markDirty(u); flush(); audit(`Смена ника: ${old} → ${nn}`); return ok('Ник изменён');
        }
        case 'noavatar': { if (!need()) return; delete u.avatar; u.frame = 0; markDirty(u); audit('Убран аватар: ' + u.name); return ok('Аватар убран'); }
        case 'clearmsgs': { if (!need()) return; Social.admin.clearWorld(sstore, u.id); setSdirty(); audit('Удалены сообщения: ' + u.name); return ok('Сообщения удалены'); }
        case 'grant': {
          if (!need()) return;
          touchState(u); const st = u.state, g = b.give || {}, parts = [];
          const n = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));
          if (n(g.gems, 1e6)) { st.gems = (st.gems || 0) + n(g.gems, 1e6); parts.push(n(g.gems, 1e6) + ' рунных камней'); }
          if (n(g.haste, 1e5)) { st.haste += n(g.haste, 1e5); parts.push(n(g.haste, 1e5) + ' ускорений'); }
          for (const r of ['food', 'wood', 'stone', 'iron', 'silver']) if (n(g[r], 1e8)) { st.res[r] += n(g[r], 1e8); parts.push(n(g[r], 1e8) + ' ' + Core.RI[r].n.toLowerCase()); }
          if (n(g.vipDays, 3650)) { st.vip = Math.max(st.vip || 0, Date.now()) + n(g.vipDays, 3650) * 86400000; parts.push('VIP на ' + n(g.vipDays, 3650) + ' дн.'); }
          if (n(g.shieldH, 720)) { st.shield = Math.max(st.shield, Date.now()) + n(g.shieldH, 720) * 3600000; parts.push('щит на ' + n(g.shieldH, 720) + ' ч'); }
          if (!parts.length) return json(res, 400, { error: 'Ничего не выбрано.' });
          Core.addLogTo(st, 'Дар от администрации: ' + parts.join(', ') + '.', 'good'); markDirty(u);
          audit(`Выдано ${u.name}: ${parts.join(', ')}`); return ok('Выдано: ' + parts.join(', '));
        }
        case 'setpw': {
          if (!need()) return; const pw = String(b.password || '');
          if (pw.length < 6 || pw.length > 64) return json(res, 400, { error: 'Пароль: от 6 до 64 символов.' });
          u.salt = crypto.randomBytes(16).toString('hex'); u.hash = hashPw(pw, u.salt); u.tokens.forEach(h => byToken.delete(h)); u.tokens = []; markDirty(u);
          audit('Сменён пароль: ' + u.name); return ok('Пароль изменён, игрок вышел со всех устройств');
        }
        case 'delete': {
          if (!need()) return; if (String(b.confirm || '').toLowerCase() !== u.nameKey) return json(res, 400, { error: 'Для удаления введите имя игрока точно.' });
          if (Clan.clanOf(cstore, u.id)) { Clan.act(cstore, cctx, u.id, 'leave', {}); setCdirty(); }
          u.tokens.forEach(h => byToken.delete(h)); users.delete(u.id); byName.delete(u.nameKey);
          try { fs.unlinkSync(path.join(DATA_DIR, u.id + '.json')); } catch (e) { /* файла могло не быть */ }
          audit('УДАЛЁН игрок: ' + u.name); return ok('Игрок удалён');
        }
      }
      return json(res, 400, { error: 'Неизвестное действие.' });
    }
    return json(res, 404, { error: 'Нет такого запроса' });
  }
  return { handle, enabled: !!cfg };
};
