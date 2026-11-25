#!/usr/bin/env python3
"""
Clean hanger hooks and repair edge-on hanger dropouts across all viewer sequences.
- Removes severed wire hook stubs across all 270 frames.
- Interpolates missing hanger in arch-longsleeve frames 43 and 44.
- Flushes the top of each hanger to a smooth, flawless luxury arch.
"""

import os
import glob
from PIL import Image
import numpy as np

PUBLIC_DIR = 'public/assets/viewer'

def repair_arch_longsleeve_dropout():
    f42_path = os.path.join(PUBLIC_DIR, 'arch-longsleeve', '0042.webp')
    f45_path = os.path.join(PUBLIC_DIR, 'arch-longsleeve', '0045.webp')
    f43_path = os.path.join(PUBLIC_DIR, 'arch-longsleeve', '0043.webp')
    f44_path = os.path.join(PUBLIC_DIR, 'arch-longsleeve', '0044.webp')

    im42 = np.array(Image.open(f42_path).convert('RGBA'))
    im45 = np.array(Image.open(f45_path).convert('RGBA'))
    im43 = np.array(Image.open(f43_path).convert('RGBA'))
    im44 = np.array(Image.open(f44_path).convert('RGBA'))

    # Region to interpolate: y in [35, 198]
    # For frame 43: 2/3 f42 + 1/3 f45
    h_43 = (im42[35:198, :, :].astype(float) * (2.0 / 3.0) + im45[35:198, :, :].astype(float) * (1.0 / 3.0)).astype(np.uint8)
    # For frame 44: 1/3 f42 + 2/3 f45
    h_44 = (im42[35:198, :, :].astype(float) * (1.0 / 3.0) + im45[35:198, :, :].astype(float) * (2.0 / 3.0)).astype(np.uint8)

    im43[35:198, :, :] = h_43
    im44[35:198, :, :] = h_44

    Image.fromarray(im43, 'RGBA').save(f43_path, 'WEBP', quality=85)
    Image.fromarray(im44, 'RGBA').save(f44_path, 'WEBP', quality=85)
    print("Repaired arch-longsleeve frames 43 and 44 hanger dropout.")

def clean_frames():
    configs = {
        'arch-longsleeve': {
            'cut_y': 35,
            'check_y_max': 38,
            'max_w_stub': 20,
        },
        'all-we-need-tee': {
            'cut_y': 35,
            'check_y_max': 38,
            'max_w_stub': 20,
        },
        'money-rose-shirt': {
            'cut_y': 49,
            'check_y_max': 53,
            'max_w_stub': 20,
        }
    }

    for slug, cfg in configs.items():
        frame_paths = sorted(glob.glob(os.path.join(PUBLIC_DIR, slug, '*.webp')))
        print(f"Cleaning {len(frame_paths)} frames for {slug}...")

        cut_y = cfg['cut_y']
        check_y_max = cfg['check_y_max']
        max_w = cfg['max_w_stub']

        for fpath in frame_paths:
            im = Image.open(fpath).convert('RGBA')
            arr = np.array(im)

            # 1. Zero out any pixels above cut_y (the hook stub)
            arr[:cut_y, :, :] = 0

            # 2. Check rows between cut_y and check_y_max for narrow stubs (width < max_w)
            # Only if garment width in this row is small (avoid cutting side view hanger)
            # In side view, the hanger body width at y=35..50 is >= 18px. If it's a 1-6px tip, clear it.
            for y in range(cut_y, min(check_y_max, arr.shape[0])):
                row_alpha = arr[y, :, 3]
                nz = np.where(row_alpha > 30)[0]
                if len(nz) > 0:
                    width = nz[-1] - nz[0] + 1
                    if width <= 8:  # narrow tip/nipple sticking out of apex
                        arr[y, nz, :] = 0

            # Save back cleaned webp
            out_img = Image.fromarray(arr, 'RGBA')
            out_img.save(fpath, 'WEBP', quality=85)

    print("All frames cleaned successfully!")

if __name__ == '__main__':
    repair_arch_longsleeve_dropout()
    clean_frames()
