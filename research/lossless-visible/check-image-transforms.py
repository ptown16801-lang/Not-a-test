#!/usr/bin/env python3
"""Additional observation tests distinguish protocol rejection from lost pixels."""
from pathlib import Path
import importlib.util
import json
import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('checks',HERE/'test_renderer.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
out=HERE/'results/additional-transforms';out.mkdir(exist_ok=True)
native=Image.open(HERE/'results/display-sample.png').convert('RGB')
expected,_seconds,_audit=t.isolated(HERE/'results/display-sample.png')
results=[]
for factor in [.25,.5,.75,.99,1.01,1.5,2.]:
    for method,label in [(Image.Resampling.NEAREST,'nearest'),(Image.Resampling.LANCZOS,'lanczos')]:
        first=native.resize((round(native.width*factor),round(native.height*factor)),method)
        restored=first.resize(native.size,method)
        path=out/f'restored-{factor}-{label}.png';restored.save(path)
        got,elapsed,detail=t.isolated(path)
        results.append({'scale':factor,'filter':label,'observation':'resized then restored to native dimensions','exact':t.scalar_bits(got)==t.scalar_bits(expected),'status':'rejected' if got is None else ('exact' if t.scalar_bits(got)==t.scalar_bits(expected) else 'wrong-decoding'),'RGB_pixels_changed':int(np.any(np.asarray(native)!=np.asarray(restored),axis=2).sum()),'detail':detail,'seconds':elapsed})
(HERE/'results/additional-transform-results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps([(r['scale'],r['filter'],r['status']) for r in results]))
