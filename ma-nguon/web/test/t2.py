#!/usr/bin/env python3
"""Kiểm thử web chung (đăng nhập Gmail): python3 test/t2.py [URL] — cục bộ dùng đăng nhập thử (TEST_LOGIN)."""
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8788'
LOCAL = '127.0.0.1' in URL or 'localhost' in URL
OUT = os.path.join(os.path.dirname(__file__), 'shots'); os.makedirs(OUT, exist_ok=True)
R = []
def ok(c, m): R.append((bool(c), m)); print(('ĐẠT ' if c else 'LỖI ') + m, flush=True)
EMAIL = 'hocvien.thu@example.com'

def answer_some(pg, n, right=True):
    done = 0
    while done < n:
        pg.wait_for_selector('.ans, #ty, .list .li, #h', timeout=15000)
        if pg.locator('#h').count(): break
        if pg.locator('.list .li').count(): pg.click('#go'); continue
        cur = pg.evaluate('SESS.cur'); c = pg.evaluate('id => E.cOf(id)', cur['sid'])
        if pg.locator('.ans').count():
            for i in range(pg.locator('.ans').count()):
                t = pg.locator('.ans').nth(i).inner_text()
                if (t == c['o']) == right: pg.locator('.ans').nth(i).click(); break
        else: pg.fill('#ty', c['o'] if right else 'zzz'); pg.click('#chk')
        pg.wait_for_selector('#nx'); pg.click('#nx'); done += 1
    return done

def onboard_guest(pg, tag):
    pg.goto(URL); pg.wait_for_selector('#jobs', timeout=20000)
    ok(pg.locator('#pin').count() == 0, f'{tag}: web chung không hỏi mã PIN, vào học ngay')
    pg.click('[data-j="ban_hang"]'); pg.click('#next')
    while pg.locator('.ans.skip').count(): pg.click('.ans.skip')
    pg.wait_for_selector('#go'); pg.click('#go')

with sync_playwright() as pw:
    for kind in ('c', 'w'):
        tag = 'android' if kind == 'c' else 'iphone'
        bt = pw.chromium if kind == 'c' else pw.webkit; dev = pw.devices['Pixel 7'] if kind == 'c' else pw.devices['iPhone 13']
        br = bt.launch(); errs = []
        email = (tag + '.' + EMAIL)
        # ---- máy 1: học khi chưa đăng nhập ----
        c1 = br.new_context(**dev); p1 = c1.new_page(); p1.on('pageerror', lambda e: errs.append(str(e)))
        onboard_guest(p1, tag)
        answer_some(p1, 6)
        p1.click('#out'); p1.wait_for_selector('#h, .ring')
        if p1.locator('#h').count():
            ok(p1.locator('#lg').count() == 1, f'{tag}: hết buổi đầu thì mời đăng nhập Gmail')
            p1.screenshot(path=f'{OUT}/chung-{tag}-moi.png'); p1.click('#h')
        p1.wait_for_selector('.ring')
        ok(p1.locator('#dn').count() == 1, f'{tag}: trang chính có lời mời đăng nhập khi chưa đăng nhập')
        n1 = p1.evaluate('E.stats().today.n'); c1n = p1.evaluate('Object.keys(E.S.cards).length')
        # kể chuyện khi chưa đăng nhập → mời đăng nhập
        p1.click('#ke'); p1.wait_for_selector('#lg'); ok('cần đăng nhập' in p1.inner_text('#app'), f'{tag}: AI sửa câu cần đăng nhập'); p1.click('#out')
        # màn đăng nhập: có nút Google (cục bộ: không tải được nút thật thì vẫn phải có chỗ đặt nút)
        p1.wait_for_selector('#dn'); p1.click('#dn'); p1.wait_for_selector('#lg .gbtn, #lg .why')
        ok(p1.locator('#lg .gbtn').count() == 1 and p1.locator('#mo').count() == 0, f'{tag}: trình duyệt thường thì hiện nút đăng nhập Google')
        p1.screenshot(path=f'{OUT}/chung-{tag}-dangnhap.png')
        if LOCAL:
            p1.evaluate("c => onCred({credential: c})", 'test:' + email); p1.wait_for_selector('.ring')
            ok(p1.locator('#dn').count() == 0, f'{tag}: đăng nhập xong thì hết lời mời')
            p1.wait_for_timeout(800)
            sv = p1.evaluate("fetch('/api/tt',{headers:{'x-tk':localStorage.getItem('tk')}}).then(r=>r.json())")
            ok(sv.get('doc') and len(sv['doc']['cards']) == c1n, f'{tag}: tiến độ lúc chưa đăng nhập được gộp lên tài khoản ({c1n} câu)')
            ok((sv.get('me') or {}).get('email') == email, f'{tag}: máy chủ nhận đúng Gmail')
            # ---- máy 2: học khách vài câu rồi đăng nhập cùng Gmail → gộp ----
            c2 = br.new_context(**dev); p2 = c2.new_page(); p2.on('pageerror', lambda e: errs.append(str(e)))
            onboard_guest(p2, tag + ' máy 2'); answer_some(p2, 3); p2.click('#out'); p2.wait_for_selector('#h, .ring')
            if p2.locator('#h').count(): p2.click('#h')
            c2n = p2.evaluate('Object.keys(E.S.cards).length')
            p2.evaluate("c => onCred({credential: c})", 'test:' + email); p2.wait_for_selector('.ring'); p2.wait_for_timeout(800)
            m = p2.evaluate('Object.keys(E.S.cards).length')
            ok(m >= max(c1n, c2n) and m <= c1n + c2n, f'{tag}: máy 2 đăng nhập cùng Gmail thì có đủ câu của cả hai máy ({c1n} + {c2n} → {m})')
            # máy 1 tải lại thấy phần học của máy 2
            p1.reload(); p1.wait_for_selector('.ring'); ok(p1.evaluate('Object.keys(E.S.cards).length') >= m, f'{tag}: máy 1 tải lại thấy cả phần học ở máy 2')
            # ---- xoá tài khoản ----
            tk = p2.evaluate("localStorage.getItem('tk')")
            p2.click('#cd'); p2.wait_for_selector('#xoa'); p2.click('#xoa'); ok('lần nữa' in p2.inner_text('#xoa'), f'{tag}: xoá tài khoản phải bấm hai lần')
            p2.click('#xoa'); p2.wait_for_selector('#jobs, .ring', timeout=15000)
            r = p2.evaluate("t => fetch('/api/tt',{headers:{'x-tk':t}}).then(r=>r.status)", tk)
            ok(r == 401, f'{tag}: xoá xong thì phiên cũ hết hiệu lực ({r})')
            ok(p2.evaluate("localStorage.getItem('tt')") in (None, 'null') or p2.locator('#jobs').count() == 1, f'{tag}: xoá xong thì máy sạch dữ liệu học')
            c2.close()
        # ---- trình duyệt trong ứng dụng Facebook ----
        ua = dev['user_agent'] + (' [FBAN/FB4A;FBAV/450.0.0.0;]' if kind == 'c' else ' [FBAN/FBIOS;FBAV/450.0;]')
        c3 = br.new_context(**{**dev, 'user_agent': ua}); p3 = c3.new_page(); p3.on('pageerror', lambda e: errs.append(str(e)))
        onboard_guest(p3, tag + ' trong FB'); answer_some(p3, 2); p3.click('#out'); p3.wait_for_selector('#h, .ring')
        if p3.locator('#h').count(): p3.click('#h')
        p3.click('#dn'); p3.wait_for_selector('#lg .why')
        ok(p3.locator('#mo').count() == 1 and p3.locator('.gbtn').count() == 0 and 'Mở bằng trình duyệt' in p3.inner_text('#lg'), f'{tag}: trong app Facebook thì hướng dẫn mở bằng trình duyệt')
        ok(('Chrome' if kind == 'c' else 'Safari') in p3.inner_text('#mo'), f'{tag}: nút mở đúng trình duyệt của máy')
        p3.screenshot(path=f'{OUT}/chung-{tag}-trongfb.png'); c3.close()
        # ---- trang dữ liệu ----
        c4 = br.new_context(**dev); p4 = c4.new_page(); p4.goto(URL + '/rieng-tu'); ok('Xoá tài khoản' in p4.inner_text('body'), f'{tag}: có trang ghi rõ lưu dữ liệu gì'); c4.close()
        ok(not [e for e in errs if 'gsi' not in e.lower()], f'{tag}: không lỗi JavaScript {errs[:2]}')
        c1.close(); br.close()
bad = [m for g, m in R if not g]
print(f'\n{len(R) - len(bad)}/{len(R)} đạt'); [print(' LỖI:', m) for m in bad]
