from PIL import Image
import numpy as np

poster = Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg")
p_arr = np.array(poster)

# Let's inspect columns around each hanger:
# Garment 1: x around 179
# Garment 2: x around 411
# Garment 3: x around 646

# Check where garment ends and shadow starts
# Rail is at y = 339
# Shadows are around y = 800..900
# Tagline "Wear the reminder." is around y = 940..980

print("Hanger hook top y:", 339)
# Find tagline at bottom
for y in range(920, 1000):
    row_text = p_arr[y, 300:520, :]
    # Text is dark
    if np.min(row_text) < 100:
        print("Tagline text row y =", y)
        break
