import cv2, time
import numpy as np

img = cv2.imread("test_frame_0001.png")
H, W, _ = img.shape
rect = (40, 135, 280, 390)

mask = np.zeros((H, W), dtype=np.uint8)
bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)

t0 = time.time()
cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 3, cv2.GC_INIT_WITH_RECT)
dt = time.time() - t0
print(f"GrabCut (3 iters) took: {dt:.3f} seconds")
