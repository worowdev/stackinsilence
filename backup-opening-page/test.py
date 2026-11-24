import sys
print("Python version:", sys.version)
try:
    import onnxruntime
    print("onnxruntime:", onnxruntime.__version__)
except Exception as e:
    print("onnxruntime failed:", e)
