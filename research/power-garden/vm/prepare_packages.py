import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import urllib.request

BASE = Path(__file__).resolve().parent
PACKAGES = sys.argv[1:] or [
    'xvfb', 'libxfont2', 'xserver-common', 'xfonts-base', 'x11-xkb-utils',
    'qemu-system-x86', 'qemu-system-common', 'qemu-system-data', 'seabios',
    'ipxe-qemu', 'busybox-static', 'linux-image-6.8.0-139-generic',
    'python3-tk', 'tk8.6-blt2.5', 'blt',
    'libaio1t64', 'libbpf1', 'libfdt1', 'libfuse3-3', 'libibverbs1',
    'libpmem1', 'librdmacm1t64', 'libslirp0', 'liburing2',
    'libbrlapi0.8', 'libcacard0', 'libusbredirparser1t64',
    'libtcl8.6', 'libtk8.6', 'tcl8.6', 'tk8.6',
    'libndctl6', 'libdaxctl1', 'libnl-route-3-200', 'libxft2', 'python3-pil.imagetk',
]
(BASE/'packages').mkdir(exist_ok=True)
(BASE/'sysroot').mkdir(exist_ok=True)
raw = subprocess.run(['apt-cache', 'show', *PACKAGES], check=True, capture_output=True, text=True).stdout
records = {}
for stanza in raw.split('\n\n'):
    record = dict(line.split(': ', 1) for line in stanza.splitlines() if ': ' in line and not line.startswith(' '))
    name = record.get('Package')
    if name in PACKAGES and name not in records and 'Filename' in record:
        records[name] = record
if set(PACKAGES) != records.keys():
    raise RuntimeError('Missing packages: '+repr(set(PACKAGES)-records.keys()))

def fetch(record):
    path = BASE/'packages'/Path(record['Filename']).name
    if not path.exists():
        url = 'http://archive.ubuntu.com/ubuntu/'+record['Filename']
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != record['SHA256']:
            raise RuntimeError('Package checksum mismatch: '+str(path))
        path.write_bytes(data)
    if hashlib.sha256(path.read_bytes()).hexdigest() != record['SHA256']:
        raise RuntimeError('Existing package checksum mismatch: '+str(path))
    print('Verified',record['Package'],record['Version'],path.stat().st_size,flush=True)
    return path

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    paths = list(pool.map(fetch,records.values()))
for path in paths:
    subprocess.run(['dpkg-deb','-x',str(path),str(BASE/'sysroot')],check=True)
manifest_path=BASE/'packages.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
manifest.update(records)
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print('Extracted',len(paths),'packages locally',flush=True)
