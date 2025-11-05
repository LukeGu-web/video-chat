# Object Detection Testing Guide

**Version**: 1.0.0
**Date**: 2025-11-01
**Status**: Ready for Testing

## Overview

This guide provides instructions for testing the fixed object detection functionality in EmoMate. The fix addresses the native crash issue caused by data type mismatch (uint8 vs float32).

## Prerequisites

### Required Tools
- Xcode (for iOS testing)
- Android Studio (for Android testing)
- Physical device or simulator
- Expo Go app (for quick testing)

### Environment Setup
```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate
npm install
```

## Testing Scenarios

### Scenario 1: Basic Object Detection

**Objective**: Verify that object detection works without crashes

**Steps**:
1. Start the app:
   ```bash
   npm start
   ```

2. Navigate to a screen that uses object detection (e.g., Environment Test Screen)

3. Point camera at common objects:
   - Person
   - Chair
   - Cup/Mug
   - Laptop
   - Phone
   - Book

4. Check console logs for detection results:
   ```
   ✅ [useEnvironmentDetection] Model inference complete
   ✅ [useEnvironmentDetection] Detections: 3
   ```

**Expected Results**:
- App does not crash
- Console shows detection logs
- Objects are detected with confidence > 0.3
- Detection rate: 10-15 FPS

**Pass/Fail Criteria**:
- ✅ Pass: No crashes, detections appear in logs
- ❌ Fail: App crashes or no detections

---

### Scenario 2: Performance Testing

**Objective**: Verify detection performance meets requirements

**Steps**:
1. Enable object detection in a screen with camera
2. Monitor for 60 seconds
3. Observe frame processing rate in logs
4. Check memory usage in developer tools

**Expected Metrics**:
- Detection Rate: 10-15 FPS (configurable)
- Latency: < 100ms per frame
- Memory: ~1-2 MB increase (Float32Array buffers)
- CPU: < 30% on modern devices

**Pass/Fail Criteria**:
- ✅ Pass: Metrics within expected ranges
- ⚠️ Warning: Metrics outside range but still functional
- ❌ Fail: Crashes or extreme resource usage

---

### Scenario 3: Multiple Object Detection

**Objective**: Verify detection of multiple objects simultaneously

**Steps**:
1. Place multiple detectable objects in camera view
2. Observe detection logs
3. Count number of detected objects

**Expected Results**:
- Maximum 10 detections per frame (model limit)
- Each detection has:
  - Label (e.g., "person", "chair")
  - Confidence score (0.3-1.0)
  - Bounding box coordinates

**Example Log**:
```json
{
  "label": "person",
  "confidence": 0.87,
  "bbox": { "x": 0.2, "y": 0.3, "width": 0.4, "height": 0.6 }
}
```

**Pass/Fail Criteria**:
- ✅ Pass: Detects up to 10 objects correctly
- ❌ Fail: Cannot detect multiple objects

---

### Scenario 4: Edge Cases

**Objective**: Test detection under challenging conditions

#### 4.1 Low Light
**Steps**:
1. Test in dimly lit environment
2. Check if detection still works

**Expected**: Lower confidence scores, but no crashes

#### 4.2 Motion Blur
**Steps**:
1. Move camera quickly
2. Check if processing continues

**Expected**: Some frames may be skipped, but no crashes

#### 4.3 No Objects
**Steps**:
1. Point camera at blank wall
2. Check if app handles empty results

**Expected**: 0 detections, no crashes

#### 4.4 Extreme Distance
**Steps**:
1. Test with objects very far away
2. Check detection capability

**Expected**: Lower confidence or no detection, no crashes

**Pass/Fail Criteria**:
- ✅ Pass: App handles all edge cases gracefully
- ❌ Fail: Crashes or hangs in any scenario

---

### Scenario 5: Model Switching

**Objective**: Verify different models work with the fix

**Steps**:
1. Test with `ssd-mobilenet-v1-tflite-default-v1.tflite` (current default)
2. Switch to `object-detect.tflite`
3. Test with `efficientdet-lite0-detection-default-v1.tflite` (requires 320×320)

**Model Configuration**:
```typescript
// In useEnvironmentDetection.ts
const objectModel = useTensorflowModel(
  require('../../assets/tflite/ssd-mobilenet-v1-tflite-default-v1.tflite')
);
```

**Expected Results**:
- All SSD MobileNet V1 models (300×300) work
- EfficientDet model works if resize is changed to 320×320

**Pass/Fail Criteria**:
- ✅ Pass: All models work without crashes
- ⚠️ Warning: Some models work better than others
- ❌ Fail: Any model causes crash

---

### Scenario 6: Long Running Test

**Objective**: Verify stability over extended use

**Steps**:
1. Enable object detection
2. Let app run for 10 minutes
3. Monitor for memory leaks or crashes
4. Check if detection continues to work

**Expected Results**:
- No memory leaks (< 100 MB increase)
- No performance degradation
- No crashes
- Consistent detection quality

**Pass/Fail Criteria**:
- ✅ Pass: Stable operation for 10+ minutes
- ⚠️ Warning: Minor memory increase but stable
- ❌ Fail: Crashes or severe memory leak

---

## Debug Logs Reference

### Success Logs
```
[useEnvironmentDetection] Starting frame processing
[useEnvironmentDetection] About to resize
[useEnvironmentDetection] Resize complete
[useEnvironmentDetection] About to extract buffer
[useEnvironmentDetection] Buffer extracted, size: 270000
[useEnvironmentDetection] About to run model inference
[useEnvironmentDetection] Model inference complete
[useEnvironmentDetection] Detections: 3
```

### Error Indicators
```
// Size mismatch (preprocessing error)
[useEnvironmentDetection] Size mismatch: 150000 vs 270000

// Resize failure
[useEnvironmentDetection] Resize failed

// Model inference failure
[useEnvironmentDetection] Model inference failed
```

## Testing Checklist

### Pre-Testing
- [ ] Code changes verified in useEnvironmentDetection.ts
- [ ] Model inspection script run successfully
- [ ] App builds without errors
- [ ] Console logs visible in developer tools

### Basic Functionality
- [ ] Scenario 1: Basic object detection works
- [ ] Scenario 2: Performance metrics acceptable
- [ ] Scenario 3: Multiple object detection works
- [ ] Scenario 4: Edge cases handled gracefully
- [ ] Scenario 5: Model switching works
- [ ] Scenario 6: Long running stability verified

### Platform Testing
- [ ] iOS: Physical device tested
- [ ] iOS: Simulator tested (if applicable)
- [ ] Android: Physical device tested
- [ ] Android: Emulator tested

### Performance Validation
- [ ] FPS: 10-15 range (configurable)
- [ ] Latency: < 100ms
- [ ] Memory: < 100 MB increase over 10 mins
- [ ] CPU: < 30% average
- [ ] Battery: No excessive drain

### Documentation
- [ ] Test results documented
- [ ] Issues logged if any
- [ ] Performance metrics recorded
- [ ] Screenshots/videos captured

## Reporting Results

### Test Report Template

```markdown
## Object Detection Test Results

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Device**: [iOS/Android - Model]
**OS Version**: [Version]
**App Version**: [Version]

### Test Summary
- Scenarios Tested: X/6
- Pass Rate: X%
- Critical Issues: X
- Performance: [Excellent/Good/Fair/Poor]

### Detailed Results

#### Scenario 1: Basic Object Detection
- Status: [Pass/Fail]
- Notes: [Details]

#### Scenario 2: Performance Testing
- Detection Rate: X FPS
- Latency: X ms
- Memory: X MB
- Status: [Pass/Warning/Fail]

[Continue for all scenarios...]

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]

### Overall Assessment
[Summary of test results and readiness for production]
```

## Troubleshooting

### If Detection Doesn't Work
1. Check console logs for error messages
2. Verify model file exists in `assets/tflite/`
3. Confirm resize configuration uses `dataType: 'float32'`
4. Check camera permissions granted
5. Try restarting app

### If Performance Is Poor
1. Reduce detection FPS (default: 15)
2. Increase skip frames (default: 1)
3. Check device specifications
4. Monitor other background processes
5. Consider using smaller model

### If App Still Crashes
1. Capture crash logs from device
2. Check if using correct data type (float32)
3. Verify model file not corrupted
4. Test with different model
5. Report issue with logs to development team

## Contact

For questions or issues:
- Check: `OBJECT_DETECTION_FIX_REPORT.md` for technical details
- Check: `OBJECT_DETECTION_TROUBLESHOOTING.md` for known issues
- Create GitHub issue with test results

---

**Testing Status**: ⏳ Awaiting Device Testing
**Last Updated**: 2025-11-01
