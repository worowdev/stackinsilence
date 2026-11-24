from PIL import Image
import numpy as np
import scipy.interpolate

poster = np.array(Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg"))
H, W, _ = poster.shape
clean = poster.copy()

# Sample 4 clean vertical columns:
# x=25 (left edge), x=287 (gap 1-2), x=523 (gap 2-3), x=792 (right edge)
anchors_x = np.array([0, 25, 287, 523, 792, W - 1], dtype=float)

y_start = 342
y_end = 770

# For each channel, build a 2D smooth surface
for ch in range(3):
    # Anchor columns values
    col0 = poster[y_start:y_end, 0:15, ch].mean(axis=1)
    col1 = poster[y_start:y_end, 20:35, ch].mean(axis=1)
    col2 = poster[y_start:y_end, 284:290, ch].mean(axis=1)
    col3 = poster[y_start:y_end, 520:526, ch].mean(axis=1)
    col4 = poster[y_start:y_end, 785:800, ch].mean(axis=1)
    col5 = poster[y_start:y_end, W-15:W, ch].mean(axis=1)

    anchor_grid = np.column_stack([col0, col1, col2, col3, col4, col5])
    
    # Interpolate for all x in 0..W-1 across each row
    for row_idx, y in enumerate(range(y_start, y_end)):
        interp_func = scipy.interpolate.PchipInterpolator(anchors_x, anchor_grid[row_idx, :])
        clean[y, :, ch] = np.clip(interp_func(np.arange(W)), 0, 255)

# Smooth blend at y_start and y_end
feather = 30
for i in range(feather):
    y = y_end - feather + i
    w = (i + 1) / float(feather)
    clean[y, :, :] = (1.0 - w) * clean[y, :, :] + w * poster[y, :, :]

# Add fine matching studio film grain
np.random.seed(42)
grain = np.random.normal(0, 1.2, (y_end - y_start, W, 3))
clean[y_start:y_end, :, :] = np.clip(clean[y_start:y_end, :, :].astype(float) + grain, 0, 255).astype(np.uint8)

# Clean the 3 tiny hanger loop fragments touching the rail at y=338..342
# In clean areas of the rail (e.g. x=100), the rail is smooth
clean_rail = poster[336:343, 80:120, :].mean(axis=1)
for hx in [179, 411, 646]:
    for dx in range(-12, 13):
        weight = 1.0 - abs(dx) / 12.0
        clean[337:344, hx + dx, :] = (
            (1.0 - weight) * clean[337:344, hx + dx, :] + weight * clean_rail
        )

Image.fromarray(clean.astype(np.uint8)).save("test_clean_plate_v2.jpg", quality=98)
print("Saved test_clean_plate_v2.jpg")
