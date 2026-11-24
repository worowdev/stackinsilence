from PIL import Image
import numpy as np
import cv2

poster = np.array(Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg"))
clean = np.array(Image.open("test_clean_plate_v4.jpg"))

diff = np.linalg.norm(poster.astype(float) - clean.astype(float), axis=-1)

# Garment 1: x in [50, 310]
# Garment 2: x in [290, 530]
# Garment 3: x in [510, 770]
# y in [336, 750]

for idx, (x0, x1, name) in enumerate([
    (40, 315, "longsleeve_still"),
    (290, 535, "tshirt_still"),
    (515, 780, "shirt_still")
]):
    sub_poster = poster[336:750, x0:x1]
    sub_diff = diff[336:750, x0:x1]
    
    # Mask
    raw_mask = (sub_diff > 8.0).astype(np.uint8) * 255
    # Morph close
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    closed = cv2.morphologyEx(raw_mask, cv2.MORPH_CLOSE, kernel)
    
    # Keep largest component
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(closed)
    if num_labels > 1:
        largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        clean_mask = np.uint8(labels == largest_label) * 255
    else:
        clean_mask = closed

    # Feather alpha edge ~1px
    alpha = cv2.GaussianBlur(clean_mask, (3, 3), 0.8)
    
    rgba = np.dstack([sub_poster, alpha])
    Image.fromarray(rgba).save(f"test_{name}.png")
    print(f"Saved test_{name}.png, size={rgba.shape}")
