from PIL import Image
import numpy as np

poster = np.array(Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg"))
# Look at column 285 (gap between garment 1 and 2)
col_gap = poster[345:780, 285, :]
col_left = poster[345:780, 25, :]
col_right = poster[345:780, 790, :]

print("At y=500: left =", col_left[500-345], "gap =", col_gap[500-345], "right =", col_right[500-345])
print("At y=650: left =", col_left[650-345], "gap =", col_gap[650-345], "right =", col_right[650-345])
print("At y=720: left =", col_left[720-345], "gap =", col_gap[720-345], "right =", col_right[720-345])
