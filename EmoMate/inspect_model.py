#!/usr/bin/env python3
"""
TFLite Model Metadata Inspector

This script inspects TFLite models to determine their input/output requirements,
helping debug the native crash issue in React Native object detection.
"""

import sys
import os

def inspect_tflite_model(model_path):
    """Inspect TFLite model and print detailed metadata."""
    try:
        import tensorflow as tf
    except ImportError:
        print("ERROR: TensorFlow is not installed.")
        print("Please install it with: pip install tensorflow")
        sys.exit(1)

    if not os.path.exists(model_path):
        print(f"ERROR: Model file not found: {model_path}")
        sys.exit(1)

    print(f"\n{'='*80}")
    print(f"Inspecting TFLite Model: {os.path.basename(model_path)}")
    print(f"{'='*80}\n")

    try:
        # Load the TFLite model
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()

        # Get input details
        input_details = interpreter.get_input_details()
        print("INPUT DETAILS:")
        print("-" * 80)

        for i, detail in enumerate(input_details):
            print(f"\nInput {i}:")
            print(f"  Name: {detail['name']}")
            print(f"  Shape: {detail['shape']}")
            print(f"  Type: {detail['dtype']}")
            print(f"  Quantization: {detail['quantization']}")
            print(f"  Quantization Parameters:")
            print(f"    - Scale: {detail['quantization_parameters']['scales']}")
            print(f"    - Zero Points: {detail['quantization_parameters']['zero_points']}")

            # Determine expected input format
            print(f"\n  EXPECTED FORMAT:")
            dtype = detail['dtype']
            shape = detail['shape']

            if dtype == 'uint8':
                print(f"    ✓ Data Type: UINT8 (0-255 range)")
                print(f"    ✓ No normalization needed")
            elif dtype == 'float32':
                print(f"    ✓ Data Type: FLOAT32")
                # Check quantization for normalization hints
                scales = detail['quantization_parameters']['scales']
                if len(scales) > 0 and scales[0] == 0.00784313679:
                    print(f"    ✓ Normalization: 0-1 range (divide by 255)")
                elif len(scales) > 0 and scales[0] == 0.0078125:
                    print(f"    ✓ Normalization: -1 to 1 range (subtract 127.5, divide by 127.5)")
                else:
                    print(f"    ✓ Normalization: Likely 0-1 range (divide by 255)")

            print(f"    ✓ Shape: {list(shape)}")
            print(f"    ✓ Expected buffer size: {shape[1] * shape[2] * shape[3] if len(shape) == 4 else 'N/A'}")

        # Get output details
        output_details = interpreter.get_output_details()
        print(f"\n\n{'='*80}")
        print("OUTPUT DETAILS:")
        print("-" * 80)

        for i, detail in enumerate(output_details):
            print(f"\nOutput {i}:")
            print(f"  Name: {detail['name']}")
            print(f"  Shape: {detail['shape']}")
            print(f"  Type: {detail['dtype']}")
            print(f"  Quantization: {detail['quantization']}")

        # Determine model type
        print(f"\n\n{'='*80}")
        print("MODEL TYPE ANALYSIS:")
        print("-" * 80)

        if 'ssd' in os.path.basename(model_path).lower():
            print("\n✓ Detected: SSD MobileNet Object Detection Model")
            print("  Expected outputs:")
            print("    - Output 0: Detection boxes [1, num_detections, 4]")
            print("    - Output 1: Detection classes [1, num_detections]")
            print("    - Output 2: Detection scores [1, num_detections]")
            print("    - Output 3: Number of detections [1]")
        elif 'efficientdet' in os.path.basename(model_path).lower():
            print("\n✓ Detected: EfficientDet Object Detection Model")
            print("  Expected outputs:")
            print("    - Output 0: Detection boxes [1, num_detections, 4]")
            print("    - Output 1: Detection classes [1, num_detections]")
            print("    - Output 2: Detection scores [1, num_detections]")
            print("    - Output 3: Number of detections [1]")

        # React Native integration recommendations
        print(f"\n\n{'='*80}")
        print("REACT NATIVE INTEGRATION RECOMMENDATIONS:")
        print("-" * 80)

        input_dtype = input_details[0]['dtype']
        input_shape = input_details[0]['shape']

        print("\nFor react-native-fast-tflite:")
        print(f"\n1. Resize Configuration:")
        print(f"   const resized = resize(frame, {{")
        print(f"     scale: {{ width: {input_shape[1]}, height: {input_shape[2]} }},")
        print(f"     pixelFormat: 'rgb',")

        if input_dtype == 'uint8':
            print(f"     dataType: 'uint8',  // ✓ CORRECT: Model expects uint8")
            print(f"   }});")
            print(f"\n2. Direct Inference (no normalization needed):")
            print(f"   const outputs = model.run([resized]);")
        else:  # float32
            print(f"     dataType: 'float32',  // ✓ CORRECT: Model expects float32")
            print(f"   }});")
            print(f"\n2. Inference (resize plugin normalizes to 0-1):")
            print(f"   const outputs = model.run([resized]);")

        print(f"\n3. Buffer Shape:")
        print(f"   Expected: Uint8Array[{input_shape[1] * input_shape[2] * input_shape[3]}]" if input_dtype == 'uint8'
              else f"   Expected: Float32Array[{input_shape[1] * input_shape[2] * input_shape[3]}]")

        print(f"\n\n{'='*80}")
        print("ANALYSIS COMPLETE")
        print(f"{'='*80}\n")

    except Exception as e:
        print(f"ERROR: Failed to load model: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # Model paths
    models = [
        "assets/tflite/ssd-mobilenet-v1-tflite-default-v1.tflite",
        "assets/tflite/object-detect.tflite",
        "assets/tflite/efficientdet-tflite-lite0-detection-default-v1.tflite"
    ]

    # Get model path from command line or use defaults
    if len(sys.argv) > 1:
        model_path = sys.argv[1]
        inspect_tflite_model(model_path)
    else:
        # Inspect all models
        for model_path in models:
            if os.path.exists(model_path):
                inspect_tflite_model(model_path)
                print("\n" * 2)
