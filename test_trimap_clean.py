import cv2
import numpy as np

img = cv2.imread("test_frame_0001.png")
H, W, _ = img.shape

bg_left = img[:, 10:40, :].mean(axis=1)
bg_right = img[:, 320:350, :].mean(axis=1)
bg_row = (bg_left + bg_right) / 2.0
bg_img = np.tile(bg_row[:, np.newaxis, :], (1, W, 1))

diff = np.linalg.norm(img.astype(float) - bg_img, axis=-1)

mask = np.zeros((H, W), dtype=np.uint8)

# The rail is at y in [130, 138]. Everything y <= 138 is BGD, EXCEPT hook neck at x in [177, 183] down from y=135
mask[:135, :] = cv2.GC_BGD
# Between y=135 and 142, only x in [176, 184] can be foreground (the hook touching the rail)
mask[135:142, :] = cv2.GC_BGD
mask[135:142, 176:185] = cv2.GC_PR_FGD

# Bottom: floor and shadow (y > 525 is BGD)
mask[525:, :] = cv2.GC_BGD

# Main garment body: y in [142, 525]
in_body = (np.arange(H)[:, None] >= 142) & (np.arange(H)[:, None] <= 525)
mask[in_body & (diff > 16.0)] = cv2.GC_FGD
mask[in_body & (diff >= 7.0) & (diff <= 16.0)] = cv2.GC_PR_FGD
mask[in_body & (diff < 7.0)] = cv2.GC_PR_BGD
mask[in_body & (diff < 3.0)] = cv2.GC_BGD
# Far margins are definitely background
mask[in_body & ((np.arange(W)[None, :] < 25) | (np.arange(W)[None, :] > 335))] = cv2.GC_BGD

bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)

cv2.grabCut(img, mask, None, bgdModel, fgdModel, 3, cv2.GC_INIT_WITH_MASK)

final_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
# Zero out rail strictly
final_mask[:135, :] = 0
final_mask[135:140, :176] = 0
final_mask[135:140, 185:] = 0
final_mask[525:, :] = 0

# Keep largest component
num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(final_mask)
if num_labels > 1:
    largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    final_mask = np.uint8(labels == largest_label) * 255

feathered = cv2.GaussianBlur(final_mask, (3, 3), 0.8)
rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
rgba[:, :, 3] = feathered
cv2.imwrite("test_trimap_clean.png", rgba)
print("Saved test_trimap_clean.png")
