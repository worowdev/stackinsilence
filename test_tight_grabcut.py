import cv2
import numpy as np

img = cv2.imread("test_frame_0052.png")
H, W, _ = img.shape

# Compute background estimate
bg_left = img[:, 10:40, :].mean(axis=1)
bg_right = img[:, 320:350, :].mean(axis=1)
bg_row = (bg_left + bg_right) / 2.0
bg_img = np.tile(bg_row[:, np.newaxis, :], (1, W, 1))

diff = np.linalg.norm(img.astype(float) - bg_img, axis=-1)

# In garment vertical region y in [180, 500]:
col_activity = np.sum(diff[180:500, :] > 10.0, axis=0)
active_cols = np.where(col_activity > 5)[0]

print("Frame 52 active columns:", active_cols.min(), "to", active_cols.max(), "width:", active_cols.max() - active_cols.min())

# Run GrabCut with this tight bounding box!
x0 = max(0, active_cols.min() - 8)
x1 = min(W, active_cols.max() + 8)
y0 = 135
y1 = 525
rect = (x0, y0, x1 - x0, y1 - y0)
print("Using rect:", rect)

mask = np.zeros((H, W), dtype=np.uint8)
bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)

cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_RECT)
final_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)

feathered = cv2.GaussianBlur(final_mask, (3, 3), 0.8)
rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
rgba[:, :, 3] = feathered
cv2.imwrite("test_grabcut_tight_0052.png", rgba)
print("Saved test_grabcut_tight_0052.png")
