// ===== GIAO DIỆN — Tiếng Anh theo cách AI học =====
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = () => $('#app');
const TK = () => localStorage.getItem('tk') || '';
let KHO = null, E = null, SYNC_T = null, ONLINE = navigator.onLine;
const NGHE = { ban_hang: 'Bán hàng, kinh doanh', van_phong: 'Văn phòng', nong_nghiep: 'Làm vườn, trồng trọt, chăn nuôi', bat_dong_san: 'Môi giới nhà đất', nha_hang: 'Nhà hàng, quán cà phê, nấu ăn', lai_xe: 'Lái xe, giao hàng', y_te: 'Y tế, nhà thuốc', tho_ky_thuat: 'Thợ, kỹ thuật, xây dựng', giao_vien: 'Giáo viên', hoc_sinh: 'Học sinh, sinh viên', du_lich: 'Du lịch, khách sạn, đi nước ngoài', noi_tro: 'Nội trợ, gia đình' };

async function api(p, body, opt = {}) {
  const r = await fetch(p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-tk': TK() }, body: body ? JSON.stringify(body) : undefined, keepalive: !!opt.keep });
  let j = {}; try { j = await r.json(); } catch { }
  if (r.status === 401 && !opt.noLogout && TK()) { localStorage.removeItem('tk'); location.reload(); }
  if (!r.ok && !j.error) j.error = 'Lỗi ' + r.status;
  return j;
}
function toast(m, ms = 2200) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms); }

// ---------- lưu & đồng bộ ----------
function saveLocal() { try { localStorage.setItem('tt', JSON.stringify(E.S)); } catch { } clearTimeout(SYNC_T); SYNC_T = setTimeout(pushState, 4000); }
async function pushState(keep) {
  if (!TK() || !E) return; try { const r = await api('/api/tt', { doc: E.S, updated: E.S.updated || Date.now() }, { keep, noLogout: true }); if (r.ok) localStorage.setItem('tt_sync', String(E.S.updated)); } catch { }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushState(true); });
addEventListener('online', () => { ONLINE = true; pushState(); }); addEventListener('offline', () => { ONLINE = false; });

async function loadAll() {
  app().innerHTML = '<div class="mid"><div class="spin"></div><p>Đang mở bài học…</p></div>';
  const kr = await fetch('/kho.json'); KHO = await kr.json();
  let local = null; try { local = JSON.parse(localStorage.getItem('tt') || 'null'); } catch { }
  let remote = null; try { const r = await api('/api/tt'); if (r.doc) remote = r.doc; } catch { }
  let st = local; if (remote && (!local || (remote.updated || 0) > (local.updated || 0))) st = remote;
  E = DC.Engine(KHO, st || DC.newState(), {});
  if (local && remote && (local.updated || 0) > (remote.updated || 0)) pushState();
  saveLocal();
  if (!E.S.placed) onboard(); else home();
  setTimeout(taiGiong, 3000);
}
// chép dần giọng đọc từ nguồn về máy chủ riêng của bạn (mỗi lần một gói nhỏ), để web chạy độc lập
async function taiGiong() {
  const n = KHO.goi || 0; let done = Number(localStorage.getItem('am_done') || 0);
  for (let i = done; i < n; i++) { if (!ONLINE) return; const r = await api('/api/tai?n=' + i, null, { noLogout: true }).catch(() => ({ error: 1 })); if (r.error) return setTimeout(taiGiong, 60e3); localStorage.setItem('am_done', String(i + 1)); }
}

// ---------- âm thanh ----------
const AU = new Audio(); let AU_T = null;
function amUrl(sid) { const c = E.cOf(sid); return c && c.am != null ? `/am/${c.am}/${sid}.mp3` : null; }
function say(sid, untilMs) {
  clearTimeout(AU_T); AU.pause(); speechSynthesis && speechSynthesis.cancel();
  const u = amUrl(sid); const c = E.cOf(sid);
  if (u) { AU.src = u; AU.currentTime = 0; AU.playbackRate = Number(localStorage.getItem('toc') || 1); const pr = AU.play(); if (pr) pr.catch(() => { }); if (untilMs) { const stop = () => { AU_T = setTimeout(() => AU.pause(), untilMs / AU.playbackRate); AU.removeEventListener('playing', stop); }; AU.addEventListener('playing', stop); } return; }
  if (c && window.speechSynthesis) { const ut = new SpeechSynthesisUtterance(plain(c.en)); ut.lang = 'en-US'; ut.rate = 0.9 * Number(localStorage.getItem('toc') || 1); speechSynthesis.speak(ut); }
}
function sayText(t) { if (!window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.speak(u); }
const plain = en => en.replace(/[{}]/g, '');

// ---------- hiển thị câu ----------
function hlHtml(c) { // tô chỗ khác câu trước
  const t = plain(c.en); if (!c.hl) return esc(t);
  return esc(t.slice(0, c.hl[0])) + '<mark>' + esc(t.slice(c.hl[0], c.hl[1])) + '</mark>' + esc(t.slice(c.hl[1]));
}
function blankHtml(c, fill, cls) { const m = c.en.match(/^(.*)\{(.+?)\}(.*)$/); if (!m) return esc(c.en); return esc(m[1]) + `<span class="blank ${cls || ''}">${fill != null ? esc(fill) : '&nbsp;'.repeat(Math.max(6, m[2].length * 2))}</span>` + esc(m[3]); }

// ---------- khoá ----------
async function lock() {
  const s = await api('/api/state', null, { noLogout: true });
  const first = !s.hasPin;
  app().innerHTML = `<div class="card mid"><div class="logo">A<span>b</span></div><h1>Tiếng Anh theo cách AI học</h1>
  <p class="sub">${first ? 'Đặt một mã PIN 4–8 số để chỉ mình bạn mở được trang học này.' : 'Nhập mã PIN để vào học.'}</p>
  <input id="pin" type="password" inputmode="numeric" autocomplete="${first ? 'new-password' : 'current-password'}" maxlength="8" placeholder="Mã PIN">
  ${first ? '<input id="pin2" type="password" inputmode="numeric" maxlength="8" placeholder="Nhập lại mã PIN">' : ''}
  <button class="big" id="go">${first ? 'Đặt mã PIN' : 'Vào học'}</button><p class="err" id="er"></p></div>`;
  const go = async () => {
    const pin = $('#pin').value.trim(); if (first && pin !== $('#pin2').value.trim()) return $('#er').textContent = 'Hai lần nhập chưa giống nhau';
    const r = await api(first ? '/api/setup' : '/api/login', { pin }, { noLogout: true }); if (r.error) return $('#er').textContent = r.error;
    localStorage.setItem('tk', r.token); loadAll();
  };
  $('#go').onclick = go; $('#pin').onkeydown = e => { if (e.key === 'Enter') go(); }; if ($('#pin2')) $('#pin2').onkeydown = e => { if (e.key === 'Enter') go(); };
}

// ---------- lần đầu: nghề, mục tiêu, kiểm tra đầu vào ----------
function onboard() {
  app().innerHTML = `<div class="card"><h2>Chào bạn 👋</h2><p>Trang này dạy tiếng Anh theo đúng cách AI học ngôn ngữ: đọc một loạt câu chỉ khác nhau một chỗ, rồi che đi và đoán. Sai thì chỉnh ngay. Không học thuộc công thức trước.</p>
  <h3>Bạn làm nghề gì?</h3><p class="sub">Để câu ví dụ gần với cuộc sống của bạn.</p>
  <div class="grid" id="jobs">${Object.entries(NGHE).map(([k, v]) => `<button class="opt" data-j="${k}">${esc(v)}</button>`).join('')}<button class="opt" data-j="_">Nghề khác…</button></div>
  <div id="khac" hidden><input id="mota" placeholder="Ví dụ: thợ may, bán tạp hóa…"><button id="okk">Xong</button></div>
  <h3>Mỗi ngày bạn học bao nhiêu?</h3><div class="row" id="goals"><button class="opt" data-g="20">Ít · 5 phút</button><button class="opt on" data-g="40">Vừa · 10 phút</button><button class="opt" data-g="80">Nhiều · 20 phút</button></div>
  <button class="big" id="next" disabled>Làm bài kiểm tra 2 phút →</button><p class="sub">Bài kiểm tra chỉ để biết nên bắt đầu từ đâu. Không biết thì cứ chọn đại, không sao cả.</p></div>`;
  let goal = 40;
  app().querySelectorAll('#goals .opt').forEach(b => b.onclick = () => { goal = Number(b.dataset.g); app().querySelectorAll('#goals .opt').forEach(x => x.classList.toggle('on', x === b)); });
  const pick = j => { E.S.job = j; app().querySelectorAll('#jobs .opt').forEach(x => x.classList.toggle('on', x.dataset.j === j)); $('#next').disabled = false; };
  app().querySelectorAll('#jobs .opt').forEach(b => b.onclick = () => { if (b.dataset.j === '_') { $('#khac').hidden = false; $('#mota').focus(); return; } $('#khac').hidden = true; pick(b.dataset.j); });
  $('#okk').onclick = async () => { const m = $('#mota').value.trim(); if (!m) return; $('#okk').textContent = '…'; const r = await api('/api/nghe-nghiep', { mota: m, list: NGHE }).catch(() => ({})); $('#okk').textContent = 'Xong'; E.S.job_mota = m; pick(r.job || 'noi_tro'); toast('Gần nhất: ' + (NGHE[r.job] || NGHE.noi_tro)); };
  $('#next').onclick = () => { E.S.goal = goal; saveLocal(); placement(); };
}
function placement() {
  const items = E.placementItems(); const res = []; let i = 0; const t0 = Date.now();
  const show = () => {
    const recent = res.slice(-4); const stop = Date.now() - t0 > 130e3 || i >= items.length || (recent.length === 4 && recent.filter(x => !x.ok).length >= 3);
    if (stop) { const r = E.applyPlacement(res); saveLocal(); pushState();
      app().innerHTML = `<div class="card mid"><h2>Xong rồi!</h2><p>${r.p ? `Bạn đã quen <b>${r.p}</b> trên ${r.total} khuôn câu. Những khuôn đó sẽ được ôn nhẹ để chắc chắn.` : 'Mình bắt đầu từ những câu đơn giản nhất nhé.'}</p><button class="big" id="go">Bắt đầu học →</button></div>`; $('#go').onclick = () => learn(); return; }
    const st = items[i]; const c = E.cOf(st.sid); const ts = Date.now();
    app().innerHTML = `<div class="card"><div class="bar"><i style="width:${Math.min(100, (Date.now() - t0) / 1200)}%"></i></div><p class="sub">Kiểm tra đầu vào · câu ${i + 1}</p>
    <p class="en">${blankHtml(c)}</p><p class="vi">${esc(c.vi)}</p><div class="grid">${st.opts.map(o => `<button class="opt ans">${esc(o)}</button>`).join('')}<button class="opt ans skip" data-skip="1">Chưa biết</button></div></div>`;
    app().querySelectorAll('.ans').forEach(b => b.onclick = () => { res.push({ pi: st.pi, ok: !b.dataset.skip && DC.norm(b.textContent) === DC.norm(c.o), ms: Date.now() - ts }); i++; show(); });
  };
  show();
}

// ---------- trang chính ----------
function ring(n, g) { const p = Math.min(1, n / g), r = 52, L = 2 * Math.PI * r; return `<svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="${r}" class="bg"/><circle cx="60" cy="60" r="${r}" class="fg" stroke-dasharray="${L * p} ${L}"/><text x="60" y="58">${n}</text><text x="60" y="80" class="s">/ ${g} câu</text></svg>`; }
function home() {
  const s = E.stats(); const canNoi = E.noiItems(1).length > 0;
  app().innerHTML = `<div class="card mid">${ring(s.today.n || 0, s.goal)}
  <p class="streak">${s.streak ? `🔥 ${s.streak} ngày liền` : 'Hôm nay là ngày đầu tiên'} · đúng ${s.acc}% gần đây</p>
  <button class="big" id="hoc">${(s.today.n || 0) >= s.goal ? 'Học thêm' : 'Học hôm nay'}</button>
  <div class="row"><button id="noi" ${canNoi ? '' : 'disabled'}>🎙️ Nói thẳng</button><button id="ke">✍️ Kể chuyện</button></div>
  <div class="row"><button id="tb">📈 Tiến bộ</button><button id="cd">⚙️ Cài đặt</button></div>
  <p class="sub">${s.known}/${s.total} khuôn câu đã thuộc · ${s.due} câu tới hẹn ôn${canNoi ? '' : ' · Nói thẳng mở khi bạn thuộc khuôn đầu tiên'}</p>${ONLINE ? '' : '<p class="sub">Đang không có mạng, vẫn học được bình thường.</p>'}</div>`;
  $('#hoc').onclick = () => learn(); $('#noi').onclick = () => noi(); $('#ke').onclick = () => ke(); $('#tb').onclick = () => tienbo(); $('#cd').onclick = () => caidat();
}

// ---------- học ----------
let SESS = null;
function learn() { SESS = { n: 0, ok: 0, start: Date.now() }; nextStep(); }
function nextStep() {
  const st = E.next(); SESS.cur = st;
  if (st.type === 'xong') return done(true);
  if (st.type === 'xem') return xem(st);
  doan(st);
}
function header() { const s = E.stats(); return `<div class="top"><button class="x" id="out">✕</button><div class="bar"><i style="width:${Math.min(100, 100 * (s.today.n || 0) / s.goal)}%"></i></div><span class="cnt">${s.today.n || 0}/${s.goal}</span></div>`; }
function bindOut() { $('#out').onclick = () => done(false); }
function xem(st) {
  const cs = st.ids.map(id => [id, E.cOf(id)]).filter(x => x[1]);
  app().innerHTML = header() + `<div class="card"><p class="tag">${st.lai ? 'Đọc lại cho đủ dấu hiệu' : 'Khuôn mới'}</p><h2>${esc(st.ten)}</h2><p class="sub">Đọc và nghe lần lượt. Để ý chỗ tô màu: đó là chỗ duy nhất thay đổi so với câu trước.</p>
  <div class="list">${cs.map(([id, c], i) => `<div class="li" data-id="${id}"><button class="pl" aria-label="Nghe">▶</button><div><p class="en">${hlHtml(c)}</p><p class="vi">${esc(c.vi)}</p></div></div>`).join('')}</div>
  <div class="row"><button id="all">🔊 Nghe cả loạt</button></div><button class="big" id="go">Đã xem, đoán thử →</button></div>`;
  bindOut();
  app().querySelectorAll('.li').forEach(el => el.onclick = () => { say(el.dataset.id); app().querySelectorAll('.li').forEach(x => x.classList.toggle('on', x === el)); });
  $('#all').onclick = () => { let i = 0; const els = [...app().querySelectorAll('.li')]; const run = () => { if (i >= els.length || !document.body.contains(els[0])) return; els.forEach(x => x.classList.toggle('on', x === els[i])); els[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); say(els[i].dataset.id); i++; AU.onended = () => setTimeout(run, 450); if (!amUrl(els[i - 1].dataset.id)) setTimeout(run, 2600); }; run(); };
  $('#go').onclick = () => { AU.onended = null; AU.pause(); nextStep(); };
}
function doan(st) {
  const c = E.cOf(st.sid); const t0 = Date.now(); let answered = false;
  const why = { on: 'Ôn lại', tron: 'Ôn lẫn khuôn cũ', sua: 'Câu cùng kiểu, đoán lại', hoc: '' }[st.why] || '';
  const nghe = st.mode === 'nghe';
  app().innerHTML = header() + `<div class="card">${why ? `<p class="tag">${why}</p>` : ''}
  <div class="timer"><i id="tm"></i></div>
  ${nghe ? `<p class="sub">Nghe rồi đoán chữ bị che. Không nhìn chữ.</p><button class="big ghost" id="rep">🔊 Nghe lại</button>` : `<p class="en big" id="sen">${blankHtml(c)}</p>`}
  ${st.vi && !nghe ? `<p class="vi">${esc(c.vi)}</p>` : ''}
  <div id="inp">${st.opts ? `<div class="grid">${st.opts.map(o => `<button class="opt ans">${esc(o)}</button>`).join('')}</div>` : `<input id="ty" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ chữ bị che"><button class="big" id="chk">Kiểm tra</button>`}</div>
  <div id="fb"></div></div>`;
  bindOut();
  const tm = $('#tm'); tm.style.transition = 'none'; tm.style.width = '100%'; requestAnimationFrame(() => { tm.style.transition = `width ${st.mode === 'go' ? 12 : 7}s linear`; tm.style.width = '0%'; });
  if (nghe) { const play = () => say(st.sid, c.tc); play(); $('#rep').onclick = play; }
  const submit = given => {
    if (answered) return; answered = true; const ms = Date.now() - t0; tm.style.transition = 'none';
    const r = E.answer(st, given, ms); SESS.n++; if (r.ok) SESS.ok++; saveLocal();
    const sen = nghe ? '' : '';
    app().querySelectorAll('.ans').forEach(b => { if (DC.norm(b.textContent) === DC.norm(c.o)) b.classList.add('good'); else if (b.textContent === given && !r.ok) b.classList.add('bad'); b.disabled = true; });
    if ($('#ty')) { $('#ty').disabled = true; $('#ty').classList.add(r.ok ? 'good' : 'bad'); $('#chk').remove(); }
    $('#fb').innerHTML = `<div class="fb ${r.ok ? 'ok' : 'no'}"><p class="en">${blankHtml(c, c.o, 'filled')}</p>${!st.vi || nghe ? `<p class="vi">${esc(c.vi)}</p>` : ''}
      <p class="msg">${r.ok ? (ms < 2500 ? 'Đúng, nhanh lắm!' : 'Đúng rồi!') : `Chưa đúng. Chữ đúng là <b>${esc(c.o)}</b>.${r.follow ? ` Đoán thêm ${r.follow} câu cùng kiểu nhé.` : ''}`}</p>
      ${r.explain ? `<div class="why"><b>Vì sao?</b> ${esc(r.explain)}</div>` : ''}<button class="big" id="nx">Tiếp →</button></div>`;
    say(st.sid);
    $('#nx').onclick = () => { clearTimeout(SESS.auto); nextStep(); };
    if (r.ok && !r.explain) SESS.auto = setTimeout(() => { if ($('#nx')) nextStep(); }, 1700);
    if (E.stats().today.n === E.S.goal) setTimeout(() => toast('🎉 Xong mục tiêu hôm nay!'), 300);
  };
  app().querySelectorAll('.ans').forEach(b => b.onclick = () => submit(b.textContent));
  if ($('#ty')) { const ty = $('#ty'); setTimeout(() => ty.focus(), 50); $('#chk').onclick = () => ty.value.trim() && submit(ty.value); ty.onkeydown = e => { if (e.key === 'Enter' && ty.value.trim()) submit(ty.value); }; }
}
function done(finished) {
  clearTimeout(SESS && SESS.auto); AU.pause(); pushState();
  if (!SESS || !SESS.n) return home();
  const p = Math.round(100 * SESS.ok / SESS.n);
  app().innerHTML = `<div class="card mid"><h2>${finished ? 'Hết bài cho hôm nay' : 'Nghỉ chút nhé'}</h2><p class="huge">${SESS.ok}/${SESS.n}</p><p>câu đúng (${p}%)</p>
  <p class="sub">${p >= 90 ? 'Dễ quá rồi, lần sau web sẽ đưa câu khó hơn.' : p < 70 ? 'Hơi khó, web sẽ cho bạn đọc thêm trước khi đoán.' : 'Vừa sức, đúng mức học nhanh nhất.'}</p>
  <button class="big" id="h">Về trang chính</button></div>`; $('#h').onclick = home; SESS = null;
}

// ---------- nói thẳng ----------
const REC = { ctx: null, stream: null, node: null, buf: [], on: false };
async function micStart() {
  if (!REC.stream) REC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  if (!REC.ctx) { REC.ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = REC.ctx.createMediaStreamSource(REC.stream); REC.node = REC.ctx.createScriptProcessor(4096, 1, 1); src.connect(REC.node); REC.node.connect(REC.ctx.destination); REC.node.onaudioprocess = e => { if (!REC.on) return; const d = e.inputBuffer.getChannelData(0); REC.buf.push(new Float32Array(d)); REC.tick && REC.tick(d); }; }
  if (REC.ctx.state === 'suspended') await REC.ctx.resume();
}
function wav16(chunks, rate) {
  let n = 0; for (const c of chunks) n += c.length; const all = new Float32Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  const ratio = rate / 16000, m = Math.floor(n / ratio), pcm = new Int16Array(m);
  for (let i = 0; i < m; i++) { const s = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)])); pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
  const b = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(b); const w = (p, s) => [...s].forEach((ch, i) => v.setUint8(p + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(b, 44).set(pcm); let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s);
}
// Ghi một câu: tự phát hiện lúc bắt đầu nói (để đo số giây) và tự dừng khi im lặng
function recordOnce(t0, onLevel) {
  return new Promise(resolve => {
    REC.buf = []; REC.on = true; let floor = 0.01, nf = 0, speechAt = 0, lastLoud = 0; const st = performance.now();
    REC.tick = d => { let e = 0; for (let i = 0; i < d.length; i += 4) e += d[i] * d[i]; const rms = Math.sqrt(e / (d.length / 4)); const now = performance.now();
      if (now - st < 350) { floor = Math.max(floor, rms); nf++; return; }
      onLevel && onLevel(Math.min(1, rms * 8));
      if (rms > Math.max(0.025, floor * 2.5)) { if (!speechAt) speechAt = Date.now(); lastLoud = now; }
      if ((speechAt && now - lastLoud > 1300) || now - st > 12000) finish(); };
    const finish = () => { if (!REC.on) return; REC.on = false; REC.tick = null; resolve({ wav: REC.buf.length ? wav16(REC.buf, REC.ctx.sampleRate) : '', ms: speechAt ? speechAt - t0 : null }); };
    REC.stop = finish;
  });
}
async function noi() {
  const items = E.noiItems(5); let i = 0; const res = [];
  const show = async () => {
    if (i >= items.length) { const ok = res.filter(x => x.ok); app().innerHTML = `<div class="card mid"><h2>Xong phần nói</h2><p class="huge">${ok.length}/${res.length}</p><p>${ok.length ? `Trung bình bạn mở miệng sau <b>${(ok.reduce((a, x) => a + x.ms, 0) / ok.length / 1000).toFixed(1)} giây</b>. Số giây càng ngắn là phản xạ càng thật.` : 'Không sao, nói nhiều sẽ nhanh dần.'}</p><button class="big" id="h">Về trang chính</button></div>`; $('#h').onclick = home; return; }
    const it = items[i];
    app().innerHTML = `<div class="top"><button class="x" id="out">✕</button><div class="bar"><i style="width:${100 * i / items.length}%"></i></div><span class="cnt">${i + 1}/${items.length}</span></div>
    <div class="card"><p class="tag">Nói thẳng bằng tiếng Anh, không dịch</p><p class="tinh">${esc(it.tinh)}</p>
    <div class="mic" id="mic"><div class="lv" id="lv"></div><span id="ms">Bấm để bắt đầu</span></div><div id="fb"></div>
    <button class="link" id="skip">Bỏ qua câu này</button></div>`;
    $('#out').onclick = () => { if (REC.stop) REC.stop(); home(); };
    $('#skip').onclick = () => { if (REC.stop) REC.stop(); i++; show(); };
    const go = async () => {
      $('#mic').onclick = null;
      try { await micStart(); } catch (e) { $('#fb').innerHTML = `<p class="err">Chưa mở được micro. Trên iPhone hãy cho phép micro trong cài đặt trình duyệt. (${esc(e.message)})</p>`; return; }
      const t0 = Date.now(); $('#mic').classList.add('on'); $('#ms').textContent = 'Nói đi…';
      const r = await recordOnce(t0, v => { const l = $('#lv'); if (l) l.style.transform = `scale(${1 + v})`; });
      $('#mic').classList.remove('on'); if (!$('#ms')) return;
      if (!r.wav || r.ms == null) { $('#ms').textContent = 'Chưa nghe thấy gì. Bấm để thử lại'; $('#mic').onclick = go; return; }
      $('#ms').textContent = 'Đang nghe lại…';
      const a = await api('/api/nghe', { audio: r.wav }).catch(e => ({ error: e.message }));
      if (a.error) { $('#ms').textContent = 'Bấm để thử lại'; $('#fb').innerHTML = `<p class="err">${esc(a.error)}${ONLINE ? '' : ' Phần nói cần có mạng.'}</p>`; $('#mic').onclick = go; return; }
      const ck = E.noiCheck(it, a.text); E.noiResult(it, ck.ok, r.ms); saveLocal(); res.push({ ok: ck.ok, ms: r.ms });
      $('#ms').textContent = (r.ms / 1000).toFixed(1) + ' giây';
      $('#fb').innerHTML = `<div class="fb ${ck.ok ? 'ok' : 'no'}"><p class="sub">Máy nghe được:</p><p class="en">${esc(a.text || '(không rõ)')}</p>
        <p class="msg">${ck.ok ? 'Đúng rồi!' : 'Chưa khớp. Một cách nói đúng:'}</p>${ck.ok ? '' : `<p class="en">${esc(it.dap[0])}</p>`}
        <div class="row"><button id="nn">🔊 Nghe câu mẫu</button><button id="again">Nói lại</button></div><button class="big" id="nx">Tiếp →</button></div>`;
      $('#nn').onclick = () => it.sid ? say(it.sid) : sayText(it.dap[0]); $('#again').onclick = () => show(); $('#nx').onclick = () => { i++; show(); };
    };
    $('#mic').onclick = go;
    if (REC.stream) go();
  };
  show();
}

// ---------- kể chuyện cuối ngày ----------
async function ke() {
  app().innerHTML = `<div class="top"><button class="x" id="out">✕</button><span class="cnt">Kể chuyện cuối ngày</span></div><div class="card">
  <p>Kể 3–5 câu bằng tiếng Anh về ngày hôm nay của bạn. Sai thoải mái, AI sẽ sửa, và câu nào bị sửa sẽ thành bài đoán của ngày mai.</p>
  <textarea id="tx" rows="6" placeholder="Today I went to the market. I buy some vegetables…"></textarea>
  <div class="row"><button id="mic2">🎙️ Nói thay vì gõ</button></div><button class="big" id="go">Nhờ sửa</button><div id="fb"></div></div>`;
  $('#out').onclick = home;
  $('#mic2').onclick = async () => { try { await micStart(); } catch (e) { return toast('Chưa mở được micro'); } $('#mic2').textContent = '● Đang nghe… bấm để dừng'; let stopped = false; $('#mic2').onclick = () => { stopped = true; REC.stop && REC.stop(); };
    const r = await new Promise(res => { REC.buf = []; REC.on = true; REC.tick = null; REC.stop = () => { REC.on = false; res({ wav: wav16(REC.buf, REC.ctx.sampleRate) }); }; setTimeout(() => REC.stop && REC.on && REC.stop(), 45000); });
    $('#mic2').textContent = 'Đang chuyển thành chữ…'; const a = await api('/api/nghe', { audio: r.wav }).catch(() => ({}));
    if (a.text) $('#tx').value = ($('#tx').value + ' ' + a.text).trim(); $('#mic2').textContent = '🎙️ Nói thêm'; $('#mic2').onclick = () => ke(); };
  $('#go').onclick = async () => {
    const t = $('#tx').value.trim(); if (t.length < 3) return toast('Viết vài câu trước đã'); if (!ONLINE) return toast('Phần này cần có mạng');
    $('#go').disabled = true; $('#go').textContent = 'AI đang sửa…';
    const r = await api('/api/sua', { text: t, day: DC.dayKey(Date.now(), -new Date().getTimezoneOffset()) }).catch(e => ({ error: e.message }));
    $('#go').disabled = false; $('#go').textContent = 'Nhờ sửa';
    if (r.error) return $('#fb').innerHTML = `<p class="err">${esc(r.error)}</p>`;
    const n = r.bai && r.bai.length ? E.addUser(r.bai) : 0; saveLocal(); pushState();
    $('#fb').innerHTML = `<div class="list">${r.cau.map(x => `<div class="li col"><p class="sub">Bạn viết: ${esc(x.goc)}</p><p class="en">${x.doi && x.doi.length ? esc(x.sua) : esc(x.sua) + ' ✓'}</p><p class="vi">${esc(x.vi)}</p>${x.doi && x.doi.length ? `<p class="sub">${x.doi.map(d => `<s>${esc(d.sai)}</s> → <b>${esc(d.dung)}</b>`).join(' · ')}</p>` : ''}</div>`).join('')}</div>
      <p class="msg">${n ? `Đã thêm ${n} câu vào bài đoán của ngày mai.` : 'Câu của bạn đã đúng hết, giỏi lắm!'}</p>`;
  };
}

// ---------- tiến bộ ----------
function tienbo() {
  const s = E.stats(); const w = s.weeks.slice(-8);
  const chart = (key, label, unit, inv) => { const pts = w.map(x => x[key]).filter(x => x != null); if (!pts.length) return `<p class="sub">${label}: chưa có số liệu</p>`;
    const mx = Math.max(...pts) * 1.15 || 1, W = 300, H = 120, n = w.length; const xy = w.map((x, i) => x[key] == null ? null : [20 + (n === 1 ? (W - 40) / 2 : i * (W - 40) / (n - 1)), H - 18 - (x[key] / mx) * (H - 36)]);
    const line = xy.filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return `<h3>${label}</h3><svg viewBox="0 0 ${W} ${H}" class="chart"><path d="${line}"/>${xy.map((p, i) => p ? `<circle cx="${p[0]}" cy="${p[1]}" r="4"/><text x="${p[0]}" y="${p[1] - 9}">${w[i][key]}${unit}</text><text x="${p[0]}" y="${H - 3}" class="d">${w[i].tuan.slice(8, 10)}/${w[i].tuan.slice(5, 7)}</text>` : '').join('')}</svg><p class="sub">${inv ? 'Càng thấp càng tốt' : 'Càng cao càng tốt'}</p>`; };
  app().innerHTML = `<div class="top"><button class="x" id="out">✕</button><span class="cnt">Tiến bộ theo tuần</span></div><div class="card">
  <div class="stats"><div><b>${s.streak}</b><span>ngày liền</span></div><div><b>${s.known}</b><span>khuôn đã thuộc</span></div><div><b>${s.due}</b><span>câu tới hẹn</span></div></div>
  ${chart('dung', 'Tỷ lệ đoán đúng', '%')}${chart('giay', 'Số giây mỗi câu đoán đúng', 's', true)}${chart('noi', 'Số giây trước khi mở miệng nói', 's', true)}</div>`;
  $('#out').onclick = home;
}

// ---------- cài đặt ----------
function caidat() {
  app().innerHTML = `<div class="top"><button class="x" id="out">✕</button><span class="cnt">Cài đặt</span></div><div class="card">
  <h3>Nghề của bạn</h3><select id="job">${Object.entries(NGHE).map(([k, v]) => `<option value="${k}" ${E.S.job === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
  <h3>Mục tiêu mỗi ngày</h3><select id="goal">${[20, 40, 60, 80, 120].map(g => `<option ${E.S.goal === g ? 'selected' : ''} value="${g}">${g} câu</option>`).join('')}</select>
  <h3>Tốc độ giọng đọc</h3><select id="toc">${[[0.8, 'Chậm'], [1, 'Bình thường'], [1.15, 'Nhanh']].map(([v, t]) => `<option value="${v}" ${Number(localStorage.getItem('toc') || 1) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
  <h3>Đổi mã PIN</h3><input id="np" type="password" inputmode="numeric" maxlength="8" placeholder="Mã PIN mới"><button id="sp">Đổi</button>
  <button class="big" id="sv">Lưu</button><button class="link" id="lo">Đăng xuất trên máy này</button>
  <p class="sub">Phiên bản __VER__ · Danh sách từ thông dụng theo New General Service List (Browne, Culligan & Phillips, CC BY-SA 4.0).</p></div>`;
  $('#out').onclick = home;
  $('#sv').onclick = () => { E.S.job = $('#job').value; E.S.goal = Number($('#goal').value); localStorage.setItem('toc', $('#toc').value); E.S.updated = Date.now(); saveLocal(); pushState(); toast('Đã lưu'); home(); };
  $('#sp').onclick = async () => { const r = await api('/api/pin', { pin: $('#np').value.trim() }); toast(r.error || 'Đã đổi mã PIN'); };
  $('#lo').onclick = async () => { await pushState(); await api('/api/logout', {}); localStorage.removeItem('tk'); location.reload(); };
}

// ---------- khởi động ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
(TK() ? loadAll() : lock()).catch(e => { app().innerHTML = `<div class="card mid"><p class="err">Chưa mở được: ${esc(e.message)}</p><button class="big" onclick="location.reload()">Thử lại</button></div>`; });
