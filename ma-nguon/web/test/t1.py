#!/usr/bin/env python3
"""Kiểm thử giao diện web học: Android (Chromium) + iPhone (WebKit). python3 test/t1.py [URL]"""
import sys, json, time, re, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8787'
LIVE = '127.0.0.1' not in URL and 'localhost' not in URL
OUT = os.path.join(os.path.dirname(__file__), 'shots'); os.makedirs(OUT, exist_ok=True)
R = []
CUR = []
def ok(c, m): R.append((bool(c), m)); print(('ĐẠT ' if c else 'LỖI ') + m, flush=True)

def mocks(ctx):
    if LIVE: return
    def nghe(route):
        # trả lại đúng câu mẫu của tình huống đang hiện
        route.fulfill(json={'text': ctx._say or 'I want to drink tea.'})
    ctx.route('**/api/nghe', nghe)
    ctx.route('**/api/sua', lambda r: r.fulfill(json={'cau': [{'goc': 'She want to drink coffee.', 'sua': 'She wants to drink coffee.', 'vi': 'Cô ấy muốn uống cà phê.', 'doi': [{'sai': 'want', 'dung': 'wants', 'loai': 'thieu_s'}], 'kiem': True}, {'goc': 'I am happy.', 'sua': 'I am happy.', 'vi': 'Tôi vui.', 'doi': [], 'kiem': True}], 'bai': [{'en': 'She {wants} to drink coffee.', 'vi': 'Cô ấy muốn uống cà phê.', 'o': 'wants', 'sai': [['want', 'thieu_s']], 'khac': []}]}))
    ctx.route('**/api/nghe-nghiep', lambda r: r.fulfill(json={'job': 'ban_hang'}))

def run(pw, kind):
    tag = 'android' if kind == 'c' else 'iphone'
    dev = pw.devices['Pixel 7'] if kind == 'c' else pw.devices['iPhone 13']
    ca = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] + (['--use-file-for-fake-audio-capture=/tmp/noi_k010.wav'] if LIVE else [])
    br = (pw.chromium if kind == 'c' else pw.webkit).launch(args=ca if kind == 'c' else [])
    ctx = br.new_context(**dev, permissions=['microphone'] if kind == 'c' else [], **({} if kind == 'c' or LIVE else {'service_workers': 'block'})); ctx._say = ''
    mocks(ctx)
    errs = []; pg = ctx.new_page(); CUR[:] = [pg]; pg.on('pageerror', lambda e: errs.append(str(e)))
    am = []; pg.on('response', lambda r: am.append(r.status) if '/am/' in r.url else None)
    pg.goto(URL); pg.wait_for_selector('#pin')
    first = pg.locator('#pin2').count() > 0
    pin = '2468'
    if first:
        pg.click('#pin'); pg.keyboard.type(pin); pg.click('#pin2'); pg.keyboard.type('1357'); pg.click('#go')
        ok('giống' in pg.inner_text('#er'), f'{tag}: báo khi hai lần PIN khác nhau')
        pg.fill('#pin2', ''); pg.click('#pin2'); pg.keyboard.type(pin); pg.keyboard.press('Enter')
    else:
        pg.click('#pin'); pg.keyboard.type(pin); pg.keyboard.press('Enter')
    pg.wait_for_selector('#jobs, .ring', timeout=20000)
    if pg.locator('#jobs').count():
        ok(pg.locator('#next').is_disabled(), f'{tag}: chưa chọn nghề thì chưa cho kiểm tra')
        pg.click('text=Nghề khác…'); pg.fill('#mota', 'bán tạp hóa'); pg.click('#okk'); pg.wait_for_function("document.querySelector('#okk').textContent === 'Xong'", timeout=30000); pg.wait_for_timeout(300)
        ok(pg.locator('#jobs .opt.on').count() == 1, f'{tag}: nghề khác được ghép vào nghề gần nhất')
        pg.click('[data-g="20"]'); pg.click('#next')
        # kiểm tra đầu vào: trả lời đúng vài câu đầu rồi "Chưa biết"
        n = 0
        while pg.locator('.ans').count() and n < 40:
            txt = pg.inner_text('#app')
            if n < 4:
                sid = pg.evaluate("() => { const c = Object.values(KHO.c); return null }")
                # chọn đáp án đúng bằng động cơ
                o = pg.evaluate("() => { const it = E.placementItems(); return null }")
                btns = pg.locator('.ans:not(.skip)'); right = None
                for i in range(btns.count()):
                    t = btns.nth(i).inner_text()
                    if pg.evaluate("t => Object.values(KHO.c).some(c => c.o === t && document.querySelector('.en').textContent.replace(/\\s+/g,' ').includes(c.en.split('{')[0].trim().slice(0,12)))", t): right = btns.nth(i); break
                (right or btns.first).click()
            else: pg.click('.ans.skip')
            n += 1
            if pg.locator('#go').count(): break
        ok(pg.locator('text=Xong rồi!').count() == 1, f'{tag}: kiểm tra đầu vào dừng sớm khi sai liền ({n} câu)')
        ok(n <= 12, f'{tag}: kiểm tra đầu vào ngắn')
        pg.click('#go')
    else:
        pg.click('#hoc')
    # ---- màn xem ----
    pg.wait_for_selector('.list .li, .ans, #ty', timeout=10000)
    if pg.locator('.list .li').count():
        ok(pg.locator('.list .li').count() >= 6, f'{tag}: màn xem có bộ câu nén ({pg.locator(".list .li").count()} câu)')
        ok(pg.locator('.list mark').count() >= 5, f'{tag}: chỗ thay đổi được tô màu')
        ok(pg.locator('.list .vi').first.inner_text().strip() != '', f'{tag}: có câu tiếng Việt bên cạnh')
        pg.locator('.list .li').nth(1).click(); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{OUT}/{tag}-xem.png'); pg.click('#go')
    # ---- đoán: cố ý sai một câu ----
    pg.wait_for_selector('.ans, #ty')
    ok(pg.locator('.timer').count() == 1, f'{tag}: có thanh đếm giờ')
    pg.screenshot(path=f'{OUT}/{tag}-doan.png')
    def wrong_once():
        st = pg.evaluate('SESS.cur'); c = pg.evaluate('id => E.cOf(id)', st['sid'])
        if pg.locator('.ans').count():
            for i in range(pg.locator('.ans').count()):
                if pg.locator('.ans').nth(i).inner_text() != c['o']: pg.locator('.ans').nth(i).click(); break
        else: pg.fill('#ty', 'zzz'); pg.click('#chk')
        return st, c
    st, c = wrong_once()
    ok(pg.locator('.fb.no').count() == 1 and pg.locator('.opt.bad, input.bad').count() == 1, f'{tag}: sai thì tô đỏ và hiện chữ đúng')
    ok(pg.locator('.opt.good, .blank.filled').count() >= 1, f'{tag}: tô xanh chữ đúng')
    pg.screenshot(path=f'{OUT}/{tag}-sai.png'); pg.click('#nx'); pg.wait_for_selector('.ans, #ty')
    ok('cùng kiểu' in pg.inner_text('#app'), f'{tag}: ngay sau câu sai có câu cùng kiểu')
    nk = pg.evaluate('E.cOf(SESS.cur.sid).k')
    ok(nk == c['k'], f'{tag}: câu sửa cùng khuôn với câu sai')
    # ---- sai cùng kiểu 3 lần → giải thích ----
    saw_why = False
    for _ in range(6):
        cur = pg.evaluate('SESS.cur'); cc = pg.evaluate('id => E.cOf(id)', cur['sid'])
        if pg.locator('.ans').count():
            loai = c['sai'][0][1] if c['sai'] else ''
            target = None
            for s in cc['sai']:
                if s[1] == loai: target = s[0]
            target = target or (cc['sai'][0][0] if cc['sai'] else None)
            clicked = False
            for i in range(pg.locator('.ans').count()):
                if pg.locator('.ans').nth(i).inner_text() == target: pg.locator('.ans').nth(i).click(); clicked = True; break
            if not clicked: pg.locator('.ans').first.click()
        else: pg.fill('#ty', (cc['sai'][0][0] if cc['sai'] else 'x')); pg.click('#chk')
        pg.wait_for_selector('#nx')
        if pg.locator('.why').count(): saw_why = True; pg.screenshot(path=f'{OUT}/{tag}-visao.png'); break
        pg.click('#nx'); pg.wait_for_selector('.ans, #ty, .list .li')
        if pg.locator('.list .li').count(): pg.click('#go'); pg.wait_for_selector('.ans, #ty')
    ok(saw_why, f'{tag}: sai cùng kiểu 3 lần thì hiện "Vì sao?"')
    pg.click('#nx')
    # ---- đúng liền → tự sang câu ----
    pg.wait_for_selector('.ans, #ty, .list .li')
    for _ in range(8):
        if pg.locator('.list .li').count(): pg.click('#go'); pg.wait_for_selector('.ans, #ty')
        cur = pg.evaluate('SESS.cur'); cc = pg.evaluate('id => E.cOf(id)', cur['sid'])
        if pg.locator('.ans').count():
            for i in range(pg.locator('.ans').count()):
                if pg.locator('.ans').nth(i).inner_text() == cc['o']: pg.locator('.ans').nth(i).click(); break
        else: pg.click('#ty'); pg.keyboard.type(cc['o']); pg.keyboard.press('Enter')
        pg.wait_for_selector('.fb.ok', timeout=5000); pg.wait_for_timeout(1900)
    ok(pg.locator('.ans, #ty, .list .li').count() > 0, f'{tag}: đúng thì tự sang câu tiếp')
    # ---- chế độ gõ và nghe đoán (gọi thẳng) ----
    sid = pg.evaluate("Object.keys(KHO.c).find(s => KHO.c[s].k === 'k010' && !KHO.c[s].noi)")
    pg.evaluate("sid => doan({type:'doan', sid, k:'k010', mode:'go', opts:null, vi:false})", sid)
    ok(pg.locator('#ty').count() == 1 and pg.locator('.vi').count() == 0, f'{tag}: chế độ gõ, đã bỏ câu tiếng Việt')
    o = pg.evaluate('id => E.cOf(id).o', sid)
    pg.click('#ty'); pg.keyboard.type(o.upper() + ' '); pg.keyboard.press('Enter'); pg.wait_for_selector('#nx')
    ok(pg.locator('.fb.ok').count() == 1, f'{tag}: gõ hoa/thường, thừa khoảng trắng vẫn tính đúng')
    pg.evaluate("sid => doan({type:'doan', sid, k:'k010', mode:'nghe', opts:[E.cOf(sid).o, E.cOf(sid).sai[0][0]], vi:true})", sid)
    ok(pg.locator('#sen').count() == 0 and pg.locator('#rep').count() == 1, f'{tag}: nghe đoán không hiện chữ')
    pg.locator('.ans').first.click(); pg.wait_for_selector('#nx')
    ok(pg.locator('.fb .vi').count() == 1, f'{tag}: sau nghe đoán thì hiện câu và nghĩa')
    pg.click('#out'); pg.wait_for_selector('#h, .ring');
    if pg.locator('#h').count(): ok('câu đúng' in pg.inner_text('#app'), f'{tag}: có tổng kết sau buổi học'); pg.click('#h')
    n_today = pg.evaluate('E.stats().today.n'); ok(n_today >= 10, f'{tag}: đếm câu trong ngày ({n_today})')
    # ---- tải lại vẫn còn tiến độ ----
    pg.reload(); pg.wait_for_selector('.ring'); ok(pg.evaluate('E.stats().today.n') == n_today, f'{tag}: tải lại trang vẫn giữ tiến độ')
    # ---- mất mạng vẫn học ----
    pg.wait_for_timeout(4500)
    ctx.set_offline(True); pg.click('#hoc'); pg.wait_for_selector('.ans, #ty, .list .li')
    if pg.locator('.list .li').count(): pg.click('#go'); pg.wait_for_selector('.ans, #ty')
    if pg.locator('.ans').count(): pg.locator('.ans').first.click()
    else: pg.fill('#ty', 'x'); pg.click('#chk')
    pg.wait_for_selector('#nx'); ok(pg.evaluate('E.stats().today.n') == n_today + 1, f'{tag}: mất mạng vẫn học và chấm được')
    pg.click('#out'); ctx.set_offline(False); pg.wait_for_timeout(500)
    saved = pg.evaluate("fetch('/api/tt',{headers:{'x-tk':localStorage.getItem('tk')}}).then(r=>r.json())")
    pg.evaluate('pushState()'); pg.wait_for_timeout(1500)
    saved = pg.evaluate("fetch('/api/tt',{headers:{'x-tk':localStorage.getItem('tk')}}).then(r=>r.json())")
    ok(saved.get('doc') and DayN(saved['doc']) == n_today + 1, f'{tag}: có mạng lại thì đồng bộ lên máy chủ')
    # ---- máy thứ hai thấy cùng tiến độ ----
    ctx2 = br.new_context(**dev); p2 = ctx2.new_page(); p2.goto(URL); p2.wait_for_selector('#pin'); p2.click('#pin'); p2.keyboard.type(pin); p2.keyboard.press('Enter'); p2.wait_for_selector('.ring')
    ok(p2.evaluate('E.stats().today.n') == n_today + 1, f'{tag}: đăng nhập máy khác thấy cùng tiến độ'); ctx2.close()
    # ---- nói thẳng ----
    if pg.locator('#hoc').count() == 0: pg.click('#h') if pg.locator('#h').count() else None
    pg.wait_for_selector('.ring')
    pg.evaluate("Object.values(E.S.fr).forEach(f=>{}); E.S.fr['k010'] = Object.assign(E.S.fr['k010']||{}, {st:2}); home()")
    if kind == 'c' and LIVE:
        it = json.load(open('/tmp/noi_item.json'))
        pg.evaluate("it => { E.noiItems = () => [it]; home(); }", it); pg.click('#noi'); pg.wait_for_selector('.tinh')
        pg.click('#mic'); pg.wait_for_selector('.fb', timeout=30000)
        ok('Đúng rồi' in pg.inner_text('#fb'), f'{tag}: nói thẳng thật qua Whisper: "{pg.inner_text("#fb").splitlines()[1] if len(pg.inner_text("#fb").splitlines())>1 else ""}" · {pg.inner_text("#ms")}')
        pg.screenshot(path=f'{OUT}/{tag}-noi-that.png'); pg.click('#out')
    if kind == 'c' and not LIVE:
        pg.click('#noi'); pg.wait_for_selector('.tinh')
        it = pg.evaluate("E.noiItems(5)[0]")
        ctx._say = pg.evaluate("() => { const t = document.querySelector('.tinh').textContent; const all = []; KHO.k.forEach(k => all.push(...k.noi)); Object.values(KHO.nghe).forEach(g => all.push(...g.noi)); const x = all.find(n => n.tinh === t); return x ? x.dap[0] : '' }")
        pg.click('#mic'); pg.wait_for_selector('.fb', timeout=20000)
        ok('Đúng rồi' in pg.inner_text('#fb') and 'giây' in pg.inner_text('#ms'), f'{tag}: nói thẳng: nghe, chấm đúng, đo số giây ({pg.inner_text("#ms")})')
        pg.screenshot(path=f'{OUT}/{tag}-noi.png'); pg.click('#out')
    # ---- kể chuyện cuối ngày ----
    if not LIVE:
        pg.wait_for_selector('#ke'); pg.click('#ke'); pg.fill('#tx', 'She want to drink coffee. I am happy.'); pg.click('#go'); pg.wait_for_selector('.msg')
        ok('Đã thêm 1 câu' in pg.inner_text('#fb') and pg.evaluate('Object.keys(E.S.userc).length') >= 1, f'{tag}: câu bị sửa thành bài ngày mai')
        pg.screenshot(path=f'{OUT}/{tag}-ke.png'); pg.click('#out')
    if LIVE:
        pg.wait_for_selector('#ke'); pg.click('#ke'); pg.fill('#tx', 'Yesterday I go to the market. I buy two fish. My son like banana.'); pg.click('#go'); pg.wait_for_selector('.msg', timeout=60000)
        t = pg.inner_text('#fb'); ok('Đã thêm' in t and pg.evaluate('Object.keys(E.S.userc).length') >= 2, f'{tag}: AI thật sửa câu và tạo bài ngày mai ({pg.evaluate("Object.keys(E.S.userc).length")} câu)')
        print('   ', t.replace(chr(10), ' | ')[:400]); pg.screenshot(path=f'{OUT}/{tag}-ke-that.png', full_page=True); pg.click('#out')
    # ---- tiến bộ ----
    pg.wait_for_selector('#tb'); pg.click('#tb'); ok(pg.locator('svg.chart').count() >= 1 and 'ngày liền' in pg.inner_text('#app'), f'{tag}: trang tiến bộ có biểu đồ')
    pg.screenshot(path=f'{OUT}/{tag}-tienbo.png'); pg.click('#out')
    # ---- 320px ----
    pg.set_viewport_size({'width': 320, 'height': 640}); pg.click('#hoc'); pg.wait_for_selector('.ans, #ty, .list .li')
    ow = pg.evaluate('document.documentElement.scrollWidth'); ok(ow <= 322, f'{tag}: màn 320px không tràn ngang ({ow})')
    pg.screenshot(path=f'{OUT}/{tag}-320.png'); pg.click('#out')
    # ---- cài đặt: đổi mục tiêu, đổi PIN, đăng xuất, đăng nhập PIN mới ----
    if pg.locator('#h').count(): pg.click('#h')
    pg.wait_for_selector('#cd'); pg.click('#cd'); pg.select_option('#goal', '60'); pg.click('#sv'); pg.wait_for_selector('.ring')
    ok('/ 60' in pg.text_content('.ring'), f'{tag}: đổi mục tiêu mỗi ngày')
    pg.click('#cd'); pg.fill('#np', '1111'); pg.click('#sp'); pg.wait_for_timeout(600); pg.click('#lo'); pg.wait_for_selector('#pin')
    pg.click('#pin'); pg.keyboard.type(pin); pg.keyboard.press('Enter'); pg.wait_for_timeout(700); ok('Sai' in pg.inner_text('#er'), f'{tag}: PIN cũ không vào được nữa')
    pg.fill('#pin', ''); pg.click('#pin'); pg.keyboard.type('1111'); pg.keyboard.press('Enter'); pg.wait_for_selector('.ring'); ok(True, f'{tag}: PIN mới vào được')
    pg.click('#cd'); pg.fill('#np', pin); pg.click('#sp'); pg.wait_for_timeout(500)
    ok(not errs, f'{tag}: không lỗi JavaScript {errs[:2]}')
    if am: ok(all(s in (200, 206, 304) for s in am), f'{tag}: giọng đọc tải được ({len(am)} lần, mã {sorted(set(am))})')
    br.close()
def DayN(doc):
    import datetime
    d = max(doc['days'].keys()); return doc['days'][d]['n']

import traceback
with sync_playwright() as pw:
    for kd in ('c', 'w'):
        try: run(pw, kd)
        except Exception as e:
            ok(False, f'{kd}: dừng giữa chừng: {str(e).splitlines()[0]} @ {traceback.extract_tb(e.__traceback__)[-1].lineno}')
            try:
                pg = CUR[0]; print('MÀN HÌNH:', pg.inner_text('#app')[:400]); pg.screenshot(path=f'{OUT}/{kd}-loi.png')
            except Exception: pass
bad = [m for g, m in R if not g]
print(f'\n{len(R) - len(bad)}/{len(R)} đạt'); [print(' LỖI:', m) for m in bad]
