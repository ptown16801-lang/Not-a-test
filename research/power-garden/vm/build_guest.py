"""Build a disposable Linux initramfs for the unmodified Power Garden app."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess

BASE=Path(__file__).resolve().parent
PKG=BASE/'sysroot'
ROOT=BASE/'guest'
REPO=BASE.parent/'neural-engine-power-garden'
ROOT.mkdir(exist_ok=True)
ELF=set()

def copy(source,target=None):
    source=Path(source)
    target=target or ('/'+str(source.relative_to(PKG)) if source.is_relative_to(PKG) else str(source))
    destination=ROOT/target.lstrip('/')
    if source.is_dir():
        for child in source.iterdir():
            if child.name!='__pycache__':copy(child,str(Path(target)/child.name))
        return
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,destination,follow_symlinks=True)
    if source.read_bytes()[:4]==b'\x7fELF':ELF.add((str(source),str(destination)))

for d in ('dev','proc','sys','tmp','run','out','root','etc','bin','usr/bin','lib64'):
    (ROOT/d).mkdir(exist_ok=True,parents=True)
copy(PKG/'usr/bin/busybox','/bin/busybox')
for name in ('sh','mount','mkdir','sleep','cat','uname','poweroff','base64','sync'):
    path=ROOT/'bin'/name
    if not path.exists():path.symlink_to('busybox')
for name in ('Xvfb','xkbcomp'):
    copy(PKG/'usr/bin'/name)
copy('/usr/bin/python3.12','/usr/bin/python3')
copy('/usr/lib/python3.12')
copy('/usr/lib/python3/dist-packages/PIL')
copy(PKG/'usr/lib/python3/dist-packages/PIL')
copy(PKG/'usr/lib/python3.12')
copy(PKG/'usr/lib/tcltk')
copy(PKG/'usr/share/tcltk')
copy('/usr/share/X11/xkb')
copy(PKG/'usr/share/fonts/X11')
copy('/usr/share/fonts/truetype/dejavu')
copy('/etc/fonts')
copy(os.environ['CODEX_PRIMARY_RUNTIME_NODE'],'/usr/bin/node')
copy(REPO/'apps/power-garden','/app')
copy(REPO/'research/power-garden/results/run-02/display-sample.input.json','/input.json')
copy(BASE/'guest_runner.py','/guest_runner.py')
env={**os.environ,'LD_LIBRARY_PATH':':'.join(str(PKG/p) for p in ('usr/lib/x86_64-linux-gnu','usr/lib'))}
pending=list(ELF)
seen=set()
while pending:
    source,destination=pending.pop()
    if source in seen:continue
    seen.add(source)
    result=subprocess.run(['ldd',source],env=env,capture_output=True,text=True)
    if 'not found' in result.stdout:raise RuntimeError(source+'\n'+result.stdout)
    for line in result.stdout.splitlines():
        match=re.search(r'(?:=>\s+)?(/\S+)\s+\(',line)
        if match:
            lib=Path(match.group(1))
            target='/'+str(lib.relative_to(PKG)) if lib.is_relative_to(PKG) else str(lib)
            if not (ROOT/target.lstrip('/')).exists():
                copy(lib,target)
                pending.append((str(lib),str(ROOT/target.lstrip('/'))))
(ROOT/'etc/passwd').write_text('root:x:0:0:root:/root:/bin/sh\n')
(ROOT/'etc/group').write_text('root:x:0:\n')
(ROOT/'etc/hostname').write_text('power-garden-vm\n')
(ROOT/'init').write_text('''#!/bin/sh
export PATH=/bin:/usr/bin
export LANG=C.UTF-8
export DISPLAY=:0
export PYTHONUNBUFFERED=1
export PYTHONDONTWRITEBYTECODE=1
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mkdir -p /dev/shm /tmp/.X11-unix
mount -t tmpfs tmpfs /dev/shm
Xvfb :0 -screen 0 1920x800x24 -nolisten tcp -ac > /out/xvfb.log 2>&1 &
sleep 2
python3 /guest_runner.py
RESULT=$?
cat /out/xvfb.log
echo GUEST_RUNNER_EXIT=$RESULT
sync
poweroff -f
''')
(ROOT/'init').chmod(0o755)
kernel=next((PKG/'boot').glob('vmlinuz-*'))
shutil.copy2(kernel,BASE/'vmlinuz')
manifest=[]
for path in sorted(ROOT.rglob('*')):
    if path.is_file() and not path.is_symlink():
        manifest.append({'path':'/'+str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(BASE/'guest-files.json').write_text(json.dumps(manifest,indent=2)+'\n')

# The Linux initramfs "newc" archive format. No host mounts or root privileges.
with (BASE/'initramfs.cpio.gz').open('wb') as raw, gzip.GzipFile(fileobj=raw,mode='wb',compresslevel=1,mtime=0) as out:
    def entry(name,mode,data,ino,rdev=(0,0)):
        encoded=name.encode()+b'\0'
        fields=[ino,mode,0,0,1,0,len(data),0,0,*rdev,len(encoded),0]
        header=b'070701'+b''.join(f'{n:08x}'.encode() for n in fields)
        out.write(header+encoded)
        out.write(b'\0'*((-(110+len(encoded)))%4))
        out.write(data)
        out.write(b'\0'*((-len(data))%4))
    for i,path in enumerate(sorted(ROOT.rglob('*')),1):
        name=str(path.relative_to(ROOT))
        mode=path.lstat().st_mode
        data=os.readlink(path).encode() if path.is_symlink() else path.read_bytes() if path.is_file() else b''
        entry(name,mode,data,i)
    for i,(name,major,minor) in enumerate((('console',5,1),('null',1,3),('ttyS0',4,64)),1):
        entry('dev/'+name,stat.S_IFCHR|0o600,b'',len(manifest)+9000+i,(major,minor))
    entry('TRAILER!!!',0,b'',len(manifest)+10000)
print(json.dumps({'kernel_bytes':(BASE/'vmlinuz').stat().st_size,'initramfs_bytes':(BASE/'initramfs.cpio.gz').stat().st_size,'files':len(manifest),'uncompressed_file_bytes':sum(x['bytes'] for x in manifest)},indent=2))
