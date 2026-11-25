// ===== HỌC TIẾNG ANH THEO CÁCH AI HỌC — máy chủ (Cloudflare Worker + D1 + Workers AI) =====
// Ràng buộc: DB (D1), AI (Workers AI). Giao diện, kho câu và giọng đọc tải một lần từ NGUON
// rồi lưu hẳn vào D1 của bạn (bảng assets), từ đó web chạy độc lập.
const NGUON = '__NGUON__';
const VER = '__VER__';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS assets (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, created INTEGER)`,
  `CREATE TABLE IF NOT EXISTS tt (id INTEGER PRIMARY KEY, doc TEXT, updated INTEGER)`,
  `CREATE TABLE IF NOT EXISTS ke (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, text TEXT, sua TEXT, created INTEGER)`,
  `CREATE TABLE IF NOT EXISTS am (k TEXT PRIMARY KEY, v TEXT)`,
];
let migrated = false; const MEM = {};
async function migrate(env) { if (migrated) return; await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s))); migrated = true; }
async function asset(env, k, file) {
  if (MEM[k]) return MEM[k];
  const r = await env.DB.prepare('SELECT v FROM assets WHERE k=?').bind(k).first();
  if (r) { MEM[k] = r.v; return r.v; }
  const res = await fetch(NGUON + file, { redirect: 'follow' }); if (!res.ok) throw new Error('Không tải được ' + file + ' (' + res.status + ')');
  const t = await res.text(); if (!/^\s*[{\[]/.test(t)) throw new Error('Tệp ' + file + ' không hợp lệ');
  await env.DB.prepare('INSERT INTO assets(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, t).run(); MEM[k] = t; return t;
}
const bundle = async env => { const k = 'bundle_' + VER; if (MEM['B' + k]) return MEM['B' + k]; const o = JSON.parse(await asset(env, k, 'giaodien.json')); MEM['B' + k] = o; return o; };
const khoText = env => asset(env, 'kho_' + VER, 'kho.json');
// Giọng đọc: mỗi câu một dòng trong bảng am. Gói nào chưa có thì tải về một lần (gói nhỏ để không vượt giới hạn CPU gói miễn phí).
async function importPack(env, n) {
  const flag = 'am_' + n; const f = await env.DB.prepare('SELECT v FROM settings WHERE k=?').bind(flag).first(); if (f) return 0;
  const res = await fetch(NGUON + 'am' + n + '.txt'); if (!res.ok) throw new Error('Không tải được gói giọng đọc ' + n);
  const lines = (await res.text()).split('\n'); const st = [];
  for (const l of lines) { const i = l.indexOf('\t'); if (i > 0) st.push(env.DB.prepare('INSERT OR IGNORE INTO am(k,v) VALUES(?,?)').bind(l.slice(0, i), l.slice(i + 1))); }
  for (let i = 0; i < st.length; i += 50) await env.DB.batch(st.slice(i, i + 50));
  await setSet(env, flag, '1'); return st.length;
}

const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const ERR = (m, st = 400) => J({ error: m }, st);
const rnd = (n = 24) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function getSet(env) { const r = await env.DB.prepare('SELECT k,v FROM settings').all(); const o = {}; for (const x of r.results) o[x.k] = x.v; return o; }
async function setSet(env, k, v) { await env.DB.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, String(v)).run(); }
async function authed(req, env) { const t = req.headers.get('x-tk') || ''; if (!t) return false; return !!(await env.DB.prepare('SELECT 1 FROM sessions WHERE token=?').bind(t).first()); }
const b64bytes = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));

// ---------- AI ----------
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
async function llm(env, S, sys, user, max = 900) {
  const r = await env.AI.run(S.ai_model || MODEL, { messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], max_tokens: max, temperature: 0.1 });
  const t = r && (r.response ?? r.result?.response ?? r.choices?.[0]?.message?.content);
  return typeof t === 'string' ? t : JSON.stringify(t || '');
}
function pickJSON(t) { const a = t.indexOf('['), b = t.lastIndexOf(']'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } }
const LOAI = ['thieu_s', 'thua_s', 'be_sai', 'thieu_be', 'thua_be', 'a_an', 'thieu_mao_tu', 'the', 'so_nhieu', 'so_nhieu_dac_biet', 'khong_dem_duoc', 'tinh_tu_truoc', 'so_huu', 'tan_ngu', 'to_v', 'khong_to', 'v_ing_sau', 'v_ing_gioi_tu', 'dang_lam', 'do_does', 'dont_doesnt', 'sau_do_nguyen', 'qua_khu_ed', 'qua_khu_bqt', 'was_were', 'will_v', 'going_to', 'gioi_tu_gio', 'gioi_tu_cho', 'there_be', 'many_much', 'some_any', 'trat_tu_hoi', 'so_sanh_hon', 'so_sanh_nhat', 'tan_suat', 'hthh', 'for_since', 'bi_dong', 'ed_ing', 'make_do', 'dieu_kien', 'dieu_kien_2', 'who_which', 'hoi_gian_tiep', 'dong_tu_3', 'tinh_tu_trang_tu', 'dong_tu_cam_giac', 'too_either', 'should_v', 'used_to', 'chu_ngu', 'phrasal', 'tu_vung'];

async function suaCau(env, S, text) {
  const sys = `You are a careful English teacher for Vietnamese adult learners. The learner wrote a few sentences about their day (they may mix in Vietnamese words). For EACH sentence, return the corrected natural American English version with the smallest possible changes. Output ONLY a JSON array. Each element: {"goc": original sentence, "sua": corrected sentence, "vi": natural Vietnamese translation of the corrected sentence, "doi": [list of changes]}. Each change: {"sai": the learner's wrong words (a short phrase of 1-3 words, copied exactly from goc, never empty), "dung": the correct words (1-3 words, copied exactly from sua, never empty), "loai": one code from this list: ${LOAI.join(', ')}}. If a word was missing, include the neighbouring word in both "sai" and "dung" (e.g. sai "I tired", dung "I am tired"). If a sentence is already correct, "doi" is []. Do not change meaning. Do not add sentences.`;
  const raw = await llm(env, S, sys, text.slice(0, 1200), 1500);
  const arr = pickJSON(raw); if (!Array.isArray(arr)) return { error: 'AI chưa trả lời đúng dạng, thử lại.' };
  const items = arr.filter(x => x && typeof x.sua === 'string' && typeof x.goc === 'string').slice(0, 10);
  // kiểm lại lần hai: chỉ giữ câu được xác nhận là đúng và tự nhiên
  let okIdx = items.map(() => true);
  if (items.length) {
    const v = await llm(env, S, 'You check English sentences. For each numbered sentence answer only OK if it is fully grammatical, natural American English, or BAD otherwise. Output a JSON array of "OK"/"BAD" strings in order, nothing else.', items.map((x, i) => `${i + 1}. ${x.sua}`).join('\n'), 200);
    const va = pickJSON(v); if (Array.isArray(va) && va.length === items.length) okIdx = va.map(x => String(x).toUpperCase().includes('OK')); else okIdx = items.map(() => false);
  }
  const bai = [];
  items.forEach((x, i) => {
    if (!okIdx[i]) return;
    for (const d of (Array.isArray(x.doi) ? x.doi : []).slice(0, 2)) {
      const dung = String(d.dung || '').trim(), sai = String(d.sai || '').trim();
      if (!dung || !sai || dung.toLowerCase() === sai.toLowerCase()) continue;
      const at = x.sua.indexOf(dung); if (at < 0) continue;
      bai.push({ en: x.sua.slice(0, at) + '{' + dung + '}' + x.sua.slice(at + dung.length), vi: String(x.vi || ''), o: dung, sai: [[sai, LOAI.includes(d.loai) ? d.loai : 'tu_vung']], khac: [] });
    }
  });
  return { cau: items.map((x, i) => ({ goc: x.goc, sua: x.sua, vi: x.vi || '', doi: x.doi || [], kiem: okIdx[i] })), bai };
}

// ---------- định tuyến ----------
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url); const p = url.pathname;
    try {
      await migrate(env);
      if (!p.startsWith('/api/')) {
        if (p === '/kho.json') return new Response(await khoText(env), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' } });
        const am = p.match(/^\/am\/(\d+)\/([a-z0-9_]+)\.mp3$/);
        if (am) {
          let r = await env.DB.prepare('SELECT v FROM am WHERE k=?').bind(am[2]).first();
          if (!r) { await importPack(env, Number(am[1])); r = await env.DB.prepare('SELECT v FROM am WHERE k=?').bind(am[2]).first(); }
          if (!r) return new Response('', { status: 404 });
          return new Response(b64bytes(r.v), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
        }
        const B = await bundle(env);
        if (p === '/sw.js') return new Response(B.sw.replace('__VER__', VER), { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' } });
        if (p === '/manifest.webmanifest') return new Response(B.manifest, { headers: { 'content-type': 'application/manifest+json' } });
        if (p === '/icon.svg') return new Response(B.icon, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=86400' } });
        if (p === '/icon-192.png' || p === '/icon-512.png') return new Response(b64bytes(p.includes('192') ? B.png192 : B.png512), { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' } });
        return new Response(B.html.replace('__VER__', VER), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
      }
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const S = await getSet(env);
      if (p === '/api/state') return J({ hasPin: !!S.pin, ver: VER, ai: !!env.AI });
      if (p === '/api/setup' && req.method === 'POST') {
        if (S.pin) return ERR('Đã đặt mã PIN rồi');
        const pin = String(body.pin || ''); if (!/^\d{4,8}$/.test(pin)) return ERR('Mã PIN gồm 4–8 chữ số');
        const salt = rnd(12); await setSet(env, 'salt', salt); await setSet(env, 'pin', await sha(salt + pin));
        const t = rnd(32); await env.DB.prepare('INSERT INTO sessions VALUES(?,?)').bind(t, Date.now()).run();
        return J({ token: t });
      }
      if (p === '/api/login' && req.method === 'POST') {
        if (!S.pin) return ERR('Chưa đặt mã PIN');
        if (Date.now() < Number(S.lock || 0)) return ERR('Nhập sai nhiều lần. Thử lại sau ít phút.', 429);
        if (await sha(S.salt + String(body.pin || '')) !== S.pin) { const f = Number(S.fails || 0) + 1; await setSet(env, 'fails', f >= 5 ? 0 : f); if (f >= 5) await setSet(env, 'lock', Date.now() + 5 * 60e3); return ERR('Sai mã PIN', 401); }
        await setSet(env, 'fails', 0); const t = rnd(32); await env.DB.prepare('INSERT INTO sessions VALUES(?,?)').bind(t, Date.now()).run(); return J({ token: t });
      }
      if (!(await authed(req, env))) return ERR('Cần đăng nhập', 401);
      if (p === '/api/tt') {
        if (req.method === 'POST') {
          const doc = JSON.stringify(body.doc || {}); if (doc.length > 3e6) return ERR('Dữ liệu quá lớn');
          const cur = await env.DB.prepare('SELECT updated FROM tt WHERE id=1').first();
          const up = Number(body.updated) || Date.now();
          if (cur && cur.updated > up && !body.force) return J({ conflict: true, updated: cur.updated });
          await env.DB.prepare('INSERT INTO tt(id,doc,updated) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET doc=excluded.doc, updated=excluded.updated').bind(doc, up).run();
          return J({ ok: true, updated: up });
        }
        const r = await env.DB.prepare('SELECT doc,updated FROM tt WHERE id=1').first();
        return J(r ? { doc: JSON.parse(r.doc), updated: r.updated } : { doc: null, updated: 0 });
      }
      if (p === '/api/nghe' && req.method === 'POST') {
        if (!env.AI) return ERR('Chưa bật Workers AI');
        const a = String(body.audio || ''); if (!a || a.length > 4e6) return ERR('Không có tiếng hoặc quá dài');
        try { const r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: a, language: 'en', vad_filter: true }); return J({ text: String(r?.text || '').trim() }); }
        catch (e) { return J({ error: 'Chưa nghe được: ' + e.message }, 502); }
      }
      if (p === '/api/sua' && req.method === 'POST') {
        if (!env.AI) return ERR('Chưa bật Workers AI');
        const text = String(body.text || '').trim(); if (text.length < 3) return ERR('Viết vài câu trước đã');
        try { const r = await suaCau(env, S, text); if (r.error) return J(r, 502); await env.DB.prepare('INSERT INTO ke(day,text,sua,created) VALUES(?,?,?,?)').bind(String(body.day || ''), text, JSON.stringify(r), Date.now()).run(); return J(r); }
        catch (e) { return J({ error: 'AI đang bận hoặc hết lượt miễn phí hôm nay (' + e.message + ').' }, 502); }
      }
      if (p === '/api/nghe-nghiep' && req.method === 'POST') {
        const list = body.list || {}; const mota = String(body.mota || '').slice(0, 200);
        if (!env.AI || !mota) return J({ job: '' });
        try { const t = await llm(env, S, 'Pick the single closest job category for a person. Answer with only the code.', `Person's job (Vietnamese): ${mota}\nCategories:\n${Object.entries(list).map(([k, v]) => k + ': ' + v).join('\n')}`, 20); const k = Object.keys(list).find(k => t.includes(k)) || ''; return J({ job: k }); }
        catch { return J({ job: '' }); }
      }
      if (p === '/api/tai') { const n = Number(url.searchParams.get('n')); if (!(n >= 0)) return ERR('Thiếu số gói'); try { return J({ ok: true, n: await importPack(env, n) }); } catch (e) { return ERR(e.message, 502); } }
      if (p === '/api/ke') return J((await env.DB.prepare('SELECT day,text,sua,created FROM ke ORDER BY id DESC LIMIT 30').all()).results.map(x => ({ ...x, sua: JSON.parse(x.sua || '{}') })));
      if (p === '/api/pin' && req.method === 'POST') { if (!/^\d{4,8}$/.test(String(body.pin || ''))) return ERR('Mã PIN gồm 4–8 chữ số'); const salt = rnd(12); await setSet(env, 'salt', salt); await setSet(env, 'pin', await sha(salt + body.pin)); return J({ ok: true }); }
      if (p === '/api/logout' && req.method === 'POST') { await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(req.headers.get('x-tk')).run(); return J({ ok: true }); }
      return ERR('Không có', 404);
    } catch (e) { return ERR('Lỗi máy chủ: ' + e.message, 500); }
  },
};
