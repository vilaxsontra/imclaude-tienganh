import json,re,os,subprocess,hashlib,difflib,soundfile as sf
from faster_whisper import WhisperModel
W=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=2)
kho=json.load(open('kho_tho.json')); C=kho['c']
bad=[l.split(' ')[1] for l in open('BAO-CAO-GIONG.md') if l.startswith('- ') and '(' in l and l[2] in 'kn']
NUM={'1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight','9':'nine','10':'ten','11':'eleven','12':'twelve'}
NAMES={'lan','nam','minh','hoa','tuan','mai','linh','hung','hanoi','saigon','dalat','danang','hue','pho','bao','loc','tet'}
def norm(s):
    s=s.lower().replace('’',"'").replace("o 'clock","o'clock").replace('okay','ok')
    w=re.findall(r"[a-z0-9']+",s); return [NUM.get(x,x) for x in w]
plain=lambda en: en.replace('{','').replace('}','')
out=[]
for sid in bad:
    c=C[sid]; t=plain(c['en']); voice='am_michael' if (sid.startswith('n') or c.get('noi')) else 'af_heart'
    h=hashlib.md5((voice+'|'+t).encode()).hexdigest()[:12]; mp3=f'am_cache/{h}.mp3'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',mp3,'-ac','1','-ar','16000','/tmp/k.wav'],check=True)
    a,_=sf.read('/tmp/k.wav',dtype='float32')
    seg,_=W.transcribe(a,language='en',beam_size=5,initial_prompt='Names: Lan, Nam, Minh, Hoa, Mai, Tuan, Dalat, Danang, Saigon, pho.')
    heard=' '.join(s.text for s in seg)
    A=[x for x in norm(t)]; B=[x for x in norm(heard)]
    # bỏ qua tên riêng khi so
    A2=[x for x in A if x not in NAMES]; B2=[x for x in B if x not in NAMES]
    r=difflib.SequenceMatcher(None,A2,B2).ratio()
    if r<0.9: out.append((sid,round(r,2),t,heard.strip()))
for x in out: print(x)
print(len(bad),'→ còn nghi',len(out))
json.dump(out,open('/tmp/nghi.json','w'))
