import cv2
import numpy as np
from PIL import Image
import scipy.ndimage

def build_flawless_clean_plate():
    ref_img = cv2.imread('public/assets/widescreen_reference.jpg')
    H, W, _ = ref_img.shape # 571, 1024
    clean = ref_img.copy()

    # 1. Left and right margins
    margin_left = ref_img[:, 15:80, :].mean(axis=1) # (H, 3)
    margin_right = ref_img[:, W-80:W-15, :].mean(axis=1)

    margin_l_smooth = scipy.ndimage.gaussian_filter1d(margin_left, sigma=20, axis=0)
    margin_r_smooth = scipy.ndimage.gaussian_filter1d(margin_right, sigma=20, axis=0)

    weights = np.linspace(0.0, 1.0, W)[None, :, None]
    bg_gradient = (1.0 - weights) * margin_l_smooth[:, None, :] + weights * margin_r_smooth[:, None, :]

    # 2. Inpaint top area (y in [30, 198]) so the background is 100% clean studio gradient
    # (The crisp wordmark will be rendered via independent HTML <img> at full Retina resolution!)
    for y in range(30, 198):
        for x in range(250, 780):
            t_edge = min((x - 250) / 30.0, (779 - x) / 30.0, 1.0)
            clean[y, x, :] = (1.0 - t_edge) * clean[y, x, :] + t_edge * bg_gradient[y, x, :]

    # 3. Clean steel rail at y=200..206
    clean_rail = ref_img[200:206, 50:150, :].mean(axis=1) # (6, 3)
    for hx in [370, 512, 657]:
        for dx in range(-16, 17):
            w = 1.0 - abs(dx) / 16.0
            clean[201:207, hx + dx, :] = (
                (1.0 - w) * clean[201:207, hx + dx, :] + w * clean_rail
            )

    # 4. Inpaint the ENTIRE garment zone from y=207 all the way down to y=505!
    # This completely eliminates all garment hems, sleeve outlines, and clothes ghosts!
    y_start = 207
    y_end = 505

    for y in range(y_start, y_end):
        clean[y, :, :] = bg_gradient[y, :, :]

    # Soft transition at top just below rail (y=207..212)
    for i in range(5):
        y = y_start + i
        w = (i + 1) / 5.0
        clean[y, :, :] = (1.0 - w) * ref_img[y, :, :] + w * clean[y, :, :]

    # Soft transition into the floor shadow zone (y=500..508)
    # The real floor shadows start at row 508 and peak at row 520
    for i in range(8):
        y = 500 + i
        w = (i + 1) / 8.0
        clean[y, :, :] = (1.0 - w) * clean[y, :, :] + w * ref_img[y, :, :]

    # Rows 509 to 571 are preserved from ref_img (the real soft floor shadows!)

    # 5. Add subtle film grain to matching studio lighting
    np.random.seed(42)
    grain = np.random.normal(0, 0.8, (H, W, 3))
    clean[30:505, :, :] = np.clip(clean[30:505, :, :].astype(float) + grain[30:505, :, :], 0, 255).astype(np.uint8)

    # 6. Upscale to 2K (2048 x 1142) for high DPI displays
    up = cv2.resize(clean, (2048, 1142), interpolation=cv2.INTER_LANCZOS4)

    cv2.imwrite('public/assets/clean_plate.webp', up, [cv2.IMWRITE_WEBP_QUALITY, 94])
    cv2.imwrite('public/assets/clean_plate.jpg', up, [cv2.IMWRITE_JPEG_QUALITY, 96])
    print('Flawless clean plate generated successfully!')

if __name__ == '__main__':
    build_flawless_clean_plate()
