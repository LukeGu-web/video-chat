#!/usr/bin/env python3
"""
Detailed TFLite operation check using flatbuffers
"""

import sys
import tensorflow as tf

def check_operations(model_path):
    print(f"\n{'='*80}")
    print(f"Detailed Operation Check: {model_path}")
    print(f"{'='*80}\n")

    # Load model
    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()

    # Try to get operation details from the interpreter
    print("Attempting to extract operation codes...\n")

    try:
        # Access internal model details if available
        # This may not work in all TF versions
        if hasattr(interpreter, '_get_ops_details'):
            ops = interpreter._get_ops_details()
            print(f"Found {len(ops)} operations:\n")

            op_types = {}
            for op in ops:
                op_type = op.get('op_name', 'Unknown')
                op_types[op_type] = op_types.get(op_type, 0) + 1

            for op_type, count in sorted(op_types.items()):
                print(f"  {op_type}: {count}")
        else:
            print("Cannot access internal ops details with this method\n")
    except Exception as e:
        print(f"Method 1 failed: {e}\n")

    # Alternative: Check model content
    print("\n" + "="*80)
    print("Checking model file content for operation strings...")
    print("="*80 + "\n")

    with open(model_path, 'rb') as f:
        content = f.read()

    # Convert to string for pattern matching (latin-1 to preserve bytes)
    content_str = content.decode('latin-1', errors='ignore')

    # Check for problematic operations
    problematic_ops = [
        'TFLite_Detection_PostProcess',
        'FlexDelegate',
        'SELECT_TF_OPS',
        'TFLiteCustomOp',
        'CUSTOM',
    ]

    found_ops = []
    for op in problematic_ops:
        if op in content_str:
            found_ops.append(op)
            print(f"❌ Found: {op}")

    if not found_ops:
        print("✅ No problematic custom operations found in file content")

    # Check for common YOLO ops
    print("\n" + "="*80)
    print("Checking for YOLO-specific operations...")
    print("="*80 + "\n")

    yolo_ops = [
        'Reshape',
        'Conv2D',
        'Sigmoid',
        'Mul',
        'Add',
        'Concatenation',
        'ResizeNearestNeighbor',
        'Transpose',
        'MaxPool',
    ]

    found_yolo = []
    for op in yolo_ops:
        if op in content_str:
            found_yolo.append(op)

    if found_yolo:
        print(f"YOLO operations detected: {', '.join(found_yolo)}")
        print("\nThese are standard TFLite operations and should be supported.")

    # Final check with TensorFlow
    print("\n" + "="*80)
    print("Final compatibility check...")
    print("="*80 + "\n")

    try:
        # Try to run a test inference
        import numpy as np

        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        # Create dummy input
        input_shape = input_details[0]['shape']
        input_data = np.random.rand(*input_shape).astype(np.float32)

        # Run inference
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()

        print("✅ Model can execute inference successfully in Python")
        print("   This suggests the model structure is valid")
        print("\n   The crash in React Native may be due to:")
        print("   - react-native-fast-tflite version compatibility")
        print("   - Worklet context limitations")
        print("   - Memory constraints in React Native")
        print("   - Platform-specific TFLite delegate issues")

    except Exception as e:
        print(f"❌ Model failed to run in Python: {e}")
        print("   This model may have fundamental compatibility issues")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        model_path = sys.argv[1]
    else:
        model_path = "assets/tflite/yolo-v5-tflite-model-v1.tflite"

    check_operations(model_path)
