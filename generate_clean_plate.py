from PIL import Image
import numpy as np
import cv2

poster = np.array(Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg"))
H, W, _ = poster.shape

clean = poster.copy()

# The garments hang from y=342 (just under the rail) down to y=760 (just above the floor shadows)
# Left and right margins: x in [0, 45] and x in [775, W]
y_start = 342
y_end = 760

for y in range(y_start, y_end):
    c_left = poster[y, 0:35, :].mean(axis=0)
    c_right = poster[y, W-35:W, :].mean(axis=0)
    
    # Linear interpolation from left to right
    for x in range(W):
        t = x / float(W - 1)
        clean[y, x, :] = (1.0 - t) * c_left + t * c_right

# Add subtle matching grain (std ~ 1.5) so it doesn't look unnaturally flat
np.random.seed(42)
noise = np.random.normal(0, 1.2, (y_end - y_start, W, 3))
clean[y_start:y_end, :, :] = np.clip(clean[y_start:y_end, :, :] + noise, 0, 255).astype(np.uint8)

# Feather the transition at y_end so it merges seamlessly into the shadow area
feather_h = 25
for i in range(feather_h):
    y = y_end - feather_h + i
    alpha = (i + 1) / float(feather_h)
    clean[y, :, :] = (1.0 - alpha) * clean[y, :, :] + alpha * poster[y, :, :]

# Clean up any hanger fragments right on the rail at y=338..342
# Rail is a horizontal steel bar. In empty areas (e.g. x in [10..50]), rail profile is clean:
clean_rail_section = poster[336:343, 15:35, :].mean(axis=1) # shape (7, 3)
for x in range(W):
    # If there is a dark hanger hook at y=340..343 where x is around 179, 411, 646:
    pass

Image.fromarray(clean.astype(np.uint8)).save("test_clean_plate.jpg", quality=95)
print("Saved test_clean_plate.jpg")
