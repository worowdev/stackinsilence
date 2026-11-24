from PIL import Image
import numpy as np
import scipy.ndimage

clean = np.array(Image.open("test_clean_plate_v3.jpg"))
H, W, _ = clean.shape

# The hem ghosts are around y in [710, 765]
# Let's check the floor color right above the shadows (y around 770)
# and smoothly interpolate from y=700 down to y=780
floor_line = clean[775, :, :] # shape (W, 3)
wall_line = clean[700, :, :]  # shape (W, 3)

for y in range(705, 775):
    t = (y - 705) / 70.0
    clean[y, :, :] = np.clip((1.0 - t) * wall_line + t * floor_line, 0, 255).astype(np.uint8)

# Add matching subtle film grain
np.random.seed(42)
grain = np.random.normal(0, 1.0, (70, W, 3))
clean[705:775, :, :] = np.clip(clean[705:775, :, :].astype(float) + grain, 0, 255).astype(np.uint8)

Image.fromarray(clean).save("test_clean_plate_v4.jpg", quality=98)
print("Saved test_clean_plate_v4.jpg")
