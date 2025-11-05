#!/usr/bin/env python3
"""
Check TFLite model for custom ops using flatbuffers
"""

import sys
import struct

def check_model_for_custom_ops(model_path):
    """Check if model has custom ops by reading the flatbuffer."""
    print(f"\n{'='*80}")
    print(f"Checking Model for Custom Operations: {model_path}")
    print(f"{'='*80}\n")

    try:
        # Read model as bytes
        with open(model_path, 'rb') as f:
            model_bytes = f.read()

        # Simple check: search for common custom op indicators
        model_str = model_bytes.decode('latin-1')

        # Check for "TFLite_Detection_PostProcess"
        if 'TFLite_Detection_PostProcess' in model_str:
            print("❌ FOUND: 'TFLite_Detection_PostProcess' custom op")
            print("   This op is NOT supported by react-native-fast-tflite")
            return True

        # Check for other common custom ops
        custom_ops_to_check = [
            'FlexDelegate',
            'SELECT_TF_OPS',
            'Custom',
            'CUSTOM',
        ]

        found_custom = []
        for op in custom_ops_to_check:
            if op in model_str:
                found_custom.append(op)

        if found_custom:
            print(f"⚠️  Possible custom ops found: {', '.join(found_custom)}")
            print("   May cause compatibility issues\n")
            return True

        # Try using TensorFlow to get details
        import tensorflow as tf

        interpreter = tf.lite.Interpreter(model_path=model_path)
        details = interpreter.get_tensor_details()

        print(f"Model loaded successfully")
        print(f"Total tensors: {len(details)}\n")

        # Get all unique ops from tensor details
        ops_found = set()
        for detail in details:
            if 'name' in detail:
                name = detail['name']
                # Extract operation type from tensor name
                if '/' in name:
                    parts = name.split('/')
                    for part in parts:
                        if part and not part.isdigit():
                            ops_found.add(part)

        print("Operations found in tensor names:")
        print("-" * 80)
        for op in sorted(ops_found)[:30]:  # Show first 30
            print(f"  - {op}")

        if len(ops_found) > 30:
            print(f"  ... and {len(ops_found) - 30} more")

        print(f"\n{'='*80}")
        print("✅ No obvious custom ops detected")
        print("   Model should be compatible with react-native-fast-tflite")
        print(f"{'='*80}\n")

        return False

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        model_path = sys.argv[1]
    else:
        model_path = "assets/tflite/yolo-v5-tflite-model-v1.tflite"

    has_custom_ops = check_model_for_custom_ops(model_path)

    print("\n" + "="*80)
    if has_custom_ops:
        print("CONCLUSION: Model has custom ops - may not work")
    elif has_custom_ops is False:
        print("CONCLUSION: Model appears compatible")
    else:
        print("CONCLUSION: Unable to determine")
    print("="*80 + "\n")
