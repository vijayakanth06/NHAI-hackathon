"""
Deep inspection of all 7 TFLite models.
Reports input/output tensor shapes, dtypes, quantization parameters,
and runs a test inference to see output ranges.
"""
import os
import sys
import numpy as np

try:
    import tensorflow as tf
    print(f"TensorFlow version: {tf.__version__}")
except ImportError:
    # Try tflite_runtime
    try:
        import tflite_runtime.interpreter as tflite
        print(f"Using tflite_runtime")
    except ImportError:
        print("ERROR: Neither tensorflow nor tflite_runtime is installed.")
        print("Install with: pip install tensorflow")
        sys.exit(1)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                          "android", "app", "src", "main", "assets", "models")

MODEL_FILES = [
    "featherface_detect_int8.tflite",
    "zero_dce_enhance_int8.tflite",
    "face_mesh.tflite",
    "facelive_int8.tflite",
    "silent_fas_int8.tflite",
    "rppg_liveness_int8.tflite",
    "iris_quality_int8.tflite",
]

def inspect_model(model_path, model_name):
    print(f"\n{'='*70}")
    print(f"MODEL: {model_name}")
    print(f"  File size: {os.path.getsize(model_path):,} bytes")
    print(f"{'='*70}")

    try:
        interpreter = tf.lite.Interpreter(model_path=model_path)
    except:
        interpreter = tflite.Interpreter(model_path=model_path)

    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    print(f"\n  INPUT TENSORS ({len(input_details)}):")
    for i, inp in enumerate(input_details):
        print(f"    [{i}] name: {inp['name']}")
        print(f"        shape: {inp['shape']}")
        print(f"        dtype: {inp['dtype']}")
        if 'quantization' in inp:
            print(f"        quantization: {inp['quantization']}")
        if 'quantization_parameters' in inp:
            qp = inp['quantization_parameters']
            print(f"        quant_params: scales={qp.get('scales', 'N/A')}, "
                  f"zero_points={qp.get('zero_points', 'N/A')}, "
                  f"quantized_dimension={qp.get('quantized_dimension', 'N/A')}")

    print(f"\n  OUTPUT TENSORS ({len(output_details)}):")
    for i, out in enumerate(output_details):
        print(f"    [{i}] name: {out['name']}")
        print(f"        shape: {out['shape']}")
        print(f"        dtype: {out['dtype']}")
        if 'quantization' in out:
            print(f"        quantization: {out['quantization']}")
        if 'quantization_parameters' in out:
            qp = out['quantization_parameters']
            print(f"        quant_params: scales={qp.get('scales', 'N/A')}, "
                  f"zero_points={qp.get('zero_points', 'N/A')}, "
                  f"quantized_dimension={qp.get('quantized_dimension', 'N/A')}")

    # === Test inference with random data ===
    print(f"\n  TEST INFERENCE (random input):")
    for i, inp in enumerate(input_details):
        shape = inp['shape']
        dtype = inp['dtype']
        if dtype == np.float32:
            test_input = np.random.rand(*shape).astype(np.float32)
        elif dtype == np.uint8:
            test_input = np.random.randint(0, 256, size=shape, dtype=np.uint8)
        elif dtype == np.int8:
            test_input = np.random.randint(-128, 127, size=shape, dtype=np.int8)
        else:
            test_input = np.zeros(shape, dtype=dtype)
        interpreter.set_tensor(inp['index'], test_input)

    try:
        interpreter.invoke()
        for i, out in enumerate(output_details):
            result = interpreter.get_tensor(out['index'])
            print(f"    Output[{i}]: shape={result.shape}, dtype={result.dtype}")
            print(f"        min={result.min():.6f}, max={result.max():.6f}, "
                  f"mean={result.mean():.6f}, std={result.std():.6f}")
            if result.size <= 20:
                print(f"        values={result.flatten().tolist()}")
    except Exception as e:
        print(f"    ERROR during inference: {e}")

    # === Special test for Silent-FAS: test with a "face-like" input ===
    if "silent_fas" in model_name:
        print(f"\n  SPECIAL TEST — Silent-FAS with face-like patterns:")
        for test_name, make_input in [
            ("all_zeros", lambda s: np.zeros(s, dtype=np.float32)),
            ("all_0.5 (mid-gray)", lambda s: np.full(s, 0.5, dtype=np.float32)),
            ("all_1.0 (white)", lambda s: np.ones(s, dtype=np.float32)),
            ("[-1,1] random", lambda s: (np.random.rand(*s).astype(np.float32) * 2 - 1)),
            ("[0,1] random", lambda s: np.random.rand(*s).astype(np.float32)),
            ("[0,255] as float", lambda s: (np.random.rand(*s).astype(np.float32) * 255)),
        ]:
            inp_detail = input_details[0]
            shape = tuple(inp_detail['shape'])
            test_data = make_input(shape)
            interpreter.set_tensor(inp_detail['index'], test_data)
            try:
                interpreter.invoke()
                result = interpreter.get_tensor(output_details[0]['index'])
                logits = result.flatten().tolist()
                # Softmax
                exps = [np.exp(x - max(logits)) for x in logits]
                s = sum(exps)
                probs = [e/s for e in exps]
                print(f"    {test_name:25s} -> logits={[f'{x:.4f}' for x in logits]}  "
                      f"softmax={[f'{x:.4f}' for x in probs]}")
            except Exception as e:
                print(f"    {test_name:25s} -> ERROR: {e}")

    return input_details, output_details


if __name__ == "__main__":
    print(f"Models directory: {MODELS_DIR}")
    print(f"Exists: {os.path.isdir(MODELS_DIR)}")

    for model_file in MODEL_FILES:
        model_path = os.path.join(MODELS_DIR, model_file)
        if os.path.exists(model_path):
            inspect_model(model_path, model_file)
        else:
            print(f"\n*** MISSING: {model_file} ***")
