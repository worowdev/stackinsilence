from PIL import Image
import numpy as np

# Load f1, f52, f85, f112
f1 = np.array(Image.open("test_frame_0001.png"), dtype=float)
f52 = np.array(Image.open("test_frame_0052.png"), dtype=float)
f85 = np.array(Image.open("test_frame_0085.png"), dtype=float)
f112 = np.array(Image.open("test_frame_0112.png"), dtype=float)

# In f52 and f112, x < 120 and x > 240 are completely empty background!
# Let's inspect the background colors at x=20 across different rows:
print("Row y=10 (above logo):", f1[10, 20])
print("Row y=80 (logo level):", f52[80, 20])
print("Row y=135 (rail level):", f52[135, 20])
print("Row y=200 (chest level):", f52[200, 20])
print("Row y=350 (torso level):", f52[350, 20])
print("Row y=500 (hem level):", f52[500, 20])
print("Row y=550 (shadow level):", f52[550, 20])
print("Row y=620 (tagline level):", f52[620, 20])
