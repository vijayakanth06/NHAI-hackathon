"""
Minimal TFLite model inspection using flatbuffers schema parsing.
No TensorFlow dependency needed — reads the raw flatbuffer directly.
"""
import struct
import os

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                          "android", "app", "src", "main", "assets", "models")

# TFLite tensor type mapping
TENSOR_TYPES = {
    0: "FLOAT32", 1: "FLOAT16", 2: "INT32", 3: "UINT8",
    4: "INT64", 5: "STRING", 6: "BOOL", 7: "INT16",
    8: "COMPLEX64", 9: "INT8", 10: "FLOAT64", 11: "COMPLEX128",
    12: "UINT64", 13: "RESOURCE", 14: "VARIANT", 15: "UINT32",
    16: "UINT16", 17: "INT4"
}

def read_tflite_header(filepath):
    """Read basic info about a TFLite model from its flatbuffer header."""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    file_size = len(data)
    
    # Check TFLite magic
    if data[-4:] != b'TFL3':
        # Try checking the start
        if data[:4] == b'TFL3':
            print(f"    WARNING: TFL3 magic at start (unusual)")
        else:
            print(f"    WARNING: No TFL3 magic found at file end")
            print(f"    Last 4 bytes: {data[-4:]}")
            print(f"    First 4 bytes: {data[:4]}")
    else:
        print(f"    TFL3 magic: OK ✓")
    
    return file_size

for model_file in sorted(os.listdir(MODELS_DIR)):
    if not model_file.endswith('.tflite'):
        continue
    path = os.path.join(MODELS_DIR, model_file)
    print(f"\n{'='*60}")
    print(f"MODEL: {model_file}")
    print(f"  Size: {os.path.getsize(path):,} bytes ({os.path.getsize(path)/1024:.1f} KB)")
    print(f"{'='*60}")
    read_tflite_header(path)
