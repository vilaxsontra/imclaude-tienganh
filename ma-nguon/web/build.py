"""Đóng gói bản cài: python3 build.py [GỐC_URL]  → dist/nguon/maychu.txt + dist/nguon/<ver>/{maychu.txt,giaodien.json,kho.json,am*.txt}"""
import json, os, sys, hashlib, shutil, glob
B = os.path.dirname(os.path.abspath(__file__)); S = lambda f: open(os.path.join(B, 'src', f), encoding='utf-8').read()
app = S('app.js'); dc = S('dongco.js'); assert '</script' not in app + dc
html = S('index.html').replace('__DONGCO__', dc).replace('__APP__', app)
assets = {'html': html, 'sw': S('sw.js'), 'manifest': S('manifest.json'), 'icon': S('icon.svg'), 'png192': S('i192.b64'), 'png512': S('i512.b64')}
goc = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
KHO = os.environ.get('KHO', os.path.join(B, '..', 'kho', 'xuat'))  # thư mục có kho.json + am*.txt
g = json.dumps(assets, ensure_ascii=False)
kh = open(os.path.join(KHO, 'kho.json'), 'rb').read()
amf = sorted(glob.glob(os.path.join(KHO, 'am*.txt')))
hsh = hashlib.sha1(g.encode() + kh + S('server.js').encode())
for f in amf: hsh.update(open(f, 'rb').read())
ver = hsh.hexdigest()[:8]
out = os.path.join(B, 'dist', 'nguon'); vd = os.path.join(out, ver); os.makedirs(vd, exist_ok=True)
open(os.path.join(vd, 'giaodien.json'), 'w', encoding='utf-8').write(g)
shutil.copy(os.path.join(KHO, 'kho.json'), vd)
for f in amf: shutil.copy(f, vd)
srv = S('server.js').replace('__NGUON__', goc + ver + '/').replace('__VER__', ver)
open(os.path.join(B, 'dist', 'worker.js'), 'w', encoding='utf-8').write(srv)
open(os.path.join(out, 'maychu.txt'), 'w', encoding='utf-8').write(srv); open(os.path.join(vd, 'maychu.txt'), 'w', encoding='utf-8').write(srv)
print('ver', ver, 'worker', len(srv), 'giaodien', len(g), 'kho', len(kh), 'goi am', len(amf), 'sha256 maychu', hashlib.sha256(srv.encode()).hexdigest())
