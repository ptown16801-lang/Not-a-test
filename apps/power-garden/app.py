#!/usr/bin/env python3
"""Standalone Power Garden CLI and native desktop preview."""
import argparse
import json
import subprocess
from pathlib import Path
from contract import load,plan,WIDTH,TOP,ROW,FOOT,DomainError,CapacityError
from render import render,save
from isolated import decode_file

def preview(path):
    import tkinter as tk
    from tkinter import filedialog,messagebox
    from PIL import Image,ImageTk
    image=Image.open(path).convert('RGB')
    root=tk.Tk();root.title('Power Garden — complete image at native pixels')
    root.geometry('1200x850')
    status=tk.StringVar(value=f'{image.width} × {image.height} pixels. Scroll to inspect; a cropped viewport is not the complete recovery image.')
    bar=tk.Frame(root);bar.pack(fill='x')
    def inverse():
        out=filedialog.asksaveasfilename(defaultextension='.json')
        if out:
            cp=decode_file(path)
            if cp.returncode:messagebox.showerror('Image rejected',cp.stderr)
            else:Path(out).write_text(cp.stdout);status.set('Recovered from the image alone: '+out)
    tk.Button(bar,text='Decode this image',command=inverse).pack(side='left')
    tk.Label(bar,textvariable=status,anchor='w').pack(side='left')
    frame=tk.Frame(root);frame.pack(fill='both',expand=True)
    canvas=tk.Canvas(frame,background='#f2edd2',highlightthickness=0)
    sx=tk.Scrollbar(frame,orient='horizontal',command=canvas.xview)
    sy=tk.Scrollbar(frame,orient='vertical',command=canvas.yview)
    canvas.configure(xscrollcommand=sx.set,yscrollcommand=sy.set,scrollregion=(0,0,image.width,image.height))
    sy.pack(side='right',fill='y');sx.pack(side='bottom',fill='x');canvas.pack(fill='both',expand=True)
    photo=ImageTk.PhotoImage(image);canvas.create_image(0,0,anchor='nw',image=photo)
    root.mainloop()

def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='cmd',required=True)
    a=sub.add_parser('render');a.add_argument('input');a.add_argument('output')
    a=sub.add_parser('plan');a.add_argument('input')
    a=sub.add_parser('preview');a.add_argument('image')
    a=sub.add_parser('decode');a.add_argument('image')
    args=p.parse_args()
    try:
        if args.cmd=='preview':preview(args.image)
        elif args.cmd=='decode':
            cp=decode_file(args.image)
            print(cp.stdout,end='')
            if cp.stderr:__import__('sys').stderr.write(cp.stderr)
            raise SystemExit(cp.returncode)
        else:
            scene=load(args.input)
            if args.cmd=='render':print(json.dumps(save(scene,args.output)))
            else:
                rows=plan(scene);h=TOP+ROW*len(rows)+FOOT
                print(json.dumps({'rows':len(rows),'scalars':sum(len(v) for _,v in rows),'width':WIDTH,'height':h,'pixels':WIDTH*h,'rgb_bytes':3*WIDTH*h}))
    except (DomainError,CapacityError,FileExistsError) as e:p.exit(2,f'{type(e).__name__}: {e}\n')

if __name__=='__main__':main()
