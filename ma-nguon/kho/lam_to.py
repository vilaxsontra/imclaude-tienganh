"""Nâng âm lượng giọng đọc: mỗi đoạn về khoảng -16 LUFS, đỉnh không quá -1 dBFS (đoạn .n.mp3 cạnh đoạn gốc)."""
import glob, subprocess, re, os, sys
from concurrent.futures import ThreadPoolExecutor
def one(f):
    out = f[:-4] + '.n.mp3'
    if os.path.exists(out): return
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]); pk = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1])
    g = -16 - I
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f, '-af', f'volume={g:.2f}dB,alimiter=limit=0.89:level=false', '-ac', '1', '-ar', '24000', '-b:a', '48k', out], check=True)
fs = [f for f in glob.glob('am_cache/*.mp3') if not f.endswith('.n.mp3')]
with ThreadPoolExecutor(4) as ex: list(ex.map(one, fs))
print(len(fs))
