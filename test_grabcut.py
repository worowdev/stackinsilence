import cv2
import numpy as np
from PIL import Image

img = cv2.imread("test_frame_0001.png")
H, W, _ = img.shape

# Initial mask
# 0 = cv2.GC_BGD (background)
# 1 = cv2.GC_FGD (foreground)
# 2 = cv2.GC_PR_BGD (probable background)
# 3 = cv2.GC_PR_FGD (probable foreground)
mask = np.zeros((H, W), dtype=np.uint8)

# Bounding box around garment + hanger
# The garment is inside x in [45, 315], y in [140, 525]
rect = (45, 140, 270, 385)

# Initialize background and foreground models
bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)

# Run grabCut with bounding box
cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_RECT)

# Pixels marked as foreground or probable foreground
final_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)

# Smooth edges
feathered = cv2.GaussianBlur(final_mask, (5, 5), 1.0)

# Create RGBA
rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
rgba[:, :, 3] = feathered

cv2.imwrite("test_grabcut_0001.png", rgba)
print("GrabCut complete, saved to test_grabcut_0001.png")
