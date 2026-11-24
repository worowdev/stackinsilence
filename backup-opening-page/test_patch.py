from PIL import Image
import numpy as np

# Load poster and frame 1
poster = Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg")
p_arr = np.array(poster, dtype=float)

f1 = Image.open("test_frame_0001.png")
f_arr = np.array(f1, dtype=float)

# In f1, garment region is roughly:
# y: 135 (just below rail) to 585 (including shadow)
# x: 30 to 330 (width 300)
patch = f_arr[135:585, 30:330, :]
H_p, W_p, _ = patch.shape

# Let's create an alpha mask with soft feathering on edges
alpha = np.ones((H_p, W_p), dtype=float)
feather = 20
for i in range(feather):
    factor = (i + 1) / float(feather)
    # top
    alpha[i, :] = np.minimum(alpha[i, :], factor)
    # bottom
    alpha[H_p - 1 - i, :] = np.minimum(alpha[H_p - 1 - i, :], factor)
    # left
    alpha[:, i] = np.minimum(alpha[:, i], factor)
    # right
    alpha[:, W_p - 1 - i] = np.minimum(alpha[:, W_p - 1 - i], factor)

# Let's save the feathered patch as RGBA
rgba_patch = np.dstack([patch, alpha * 255.0])
Image.fromarray(rgba_patch.astype(np.uint8)).save("test_patch_0001.png")

# Now let's test composite onto poster at garment 1 position (x=179, rail y=339)
# The patch rail top is at 135 in frame, so top of patch corresponds to rail
# In poster, rail is at y = 339
# Patch width = 300 (centered at x=180 in frame -> left is -150, right is +150 from center)
# In poster, garment 1 center is at x = 179
# So poster target box:
target_x0 = int(179 - W_p / 2) # 179 - 150 = 29
target_y0 = int(339) # rail position
target_x1 = target_x0 + W_p
target_y1 = target_y0 + H_p

comp = p_arr.copy()
sub_poster = comp[target_y0:target_y1, target_x0:target_x1, :]
blended = sub_poster * (1.0 - alpha[:, :, None]) + patch * alpha[:, :, None]
comp[target_y0:target_y1, target_x0:target_x1, :] = blended

Image.fromarray(comp.astype(np.uint8)).save("test_composite_0001.jpg")
print("Saved test_composite_0001.jpg")
