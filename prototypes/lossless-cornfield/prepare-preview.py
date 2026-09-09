#!/usr/bin/env python3
"""Stage byte-identical native PNGs for the restricted browser preview."""
from pathlib import Path
import shutil
import argparse
here=Path(__file__).resolve().parent
source=here.parents[1]/'research/lossless-visible/results'
target=here/'samples'
target.mkdir(exist_ok=True)
for name in ['display-sample','saved-balance-primitives','complex-3d-control-points','fresh-ascii-paths','fresh-neural-600']:
    shutil.copy2(source/(name+'.png'),target/(name+'.png'))
p=argparse.ArgumentParser();p.add_argument('--vendor-dependencies',action='store_true');args=p.parse_args()
if args.vendor_dependencies:
    import numpy, PIL
    vendor=here/'vendor'
    vendor.mkdir(exist_ok=True)
    for module,shared in [(numpy,'numpy.libs'),(PIL,'pillow.libs')]:
        package=Path(module.__file__).resolve().parent
        shutil.copytree(package,vendor/package.name,dirs_exist_ok=True)
        if (package.parent/shared).is_dir():
            shutil.copytree(package.parent/shared,vendor/shared,dirs_exist_ok=True)
