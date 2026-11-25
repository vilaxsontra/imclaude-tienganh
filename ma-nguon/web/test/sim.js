// Người học ảo 30 ngày — kiểm động cơ học có làm đúng phương pháp không.
// node test/sim.js [kho.json]
const DC = require('../src/dongco.js');
const fs = require('fs');
const khoPath = process.argv[2];
let kho;
if (khoPath) kho = JSON.parse(fs.readFileSync(khoPath, 'utf8'));
else { // kho giả từ danh sách khuôn
  const khung = JSON.parse(fs.readFileSync(__dirname + '/../../kho/khung.json', 'utf8'));
  kho = { loi: JSON.parse(fs.readFileSync(__dirname + '/../../kho/loi.json', 'utf8')), k: [], c: {}, nghe: {} };
  for (const k of khung) {
    const e = { id: k.id, lv: k.lv, ten: k.ten, a: [], b: [], noi: [{ id: k.id + 'n1', tinh: 'x', dap: ['I want tea'] }] };
    for (const part of ['a', 'b']) for (let i = 1; i <= (part === 'a' ? 8 : 6); i++) { const sid = k.id + part + i; kho.c[sid] = { k: k.id, en: `S ${sid} {w${i}} x.`, vi: 'v', o: 'w' + i, sai: [['z' + i, k.loi[0]], ['y' + i, k.loi[1] || k.loi[0]]], khac: [], tc: 500 }; e[part].push(sid); }
    kho.k.push(e);
  }
}
let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let T = Date.UTC(2026, 0, 5, 1, 0, 0); const DAY = 86400e3;
const E = DC.Engine(kho, DC.newState(), { now: () => T, rand, tz: 420 });
// mô hình người học: mỗi khuôn có độ thạo tăng khi gặp, quên dần theo thời gian
const mem = {}; // k -> {str, last}
function pCorrect(k, mode) {
  const m = mem[k] || { str: 0, last: T };
  const days = (T - m.last) / DAY; const keep = Math.exp(-days / (1 + m.str * 1.5));
  let p = 0.25 + 0.7 * (1 - Math.exp(-m.str / 2.5)) * keep;
  if (mode === 'chon2') p += 0.2; if (mode === 'go') p -= 0.1; if (mode === 'nghe') p -= 0.05;
  return Math.max(0.05, Math.min(0.98, p));
}
function learn(k, amt) { const m = mem[k] ||= { str: 0, last: T }; m.str += amt; m.last = T; }
const fail = []; const ok = (c, msg) => { if (!c) fail.push(msg); };

// kiểm tra đầu vào: người mới gần như không biết gì
const pl = E.placementItems(); const res = pl.slice(0, 8).map(it => ({ pi: it.pi, ok: rand() < (it.pi < 10 ? 0.6 : 0.2) }));
const P = E.applyPlacement(res); ok(P.p <= 15, 'người mới bị xếp quá cao: ' + P.p);

let sameFrameReview = 0, reviews = 0, prevK = '', follows = 0, followSame = 0, explains = 0, wrongs = 0;
const perDay = [];
for (let day = 0; day < 30; day++) {
  T = Date.UTC(2026, 0, 5 + day, 12, 0, 0);
  const goal = 40; let n = 0, c = 0, xem = 0; E.sess.q.length = 0; Object.keys(E.sess.shownNow).forEach(k => delete E.sess.shownNow[k]); E.sess.n = 0; E.sess.learnSince = 0;
  let pendingFollow = 0, wrongK = '';
  while (n < goal) {
    const st = E.next(); T += 8000;
    if (st.type === 'xong') break;
    if (st.type === 'xem') { xem++; learn(st.k, 1.2); continue; }
    if (pendingFollow > 0) { follows++; if (E.cOf(st.sid).k === wrongK) followSame++; pendingFollow--; }
    if (st.why === 'on') { reviews++; if (E.cOf(st.sid).k === prevK) sameFrameReview++; }
    prevK = E.cOf(st.sid).k;
    const cc = E.cOf(st.sid); const right = rand() < pCorrect(cc.k, st.mode);
    const given = right ? cc.o : (cc.sai[0] || ['zz'])[0];
    const r = E.answer(st, given, 3000 + rand() * 4000);
    learn(cc.k, right ? 0.5 : 0.8);
    n++; if (r.ok) c++; else { wrongs++; pendingFollow = r.follow; wrongK = cc.k; ok(r.follow >= 2, 'sai mà không có câu cùng kiểu: ' + st.sid); }
    if (r.explain) explains++;
  }
  const s = E.stats();
  perDay.push({ day: day + 1, n, acc: n ? Math.round(100 * c / n) : 0, xem, known: s.known, due: s.due });
}
console.table(perDay);
const late = perDay.slice(5); const avg = late.reduce((a, x) => a + x.acc, 0) / late.length;
console.log({ avgAccAfterDay5: Math.round(avg), reviews, sameFrameReview, follows, followSame, explains, wrongs, streak: E.stats().streak });
ok(avg >= 70 && avg <= 92, 'độ đúng trung bình không giữ trong khoảng 70–92%: ' + avg);
ok(perDay[29].known > perDay[3].known, 'không tiến bộ qua các khuôn');
ok(followSame === follows, 'câu sửa không cùng khuôn');
ok(explains > 0, 'không bao giờ giải thích sau 3 lần sai');
ok(reviews > 0 && sameFrameReview / reviews < 0.35, 'ôn không trộn khuôn: ' + sameFrameReview + '/' + reviews);
ok(E.stats().streak >= 29, 'chuỗi ngày sai: ' + E.stats().streak);
// câu sai phải quay lại sau khoảng 1 ngày
const wrongCard = Object.entries(E.S.cards).find(([s, c]) => c.lapses && c.last);
if (wrongCard) ok(wrongCard[1].due - wrongCard[1].last <= DAY * 1.01 || wrongCard[1].reps > 0, 'câu sai không hẹn lại trong 1 ngày');
// nói thẳng có câu sau khi thuộc khuôn
ok(E.noiItems(3).length > 0, 'không có câu nói thẳng');
console.log(fail.length ? 'LỖI:\n- ' + fail.join('\n- ') : 'ĐẠT tất cả');
process.exit(fail.length ? 1 : 0);
