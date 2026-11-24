import cv2
import numpy as np
from PIL import Image
import scipy.ndimage

def generate_perfect_plate():
    # 1. Load widescreen reference
    ref_img = cv2.imread('public/assets/widescreen_reference.jpg')
    H, W, _ = ref_img.shape # 571, 1024
    
    clean = ref_img.copy()

    # 2. Extract left and right margin profiles for entire height
    margin_left = ref_img[:, 15:80, :].mean(axis=1) # (H, 3)
    margin_right = ref_img[:, W-80:W-15, :].mean(axis=1)

    margin_l_smooth = scipy.ndimage.gaussian_filter1d(margin_left, sigma=20, axis=0)
    margin_r_smooth = scipy.ndimage.gaussian_filter1d(margin_right, sigma=20, axis=0)

    # 3. Inpaint old blurry wordmark area (y in [40, 198], x in [300, 724])
    # Replace with clean horizontal gradient ramp
    weights = np.linspace(0.0, 1.0, W)[None, :, None]
    bg_gradient = (1.0 - weights) * margin_l_smooth[:, None, :] + weights * margin_r_smooth[:, None, :]

    # Inpaint wordmark area
    for y in range(40, 198):
        # Soft lateral blend
        for x in range(300, 725):
            t_edge = min((x - 300) / 25.0, (724 - x) / 25.0, 1.0)
            clean[y, x, :] = (1.0 - t_edge) * clean[y, x, :] + t_edge * bg_gradient[y, x, :]

    # 4. Inpaint garment area completely from y=207 to y=455 (removing all hem ghosts!)
    y_start = 207
    y_end = 455
    
    for y in range(y_start, y_end):
        clean[y, :, :] = bg_gradient[y, :, :]

    # Soft transition at top just below rail (y=207..212)
    for i in range(5):
        y = y_start + i
        w = (i + 1) / 5.0
        clean[y, :, :] = (1.0 - w) * ref_img[y, :, :] + w * clean[y, :, :]

    # Soft transition at bottom right above shadows (y=445..460)
    for i in range(15):
        y = y_end - 15 + i
        w = (i + 1) / 15.0
        clean[y, :, :] = (1.0 - w) * clean[y, :, :] + w * ref_img[y, :, :]

    # 5. Clean hanger hook traces on rail (y=200..206)
    clean_rail = ref_img[200:206, 50:150, :].mean(axis=1) # (6, 3)
    for hx in [370, 512, 657]:
        for dx in range(-14, 15):
            w = 1.0 - abs(dx) / 14.0
            clean[201:207, hx + dx, :] = (
                (1.0 - w) * clean[201:207, hx + dx, :] + w * clean_rail
            )

    # 6. Composite the razor-sharp high-res wordmark from Untitled design (5).png
    # Load crisp wordmark
    wm_rgba = cv2.imread('public/assets/wordmark_crisp.png', cv2.IMREAD_UNCHANGED)
    wm_h, wm_w, _ = wm_rgba.shape

    # In widescreen_reference, the wordmark spans width ~200px (from x=412 to x=612), height ~130px (y=50 to 180)
    # Let's target wordmark width = 205px on the 1024px canvas
    target_wm_w = 210
    target_wm_h = int(wm_h * (target_wm_w / wm_w))
    wm_resized = cv2.resize(wm_rgba, (target_wm_w, target_wm_h), interpolation=cv2.INTER_LANCZOS4)

    # Wordmark center at x=512, y=116
    wm_x0 = 512 - target_wm_w // 2
    wm_y0 = 55
    wm_x1 = wm_x0 + target_wm_w
    wm_y1 = wm_y0 + target_wm_h

    # Alpha composite
    alpha = wm_resized[:, :, 3].astype(float) / 255.0
    for c in range(3):
        clean[wm_y0:wm_y1, wm_x0:wm_x1, c] = (
            (1.0 - alpha) * clean[wm_y0:wm_y1, wm_x0:wm_x1, c] + alpha * wm_resized[:, :, c]
        )

    # 7. Add subtle film grain to matching studio lighting
    np.random.seed(42)
    grain = np.random.normal(0, 0.9, (H, W, 3))
    clean = np.clip(clean.astype(float) + grain, 0, 255).astype(np.uint8)

    # 8. Upscale to 2K (2048 x 1142) for crisp displays
    up = cv2.resize(clean, (2048, 1142), interpolation=cv2.INTER_LANCZOS4)

    # Save final clean plates
    cv2.imwrite('public/assets/clean_plate.webp', up, [cv2.IMWRITE_WEBP_QUALITY, 92])
    cv2.imwrite('public/assets/clean_plate.jpg', up, [cv2.IMWRITE_JPEG_QUALITY, 94])
    print('Successfully generated perfect clean plate (2048x1142 WebP)!')

if __name__ == '__main__':
    generate_perfect_plate()
