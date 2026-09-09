#!/usr/bin/env python3
"""Local inspection UI. Image decoding uses a fresh, guarded subprocess."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import argparse
import json
import shutil
import subprocess
import sys
import tempfile

HERE=Path(__file__).resolve().parent
RESULTS=HERE/'samples'
if not RESULTS.is_dir():
    RESULTS=HERE.parents[1]/'research/lossless-visible/results'
SAMPLES={'display-sample':'Binary64 precision sample','saved-balance-primitives':'Saved balance primitives',
         'complex-3d-control-points':'64 control points in three dimensions',
         'fresh-ascii-paths':'All paths from the 24-step ASCII run',
         'fresh-neural-600':'Three complete 600-neuron states'}

PAGE='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neural Engine · Visible precision</title>
<style>*{box-sizing:border-box}body{margin:0;background:#17251c;color:#f4e5ba;font:16px system-ui,sans-serif}header{padding:26px 4vw 18px;border-bottom:1px solid #496344}h1{font-weight:500;font-size:30px;margin:4px 0 10px}.eyebrow{color:#d4b569;letter-spacing:.13em;font-size:12px}p{max-width:900px;line-height:1.5;color:#c5cba9}nav{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:18px 0}select,button,a{font:inherit}button,select,.download{padding:10px 15px;border:1px solid #778458;border-radius:6px;background:#263e2a;color:#f4e5ba}.download{text-decoration:none}button{cursor:pointer}main{padding:20px 4vw 50px}.surface{overflow:auto;border:1px solid #9c9c63;background:#efda95}img{display:block;width:100%;height:auto}img.native{width:1488px;max-width:none}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto;line-height:1.5}small{color:#c4c899}.badge{padding:4px 9px;background:#d8b563;color:#17251c;border-radius:3px}#result{padding:12px 0}a{color:#f4d183}</style>
<header><div class="eyebrow">NEURAL ENGINE / SHAPE COGNITION</div><h1>Visible precision</h1><p>Each stalk directly represents one numeric variable. Its branches show successively finer coordinate scales. Ordered beds keep coincident paths, control points and neural values separate.</p><span class="badge">Exact native PNG contract</span><nav><label>Example <select id="sample">OPTIONS</select></label><button id="size">Show native pixels</button><button id="decode">Decode PNG independently</button><a class="download" id="download" download>Download native PNG</a></nav><small id="dimensions"></small></header>
<main><p id="scope">The fitted preview may discard precision. Decode and download use the complete native PNG. These examples do not reconstruct a seed sentence or an entire engine history.</p><div class="surface"><img id="image" alt="Cornfield representation of exact numeric variables"></div><div id="result" role="status"></div><details><summary>Recovered geometry and state values</summary><pre id="json"></pre></details></main>
<script>const choose=document.querySelector('#sample'),img=document.querySelector('#image'),button=document.querySelector('#decode');function load(){img.src='/image/'+choose.value+'.png';document.querySelector('#download').href=img.src;document.querySelector('#result').textContent='';document.querySelector('#json').textContent=''}choose.addEventListener('change',load);img.onload=()=>document.querySelector('#dimensions').textContent=img.naturalWidth+' × '+img.naturalHeight+' native pixels';document.querySelector('#size').onclick=e=>{img.classList.toggle('native');e.target.textContent=img.classList.contains('native')?'Fit preview':'Show native pixels'};button.onclick=async()=>{button.disabled=true;document.querySelector('#result').textContent='Reading only the PNG in a fresh decoder process…';try{const r=await fetch('/decode/'+choose.value+'.png');const data=await r.json();if(!r.ok)throw Error(data.error);document.querySelector('#json').textContent=JSON.stringify(data.scene,null,2);document.querySelector('#result').textContent='Recovered '+data.scene.shapes.length+' geometry records and '+data.scene.states.length+' neural vectors from pixels. Decoder file access: image only.'}catch(e){document.querySelector('#result').textContent=e.message}finally{button.disabled=false}};load();</script></html>'''.replace('OPTIONS',''.join(f'<option value="{k}">{v}</option>' for k,v in SAMPLES.items()))


class Handler(BaseHTTPRequestHandler):
    def send(self,status,body,mime):
        self.send_response(status);self.send_header('Content-Type',mime)
        self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store')
        self.end_headers();self.wfile.write(body)

    def do_GET(self):
        route=urlparse(self.path).path
        if route=='/':return self.send(200,PAGE.encode(),'text/html; charset=utf-8')
        if route.startswith('/image/') or route.startswith('/decode/'):
            name=route.rsplit('/',1)[-1]
            if name.removesuffix('.png') not in SAMPLES or not name.endswith('.png'):
                return self.send(404,b'unknown sample','text/plain')
            source=RESULTS/name
            if not source.is_file():return self.send(404,b'run the test suite to generate this sample','text/plain')
            if route.startswith('/image/'):
                return self.send(200,source.read_bytes(),'image/png')
            with tempfile.TemporaryDirectory(prefix='preview-inverse-') as temp:
                d=Path(temp)
                for f in ('decode.py','rules.json'):shutil.copy2(HERE/f,d/f)
                shutil.copy2(source,d/'image.png')
                command=[sys.executable,'-I','decode.py','image.png']
                vendor=HERE/'vendor'
                if vendor.is_dir():
                    # Fixed, public dependencies only; no scene or answer paths.
                    boot='import sys,runpy;sys.path.insert(0,'+repr(str(vendor))+');sys.argv=["decode.py","image.png"];runpy.run_path("decode.py",run_name="__main__")'
                    command=[sys.executable,'-I','-c',boot]
                p=subprocess.run(command,cwd=d,stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=90)
                if p.returncode:return self.send(422,json.dumps({'error':p.stderr.splitlines()[-1]}).encode(),'application/json')
                return self.send(200,json.dumps({'scene':json.loads(p.stdout),'audit':json.loads(p.stderr)}).encode(),'application/json')
        self.send(404,b'not found','text/plain')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=4329);p.add_argument('--host',default='127.0.0.1');p.add_argument('--strictPort',action='store_true');a=p.parse_args()
    print(f'Visible renderer preview: http://{a.host}:{a.port}',flush=True)
    ThreadingHTTPServer((a.host,a.port),Handler).serve_forever()
