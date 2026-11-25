#!/usr/bin/env python3
"""Tạo giọng đọc tiếng Anh (Kokoro, mã nguồn mở Apache-2.0) cho mọi câu trong kho_tho.json,
đo mốc bắt đầu của chữ bị che (faster-whisper) để làm chế độ nghe đoán,
kiểm tra giọng đọc có đọc đúng câu không, rồi đóng gói thành các gói âm thanh.
Chạy: python3 giong.py  → kho.json, am0.json…amN.json (thư mục ../web/dist/nguon), BAO-CAO-GIONG.md
"""
import json, os, re, subprocess, base64, hashlib, sys, difflib
B = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(B, 'xuat'); os.makedirs(OUT, exist_ok=True)
CACHE = os.path.join(B, 'am_cache'); os.makedirs(CACHE, exist_ok=True)
kho = json.load(open(os.path.join(B, 'kho_tho.json')))
from kokoro_onnx import Kokoro
import soundfile as sf
from faster_whisper import WhisperModel
K = Kokoro('/home/claude/tts_en/kokoro-v1.0.onnx', '/home/claude/tts_en/voices-v1.0.bin')
WM = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=int(os.environ.get('THR','2')))
plain = lambda en: en.replace('{', '').replace('}', '')
words = lambda s: re.findall(r"[a-z0-9']+", s.lower().replace('’', "'"))
RIENG = json.load(open(os.path.join(B, 'giong_rieng.json'))) if os.path.exists(os.path.join(B, 'giong_rieng.json')) else {}
rep = []; ids = sorted(kho['c'])
SH = [int(x) for x in os.environ.get('SHARD','0/1').split('/')]
ONLY = SH[1] > 1
if ONLY: ids = [x for i, x in enumerate(ids) if i % SH[1] == SH[0]]
for n, sid in enumerate(ids):
    c = kho['c'][sid]; text = plain(c['en'])
    voice = 'am_michael' if (sid.startswith('n') or c.get('noi')) else 'af_heart'; speed = 0.92
    if sid in RIENG: voice = RIENG[sid].get('voice', voice); speed = RIENG[sid].get('speed', speed)
    h = hashlib.md5((voice + '|' + text + ('' if speed == 0.92 else '|' + str(speed))).encode()).hexdigest()[:12]
    mp3 = os.path.join(CACHE, h + '.mp3'); meta = os.path.join(CACHE, h + '.json')
    if not os.path.exists(meta):
        s, sr = K.create(text, voice=voice, speed=speed, lang='en-us')
        wav = os.path.join(CACHE, h + '.wav'); sf.write(wav, s, sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,apad=pad_dur=0.15', '-ac', '1', '-ar', '24000', '-b:a', '40k', mp3], check=True)
        # đo trên chính tệp mp3 sẽ phát để mốc khớp
        w16 = wav + '.16.wav'; subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', '16000', w16], check=True)
        arr, _sr = sf.read(w16, dtype='float32'); os.remove(w16)
        segs2, _ = WM.transcribe(arr, language='en', word_timestamps=True, beam_size=1)
        ws = [w for sg in segs2 for w in sg.words]
        heard = ' '.join(w.word.strip() for w in ws)
        json.dump({'heard': heard, 'w': [[w.word.strip(), round(w.start, 3)] for w in ws]}, open(meta, 'w'))
        os.remove(wav)
    m = json.load(open(meta))
    sim = difflib.SequenceMatcher(None, words(text), words(m['heard'])).ratio()
    c['_sim'] = round(sim, 2)
    if sim < 0.85: rep.append(f'- {sid} ({sim:.2f}) đọc: "{text}" | máy nghe: "{m["heard"]}"')
    # mốc bắt đầu chữ bị che
    if '{' in c['en'] and not c.get('noi'):
        pre = words(c['en'].split('{')[0]); tgt = words(re.search(r'\{([^}]*)\}', c['en']).group(1))
        hw = [(words(w)[0] if words(w) else '', t) for w, t in m['w']]
        # căn theo số chữ đứng trước chỗ che
        tc = None
        if len(hw) >= len(pre) + 1:
            cand = hw[len(pre)]
            if tgt and cand[0] == tgt[0]: tc = cand[1]
            elif len(pre) and hw[len(pre) - 1][0] == pre[-1]: tc = cand[1]
        if tc is not None and tc > 0.25: c['tc'] = int(tc * 1000 - 40)
    c['_mp3'] = mp3
    if n % 100 == 0: print(n, len(ids), sid, flush=True)

if ONLY: sys.exit(0)
# ---- đóng gói ----
packs = []; cur = {}; size = 0; LIMIT = 300_000
for sid in ids:
    c = kho['c'][sid]; b = open(c.pop('_mp3'), 'rb').read(); c.pop('_sim', None)
    if size + len(b) > LIMIT and cur: packs.append(cur); cur = {}; size = 0
    cur[sid] = base64.b64encode(b).decode(); size += len(b); c['am'] = len(packs)
if cur: packs.append(cur)
for i, p in enumerate(packs): open(os.path.join(OUT, f'am{i}.txt'), 'w').write('\n'.join(f'{k}\t{v}' for k, v in p.items()))
kho['goi'] = len(packs)
json.dump(kho, open(os.path.join(OUT, 'kho.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
ntc = sum(1 for c in kho['c'].values() if c.get('tc'))
L = ['# Báo cáo giọng đọc', f'- Câu: {len(ids)} · gói âm thanh: {len(packs)} · có mốc nghe đoán: {ntc}', f'- Câu máy nghe lại không khớp ≥85%: {len(rep)}', ''] + rep
open(os.path.join(B, 'BAO-CAO-GIONG.md'), 'w').write('\n'.join(L)); print('\n'.join(L[:4]))
