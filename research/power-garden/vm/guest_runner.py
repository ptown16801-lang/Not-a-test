"""Executed inside QEMU. Capture the actual X framebuffer, never redraw it."""
import base64
import hashlib
import json
import os
from pathlib import Path
import platform
import struct
import subprocess
import sys
import time
import traceback

sys.path.insert(0,'/app')
from isolated import decode_file

def bits(value):
    if isinstance(value,float):return struct.pack('>d',value).hex()
    if isinstance(value,list):return [bits(v) for v in value]
    if isinstance(value,dict):return {k:bits(v) for k,v in value.items()}
    return value

def parsed(text):return json.loads(text,parse_int=float,parse_float=float)

def emit(path):
    p=Path(path)
    data=p.read_bytes()
    print('BEGIN_GUEST_FILE '+p.name+' '+hashlib.sha256(data).hexdigest(),flush=True)
    print(base64.b64encode(data).decode(),flush=True)
    print('END_GUEST_FILE '+p.name,flush=True)

start=time.monotonic()
report={'guest':platform.uname()._asdict(),'python':sys.version,'node':subprocess.check_output(['node','--version'],text=True).strip(),'source_commit':'b3ec523e3a25eba16ba385f19432e112539e90e5'}
try:
    run=subprocess.run(['python3','/app/app.py','render','/input.json','/out/native.png'],capture_output=True,text=True,check=True)
    report['render']=json.loads(run.stdout)
    expected=bits(parsed(Path('/input.json').read_text()))
    decoded=decode_file('/out/native.png')
    if decoded.returncode:raise RuntimeError(decoded.stderr)
    report['independent_decoder_exact']=bits(parsed(decoded.stdout))==expected
    assert report['independent_decoder_exact']
    Path('/out/decoded.json').write_text(decoded.stdout)
    import tkinter as tk
    from tkinter import filedialog
    from PIL import Image,ImageGrab
    import PIL
    import app
    report['pillow']=PIL.__version__
    report['tk']=tk.TkVersion
    original_tk=tk.Tk
    filedialog.asksaveasfilename=lambda **kwargs:'/out/gui-decoded.json'
    class CapturedWindow(original_tk):
        def __init__(self,*args,**kwargs):
            super().__init__(*args,**kwargs)
            self.after(500,self.arrange)
        def arrange(self):
            # A normal window resize exposes every pixel of this complete image.
            self.geometry('1760x650+80+60')
            self.after(1000,self.exercise)
        def exercise(self):
            try:
                button=self.winfo_children()[0].winfo_children()[0]
                button.invoke()
                report['gui_decode_button_exact']=bits(parsed(Path('/out/gui-decoded.json').read_text()))==expected
                assert report['gui_decode_button_exact']
                self.update_idletasks()
                self.after(800,self.capture)
            except Exception:
                report['error']=traceback.format_exc();self.destroy()
        def capture(self):
            try:
                screenshot=ImageGrab.grab(xdisplay=':0').convert('RGB')
                screenshot.save('/out/Power-Garden-VM.png')
                canvas=self.winfo_children()[1].winfo_children()[0]
                # Locate the Canvas by widget type; other children are scrollbars.
                canvas=next(w for w in self.winfo_children()[1].winfo_children() if isinstance(w,tk.Canvas))
                x,y=canvas.winfo_rootx(),canvas.winfo_rooty()
                native=Image.open('/out/native.png').convert('RGB')
                crop=screenshot.crop((x,y,x+native.width,y+native.height))
                crop.save('/out/screenshot-image-region.png')
                report['screenshot_image_rect']=[x,y,native.width,native.height]
                report['screenshot_image_pixels_exact']=crop.tobytes()==native.tobytes()
                decoded_crop=decode_file('/out/screenshot-image-region.png')
                report['screenshot_crop_decode_exact']=decoded_crop.returncode==0 and bits(parsed(decoded_crop.stdout))==expected
                assert report['screenshot_image_pixels_exact'] and report['screenshot_crop_decode_exact']
                report['window_geometry']=self.geometry()
                report['display_size']=[screenshot.width,screenshot.height]
            except Exception:report['error']=traceback.format_exc()
            self.destroy()
    tk.Tk=CapturedWindow
    app.preview('/out/native.png')
except Exception:report['error']=traceback.format_exc()
report['guest_elapsed_seconds']=time.monotonic()-start
Path('/out/VM-Run.json').write_text(json.dumps(report,indent=2)+'\n')
print('GUEST_REPORT '+json.dumps(report),flush=True)
for name in ('VM-Run.json','Power-Garden-VM.png','native.png','screenshot-image-region.png','decoded.json','gui-decoded.json'):
    p=Path('/out')/name
    if p.exists():emit(p)
if 'error' in report:raise SystemExit(1)
