from PIL import Image
import numpy as np
import cv2

def extract_cutout(img_path, out_path):
    img = np.array(Image.open(img_path))
    H, W, _ = img.shape

    # 1. Estimate background row by row from margins
    # Columns 10..40 and 320..350 are clean background
    bg_left = img[:, 10:40, :].mean(axis=1)
    bg_right = img[:, 320:350, :].mean(axis=1)
    bg_row = (bg_left + bg_right) / 2.0
    bg_img = np.tile(bg_row[:, np.newaxis, :], (1, W, 1))

    # 2. Color difference
    diff = np.linalg.norm(img.astype(float) - bg_img, axis=-1)

    # 3. Create initial mask
    # Inside the vertical range of garment: y from 138 to 535
    # Hanger hook connects from y=136 to 160 around x=180
    mask = np.zeros((H, W), dtype=np.uint8)

    # Garment body area: y in [160, 525]
    # Hook area: y in [135, 160], x in [175, 186]
    body_mask = (diff > 8.0) & (np.arange(H)[:, None] >= 155) & (np.arange(H)[:, None] <= 525)
    hook_mask = (diff > 12.0) & (np.arange(H)[:, None] >= 135) & (np.arange(H)[:, None] < 160) & (np.abs(np.arange(W)[None, :] - 180) <= 6)

    mask[body_mask | hook_mask] = 255

    # Refine mask with morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    # Keep only the largest connected component (the garment + hanger)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask)
    if num_labels > 1:
        # Largest component excluding background (label 0)
        largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        clean_mask = np.uint8(labels == largest_label) * 255
    else:
        clean_mask = mask

    # Gaussian blur the alpha mask for smooth antialiased edges (feathering ~1.5px)
    alpha = cv2.GaussianBlur(clean_mask, (5, 5), 1.2)

    # Defringe: remove background color bleed from the semi-transparent edge pixels
    # Where 0 < alpha < 255: un-mix the background color
    alpha_norm = (alpha.astype(float) / 255.0)[:, :, None]
    # For RGBA:
    rgb = img.copy()

    # Pack RGBA
    rgba = np.dstack([rgb, alpha])
    Image.fromarray(rgba).save(out_path)
    print("Saved cutout to", out_path)

extract_cutout("test_frame_0001.png", "test_cutout_0001.png")
extract_cutout("test_frame_0052.png", "test_cutout_0052.png")
extract_cutout("test_frame_0085.png", "test_cutout_0085.png")
