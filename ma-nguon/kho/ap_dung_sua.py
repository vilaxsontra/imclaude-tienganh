#!/usr/bin/env python3
"""Áp các bản sửa của người soát độc lập (soat/sua*.json) vào tệp nguồn cau_nhom*.json và nghe*.json."""
import json, glob, os, re
B = os.path.dirname(os.path.abspath(__file__))
fixes = {}
for f in sorted(glob.glob(os.path.join(B, 'soat', 'sua*.json'))):
    for x in json.load(open(f)):
        if x.get('id'): fixes[x['id']] = x
src = {}
for f in glob.glob(os.path.join(B, 'cau_nhom*.json')) + glob.glob(os.path.join(B, 'nghe*.json')): src[f] = json.load(open(f))
def locate(sid):
    m = re.match(r'^(k\d{3})([abn])(\d+)$', sid)
    if m:
        kid, part, i = m.group(1), m.group(2), int(m.group(3)) - 1
        for f, d in src.items():
            if 'cau_nhom' not in f: continue
            for fr in d:
                if fr['id'] == kid:
                    arr = fr['noi'] if part == 'n' else fr[part]
                    return arr, i
    m = re.match(r'^n([a-z_]+?)(n?)(\d+)$', sid)
    if m:
        job, isn, i = m.group(1), m.group(2), int(m.group(3)) - 1
        for f, d in src.items():
            if 'nghe' in os.path.basename(f) and job in d: return (d[job]['noi'] if isn else d[job]['cau']), i
    return None, None
done = miss = dele = 0; dels = []
for sid, x in fixes.items():
    arr, i = locate(sid)
    if arr is None or i >= len(arr): miss += 1; print('không tìm thấy', sid); continue
    it = arr[i]
    if x.get('xoa'): dels.append((id(arr), arr, i)); dele += 1; continue
    isnoi = 'tinh' in it
    for k in ('en', 'vi', 'sai', 'khac', 'dap', 'tinh'):
        if k in x and x[k] not in (None, ''):
            if isnoi and k == 'vi': it['tinh'] = x[k]
            elif isnoi and k in ('en', 'sai', 'khac'): continue
            else: it[k] = x[k]
    done += 1
# xoá từ cuối lên để chỉ số không lệch
for _, arr, i in sorted(dels, key=lambda t: (t[0], -t[2])): arr[i] = None
for f, d in src.items():
    if 'cau_nhom' in f:
        for fr in d:
            for p in ('a', 'b', 'noi'): fr[p] = [c for c in fr.get(p, []) if c is not None]
    else:
        for j in d.values(): j['cau'] = [c for c in j['cau'] if c is not None]; j['noi'] = [c for c in j['noi'] if c is not None]
    json.dump(d, open(f, 'w'), ensure_ascii=False, indent=1)
print(f'sửa {done}, xoá {dele}, không tìm thấy {miss}')
