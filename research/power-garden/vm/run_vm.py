"""Boot a separate Linux kernel with no guest network or shared host mounts."""
import base64
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

BASE=Path(__file__).resolve().parent
PKG=BASE/'sysroot'
OUT=BASE/(sys.argv[1] if len(sys.argv)>1 else 'run-02')
OUT.mkdir(exist_ok=False)
env={**os.environ,'LD_LIBRARY_PATH':':'.join(str(PKG/p) for p in ('usr/lib/x86_64-linux-gnu','usr/lib'))}
env['QEMU_MODULE_DIR']=str(PKG/'usr/lib/x86_64-linux-gnu/qemu')
qemu=PKG/'usr/bin/qemu-system-x86_64'
args=[str(qemu),'-name','Power-Garden-VM','-machine','pc','-accel','tcg,thread=multi',
      '-cpu','max','-smp','2','-m','1536','-bios',str(PKG/'usr/share/seabios/bios-256k.bin'),
      '-L',str(PKG/'usr/share/qemu'),'-kernel',str(BASE/'vmlinuz'),'-initrd',str(BASE/'initramfs.cpio.gz'),
      '-append','console=ttyS0,115200 rdinit=/init panic=-1 loglevel=4',
      '-display','none','-vga','none','-nic','none','-serial','file:'+str(OUT/'serial.log'),
      '-monitor','none','-qmp','stdio','-no-reboot']
record={'started_utc':datetime.now(timezone.utc).isoformat(),'command':args,'qemu_version':subprocess.check_output([str(qemu),'--version'],env=env,text=True),'kernel_sha256':hashlib.sha256((BASE/'vmlinuz').read_bytes()).hexdigest(),'initramfs_sha256':hashlib.sha256((BASE/'initramfs.cpio.gz').read_bytes()).hexdigest()}
(OUT/'launch.json').write_text(json.dumps(record,indent=2)+'\n')
start=time.monotonic()
with (OUT/'qemu.log').open('wb') as log:
    process=subprocess.Popen(args,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log)
    print('QEMU PID',process.pid,flush=True)
    greeting=process.stdout.readline()
    if greeting:
        responses=[json.loads(greeting)]
        for command in ('qmp_capabilities','query-status','query-version','query-name','query-cpus-fast'):
            process.stdin.write((json.dumps({'execute':command})+'\n').encode());process.stdin.flush()
            line=process.stdout.readline()
            if not line:break
            response=json.loads(line);responses.append({command:response})
        (OUT/'qmp.json').write_text(json.dumps(responses,indent=2)+'\n')
        print('QEMU monitor connected',flush=True)
    while process.poll() is None:
        if time.monotonic()-start>300:
            process.terminate();record['timeout']=True;break
        time.sleep(0.5)
    record['exit_code']=process.wait()
record['host_elapsed_seconds']=time.monotonic()-start
(OUT/'launch.json').write_text(json.dumps(record,indent=2)+'\n')
serial=(OUT/'serial.log').read_text(errors='replace') if (OUT/'serial.log').exists() else ''
for match in re.finditer(r'BEGIN_GUEST_FILE ([\w.-]+) ([a-f0-9]{64})\s+([A-Za-z0-9+/=\s]+?)\s+END_GUEST_FILE \1',serial):
    name,digest,encoded=match.groups()
    data=base64.b64decode(encoded)
    if hashlib.sha256(data).hexdigest()!=digest:raise RuntimeError('Guest transfer integrity failed: '+name)
    (OUT/name).write_bytes(data)
    print('Guest output:',name,len(data),flush=True)
print(json.dumps(record,indent=2),flush=True)
print((OUT/'qemu.log').read_text(errors='replace'),flush=True)
if (OUT/'VM-Run.json').exists():
    report=json.loads((OUT/'VM-Run.json').read_text())
    print(json.dumps(report,indent=2),flush=True)
    if record['exit_code'] or 'error' in report:raise SystemExit(1)
else:
    print(serial[-12000:],flush=True)
    raise SystemExit(1)
