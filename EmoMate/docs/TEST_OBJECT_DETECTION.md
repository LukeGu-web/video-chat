# Object Detection Testing Guide

**Purpose**: Verify TFLite object detection works without crashing after the fix

---

## Quick Test Steps

### 1. Start the App
```bash
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate
npm start
# Scan QR code with Expo Go
```

### 2. Navigate to Test Screen
- Open app
- Navigate to "Environment Test" screen
- Grant camera permission if prompted

### 3. Test Object Detection

#### Test Case 1: Single Object
- Point camera at a **person**
- Expected logs:
  ```
  ✅ [useEnvironmentDetection] Model inference complete
  ✅ [useEnvironmentDetection] Processing 1 detections...
  ✅ [useEnvironmentDetection] Detection 0 label: person
  ✅ [useEnvironmentDetection] Returning 1 results
  ```
- ✅ App should NOT crash
- ✅ UI should show "person" in detected objects list

#### Test Case 2: Multiple Objects
- Point camera at **desk** (laptop, mouse, keyboard, cup)
- Expected logs:
  ```
  ✅ [useEnvironmentDetection] Processing 5 detections...
  ✅ [useEnvironmentDetection] Detection 0 label: laptop
  ✅ [useEnvironmentDetection] Detection 1 label: mouse
  ✅ [useEnvironmentDetection] Detection 2 label: keyboard
  ✅ [useEnvironmentDetection] Detection 3 label: cup
  ✅ [useEnvironmentDetection] Returning 4 results
  ```
- ✅ App should NOT crash
- ✅ UI should show all detected objects

#### Test Case 3: No Objects
- Point camera at **empty wall**
- Expected logs:
  ```
  ✅ [useEnvironmentDetection] Processing 0 detections...
  ✅ [useEnvironmentDetection] No objects detected, returning empty array
  ```
- ✅ App should NOT crash
- ✅ UI should show "waiting for detection..."

---

## What to Watch For

### Success Indicators ✅
- Logs show "Model inference complete"
- Logs show "Returning X results"
- App continues running smoothly
- Objects appear in UI with correct labels
- Confidence scores are reasonable (30%+)

### Failure Indicators ❌
- App crashes immediately after inference
- Logs stop at "Model inference complete"
- No error message (native crash)
- White screen of death

---

## Debugging Tips

### If Crash Still Occurs

1. **Check logs carefully**: Note the last successful log line
2. **Test simplified return**:
   ```typescript
   // In useEnvironmentDetection.ts, line 517
   // Replace:
   return results;
   // With:
   return [];  // Test if empty array works
   ```

3. **Test hardcoded object**:
   ```typescript
   // Replace return results; with:
   return [{ label: 'test', confidence: 0.5, bbox: { x: 0, y: 0, width: 1, height: 1 } }];
   ```

4. **Test return null**:
   ```typescript
   // Replace return results; with:
   return null;  // Should skip runOnJS, no crash
   ```

### If No Detection

1. **Check model loading**: Logs should show "Both models loaded successfully"
2. **Check camera permission**: Grant if denied
3. **Check detection toggle**: Should show "✅ 检测中"
4. **Try better lighting**: Model works better in bright conditions
5. **Try common objects**: person, chair, laptop, cup, phone

### Performance Issues

1. **High CPU usage**: Normal for TFLite inference
2. **Slow detection**: Reduce FPS (DEFAULT_OBJECT_DETECTION_FPS)
3. **Battery drain**: Expected with continuous ML inference

---

## Expected Performance

- **Model load time**: < 2 seconds
- **First inference**: 500-1000ms
- **Subsequent inferences**: 100-300ms
- **Frame rate**: ~15 FPS (configurable)
- **Detection accuracy**: 60-90% for common objects

---

## Common COCO Objects

Test with these objects for best results:
- **Person** (class 0) - Most reliable
- **Chair** (class 56)
- **Laptop** (class 63)
- **Cup** (class 41)
- **Bottle** (class 39)
- **Cell phone** (class 67)
- **Book** (class 73)
- **Keyboard** (class 66)
- **Mouse** (class 64)

---

## Log Analysis

### Successful Detection Flow
```
[useEnvironmentDetection] Starting frame processing
[useEnvironmentDetection] About to resize
[useEnvironmentDetection] Resize complete
[useEnvironmentDetection] Float32 buffer extracted, size: 270000
[useEnvironmentDetection] Converting float32 to uint8...
[useEnvironmentDetection] Uint8 conversion complete
[useEnvironmentDetection] About to run model inference
[useEnvironmentDetection] Model inference complete
[useEnvironmentDetection] Checking output format...
[useEnvironmentDetection] outputs type: object
[useEnvironmentDetection] Extracting tensor data...
[useEnvironmentDetection] Boxes extracted: success
[useEnvironmentDetection] Classes extracted: success
[useEnvironmentDetection] Scores extracted: success
[useEnvironmentDetection] NumDetections extracted: success
[useEnvironmentDetection] Calculated numDetections: 3
[useEnvironmentDetection] Processing 3 detections...
[useEnvironmentDetection] Processing detection 0
[useEnvironmentDetection] Detection 0 confidence: 0.87
[useEnvironmentDetection] Detection 0 classIndex: 0
[useEnvironmentDetection] Detection 0 label: person
[useEnvironmentDetection] Creating detection object 0
[useEnvironmentDetection] Detection object created
[useEnvironmentDetection] Pushed to array, total: 1
... (repeat for each detection)
[useEnvironmentDetection] Total detections processed: 3
[useEnvironmentDetection] Total detections: 3
[useEnvironmentDetection] Preparing to return results
[useEnvironmentDetection] Returning 3 results
```

### If Crash Occurred (Before Fix)
```
[useEnvironmentDetection] Model inference complete
[useEnvironmentDetection] Detections: 7
[CRASH - app terminates]
```

---

## Report Findings

After testing, report:
1. ✅/❌ Did app crash?
2. ✅/❌ Were objects detected?
3. ✅/❌ Were labels correct?
4. Number of objects detected
5. Detection confidence scores
6. Any error messages
7. Performance observations

---

## Next Steps After Successful Test

1. **Reduce logging**: Remove verbose debug logs for production
2. **Tune confidence threshold**: Adjust MIN_CONFIDENCE (currently 0.3)
3. **Optimize FPS**: Test different frame rates for battery life
4. **Add UI polish**: Better object visualization
5. **Integrate with AI**: Let 兰兰 respond based on detected objects

---

**Document Version**: 1.0
**Last Updated**: 2025-11-02
**Related**: TFLITE_OBJECT_DETECTION_FIX.md
