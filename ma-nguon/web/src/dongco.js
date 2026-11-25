// ===== ĐỘNG CƠ HỌC — chạy trong trình duyệt và trong Node (để thử bằng người học ảo) =====
// Phương pháp: đọc bộ câu nén → che một chỗ rồi đoán → sai thì chỉnh ngay bằng vài câu cùng kiểu
// → giữ mức đúng khoảng 8/10 → ôn lúc sắp quên (FSRS) và trộn khuôn → sai cùng kiểu 3 lần mới giải thích
// → bỏ dần tiếng Việt, nói thẳng, đo giây → câu tự kể bị sửa thành bài mới.
(function (root) {
  'use strict';
  const DAY = 86400e3;
  // ---- FSRS-4.5 (tham số mặc định công bố) ----
  const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const F = 19 / 81, C = -0.5, RET = 0.9;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const retr = (t, s) => Math.pow(1 + F * t / s, C);
  const d0 = g => clamp(W[4] - (g - 3) * W[5], 1, 10);
  function fsrs(card, g, now) { // g: 1 sai, 2 đúng chậm, 3 đúng, 4 đúng rất nhanh
    if (!card.s) { card.s = W[g - 1]; card.d = d0(g); }
    else {
      const t = Math.max(0, (now - card.last) / DAY), r = retr(t, card.s);
      card.d = clamp(W[7] * d0(3) + (1 - W[7]) * (card.d - W[6] * (g - 3)), 1, 10);
      if (g === 1) card.s = Math.min(card.s, W[11] * Math.pow(card.d, -W[12]) * (Math.pow(card.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
      else card.s = card.s * (1 + Math.exp(W[8]) * (11 - card.d) * Math.pow(card.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
    }
    const ivl = card.s / F * (Math.pow(RET, 1 / C) - 1); // ngày
    card.last = now; card.reps = (card.reps || 0) + (g > 1 ? 1 : 0); if (g === 1) card.lapses = (card.lapses || 0) + 1;
    card.due = now + (g === 1 ? Math.min(ivl, 1) : clamp(ivl, 1, 365)) * DAY;
    return card;
  }

  const norm = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[.,!?;:"]/g, '').replace(/\s+/g, ' ').trim();
  const dayKey = (ts, tz) => new Date(ts + tz * 60e3).toISOString().slice(0, 10);

  function newState() {
    return { v: 1, created: 0, updated: 0, placed: false, lv: 1, job: '', fr: {}, cards: {}, errs: {}, days: {}, recent: [], noi: {}, userc: {}, goal: 40 };
  }

  function Engine(kho, state, opt) {
    opt = opt || {};
    const now = () => (opt.now ? opt.now() : Date.now());
    const rnd = opt.rand || Math.random;
    const tz = opt.tz != null ? opt.tz : -new Date().getTimezoneOffset(); // phút
    const S = state || newState(); if (!S.created) S.created = now();
    const K = kho.k, KI = {}; K.forEach((k, i) => { KI[k.id] = i; });
    const sess = { q: [], last: '', n: 0, learnSince: 0, rereadDone: {}, shownNow: {} };

    const cOf = sid => kho.c[sid] || S.userc[sid];
    const frOf = id => (S.fr[id] ||= { st: 0, seen: 0, got: {}, hist: [] });
    const today = () => dayKey(now(), tz);
    const dayRec = () => (S.days[today()] ||= { n: 0, ok: 0, ms: 0, okn: 0, noin: 0, noiok: 0, noims: 0 });
    const acc = (n = 10) => { const r = S.recent.slice(-n); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0.85; };
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const jobIds = k => (S.job && kho.nghe && kho.nghe[S.job] && kho.nghe[S.job].k[k]) || [];

    // ---- chọn cách hỏi cho một câu ----
    function modeFor(sid, force) {
      if (force) return force;
      const card = S.cards[sid] || {}; const a = acc(); let lvl = card.reps || 0;
      if (a < 0.7) lvl -= 1; if (a > 0.88) lvl += 1;
      if (lvl <= 0) return 'chon2';
      if (lvl === 1) return 'chon';
      const c = cOf(sid);
      if (c && c.tc && rnd() < 0.3) return 'nghe';
      return 'go';
    }
    function step(sid, mode, why) {
      const c = cOf(sid); const m = mode || modeFor(sid);
      let opts = null;
      if (m === 'chon2' || m === 'chon' || m === 'nghe') {
        const wrong = (c.sai || []).map(x => x[0]);
        const pick = m === 'chon2' ? shuffle(wrong.slice()).slice(0, 1) : wrong.slice(0, 3);
        opts = shuffle([c.o, ...pick]);
      }
      const card = S.cards[sid] || {};
      return { type: 'doan', sid, k: c.k, mode: m, opts, why: why || '', vi: (card.reps || 0) < 3 || m.startsWith('chon') };
    }

    // ---- khuôn đang học ----
    function curFrame() {
      for (const k of K) { const f = S.fr[k.id]; if (f && f.st === 1) return k; }
      return null;
    }
    function newFramesToday() { return Object.values(S.fr).filter(f => f.start && dayKey(f.start, tz) === today()).length; }
    function canStartNew() {
      const a = acc(); let cap = 2; if (a >= 0.88) cap = 4; else if (a < 0.7) cap = 0;
      const due = dueList().length; if (due > 30) cap = Math.min(cap, 0);
      const min = Object.keys(S.cards).length ? 0 : 1;
      return newFramesToday() < Math.max(cap, min);
    }
    function startNext() {
      for (const k of K) { const f = frOf(k.id); if (f.st === 0) { f.st = 1; f.start = now(); f.seen = 0; return k; } }
      return null;
    }
    function frameDone(k) {
      const f = frOf(k.id); const ids = k.a.concat(jobIds(k.id));
      const allGot = ids.every(s => f.got[s]); const h = f.hist.slice(-8);
      return allGot && h.length >= 6 && h.reduce((x, y) => x + y, 0) / h.length >= 0.75;
    }

    function dueList() {
      const t = now(); return Object.entries(S.cards).filter(([s, c]) => c.due <= t && cOf(s)).sort((a, b) => a[1].due - b[1].due).map(x => x[0]);
    }
    function pickInterleave(exceptK) {
      const known = Object.keys(S.cards).filter(s => { const c = cOf(s); return c && c.k !== exceptK && (S.cards[s].reps || 0) >= 1; });
      return known.length ? known[Math.floor(rnd() * known.length)] : null;
    }

    function next() {
      if (sess.q.length) { const s = sess.q.shift(); sess.last = s.k || sess.last; return s; }
      // 1) ôn câu tới hạn, trộn khuôn: không lấy hai câu liền cùng khuôn nếu tránh được
      const due = dueList().filter(s => !sess.shownNow[s]);
      if (due.length && sess.n - sess.learnSince < 12) {
        const alt = due.find(s => cOf(s).k !== sess.last) || due[0];
        sess.n++; sess.shownNow[alt] = 1; sess.last = cOf(alt).k; return step(alt, null, 'on');
      }
      sess.learnSince = sess.n;
      // 2) khuôn đang học
      let k = curFrame();
      if (k && frameDone(k)) { frOf(k.id).st = 2; frOf(k.id).done = now(); k = null; }
      if (!k && canStartNew()) k = startNext();
      if (!k) {
        if (due.length) { const s = due[0]; sess.n++; sess.shownNow[s] = 1; return step(s, null, 'on'); }
        return { type: 'xong' };
      }
      const f = frOf(k.id);
      if (!f.seen) { f.seen = 1; sess.last = k.id; return { type: 'xem', k: k.id, ids: k.a.concat(jobIds(k.id)), ten: k.ten }; }
      if (acc(8) < 0.6 && S.recent.length >= 8 && !sess.rereadDone[k.id]) {
        sess.rereadDone[k.id] = 1; return { type: 'xem', k: k.id, ids: k.a.concat(jobIds(k.id)), ten: k.ten, lai: true };
      }
      // cứ 3 câu mới chen 1 câu khuôn cũ để buộc nhìn chữ đi cùng
      if (sess.n % 4 === 3) { const s = pickInterleave(k.id); if (s) { sess.n++; return step(s, null, 'tron'); } }
      const ids = k.a.concat(jobIds(k.id));
      const notGot = ids.filter(s => !f.got[s]);
      const pool = notGot.length ? notGot : shuffle(k.b.slice()).slice(0, 3);
      const cand = pool.filter(s => !sess.shownNow[s]);
      const s = (cand.length ? cand : pool)[0];
      sess.n++; sess.shownNow[s] = 1; sess.last = k.id;
      return step(s, null, 'hoc');
    }

    // ---- chấm một câu đoán ----
    function answer(st, given, ms) {
      const c = cOf(st.sid); const g = norm(given);
      const ok = g === norm(c.o) || (c.khac || []).some(x => norm(x) === g);
      let loai = null;
      if (!ok) { const hit = (c.sai || []).find(x => norm(x[0]) === g); loai = hit ? hit[1] : null; }
      const t = now(); const card = S.cards[st.sid] ||= {};
      const slow = ms > (st.mode === 'go' ? 12000 : 7000), fast = ms < 2500;
      const isDue = !card.due || card.due <= t || !card.s;
      if (isDue) fsrs(card, ok ? (slow ? 2 : fast && (card.reps || 0) >= 2 ? 4 : 3) : 1, t);
      else if (!ok) { card.due = Math.min(card.due, t + DAY); card.lapses = (card.lapses || 0) + 1; }
      S.recent.push(ok ? 1 : 0); if (S.recent.length > 40) S.recent.splice(0, S.recent.length - 40);
      const d = dayRec(); d.n++; if (ok) { d.ok++; d.ms += ms; d.okn++; }
      const f = frOf(c.k); if (ok) f.got[st.sid] = 1; f.hist.push(ok ? 1 : 0); if (f.hist.length > 20) f.hist.shift();
      // khuôn đã thuộc mà sai liền nhiều lần → học lại
      if (f.st === 2 && f.hist.slice(-4).filter(x => !x).length >= 3) { f.st = 1; f.seen = 0; f.got = {}; }
      let explain = null; const follow = [];
      if (!ok) {
        const key = loai || '';
        if (key) { const e = S.errs[key] ||= { t: [], shown: 0 }; e.t = (e.t || []).filter(x => t - x < 7 * DAY); e.t.push(t); if (e.t.length >= 3) { e.t = []; e.shown++; explain = (kho.loi || {})[key] || null; } }
        // đưa ngay 2–3 câu cùng quy luật để đoán lại
        const k = kho.k[KI[c.k]];
        let pool = k ? k.b.concat(k.a, jobIds(k.id)).filter(s => s !== st.sid) : [];
        const same = pool.filter(s => (cOf(s).sai || []).some(x => x[1] === key));
        pool = shuffle(same.length >= 2 ? same : pool).filter(s => !sess.q.some(q => q.sid === s));
        for (const s of pool.slice(0, explain ? 3 : 2)) follow.push(step(s, st.mode === 'go' ? 'chon' : st.mode, 'sua'));
        sess.q.unshift(...follow);
      }
      S.updated = t;
      return { ok, loai, dung: c.o, explain, follow: follow.length };
    }

    // ---- kiểm tra đầu vào ----
    function placementItems() {
      const out = []; for (let i = 0; i < K.length; i += 3) { const k = K[i]; const sid = k.a[Math.min(2, k.a.length - 1)]; out.push(Object.assign(step(sid, 'chon'), { pi: i })); }
      return out;
    }
    function applyPlacement(results) { // results: [{pi, ok}]
      let p = 0; const r = results.slice().sort((a, b) => a.pi - b.pi);
      for (let i = 0; i < r.length; i++) { const w = r.slice(Math.max(0, i - 2), i + 1); const a = w.filter(x => x.ok).length / w.length; if (a >= 0.67 && r[i].ok) p = r[i].pi + 1; else if (a < 0.5) break; }
      const t = now();
      K.forEach((k, i) => {
        if (i < p) { const f = frOf(k.id); f.st = 2; f.seen = 1; f.done = t; f.placed = 1;
          k.a.slice(0, 3).forEach((s, j) => { S.cards[s] = { s: 3, d: 5, reps: 1, last: t, due: t + (1 + ((i + j) % 6)) * DAY }; }); }
      });
      S.lv = p > 70 ? 3 : p > 35 ? 2 : 1; S.placed = true; S.updated = t;
      return { p, lv: S.lv, total: K.length };
    }

    // ---- nói thẳng ----
    function noiItems(n) {
      const done = K.filter(k => (S.fr[k.id] || {}).st === 2 || ((S.fr[k.id] || {}).st === 1 && Object.keys((S.fr[k.id] || {}).got || {}).length >= 4));
      let items = []; for (const k of done) for (const x of k.noi || []) items.push(x);
      if (S.job && kho.nghe && kho.nghe[S.job]) for (const x of kho.nghe[S.job].noi || []) if (done.some(k => k.id === x.k)) items.push(x);
      items = shuffle(items).sort((a, b) => ((S.noi[a.id] || {}).n || 0) - ((S.noi[b.id] || {}).n || 0) || ((S.noi[b.id] || {}).ms || 9e9) - ((S.noi[a.id] || {}).ms || 9e9));
      return items.slice(0, n || 5);
    }
    function noiCheck(item, text) {
      const t = norm(text).split(' ').filter(Boolean); if (!t.length) return { ok: false, best: item.dap[0], score: 0 };
      let best = null, bs = 0;
      for (const d of item.dap) { const w = norm(d).split(' '); const set = {}; t.forEach(x => set[x] = (set[x] || 0) + 1);
        let hit = 0; for (const x of w) if (set[x]) { hit++; set[x]--; }
        const sc = 2 * hit / (w.length + t.length); if (sc > bs) { bs = sc; best = d; } }
      return { ok: bs >= 0.8, best, score: Math.round(bs * 100) / 100 };
    }
    function noiResult(item, ok, ms) {
      const r = S.noi[item.id] ||= { n: 0, ok: 0, ms: 0 }; r.n++; if (ok) { r.ok++; r.ms = r.ms ? Math.round(r.ms * 0.6 + ms * 0.4) : ms; }
      const d = dayRec(); d.noin++; if (ok) { d.noiok++; d.noims += ms; } S.updated = now();
    }

    // ---- câu tự kể đã được sửa → bài mới ----
    function addUser(list) { // [{en with {}, vi, o, sai:[[w,loai]]}]
      const t = now(); let n = 0;
      for (const x of list) { const id = 'u' + t.toString(36) + (n++); S.userc[id] = Object.assign({ k: 'tu' }, x); S.cards[id] = { due: t + DAY / 2 }; }
      S.updated = t; return n;
    }

    // ---- số liệu tiến bộ ----
    function stats() {
      const days = Object.keys(S.days).sort(); let streak = 0;
      for (let t = now(); ; t -= DAY) { const d = S.days[dayKey(t, tz)]; if (d && d.n >= 10) streak++; else if (dayKey(t, tz) === today()) continue; else break; if (streak > 3650) break; }
      const weeks = {};
      for (const d of days) { const dt = new Date(d + 'T00:00:00Z'); const wd = (dt.getUTCDay() + 6) % 7; const mon = new Date(dt - wd * DAY).toISOString().slice(0, 10);
        const w = weeks[mon] ||= { n: 0, ok: 0, ms: 0, okn: 0, noin: 0, noiok: 0, noims: 0 }; for (const k in w) w[k] += S.days[d][k] || 0; }
      const wk = Object.keys(weeks).sort().map(m => ({ tuan: m, dung: weeks[m].n ? Math.round(100 * weeks[m].ok / weeks[m].n) : null, giay: weeks[m].okn ? Math.round(weeks[m].ms / weeks[m].okn / 100) / 10 : null, noi: weeks[m].noiok ? Math.round(weeks[m].noims / weeks[m].noiok / 100) / 10 : null, cau: weeks[m].n }));
      const known = K.filter(k => (S.fr[k.id] || {}).st === 2).length;
      const t = today(); return { streak, weeks: wk, today: S.days[t] || { n: 0, ok: 0 }, known, total: K.length, due: dueList().length, goal: S.goal, acc: Math.round(acc(20) * 100) };
    }

    return { S, next, answer, placementItems, applyPlacement, noiItems, noiCheck, noiResult, addUser, stats, dueList, cOf, acc, sess, norm };
  }

  const api = { Engine, newState, fsrs, norm, dayKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DC = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
