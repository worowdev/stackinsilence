import cv2
import numpy as np

def test_garment_cutout(img_path, out_path):
    img = cv2.imread(img_path)
    H, W, _ = img.shape

    bg_left = img[:, 10:40, :].mean(axis=1)
    bg_right = img[:, 320:350, :].mean(axis=1)
    bg_row = (bg_left + bg_right) / 2.0
    bg_img = np.tile(bg_row[:, np.newaxis, :], (1, W, 1))

    diff = np.linalg.norm(img.astype(float) - bg_img, axis=-1)

    mask = np.zeros((H, W), dtype=np.uint8)

    # Rail top
    mask[:135, :] = cv2.GC_BGD
    mask[135:142, :] = cv2.GC_BGD
    mask[135:142, 175:185] = cv2.GC_PR_FGD

    # Bottom shadow & tagline
    mask[530:, :] = cv2.GC_BGD

    in_body = (np.arange(H)[:, None] >= 142) & (np.arange(H)[:, None] <= 530)
    mask[in_body & (diff > 16.0)] = cv2.GC_FGD
    mask[in_body & (diff >= 7.0) & (diff <= 16.0)] = cv2.GC_PR_FGD
    mask[in_body & (diff < 7.0)] = cv2.GC_PR_BGD
    mask[in_body & (diff < 3.0)] = cv2.GC_BGD
    mask[in_body & ((np.arange(W)[None, :] < 20) | (np.arange(W)[None, :] > 340))] = cv2.GC_BGD

    bgdModel = np.zeros((1, 65), np.float64)
    fgdModel = np.zeros((1, 65), np.float64)

    cv2.grabCut(img, mask, None, bgdModel, fgdModel, 3, cv2.GC_INIT_WITH_MASK)

    final_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    final_mask[:135, :] = 0
    final_mask[135:140, :175] = 0
    final_mask[135:140, 185:] = 0
    final_mask[530:, :] = 0

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(final_mask)
    if num_labels > 1:
        largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        final_mask = np.uint8(labels == largest_label) * 255

    feathered = cv2.GaussianBlur(final_mask, (3, 3), 0.8)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = feathered
    cv2.imwrite(out_path, rgba)
    print("Saved", out_path)

test_garment_cutout("test_tshirt/tshirt_frames/frame_0001.png", "test_tshirt_cutout.png")
test_garment_cutout("test_shirt/shirt_frames/frame_0001.png", "test_shirt_cutout.png")
