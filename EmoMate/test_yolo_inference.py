#!/usr/bin/env python3
"""
Test YOLOv5 TFLite model inference to verify it works
"""

import numpy as np
import tensorflow as tf

def test_yolo_inference():
    model_path = "assets/tflite/yolo-v5-tflite-model-v1.tflite"

    print(f"\n{'='*80}")
    print("Testing YOLOv5 TFLite Model Inference")
    print(f"{'='*80}\n")

    try:
        # Load model
        print("1. Loading model...")
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()
        print("   ✓ Model loaded successfully")

        # Get input/output details
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        print(f"\n2. Input shape: {input_details[0]['shape']}")
        print(f"   Input type: {input_details[0]['dtype']}")
        print(f"\n3. Output shape: {output_details[0]['shape']}")
        print(f"   Output type: {output_details[0]['dtype']}")

        # Create test input (normalized float32 values like from resize plugin)
        print("\n4. Creating test input (normalized float32 [0,1])...")
        input_shape = input_details[0]['shape']
        test_input = np.random.rand(*input_shape).astype(np.float32)
        print(f"   Input created: shape={test_input.shape}, dtype={test_input.dtype}")
        print(f"   Sample values: {test_input.flatten()[:5]}")

        # Run inference
        print("\n5. Running inference...")
        interpreter.set_tensor(input_details[0]['index'], test_input)
        interpreter.invoke()
        print("   ✓ Inference completed successfully!")

        # Get output
        output = interpreter.get_tensor(output_details[0]['index'])
        print(f"\n6. Output shape: {output.shape}")
        print(f"   Output type: {output.dtype}")
        print(f"   Sample output values: {output.flatten()[:10]}")

        print(f"\n{'='*80}")
        print("✅ SUCCESS - YOLOv5 model works correctly in Python")
        print(f"{'='*80}\n")

        # Check for any ops issues
        print("\n7. Checking model operations...")
        import os
        os.system(f"python3 -m tensorflow.lite.python.analyzer_wrapper --model_file={model_path} --model_content=NONE")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_yolo_inference()
