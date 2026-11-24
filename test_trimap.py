import cv2, time
import numpy as np

img = cv2.imread("test_frame_0001.png")
H, W, _ = img.shape

# 1. Background estimate from margins
bg_left = img[:, 10:40, :].mean(axis=1)
bg_right = img[:, 320:350, :].mean(axis=1)
bg_row = (bg_left + bg_right) / 2.0
bg_img = np.tile(bg_row[:, np.newaxis, :], (1, W, 1))

diff = np.linalg.norm(img.astype(float) - bg_img, axis=-1)

# 2. Build initial trimap mask
# 0 = BGD, 1 = FGD, 2 = PR_BGD, 3 = PR_FGD
mask = np.zeros((H, W), dtype=np.uint8)

# Outside garment vertical range (y < 135 or y > 530) is DEFINITE BACKGROUND
mask[:135, :] = cv2.GC_BGD
mask[530:, :] = cv2.GC_BGD

# Inside garment vertical range
in_y = (np.arange(H)[:, None] >= 135) & (np.arange(H)[:, None] <= 530)

# Definite foreground: high difference inside body/hook
mask[in_y & (diff > 18.0)] = cv2.GC_FGD

# Probable foreground: moderate difference
mask[in_y & (diff >= 8.0) & (diff <= 18.0)] = cv2.GC_PR_FGD

# Probable background: low difference
mask[in_y & (diff >= 3.5) & (diff < 8.0)] = cv2.GC_PR_BGD

# Definite background: very low difference or far margins
mask[in_y & (diff < 3.5)] = cv2.GC_BGD
mask[in_y & ((np.arange(W)[None, :] < 30) | (np.arange(W)[None, :] > 330))] = cv2.GC_BGD

bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)

t0 = time.time()
cv2.grabCut(img, mask, None, bgdModel, fgdModel, 2, cv2.GC_INIT_WITH_MASK)
dt = time.time() - t0
print(f"Mask-initialized GrabCut took: {dt:.3f} seconds")

final_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)

# Largest connected component
num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(final_mask)
if num_labels > 1:
    largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    final_mask = np.uint8(labels == largest_label) * 255

feathered = cv2.GaussianBlur(final_mask, (3, 3), 0.8)
rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
rgba[:, :, 3] = feathered
cv2.imwrite("test_trimap_grabcut.png", rgba)
print("Saved test_trimap_grabcut.png")
