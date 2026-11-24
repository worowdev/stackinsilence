import cv2
import numpy as np

poster = cv2.imread("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg")
H, W, _ = poster.shape

# Create inpaint mask:
# Garments are located between y=342 and y=760, and between x=45 and x=775
inpaint_mask = np.zeros((H, W), dtype=np.uint8)
inpaint_mask[342:760, 45:775] = 255

# Inpaint using Telea
clean = cv2.inpaint(poster, inpaint_mask, inpaintRadius=15, flags=cv2.INPAINT_TELEA)

# Also inpaint Navier-Stokes for comparison
clean_ns = cv2.inpaint(poster, inpaint_mask, inpaintRadius=15, flags=cv2.INPAINT_NS)

cv2.imwrite("test_inpaint_telea.jpg", clean)
cv2.imwrite("test_inpaint_ns.jpg", clean_ns)
print("Inpaint complete")
