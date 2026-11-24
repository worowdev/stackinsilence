from PIL import Image
import numpy as np

poster = Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg")
print("Poster size:", poster.size)

# Poster width = 819, height = 1024
# Let's locate where the rail is in the poster
p_arr = np.array(poster)
# Find the rail: dark line across the image around y = 0.33 * 1024 = 338
for y in range(320, 360):
    row = p_arr[y, 100:700, :]
    # Rail is dark
    if np.mean(row) < 60:
        print("Found rail at y =", y, "mean color:", np.mean(row, axis=0))
