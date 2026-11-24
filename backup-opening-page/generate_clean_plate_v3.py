from PIL import Image
import numpy as np
import scipy.ndimage

poster = np.array(Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg"))
H, W, _ = poster.shape
clean = poster.copy()

y_start = 343 # just below rail
y_end = 770   # above floor shadows

# Extract left and right margin profiles from y=300 to y=850
# Left margin x in [5, 30], Right margin x in [W-30, W-5]
margin_left = poster[:, 5:30, :].mean(axis=1) # shape (H, 3)
margin_right = poster[:, W-30:W-5, :].mean(axis=1)

# Heavily smooth margin profiles vertically with a large 1D Gaussian filter
# so there are NO abrupt steps or local shadows in the profile!
margin_left_smooth = scipy.ndimage.gaussian_filter1d(margin_left, sigma=25, axis=0)
margin_right_smooth = scipy.ndimage.gaussian_filter1d(margin_right, sigma=25, axis=0)

# Fill y from y_start to y_end by smooth horizontal linear interpolation
for y in range(y_start, y_end):
    c_l = margin_left_smooth[y]
    c_r = margin_right_smooth[y]
    # Linear ramp across x
    weights = np.linspace(0.0, 1.0, W)[:, None]
    clean[y, :, :] = (1.0 - weights) * c_l + weights * c_r

# Soft blend transition at y_start (rail)
blend_top = 8
for i in range(blend_top):
    y = y_start + i
    w = (i + 1) / float(blend_top)
    clean[y, :, :] = (1.0 - w) * poster[y, :, :] + w * clean[y, :, :]

# Soft blend transition at y_end (floor shadow transition)
blend_bot = 35
for i in range(blend_bot):
    y = y_end - blend_bot + i
    w = (i + 1) / float(blend_bot)
    clean[y, :, :] = (1.0 - w) * clean[y, :, :] + w * poster[y, :, :]

# Clean up any hanger fragments on the rail at y=338..342
# In clean areas of the rail (e.g. x=80..120), the rail is smooth
clean_rail = poster[336:343, 80:120, :].mean(axis=1)
for hx in [179, 411, 646]:
    for dx in range(-14, 15):
        weight = 1.0 - abs(dx) / 14.0
        clean[337:344, hx + dx, :] = (
            (1.0 - weight) * clean[337:344, hx + dx, :] + weight * clean_rail
        )

# Add matching subtle film grain (std = 1.0)
np.random.seed(42)
grain = np.random.normal(0, 1.0, (y_end - y_start, W, 3))
clean[y_start:y_end, :, :] = np.clip(clean[y_start:y_end, :, :].astype(float) + grain, 0, 255).astype(np.uint8)

Image.fromarray(clean).save("test_clean_plate_v3.jpg", quality=98)
print("Saved test_clean_plate_v3.jpg")
