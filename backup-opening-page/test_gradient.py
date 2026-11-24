from PIL import Image
import numpy as np

# Load frame 52 (thin side view)
f52 = np.array(Image.open("test_frame_0052.png"), dtype=float)

# In frame 52, garment is strictly within x in [140, 220]
# Left margin x in [0, 80], right margin x in [280, 359]
left_bg = f52[:, 10:50, :]
right_bg = f52[:, 310:350, :]

print("Left margin mean at y=250:", left_bg[250].mean(axis=0))
print("Right margin mean at y=250:", right_bg[250].mean(axis=0))

print("Left margin std across x at y=250:", left_bg[250].std(axis=0))
print("Right margin std across x at y=250:", right_bg[250].std(axis=0))
