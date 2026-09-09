#!/usr/bin/env python3
"""Replay the recorded native-app run in a disposable QEMU Linux VM."""
import argparse
import base64
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

def extract(serial,directory):
    files=[]
    pattern=r'BEGIN_GUEST_FILE ([\w.-]+) ([a-f0-9]{64})\s+([A-Za-z0-9+/=\s]+?)\s+END_GUEST_FILE \1'
    for match in re.finditer(pattern,serial):
        name,digest,encoded=match.groups()
        data=base64.b64decode(encoded)
        if hashlib.sha256(data).hexdigest()!=digest:raise RuntimeError('Transfer checksum mismatch: '+name)
        (directory/name).write_bytes(data);files.append(name)
    return files

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--qemu',default=shutil.which('qemu-system-x86_64'))
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    if not args.qemu:parser.error('Install QEMU with x86 system emulation, or supply --qemu PATH.')
    base=Path(__file__).resolve().parent
    output=(args.output or base/('replay-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))).resolve()
    output.mkdir(parents=True,exist_ok=False)
    command=[args.qemu,'-name','Power-Garden-VM','-machine','pc','-accel','tcg,thread=multi','-cpu','max','-smp','2','-m','1536',
             '-bios',str(base/'firmware/bios-256k.bin'),'-L',str(base/'firmware'),
             '-kernel',str(base/'vmlinuz'),'-initrd',str(base/'initramfs.cpio.gz'),
             '-append','console=ttyS0,115200 rdinit=/init panic=-1 loglevel=4',
             '-display','none','-vga','none','-nic','none','-monitor','none',
             '-serial','file:'+str(output/'serial.log'),'-no-reboot']
    (output/'command.json').write_text(json.dumps(command,indent=2)+'\n')
    print('Booting the native app in a separate Linux guest. Captures will be saved to',output,flush=True)
    with (output/'qemu.log').open('wb') as log:
        result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,timeout=300)
    serial=(output/'serial.log').read_text(errors='replace') if (output/'serial.log').exists() else ''
    files=extract(serial,output)
    if result.returncode or 'VM-Run.json' not in files:
        raise RuntimeError('VM did not finish; inspect '+str(output/'qemu.log'))
    report=json.loads((output/'VM-Run.json').read_text())
    checks=('independent_decoder_exact','gui_decode_button_exact','screenshot_image_pixels_exact','screenshot_crop_decode_exact')
    if 'error' in report or not all(report.get(k) is True for k in checks):
        raise RuntimeError('A guest check failed; inspect '+str(output/'VM-Run.json'))
    print('PASS: rendered image, native decode button, screenshot pixels and independent screenshot decoding.')
    print('Open the actual VM screenshot:',output/'Power-Garden-VM.png')

if __name__=='__main__':main()
