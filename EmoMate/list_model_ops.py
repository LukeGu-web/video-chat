#!/usr/bin/env python3
"""
List all operations used in a TFLite model
"""

import sys
import tensorflow as tf

def list_model_operations(model_path):
    """List all operations in a TFLite model."""
    print(f"\n{'='*80}")
    print(f"Analyzing TFLite Model Operations: {model_path}")
    print(f"{'='*80}\n")

    try:
        # Load model
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()

        # Get operation codes from the model
        print("Extracting operations from model...\n")

        # Read model file as bytes
        with open(model_path, 'rb') as f:
            model_content = f.read()

        # Use TFLite schema to parse
        try:
            from tensorflow.lite.python import schema_py_generated as schema_fb
            model = schema_fb.Model.GetRootAsModel(model_content, 0)

            # Get subgraph (usually only one)
            subgraph = model.Subgraphs(0)

            # Get operator codes
            op_codes = []
            for i in range(model.OperatorCodesLength()):
                op_code = model.OperatorCodes(i)
                # Try to get builtin code
                builtin_code = op_code.BuiltinCode()
                deprecated_code = op_code.DeprecatedBuiltinCode()
                custom_code = op_code.CustomCode()

                if custom_code:
                    op_codes.append(f"CUSTOM: {custom_code.decode('utf-8')}")
                else:
                    # Get name from builtin code
                    from tensorflow.lite.python.schema_util import get_builtin_code_name
                    try:
                        name = get_builtin_code_name(builtin_code)
                        op_codes.append(f"BUILTIN: {name}")
                    except:
                        op_codes.append(f"BUILTIN: Code={builtin_code}")

            print(f"Found {len(op_codes)} operation types:\n")
            print("-" * 80)

            for i, op in enumerate(op_codes, 1):
                if op.startswith("CUSTOM"):
                    print(f"  {i}. {op}  ⚠️  CUSTOM OPERATION - MAY NOT BE SUPPORTED")
                else:
                    print(f"  {i}. {op}")

            print("-" * 80)

            # Check for custom operations
            custom_ops = [op for op in op_codes if op.startswith("CUSTOM")]
            if custom_ops:
                print(f"\n❌ WARNING: Found {len(custom_ops)} CUSTOM operations!")
                print("   Custom ops may not be supported by react-native-fast-tflite")
                print("   This could cause 'unresolved-ops' errors or crashes\n")
                for op in custom_ops:
                    print(f"   - {op}")
            else:
                print(f"\n✅ Good news: No custom operations found!")
                print("   All operations are built-in TFLite ops\n")

            # List actual operators used
            print(f"\n{'='*80}")
            print("Operators used in graph:")
            print("-" * 80)

            operator_usage = {}
            for i in range(subgraph.OperatorsLength()):
                op = subgraph.Operators(i)
                op_code_idx = op.OpcodeIndex()
                op_name = op_codes[op_code_idx]
                operator_usage[op_name] = operator_usage.get(op_name, 0) + 1

            for op_name, count in sorted(operator_usage.items()):
                print(f"  {op_name}: {count} times")

            print(f"{'='*80}\n")

        except ImportError:
            print("Could not import TFLite schema, using alternative method...\n")

            # Alternative: check with TFLite tools
            import subprocess
            result = subprocess.run(
                ['python3', '-m', 'tensorflow.lite.tools.visualize', model_path],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                print(result.stdout)
            else:
                print("Alternative method also failed")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        model_path = sys.argv[1]
    else:
        model_path = "assets/tflite/yolo-v5-tflite-model-v1.tflite"

    list_model_operations(model_path)
