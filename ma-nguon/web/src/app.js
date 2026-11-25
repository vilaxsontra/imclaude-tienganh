// ===== GIAO DIỆN — Tiếng Anh theo cách AI học =====
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = () => $('#app');
const TK = () => localStorage.getItem('tk') || '';
let KHO = null, E = null, SYNC_T = null, ONLINE = navigator.onLine, MODE = 'pin', CLIENT = '';
const MAY = localStorage.getItem('may') || (() => { const m = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('may', m); return m; })();
const CHUNG = () => MODE === 'google';
const INAPP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Zalo|Line\/|musical_ly|BytedanceWebview|TikTok|Messenger/i.test(navigator.userAgent);
const ANDROID = /Android/i.test(navigator.userAgent);
const NGHE = { ban_hang: 'Bán hàng, kinh doanh', van_phong: 'Văn phòng', nong_nghiep: 'Làm vườn, trồng trọt, chăn nuôi', bat_dong_san: 'Môi giới nhà đất', nha_hang: 'Nhà hàng, quán cà phê, nấu ăn', lai_xe: 'Lái xe, giao hàng', y_te: 'Y tế, nhà thuốc', tho_ky_thuat: 'Thợ, kỹ thuật, xây dựng', giao_vien: 'Giáo viên', hoc_sinh: 'Học sinh, sinh viên', du_lich: 'Du lịch, khách sạn, đi nước ngoài', noi_tro: 'Nội trợ, gia đình' };

async function api(p, body, opt = {}) {
  const r = await fetch(p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-tk': TK(), 'x-may': MAY }, body: body ? JSON.stringify(body) : undefined, keepalive: !!opt.keep });
  let j = {}; try { j = await r.json(); } catch { }
  if (r.status === 401 && !opt.noLogout && TK()) { localStorage.removeItem('tk'); if (!CHUNG()) location.reload(); }
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
  let remote = null; if (TK()) try { const r = await api('/api/tt'); if (r.doc) remote = r.doc; if (r.me) localStorage.setItem('me', r.me.email || ''); } catch { }
  const st = DC.merge(local, remote); // gộp: học lúc chưa đăng nhập hay trên máy khác đều không mất
  E = DC.Engine(KHO, st || DC.newState(), {});
  if (remote && local && (E.S.updated || 0) > (remote.updated || 0)) pushState();
  saveLocal();
  if (!E.S.placed) onboard(); else home();
  if (!CHUNG()) setTimeout(taiGiong, 3000);
}
// chép dần giọng đọc từ nguồn về máy chủ riêng của bạn (mỗi lần một gói nhỏ), để web chạy độc lập
async function taiGiong() {
  const n = KHO.goi || 0; let done = Number(localStorage.getItem('am_done') || 0);
  for (let i = done; i < n; i++) { if (!ONLINE) return; const r = await api('/api/tai?n=' + i, null, { noLogout: true }).catch(() => ({ error: 1 })); if (r.error) return setTimeout(taiGiong, 60e3); localStorage.setItem('am_done', String(i + 1)); }
}

// ---------- đăng nhập Gmail (web chung) ----------
function loadGsi() { return new Promise((ok, no) => { if (window.google && google.accounts) return ok(); const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = () => ok(); sc.onerror = () => no(new Error('Không tải được nút Google')); document.head.appendChild(sc); }); }
async function onCred(resp) {
  const r = await api('/api/vao', { credential: resp.credential }, { noLogout: true });
  if (r.error) return toast(r.error, 4000);
  localStorage.setItem('tk', r.token); localStorage.setItem('me', r.email || '');
  const rr = await api('/api/tt'); const m = DC.merge(E ? E.S : null, rr.doc);
  E = DC.Engine(KHO, m || DC.newState(), {}); saveLocal(); await pushState();
  toast('Đã đăng nhập ' + (r.email || ''), 3000); if (E.S.placed) home(); else onboard();
}
function loginBox(el, why) {
  if (!el) return;
  if (INAPP) {
    const u = location.origin + '/';
    el.innerHTML = `<div class="why"><p>${why ? esc(why) + ' ' : ''}Bạn đang mở trong ứng dụng (Facebook, TikTok, Zalo…), Google không cho đăng nhập ở đây.</p><p><b>Bấm nút ⋯ ở góc trên, chọn "Mở bằng trình duyệt"</b>, rồi đăng nhập. Tiến độ bạn vừa học vẫn còn nếu mở lại đúng trình duyệt đó.</p>
      <div class="row"><button id="mo">${ANDROID ? 'Mở bằng Chrome' : 'Mở bằng Safari'}</button><button id="cp">Chép link</button></div></div>`;
    el.querySelector('#mo').onclick = () => { location.href = ANDROID ? `intent://${location.host}/#Intent;scheme=https;package=com.android.chrome;end` : `x-safari-https://${location.host}/`; };
    el.querySelector('#cp').onclick = () => { const t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { } t.remove(); if (!ok && navigator.clipboard) navigator.clipboard.writeText(u).then(() => toast('Đã chép link')); else toast(ok ? 'Đã chép link, dán vào Chrome hoặc Safari' : u); };
    return;
  }
  el.innerHTML = `${why ? `<p>${esc(why)}</p>` : ''}<div class="gbtn"></div><p class="sub">Chỉ dùng để giữ tiến độ học của bạn trên mọi máy. <a href="/rieng-tu">Lưu những gì?</a></p>`;
  loadGsi().then(() => { google.accounts.id.initialize({ client_id: CLIENT, callback: onCred, ux_mode: 'popup', auto_select: false, use_fedcm_for_button: true }); google.accounts.id.renderButton(el.querySelector('.gbtn'), { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'vi', width: 280 }); })
    .catch(e => { el.querySelector('.gbtn').innerHTML = `<p class="err">${esc(e.message)}. Kiểm tra mạng rồi thử lại.</p>`; });
}
function dangNhap() {
  app().innerHTML = `<div class="top"><button class="x" id="out">✕</button><span class="cnt">Đăng nhập</span></div><div class="card mid"><h2>Giữ tiến độ học</h2><p>Đăng nhập Gmail để học tiếp trên mọi máy, mọi trình duyệt. Những gì bạn đã học sẽ được giữ nguyên.</p><div id="lg"></div></div>`;
  $('#out').onclick = home; loginBox($('#lg'));
}

// ---------- âm thanh ----------
const AU = new Audio(); let AU_T = null, AU_N = 0; const BLOB = new Map();
// iPhone chỉ cho phát tiếng sau một lần chạm: lần chạm đầu tiên phát một đoạn im lặng để mở khoá
const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAABwAAA2AAVVVVVVVVVVVVVVVVVVVxcXFxcXFxcXFxcXFxcY6Ojo6Ojo6Ojo6Ojo6Oqqqqqqqqqqqqqqqqqqqqx8fHx8fHx8fHx8fHx8fj4+Pj4+Pj4+Pj4+Pj4///////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQEIAAAAAAAAANgmVBi7QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
addEventListener('pointerdown', function un() { removeEventListener('pointerdown', un, true); try { AU.src = SILENT; const p = AU.play(); if (p) p.catch(() => { }); } catch { } }, true);
function amUrl(sid) { const c = E.cOf(sid); return c && c.am != null ? `/am/${c.am}/${sid}.mp3` : null; }
async function blobFor(u) { // tải tệp tiếng thành blob: chạy ổn trên mọi trình duyệt, và đi qua bộ nhớ máy nên mất mạng vẫn nghe
  if (BLOB.has(u)) return BLOB.get(u);
  const r = await fetch(u); if (!r.ok) throw new Error('âm ' + r.status); const b = URL.createObjectURL(await r.blob());
  BLOB.set(u, b); if (BLOB.size > 60) { const k = BLOB.keys().next().value; URL.revokeObjectURL(BLOB.get(k)); BLOB.delete(k); } return b;
}
function say(sid, untilMs) {
  clearTimeout(AU_T); AU.pause(); window.speechSynthesis && speechSynthesis.cancel();
  const u = amUrl(sid); const c = E.cOf(sid); const my = ++AU_N;
  if (u) { blobFor(u).then(b => { if (my !== AU_N) return; AU.src = b; AU.currentTime = 0; AU.playbackRate = Number(localStorage.getItem('toc') || 1); const pr = AU.play(); if (pr) pr.catch(() => { });
      if (untilMs) { const stop = () => { AU_T = setTimeout(() => AU.pause(), untilMs / AU.playbackRate); AU.removeEventListener('playing', stop); }; AU.addEventListener('playing', stop); } })
      .catch(() => { if (my === AU_N && c && window.speechSynthesis) { const ut = new SpeechSynthesisUtterance(plain(c.en)); ut.lang = 'en-US'; ut.rate = 0.9; speechSynthesis.speak(ut); } }); return; }
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
  <p class="sub">${s.known}/${s.total} khuôn câu đã thuộc · ${s.due} câu tới hẹn ôn${canNoi ? '' : ' · Nói thẳng mở khi bạn thuộc khuôn đầu tiên'}</p>${ONLINE ? '' : '<p class="sub">Đang không có mạng, vẫn học được bình thường.</p>'}</div>
  ${CHUNG() && !TK() ? `<div class="card hint"><p><b>Đăng nhập Gmail</b> để giữ tiến độ khi đổi máy hoặc đổi trình duyệt.</p><button id="dn">Đăng nhập</button></div>` : ''}`;
  if ($('#dn')) $('#dn').onclick = dangNhap;
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
  <button class="big" id="h">Về trang chính</button></div>${CHUNG() && !TK() ? '<div class="card mid"><p><b>Đăng nhập Gmail để giữ kết quả này</b>, mai học tiếp trên máy nào cũng được.</p><div id="lg"></div></div>' : ''}`; $('#h').onclick = home; SESS = null;
  if ($('#lg')) loginBox($('#lg'));
}

// ---------- nói thẳng ----------
const REC = { ctx: null, stream: null, node: null, buf: [], on: false };
async function micStart() {
  if (!REC.stream) REC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  if (!REC.ctx) { REC.ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = REC.ctx.createMediaStreamSource(REC.stream); REC.node = REC.ctx.createScriptProcessor(4096, 1, 1); src.connect(REC.node); REC.node.connect(REC.ctx.destination); REC.node.onaudioprocess = e => { if (!REC.on) return; const d = e.inputBuffer.getChannelData(0); REC.buf.push(new Float32Array(d)); REC.tick && REC.tick(d); }; }
  if (REC.ctx.state === 'suspended') await REC.ctx.resume();
}
function micStop() { // tắt micro: iPhone và nhiều máy Android chỉ trả tiếng về loa ngoài khi micro đã tắt
  try { REC.stream && REC.stream.getTracks().forEach(t => t.stop()); } catch { } try { REC.ctx && REC.ctx.close(); } catch { }
  REC.stream = null; REC.ctx = null; REC.node = null; REC.on = false;
}
function wavUrl(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([u], { type: 'audio/wav' })); }
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
    const finish = () => { if (!REC.on) return; REC.on = false; REC.tick = null; const wav = REC.buf.length && REC.ctx ? wav16(REC.buf, REC.ctx.sampleRate) : ''; micStop(); resolve({ wav, ms: speechAt ? speechAt - t0 : null }); };
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
    $('#out').onclick = () => { if (REC.stop) REC.stop(); micStop(); home(); };
    $('#skip').onclick = () => { if (REC.stop) REC.stop(); micStop(); i++; show(); };
    const t0 = Date.now(); // đo từ lúc thấy tình huống tới lúc mở miệng
    const go = async () => {
      $('#mic').onclick = null;
      try { await micStart(); } catch (e) { micStop(); $('#fb').innerHTML = `<p class="err">Chưa mở được micro. Trên iPhone hãy cho phép micro trong cài đặt trình duyệt. (${esc(e.message)})</p>`; $('#mic').onclick = go; return; }
      $('#mic').classList.add('on'); $('#ms').textContent = 'Nói đi…';
      const r = await recordOnce(t0, v => { const l = $('#lv'); if (l) l.style.transform = `scale(${1 + v})`; });
      $('#mic').classList.remove('on'); if (!$('#ms')) return;
      if (!r.wav || r.ms == null) { $('#ms').textContent = 'Chưa nghe thấy gì. Bấm để thử lại'; $('#mic').onclick = go; return; }
      $('#ms').textContent = 'Đang nghe lại…';
      const a = await api('/api/nghe', { audio: r.wav }).catch(e => ({ error: e.message }));
      if (a.error) { $('#ms').textContent = 'Bấm để thử lại'; $('#fb').innerHTML = `<p class="err">${esc(a.error)}${ONLINE ? '' : ' Phần nói cần có mạng.'}</p>${a.code === 'khach' ? '<div id="lg"></div>' : ''}`; if ($('#lg')) loginBox($('#lg')); $('#mic').onclick = go; return; }
      const myUrl = wavUrl(r.wav);
      const ck = E.noiCheck(it, a.text); E.noiResult(it, ck.ok, r.ms); saveLocal(); res.push({ ok: ck.ok, ms: r.ms });
      $('#ms').textContent = (r.ms / 1000).toFixed(1) + ' giây';
      $('#fb').innerHTML = `<div class="fb ${ck.ok ? 'ok' : 'no'}"><p class="sub">Máy nghe được:</p><p class="en">${esc(a.text || '(không rõ)')}</p>
        <p class="msg">${ck.ok ? 'Đúng rồi!' : 'Chưa khớp. Một cách nói đúng:'}</p>${ck.ok ? '' : `<p class="en">${esc(it.dap[0])}</p>`}
        <div class="row"><button id="me">🔁 Giọng mình</button><button id="nn">🔊 Câu mẫu</button></div><div class="row"><button id="ss">So sánh: mình rồi mẫu</button><button id="again">Nói lại</button></div><button class="big" id="nx">Tiếp →</button></div>`;
      const mau = () => it.sid ? say(it.sid) : sayText(it.dap[0]);
      const mine = after => { clearTimeout(AU_T); AU.pause(); AU_N++; AU.onended = after || null; AU.src = myUrl; AU.currentTime = 0; AU.playbackRate = 1; const pr = AU.play(); if (pr) pr.catch(() => { }); };
      $('#me').onclick = () => mine(); $('#nn').onclick = () => { AU.onended = null; mau(); };
      $('#ss').onclick = () => mine(() => { AU.onended = null; setTimeout(mau, 350); });
      $('#again').onclick = () => show(); $('#nx').onclick = () => { AU.onended = null; i++; show(); };
    };
    $('#mic').onclick = go;
  };
  show();
}

// ---------- kể chuyện cuối ngày ----------
async function ke() {
  if (CHUNG() && !TK()) {
    app().innerHTML = `<div class="top"><button class="x" id="out">✕</button><span class="cnt">Kể chuyện cuối ngày</span></div><div class="card mid"><h2>AI sửa câu bạn tự kể</h2><p>Phần này dùng AI nên cần đăng nhập Gmail, mỗi ngày được vài lượt miễn phí.</p><div id="lg"></div></div>`;
    $('#out').onclick = home; loginBox($('#lg')); return;
  }
  app().innerHTML = `<div class="top"><button class="x" id="out">✕</button><span class="cnt">Kể chuyện cuối ngày</span></div><div class="card">
  <p>Kể 3–5 câu bằng tiếng Anh về ngày hôm nay của bạn. Sai thoải mái, AI sẽ sửa, và câu nào bị sửa sẽ thành bài đoán của ngày mai.</p>
  <textarea id="tx" rows="6" placeholder="Today I went to the market. I buy some vegetables…"></textarea>
  <div class="row"><button id="mic2">🎙️ Nói thay vì gõ</button></div><button class="big" id="go">Nhờ sửa</button><div id="fb"></div></div>`;
  $('#out').onclick = home;
  $('#mic2').onclick = async () => { try { await micStart(); } catch (e) { return toast('Chưa mở được micro'); } $('#mic2').textContent = '● Đang nghe… bấm để dừng'; let stopped = false; $('#mic2').onclick = () => { stopped = true; REC.stop && REC.stop(); };
    const r = await new Promise(res => { REC.buf = []; REC.on = true; REC.tick = null; REC.stop = () => { REC.on = false; res({ wav: wav16(REC.buf, REC.ctx.sampleRate) }); }; setTimeout(() => REC.stop && REC.on && REC.stop(), 45000); });
    $('#mic2').textContent = 'Đang chuyển thành chữ…'; const a = await api('/api/nghe', { audio: r.wav }).catch(() => ({}));
    micStop(); if (a.error) toast(a.error, 4000);
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
  ${CHUNG() ? (TK() ? `<h3>Tài khoản</h3><p>${esc(localStorage.getItem('me') || 'Đã đăng nhập')}</p><div class="row"><button id="lo2">Đăng xuất</button><button id="xoa">Xoá tài khoản</button></div><p class="sub"><a href="/rieng-tu">Web lưu những gì về bạn?</a></p>` : `<h3>Tài khoản</h3><div id="lg"></div>`)
    : `<h3>Đổi mã PIN</h3><input id="np" type="password" inputmode="numeric" maxlength="8" placeholder="Mã PIN mới"><button id="sp">Đổi</button>`}
  <button class="big" id="sv">Lưu</button>${CHUNG() ? '' : '<button class="link" id="lo">Đăng xuất trên máy này</button>'}
  <p class="sub">Phiên bản __VER__ · Danh sách từ thông dụng theo New General Service List (Browne, Culligan & Phillips, CC BY-SA 4.0).</p></div>`;
  $('#out').onclick = home;
  $('#sv').onclick = () => { E.S.job = $('#job').value; E.S.goal = Number($('#goal').value); localStorage.setItem('toc', $('#toc').value); E.S.updated = Date.now(); saveLocal(); pushState(); toast('Đã lưu'); home(); };
  if ($('#sp')) $('#sp').onclick = async () => { const r = await api('/api/pin', { pin: $('#np').value.trim() }); toast(r.error || 'Đã đổi mã PIN'); };
  if ($('#lo')) $('#lo').onclick = async () => { await pushState(); await api('/api/logout', {}); localStorage.removeItem('tk'); location.reload(); };
  if ($('#lg')) loginBox($('#lg'));
  const xoaMay = () => { ['tk', 'me', 'tt', 'tt_sync'].forEach(k => localStorage.removeItem(k)); location.reload(); };
  if ($('#lo2')) $('#lo2').onclick = async () => { await pushState(); await api('/api/logout', {}, { noLogout: true }); xoaMay(); };
  if ($('#xoa')) $('#xoa').onclick = async () => {
    const b = $('#xoa'); if (!b.dataset.c) { b.dataset.c = 1; b.textContent = 'Bấm lần nữa để xoá hẳn'; b.classList.add('danger'); return; }
    const r = await api('/api/xoa', {}, { noLogout: true }); if (r.error) return toast(r.error); toast('Đã xoá toàn bộ dữ liệu'); setTimeout(xoaMay, 800);
  };
}

// ---------- khởi động ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
(async () => { const s = await api('/api/state', null, { noLogout: true }); MODE = s.mode || 'pin'; CLIENT = s.client || ''; return (CHUNG() || TK()) ? loadAll() : lock(); })().catch(e => { app().innerHTML = `<div class="card mid"><p class="err">Chưa mở được: ${esc(e.message)}</p><button class="big" onclick="location.reload()">Thử lại</button></div>`; });
