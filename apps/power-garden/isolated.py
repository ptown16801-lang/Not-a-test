"""Fresh inverse process with reads restricted to one image and public rules."""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

def decode_file(image):
    with tempfile.TemporaryDirectory(prefix='power-garden-inverse-') as temp:
        root=Path(temp)
        shutil.copyfile(Path(__file__).with_name('inverse.mjs'),root/'inverse.mjs')
        shutil.copyfile(image,root/'observation.png')
        return subprocess.run([shutil.which('node') or 'node','--permission',
            '--allow-fs-read='+str(root/'inverse.mjs'),
            '--allow-fs-read='+str(root/'observation.png'),
            str(root/'inverse.mjs'),str(root/'observation.png')],
            cwd=root,stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=90,
            env={'PATH':os.environ['PATH'],'LANG':'C'})
