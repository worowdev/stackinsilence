from PIL import Image
import numpy as np

poster = np.array(Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg"))
H, W, _ = poster.shape
print("Poster shape:", H, W)

# Check margins x in [0, 40] and x in [780, 818] between y=345 and y=750
left_margin = poster[345:750, 0:40, :]
right_margin = poster[345:750, 780:818, :]

# Check if margins are smooth gradients
print("Left margin mean at y=400:", left_margin[400 - 345].mean(axis=0))
print("Right margin mean at y=400:", right_margin[400 - 345].mean(axis=0))
print("Left margin mean at y=600:", left_margin[600 - 345].mean(axis=0))
print("Right margin mean at y=600:", right_margin[600 - 345].mean(axis=0))
