from PIL import Image
import numpy as np

f1 = np.array(Image.open("test_frame_0001.png"), dtype=float)
f52 = np.array(Image.open("test_frame_0052.png"), dtype=float)

# Construct estimated background image bg[y, x] from the clean margins of f52
# For each row y, bg[y] is the mean of columns 10..50 and 310..350 in f52
bg_row = (f52[:, 10:50, :].mean(axis=1) + f52[:, 310:350, :].mean(axis=1)) / 2.0
bg_img = np.tile(bg_row[:, np.newaxis, :], (1, 360, 1))

diff = np.linalg.norm(f1 - bg_img, axis=-1)

# Check diff distribution inside garment (e.g. y in 200..450, x in 100..260)
inside = diff[200:450, 100:260]
outside = diff[200:450, 0:50]

print("Diff outside garment: min=%.1f, mean=%.1f, max=%.1f" % (outside.min(), outside.mean(), outside.max()))
print("Diff inside garment: min=%.1f, mean=%.1f, max=%.1f" % (inside.min(), inside.mean(), inside.max()))
print("Percentage of pixels inside garment with diff > 5:", np.mean(inside > 5) * 100)
print("Percentage of pixels inside garment with diff > 8:", np.mean(inside > 8) * 100)
