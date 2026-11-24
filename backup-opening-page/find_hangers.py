from PIL import Image
import numpy as np

poster = Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg")
p_arr = np.array(poster)

# Let's inspect the row just below the rail (y = 345..370)
# Dark hanger hooks are hanging down at 3 distinct x coordinates!
hook_row = p_arr[350:370, :, :].mean(axis=0).mean(axis=-1)
# Find local minima in brightness
import scipy.signal

# Smooth signal
smooth = np.convolve(hook_row, np.ones(15)/15, mode='same')
minima, _ = scipy.signal.find_peaks(-smooth, distance=150)
print("Hook X locations:", minima)
for m in minima:
    print("X =", m, "(%.2f%% of poster width)" % (m / 819.0 * 100))
