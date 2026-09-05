"""Test-only JPEG bridge. Production src/stego.js has no codec dependency."""
import sys
from PIL import Image

source, target, quality = sys.argv[1], sys.argv[2], int(sys.argv[3])
with Image.open(source) as image:
    image.convert("RGB").save(target, "JPEG", quality=quality, optimize=False)
with Image.open(target) as image:
    image.convert("RGB").save(target + ".ppm", "PPM")
