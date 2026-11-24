import cv2
import numpy as np

def run_grabcut(img_path, out_path):
    img = cv2.imread(img_path)
    H, W, _ = img.shape

    # For side view or any frame:
    # Garment is inside y in [135, 525], x in [40, 320]
    mask = np.zeros((H, W), dtype=np.uint8)
    rect = (40, 135, 280, 390)

    bgdModel = np.zeros((1, 65), np.float64)
    fgdModel = np.zeros((1, 65), np.float64)

    # In margins (x < 35 or x > 325, or y < 133 or y > 530), definitely background:
    cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 4, cv2.GC_INIT_WITH_RECT)

    final_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)

    # Keep largest component
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(final_mask)
    if num_labels > 1:
        largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        final_mask = np.uint8(labels == largest_label) * 255

    feathered = cv2.GaussianBlur(final_mask, (3, 3), 0.8)

    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = feathered
    cv2.imwrite(out_path, rgba)
    print("Done:", out_path)

run_grabcut("test_frame_0052.png", "test_grabcut_0052.png")
run_grabcut("test_frame_0085.png", "test_grabcut_0085.png")
