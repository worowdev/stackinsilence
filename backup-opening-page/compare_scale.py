from PIL import Image
import numpy as np

f1 = np.array(Image.open("test_frame_0001.png"))
poster = np.array(Image.open("assets/raw/add_this_on_top_as_579f8e2c_2K.jpg"))

# In f1, let's find the hanger width (black hanger body at y = 170..190)
hanger_f1 = f1[170:190, :, :]
# dark pixels < 60
dark_x_f1 = np.where(hanger_f1.mean(axis=0).mean(axis=-1) < 80)[0]
print("f1 hanger x range:", dark_x_f1.min(), "to", dark_x_f1.max(), "width:", dark_x_f1.max() - dark_x_f1.min())

# In poster, around garment 1 (x ~ 179)
hanger_p1 = poster[375:400, 100:260, :]
dark_x_p1 = np.where(hanger_p1.mean(axis=0).mean(axis=-1) < 80)[0]
if len(dark_x_p1) > 0:
    print("Poster g1 hanger width:", dark_x_p1.max() - dark_x_p1.min())
