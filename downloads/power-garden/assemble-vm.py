#!/usr/bin/env python3
"""Restore the exact tested Power Garden VM ZIP from verified GitHub parts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.request

MANIFEST = {'archive': 'Power-Garden-VM.zip', 'archive_bytes': 105171853, 'archive_sha256': '717f51cda085d7e7dcb579d22f5f10773a512182792b4b204cf58a5f2c3cde04', 'parts': [{'name': 'Power-Garden-VM.zip.001', 'bytes': 33554432, 'sha256': 'd1c57aeb713a5e9f23cba3e92cca538fd20ff59286a7e1256bc4ced4b980bb6f'}, {'name': 'Power-Garden-VM.zip.002', 'bytes': 33554432, 'sha256': '5129e86849c164ef6c0e74cbaebcad2a17205688a3b12c1ed1c3843487679f0a'}, {'name': 'Power-Garden-VM.zip.003', 'bytes': 33554432, 'sha256': '2ccc7a0e0b526bbf55f5a3bb2ec88ec039ebbf8e15b7977b9e4082b10d7d8daa'}, {'name': 'Power-Garden-VM.zip.004', 'bytes': 4508557, 'sha256': 'b96502f4b1cb2403c036d44d478758fbe8d99c95737a2cf6415fcc6d795e0345'}]}
BASE_URL = 'https://raw.githubusercontent.com/ptown16801-lang/Not-a-test/refs/heads/research/power-garden-standalone/downloads/power-garden/parts/'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path('Power-Garden-VM.zip'))
    args=parser.parse_args();output=args.output.resolve()
    if output.exists():raise FileExistsError(str(output)+' already exists; choose another --output.')
    temporary=Path(str(output)+'.partial')
    output.parent.mkdir(parents=True,exist_ok=True)
    total=hashlib.sha256();count=0
    try:
        with temporary.open('xb') as destination:
            for part in MANIFEST['parts']:
                local=Path(__file__).resolve().parent/'parts'/part['name']
                source=local.open('rb') if local.exists() else urllib.request.urlopen(BASE_URL+part['name'],timeout=60)
                digest=hashlib.sha256();size=0
                with source:
                    while block:=source.read(1024*1024):
                        digest.update(block);total.update(block);destination.write(block);size+=len(block);count+=len(block)
                if size!=part['bytes'] or digest.hexdigest()!=part['sha256']:
                    raise ValueError('Part integrity mismatch: '+part['name'])
                print('Verified',part['name'],flush=True)
        if count!=MANIFEST['archive_bytes'] or total.hexdigest()!=MANIFEST['archive_sha256']:
            raise ValueError('Complete archive integrity mismatch')
        if output.exists():raise FileExistsError(str(output)+' appeared while assembling; verified data remains in '+str(temporary))
        temporary.rename(output)
    except Exception:
        print('Assembly did not finish. Any partial file is retained at',temporary,flush=True)
        raise
    print('Restored exact tested ZIP:',output)
    print('SHA-256:',total.hexdigest())
    print('Extract it, then run python3 replay.py with QEMU installed.')

if __name__=='__main__':main()
