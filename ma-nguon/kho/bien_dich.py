#!/usr/bin/env python3
"""Biên dịch kho câu: gom câu các nhóm + gói nghề, kiểm tra máy (lớp 1), tính chỗ tô màu, ghi kho_tho.json.
Chạy: python3 bien_dich.py  → kho_tho.json + BAO-CAO-KIEM.md
"""
import json, re, os, glob, difflib, collections
B = os.path.dirname(os.path.abspath(__file__)); N = os.path.join(B, '..', 'nguon_tai')
loi = json.load(open(os.path.join(B, 'loi.json')))
khung = json.load(open(os.path.join(B, 'khung.json')))
KI = {k['id']: k for k in khung}

# ---- danh sách từ NGSL (mọi dạng từ) + bổ sung ----
words = set()
for fn in ('NGSL_12_lemmatized_for_research.csv', 'SUP_lemmatized.csv'):
    for line in open(os.path.join(N, fn), encoding='utf-8-sig'):
        if line.startswith('#'): continue
        for w in line.strip().split(','):
            if w: words.add(w.strip().lower())
EXTRA = set("""i i'm i've i'd i'll you're you've you'd you'll he's she's it's we're we've we'll they're they've they'll that's there's what's where's who's how's let's don't doesn't didn't isn't aren't wasn't weren't can't couldn't won't wouldn't shouldn't haven't hasn't hadn't mustn't mom dad ok okay hello hi bye tv phone pho coffee tea juice cake sushi taxi pizza email laptop wifi gym toilet bathroom kitchen
lan nam minh hoa tuan mai linh hung hanoi saigon dalat danang hue vietnam vietnamese japan japanese english ho chi city mr mrs ms sir o'clock a.m p.m am pm""".split())
words |= EXTRA
names = set("lan nam minh hoa tuan mai linh hung hanoi saigon dalat danang hue".split())
tat = set()
tf = os.path.join(N, 'tatoeba_en_short.txt')
if os.path.exists(tf):
    for l in open(tf, encoding='utf-8'): tat.add(l.strip().lower())

LIM = {1: 8, 2: 10, 3: 14}
tok = lambda s: re.findall(r"[A-Za-z][A-Za-z']*", s)
plain = lambda en: en.replace('{', '').replace('}', '')
def oov(en):
    out = []
    for w in tok(plain(en)):
        lw = w.lower()
        if lw in words: continue
        b = lw[:-2] if lw.endswith("'s") else lw
        if b in words or b.rstrip("'") in words: continue
        out.append(w)
    return out

issues = collections.defaultdict(list); stats = collections.Counter()
def check_c(c, where, lv, job=False):
    en = c.get('en', ''); n = en.count('{')
    if n != 1 or en.count('}') != 1 or not re.search(r'\{[^{}]+\}', en): issues['ngoac'].append(f'{where}: {en}'); return False
    o = re.search(r'\{([^{}]+)\}', en).group(1).strip()
    c['o'] = o
    if not c.get('vi'): issues['thieu_vi'].append(f'{where}: {en}')
    sai = c.get('sai') or []
    if not (1 <= len(sai) <= 3): issues['so_dap_an_nhieu'].append(f'{where}: {en} → {sai}')
    for s in sai:
        if not isinstance(s, list) or len(s) != 2: issues['dang_sai'].append(f'{where}: {s}'); continue
        if s[1] not in loi: issues['ma_loi_la'].append(f'{where}: {s}')
        if s[0].strip().lower() == o.lower(): issues['nhieu_trung_dung'].append(f'{where}: {en} {s}')
        if s[0].strip().lower() in [x.lower() for x in c.get('khac') or []]: issues['nhieu_trong_khac'].append(f'{where}: {en} {s}')
    if len(tok(plain(en))) > LIM.get(lv, 14) + (3 if job else 0): issues['qua_dai'].append(f'{where}: {en}')
    ov = oov(en)
    if ov and not job: issues['tu_ngoai_ngsl'].append(f'{where}: {",".join(ov)} | {plain(en)}')
    stats['cau'] += 1
    if plain(en).strip().lower() in tat: stats['co_trong_tatoeba'] += 1
    return True

def span(prev, cur):
    """chỗ khác nhau giữa hai câu (theo chữ) → khoảng ký tự trong câu hiện tại"""
    TK = r"[A-Za-z0-9][A-Za-z0-9']*|[^\sA-Za-z0-9]"
    a, b = [x.lower() for x in re.findall(TK, prev)], re.findall(TK, cur)
    bl = [x.lower() for x in b]
    sm = difflib.SequenceMatcher(None, a, bl, autojunk=False)
    ops = [op for op in sm.get_opcodes() if op[0] != 'equal' and op[3] != op[4]]
    segs = len([op for op in sm.get_opcodes() if op[0] != 'equal'])
    if not ops: return None, segs
    j1, j2 = ops[0][3], ops[-1][4]
    # vị trí ký tự
    pos = []; i = 0
    for t in b: k = cur.index(t, i); pos.append((k, k + len(t))); i = k + len(t)
    return [pos[j1][0], pos[j2 - 1][1]], segs

C = {}; K = []
files = sorted(glob.glob(os.path.join(B, 'cau_nhom*.json')))
got = {}
for f in files:
    for fr in json.load(open(f)): got[fr['id']] = fr
for kid in [k['id'] for k in khung]:
    meta = KI[kid]; fr = got.get(kid)
    if not fr: issues['thieu_khuon'].append(kid); continue
    lv = meta['lv']; entry = {'id': kid, 'lv': lv, 'ten': meta['ten'], 'a': [], 'b': [], 'noi': []}
    seen = set()
    for part in ('a', 'b'):
        prev = None
        for i, c in enumerate(fr.get(part) or []):
            sid = f'{kid}{part}{i + 1}'
            key = plain(c.get('en', '')).lower()
            if key in seen: issues['trung'].append(f'{sid}: {key}'); continue
            seen.add(key)
            if not check_c(c, sid, lv): continue
            p = plain(c['en'])
            if part == 'a' and prev is not None:
                hl, segs = span(prev, p)
                if segs > 2: issues['chuoi_khong_nen'].append(f'{sid}: "{prev}" → "{p}" ({segs} chỗ)')
            else:
                m = re.search(r'\{([^{}]+)\}', c['en']); s0 = m.start(); hl = [s0, s0 + len(m.group(1))]
            if part == 'b': m = re.search(r'\{([^{}]+)\}', c['en']); s0 = m.start(); hl = [s0, s0 + len(m.group(1))]
            C[sid] = {'k': kid, 'en': c['en'], 'vi': c.get('vi', ''), 'o': c['o'], 'sai': c.get('sai') or [], 'khac': c.get('khac') or [], 'hl': hl}
            entry[part].append(sid); prev = p
    if len(entry['a']) < 6: issues['bo_a_thieu'].append(f'{kid}: {len(entry["a"])}')
    if len(entry['b']) < 4: issues['bo_b_thieu'].append(f'{kid}: {len(entry["b"])}')
    for j, x in enumerate(fr.get('noi') or []):
        if not x.get('tinh') or not x.get('dap'): issues['noi_hong'].append(f'{kid}: {x}'); continue
        nid = f'{kid}n{j + 1}'; C[nid] = {'k': kid, 'en': x['dap'][0], 'vi': '', 'noi': 1}
        entry['noi'].append({'id': nid, 'sid': nid, 'tinh': x['tinh'], 'dap': x['dap'], 'k': kid})
    K.append(entry)

NGHE = {}
for f in sorted(glob.glob(os.path.join(B, 'nghe*.json'))):
    for job, d in json.load(open(f)).items():
        g = {'ten': d.get('ten', job), 'k': {}, 'noi': []}; prev = {}
        for i, c in enumerate(d.get('cau') or []):
            kid = c.get('k'); sid = f'n{job}{i + 1}'
            if kid not in KI: issues['nghe_khuon_la'].append(f'{sid}: {kid}'); continue
            if not check_c(c, sid, KI[kid]['lv'], job=True): continue
            p = plain(c['en'])
            if kid in prev: hl, segs = span(prev[kid], p)
            else: m = re.search(r'\{([^{}]+)\}', c['en']); hl = [m.start(), m.start() + len(m.group(1))]
            prev[kid] = p
            C[sid] = {'k': kid, 'en': c['en'], 'vi': c.get('vi', ''), 'o': c['o'], 'sai': c.get('sai') or [], 'khac': c.get('khac') or [], 'hl': hl}
            g['k'].setdefault(kid, []).append(sid)
        for j, x in enumerate(d.get('noi') or []):
            if not x.get('tinh') or not x.get('dap') or x.get('k') not in KI: issues['noi_hong'].append(f'{job}: {x}'); continue
            nid = f'n{job}n{j + 1}'; C[nid] = {'k': x['k'], 'en': x['dap'][0], 'vi': '', 'noi': 1}
            g['noi'].append({'id': nid, 'sid': nid, 'tinh': x['tinh'], 'dap': x['dap'], 'k': x['k']})
        NGHE[job] = g

kho = {'v': 1, 'loi': loi, 'k': K, 'c': C, 'nghe': NGHE}
json.dump(kho, open(os.path.join(B, 'kho_tho.json'), 'w'), ensure_ascii=False)
L = [f'# Báo cáo kiểm tra máy kho câu', '', f'- Khuôn: {len(K)}/{len(khung)}', f'- Câu có chỗ che: {stats["cau"]}', f'- Câu trùng nguyên văn với câu thật trong Tatoeba: {stats["co_trong_tatoeba"]} ({round(100 * stats["co_trong_tatoeba"] / max(1, stats["cau"]))}%)', f'- Gói nghề: {len(NGHE)}', '']
for k, v in sorted(issues.items()):
    L.append(f'## {k} ({len(v)})'); L += ['- ' + x for x in v[:300]]; L.append('')
open(os.path.join(B, 'BAO-CAO-KIEM.md'), 'w').write('\n'.join(L))
print('\n'.join(L[:8])); print({k: len(v) for k, v in issues.items()})
