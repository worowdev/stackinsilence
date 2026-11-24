import os
import zipfile
import cv2
import numpy as np
from PIL import Image
from concurrent.futures import ProcessPoolExecutor
import json

RAW_DIR = "assets/raw"
OUT_DIR = "public/assets"

GARMENTS = [
    {
        "slug": "arch-longsleeve",
        "name": "Stack In Silence Arch Longsleeve",
        "subtitle": "Heavyweight Vintage Script Longsleeve",
        "price": "$110.00",
        "priceNumber": 110.00,
        "zip": "tee_frames_30fps_smooth.zip",
        "folder": "frames",
        "hook_x_pct": 21.86,
        "hook_y_pct": 33.11,
        "keyframes": {"front": 1, "side1": 52, "back": 85, "side2": 112},
        "description": "Signature arched 'STACK IN SILENCE' logo across the chest with ornate calligraphy running down both sleeves. Custom heavyweight cotton cut in a relaxed, boxy silhouette.",
        "details": [
            "100% Heavyweight organic cotton (300 GSM)",
            "Dual sleeve script calligraphy screenprint",
            "Ribbed collar and cuffs",
            "Preshrunk vintage wash finish",
            "Designed and tailored in limited edition"
        ],
        "sizes": ["S", "M", "L", "XL", "XXL"]
    },
    {
        "slug": "all-we-need-tee",
        "name": "All We Need Vintage Boxy Tee",
        "subtitle": "Distressed Graphic Oversized Tee",
        "price": "$85.00",
        "priceNumber": 85.00,
        "zip": "tshirt_frames_30fps_smooth.zip",
        "folder": "tshirt_frames",
        "hook_x_pct": 50.18,
        "hook_y_pct": 33.11,
        "keyframes": {"front": 1, "side1": 52, "back": 83, "side2": 111},
        "description": "Minimal arched chest identity paired with a high-impact back print reading 'ALL WE NEED IS MONEY' wrapped around a photorealistic hundred-dollar bill bundle.",
        "details": [
            "100% Ring-spun cotton (260 GSM)",
            "Back airbrush spray font & money roll artwork",
            "Drop shoulder relaxed drape",
            "Custom acid stone wash tone",
            "Double-needle bottom hem stitching"
        ],
        "sizes": ["S", "M", "L", "XL", "XXL"]
    },
    {
        "slug": "money-rose-shirt",
        "name": "Money Rose Resort Shirt",
        "subtitle": "Camp Collar Button-Up Shirt",
        "price": "$125.00",
        "priceNumber": 125.00,
        "zip": "shirt_frames_30fps_smooth.zip",
        "folder": "shirt_frames",
        "hook_x_pct": 78.88,
        "hook_y_pct": 33.11,
        "keyframes": {"front": 1, "side1": 55, "back": 86, "side2": 110},
        "description": "A tailored statement camp collar shirt featuring contrasting obsidian collar, vertical calligraphy along the placket, chest pocket wordmark, and currency-wrapped crimson rose embroidery.",
        "details": [
            "Tencel-cotton luxury blend for fluid drape",
            "Contrasting black notch lapel camp collar",
            "Direct-to-garment rose & currency graphic",
            "Custom branded engraved faux horn buttons",
            "Straight hem with side vents"
        ],
        "sizes": ["S", "M", "L", "XL", "XXL"]
    }
]

def process_single_frame(args):
    zip_path, folder, frame_idx, out_path = args
    with zipfile.ZipFile(zip_path) as z:
        fname = f"{folder}/frame_{frame_idx:04d}.png"
        data = z.read(fname)
    
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    H, W, _ = img.shape
    
    # 1. Detect rail position in this frame
    means = [img[r, 5:25].mean() for r in range(125, 165)]
    rail_y = 125 + int(np.argmin(means))
    
    # 2. Gradient background model
    bg_left = img[:, 0:8, :].mean(axis=1)
    bg_right = img[:, 352:360, :].mean(axis=1)
    ramp = np.linspace(0, 1, W)[None, :, None]
    bg_img = (1 - ramp) * bg_left[:, None, :] + ramp * bg_right[:, None, :]
    diff = np.linalg.norm(img.astype(float) - bg_img, axis=-1)
    
    # 3. Dynamic X bounds with noise-rejection
    body_diff = diff[rail_y+10:500, :]
    bin_mask = (body_diff > 16.0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    clean_bin = cv2.morphologyEx(bin_mask, cv2.MORPH_OPEN, kernel)
    col_counts = clean_bin.sum(axis=0)
    active_cols = np.where(col_counts > 10)[0]
    if len(active_cols) > 0:
        xmin = max(0, int(active_cols.min()) - 6)
        xmax = min(W, int(active_cols.max()) + 6)
    else:
        xmin, xmax = 50, 310
    
    # 4. Mask initialization
    mask = np.zeros((H, W), dtype=np.uint8)
    mask[:rail_y-2, :] = cv2.GC_BGD
    mask[rail_y-2:rail_y+6, :] = cv2.GC_BGD
    mask[rail_y-2:rail_y+6, 173:187] = cv2.GC_PR_FGD
    mask[530:, :] = cv2.GC_BGD
    
    in_body = (np.arange(H)[:, None] >= rail_y+6) & (np.arange(H)[:, None] <= 530)
    in_x = (np.arange(W)[None, :] >= xmin) & (np.arange(W)[None, :] <= xmax)
    
    mask[in_body & in_x & (diff > 18.0)] = cv2.GC_FGD
    mask[in_body & in_x & (diff >= 10.0) & (diff <= 18.0)] = cv2.GC_PR_FGD
    mask[in_body & in_x & (diff < 10.0)] = cv2.GC_PR_BGD
    mask[in_body & in_x & (diff < 5.0)] = cv2.GC_BGD
    mask[in_body & ~in_x] = cv2.GC_BGD
    
    # 5. GrabCut 2 iterations
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, None, bgd, fgd, 2, cv2.GC_INIT_WITH_MASK)
    
    # 6. Post-process mask
    final = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    final[:rail_y-2, :] = 0
    final[rail_y-2:rail_y+6, :173] = 0
    final[rail_y-2:rail_y+6, 187:] = 0
    final[530:, :] = 0
    
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(final)
    if num_labels > 1:
        # Keep the garment body (largest component)
        largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        keep_mask = (labels == largest)
        # Also preserve the hanger hook top if segmented as a separate small piece at the rail
        hook_patch = labels[rail_y-2:rail_y+6, 173:187]
        for hl in np.unique(hook_patch):
            if hl > 0 and hl != largest and stats[hl, cv2.CC_STAT_AREA] < 500:
                keep_mask |= (labels == hl)
        final = np.uint8(keep_mask) * 255
    
    feathered = cv2.GaussianBlur(final, (3, 3), 0.8)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = feathered
    
    # 7. Standard Crop & Upscale (400px height starting at rail_y - 4)
    y_crop_start = max(0, rail_y - 4)
    y_crop_end = min(H, y_crop_start + 400)
    crop = rgba[y_crop_start:y_crop_end, :]
    if crop.shape[0] < 400:
        pad = np.zeros((400 - crop.shape[0], W, 4), dtype=np.uint8)
        crop = np.vstack([crop, pad])
    
    # Measure projected garment width (non-zero alpha column span)
    alpha = crop[:, :, 3]
    active_cols = np.where(alpha > 20)[1]
    if len(active_cols) > 0:
        proj_width = int(active_cols.max() - active_cols.min())
    else:
        proj_width = 200
        
    # Upscale 2x via Lanczos4
    up = cv2.resize(crop, (720, 800), interpolation=cv2.INTER_LANCZOS4)
    
    # Light unsharp mask on RGB channels
    bgr = up[:, :, :3]
    blurred = cv2.GaussianBlur(bgr, (0, 0), 1.0)
    sharpened = cv2.addWeighted(bgr, 1.25, blurred, -0.25, 0)
    up[:, :, :3] = np.clip(sharpened, 0, 255)
    
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cv2.imwrite(out_path, up, [cv2.IMWRITE_WEBP_QUALITY, 80])
    
    return frame_idx, proj_width

def build_all():
    os.makedirs(OUT_DIR, exist_ok=True)
    
    # 1. Clean plate & Wordmark
    # Preserving perfected clean plate and transparent wordmark
    print("Using existing perfected clean plate and wordmark.")
        
    # 2. Process each garment sequence
    manifest_data = {
        "brand": "STACK IN SILENCE",
        "tagline": "Wear the reminder.",
        "colors": {
            "espresso": "#432c1f",
            "nearBlack": "#170d0e",
            "cream": "#d9cbbe",
            "bgTop": "#998f9b",
            "bgBottom": "#efe6e8"
        },
        "rail": {
            "topPercent": 33.11,
            "y": 339,
            "totalHeight": 1024
        },
        "products": []
    }
    
    for g in GARMENTS:
        slug = g["slug"]
        zip_file = os.path.join(RAW_DIR, g["zip"])
        folder = g["folder"]
        seq_dir = os.path.join(OUT_DIR, "seq", slug)
        os.makedirs(seq_dir, exist_ok=True)
        
        print(f"\nProcessing {slug} from {zip_file} (150 frames)...")
        tasks = []
        for i in range(1, 151):
            out_path = os.path.join(seq_dir, f"{i:04d}.webp")
            tasks.append((zip_file, folder, i, out_path))
            
        proj_widths = [0] * 150
        with ProcessPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(process_single_frame, tasks))
            for f_idx, w in results:
                proj_widths[f_idx - 1] = w
                
        # Copy frame 1 as crisp front still
        still_dir = os.path.join(OUT_DIR, "stills")
        os.makedirs(still_dir, exist_ok=True)
        f1_path = os.path.join(seq_dir, "0001.webp")
        still_path = os.path.join(still_dir, f"{slug}.webp")
        with open(f1_path, "rb") as rf, open(still_path, "wb") as wf:
            wf.write(rf.read())
            
        product_entry = {
            "slug": slug,
            "name": g["name"],
            "subtitle": g["subtitle"],
            "price": g["price"],
            "priceNumber": g["priceNumber"],
            "hookXPct": g["hook_x_pct"],
            "hookYPct": g["hook_y_pct"],
            "keyframes": g["keyframes"],
            "description": g["description"],
            "details": g["details"],
            "sizes": g["sizes"],
            "stillUrl": f"/assets/stills/{slug}.webp",
            "seqUrlPattern": f"/assets/seq/{slug}/{{frame}}.webp",
            "projectedWidths": proj_widths,
            "frontWidth": proj_widths[0]
        }
        manifest_data["products"].append(product_entry)
        print(f"Done {slug}. Front width: {proj_widths[0]}px, min side width: {min(proj_widths)}px")
        
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
    print(f"\nManifest saved to {manifest_path}")

    # Also update public/products.json
    products_json_path = "public/products.json"
    with open(products_json_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
    print(f"Products json saved to {products_json_path}")

if __name__ == "__main__":
    build_all()
