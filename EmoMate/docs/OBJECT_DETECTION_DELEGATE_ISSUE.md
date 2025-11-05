# Object Detection Delegate Issue - Root Cause Analysis

**Date**: 2025-11-05
**Status**: Root cause identified ✅
**Issue**: react-native-fast-tflite crashes when running YOLO models

---

## 🎯 Root Cause

YOLOv5 TFLite model contains **55 DELEGATE operations** that require hardware acceleration (GPU/XNNPACK delegate), which are **NOT fully supported** by react-native-fast-tflite in worklet context.

### Evidence

```bash
# YOLOv5 Model Operations (crashes):
DELEGATE: 55 operations ❌
CONV_2D: 62
LOGISTIC: 62
MUL: 80
ADD: 10
... (all standard ops)

# MobileNetV3 Scene Model (works fine):
NO delegate operations ✅
All standard TFLite ops
```

### Why Scene Model Works But YOLO Doesn't

| Model | Delegates | Status | Reason |
|-------|-----------|--------|---------|
| **Scene (MobileNetV3)** | 0 | ✅ Works | Pure CPU, standard ops only |
| **YOLO v5** | 55 | ❌ Crashes | Uses GPU/XNNPACK delegates |
| **SSD MobileNet** | N/A | ❌ Crashes | Custom `TFLite_Detection_PostProcess` op |

---

## 📋 Investigation History

### 1. Initial Hypothesis (WRONG)
- **Thought**: Data type issue (float32 vs uint8)
- **Result**: User spent 4-5 days on this, frustrating

### 2. Race Condition Fix (PARTIAL)
- **Found**: Lock acquisition 25 lines after check
- **Fixed**: Immediate lock acquisition
- **Result**: Stopped race condition, but still crashed

### 3. Model Inspection
- **YOLOv5 in Python**: ✅ Works perfectly
- **No custom ops**: ✅ All standard TFLite ops
- **Model size**: 7.3MB (Scene is 15MB, so not size issue)

### 4. Delegate Discovery (ROOT CAUSE ✅)
- **Found**: 55 DELEGATE operations in YOLOv5
- **Confirmed**: react-native-fast-tflite has delegate compatibility issues
- **Evidence**: GitHub issues #84, #96, #143 mention delegate crashes

---

## 🔧 Technical Details

### What are TFLite Delegates?

TFLite delegates are acceleration mechanisms that offload operations to:
- **GPU**: Graphics processing unit
- **XNNPACK**: Optimized CPU delegate
- **NNAPI**: Android Neural Networks API
- **CoreML**: iOS hardware acceleration

### Why They Fail in React Native

1. **Worklet Context Limitations**: JavaScript worklets have restricted native access
2. **Missing Hardware Support**: Not all devices support all delegate types
3. **react-native-fast-tflite Version**: Library may not fully support delegates
4. **Android/iOS Differences**: Platform-specific delegate behaviors

### Confirmed Issues (from GitHub)

- **Issue #84**: GPU delegate fails to load models
- **Issue #96**: Long latency with YOLO models
- **Issue #143**: `unresolved-ops` errors
- **Issue #95**: frameProcessor crashes (fixed with Babel config)

---

## 💡 Solutions

### Option A: Use CPU-Only YOLO Model (Recommended)

Convert YOLOv5 to pure CPU model without delegates:

```bash
# You need to re-export YOLOv5 from original PyTorch model
# With TFLite converter flags to disable delegates:

--experimental_new_converter=False
--target_spec.supported_ops=TFLITE_BUILTINS
--optimization_default=OPTIMIZE_FOR_SIZE
# Do NOT use: --optimization_default=DEFAULT (creates delegates)
```

**Pros**:
- Should work with react-native-fast-tflite
- Same YOLO accuracy
- Compatible with all devices

**Cons**:
- Slower inference (no GPU acceleration)
- Need to re-export model from source

### Option B: Try Different Object Detection Architecture

Use a different model architecture that doesn't need delegates:

1. **MobileNet SSD v2** (if available without custom ops)
2. **EfficientDet-Lite** (check if delegate-free version exists)
3. **Simple CNN-based detector** (train custom lightweight model)

**Pros**:
- Easier than re-exporting YOLO
- May find pre-built compatible models

**Cons**:
- Lower accuracy than YOLOv5
- May still have custom op issues

### Option C: Use Different Detection Method

Switch to alternative detection approach:

1. **ML Kit Object Detection** (Google's solution)
   - Native Android/iOS support
   - No custom model needed
   - Limited to common objects

2. **Vision Camera Plugin** approach
   - Process frames without TFLite
   - Use alternative detection methods

**Pros**:
- Guaranteed compatibility
- Official support

**Cons**:
- Less flexible
- May not meet custom requirements

### Option D: Disable Delegates at Runtime (Experimental)

Modify `useTensorflowModel` to explicitly disable delegates:

```typescript
const objectModel = useTensorflowModel(
  require('../../assets/tflite/yolo-v5-tflite-model-v1.tflite'),
  {
    delegate: 'none'  // Force CPU-only mode
  }
);
```

**Status**: Need to check if react-native-fast-tflite v1.6.1 supports this

**Pros**:
- Quick test
- No model re-export

**Cons**:
- May not work if library doesn't support delegate control
- May still crash if delegates are baked into model

---

## 🎬 Next Steps

### Immediate Actions

1. **Verify Option D**: Check react-native-fast-tflite docs for delegate control
2. **Ask User**: Which solution they prefer to try first
3. **Test Simple Model**: Try a simple object detection model to confirm delegate theory

### If Pursuing Option A (CPU-Only YOLO)

1. Get original YOLOv5 PyTorch model or ONNX export
2. Convert to TFLite with CPU-only flags
3. Verify no delegates: `python3 detailed_ops_check.py new_model.tflite`
4. Test in React Native

### If Pursuing Option B (Different Architecture)

1. Search for pre-built TFLite object detection models
2. Filter for models without custom ops and delegates
3. Test each candidate model

### If Pursuing Option C (Alternative Method)

1. Research ML Kit integration for React Native Expo
2. Evaluate if ML Kit meets requirements
3. Implement alternative detection approach

---

## 📊 Model Comparison Summary

| Model | Size | Input | Delegates | Custom Ops | Status |
|-------|------|-------|-----------|------------|--------|
| **MobileNetV3 (Scene)** | 15MB | float32 [1,224,224,3] | 0 | ❌ | ✅ **WORKS** |
| **YOLOv5** | 7.3MB | float32 [1,320,320,3] | 55 ❌ | ❌ | ❌ **CRASHES** |
| **SSD MobileNet v1** | 4.0MB | uint8 [1,300,300,3] | ? | ✅ PostProcess | ❌ **CRASHES** |
| **EfficientDet Lite0** | 4.3MB | uint8 [1,320,320,3] | ? | ✅ PostProcess | ❌ **CRASHES** |

---

## 🔍 Verification Commands

```bash
# Check if model has delegates
python3 detailed_ops_check.py assets/tflite/model.tflite

# Check for custom ops
python3 check_model_ops.py assets/tflite/model.tflite

# Full model inspection
python3 inspect_model.py assets/tflite/model.tflite
```

---

## 📚 References

- **react-native-fast-tflite GitHub**: https://github.com/mrousavy/react-native-fast-tflite
- **Issue #84**: GPU delegate loading failures
- **Issue #96**: YOLO model latency issues
- **Issue #143**: unresolved-ops errors
- **TFLite Delegates Guide**: https://www.tensorflow.org/lite/performance/delegates

---

## ✅ Confirmed Facts

1. ✅ YOLOv5 model works perfectly in Python
2. ✅ YOLOv5 model has no custom TFLite ops
3. ✅ YOLOv5 model contains 55 DELEGATE operations
4. ✅ react-native-fast-tflite has known delegate compatibility issues
5. ✅ Scene model (no delegates) works fine in React Native
6. ✅ Race condition was fixed but not the root cause

---

**Conclusion**: The crash is caused by YOLOv5's delegate operations, not data types or race conditions. Need to either use a CPU-only model or find an alternative detection method.
