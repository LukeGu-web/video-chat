/**
 * useEnvironmentDetection Hook
 *
 * Custom hook for object and environment detection using TFLite models
 * Can be integrated into existing camera frame processors
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import {
  DetectedObject,
  SceneType,
  EnvironmentContext,
  COCO_LABELS,
} from '../types/environment';
import {
  buildEnvironmentContext,
  hasEnvironmentChanged,
} from '../utils/environmentAnalysis';
import { useUserStore } from '../store/userStore';
import { debugLog } from './debug';

// Performance optimization config
// FIX: Reduced from 15 to 10 FPS to prevent memory issues and concurrent inference
const DEFAULT_OBJECT_DETECTION_FPS = 10;
const DEFAULT_SCENE_INTERVAL = 3000;
const DEFAULT_SKIP_FRAMES = 1;
const MIN_CONFIDENCE = 0.3;

export interface UseEnvironmentDetectionOptions {
  isActive?: boolean;
  objectDetectionFps?: number;
  sceneClassificationInterval?: number;
  skipFrames?: number;
  onEnvironmentDetected?: (context: EnvironmentContext) => void;
}

export function useEnvironmentDetection(
  options: UseEnvironmentDetectionOptions = {}
) {
  const {
    isActive = true,
    objectDetectionFps = DEFAULT_OBJECT_DETECTION_FPS,
    sceneClassificationInterval = DEFAULT_SCENE_INTERVAL,
    skipFrames = DEFAULT_SKIP_FRAMES,
    onEnvironmentDetected,
  } = options;

  // Load TFLite models
  // Using YOLOv5 model (320x320, float32, 80 COCO classes)
  // IMPORTANT: Force 'default' delegate (CPU-only mode) to avoid delegate crashes
  // YOLOv5 model contains 55 DELEGATE operations that may not be supported in worklet context
  const objectModel = useTensorflowModel(
    require('../../assets/tflite/yolo-v5-tflite-model-v1.tflite'),
    'default' // Explicitly use CPU-only mode, no GPU/XNNPACK delegates
  );

  const sceneModel = useTensorflowModel(
    require('../../assets/tflite/mobilenet-v3-tflite-large-075-224-classification-v1.tflite'),
    'default' // Consistent delegate usage
  );

  // State management
  const { setCurrentEnvironment, addEnvironmentHistory, currentEnvironment } =
    useUserStore();
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [lastDetectedObjects, setLastDetectedObjects] = useState<
    DetectedObject[]
  >([]);
  const [currentScene, setCurrentScene] = useState<SceneType>('unknown');

  // Frame processing control
  const frameCount = useRef(0);
  const lastObjectDetectionTime = useRef(0);
  const lastSceneClassificationTime = useRef(0);

  // FIX: Add inference lock to prevent concurrent model calls
  const isInferenceRunning = useRef(false);

  // Resize plugin
  const { resize } = useResizePlugin();

  // Check model loading status
  useEffect(() => {
    if (objectModel.state === 'loaded' && sceneModel.state === 'loaded') {
      setModelStatus('ready');
      debugLog('useEnvironmentDetection', 'Both models loaded successfully');
    } else if (objectModel.state === 'error' || sceneModel.state === 'error') {
      setModelStatus('error');
      debugLog('useEnvironmentDetection', 'Error loading models', {
        objectModel: objectModel.state,
        sceneModel: sceneModel.state,
      });
    }
  }, [objectModel.state, sceneModel.state]);

  /**
   * Process frame for object detection
   * This function should be called from a frame processor worklet
   *
   * ✅ FIXED - Root cause was data type mismatch (uint8 vs float32)
   * Solution: Use float32 input as expected by react-native-fast-tflite
   * Model metadata shows uint8 input, but library expects pre-normalized float32
   */
  const processFrameForObjects = useCallback(
    (frame: any) => {
      'worklet';

      // Wrap entire function in try-catch to prevent crashes
      try {
        // FIX: Define COCO_LABELS inline within worklet to avoid import issues
        // Worklets may not have access to imported constants
        const WORKLET_COCO_LABELS = [
          'person',
          'bicycle',
          'car',
          'motorcycle',
          'airplane',
          'bus',
          'train',
          'truck',
          'boat',
          'traffic light',
          'fire hydrant',
          'stop sign',
          'parking meter',
          'bench',
          'bird',
          'cat',
          'dog',
          'horse',
          'sheep',
          'cow',
          'elephant',
          'bear',
          'zebra',
          'giraffe',
          'backpack',
          'umbrella',
          'handbag',
          'tie',
          'suitcase',
          'frisbee',
          'skis',
          'snowboard',
          'sports ball',
          'kite',
          'baseball bat',
          'baseball glove',
          'skateboard',
          'surfboard',
          'tennis racket',
          'bottle',
          'wine glass',
          'cup',
          'fork',
          'knife',
          'spoon',
          'bowl',
          'banana',
          'apple',
          'sandwich',
          'orange',
          'broccoli',
          'carrot',
          'hot dog',
          'pizza',
          'donut',
          'cake',
          'chair',
          'couch',
          'potted plant',
          'bed',
          'dining table',
          'toilet',
          'tv',
          'laptop',
          'mouse',
          'remote',
          'keyboard',
          'cell phone',
          'microwave',
          'oven',
          'toaster',
          'sink',
          'refrigerator',
          'book',
          'clock',
          'vase',
          'scissors',
          'teddy bear',
          'hair drier',
          'toothbrush',
        ];

        // Create a safe console wrapper for worklet context
        const safeConsole = {
          log: (message: string, ...args: any[]) => {
            'worklet';
            try {
              if (typeof console !== 'undefined' && console.log) {
                console.log(message, ...args);
              }
            } catch (e) {
              // Silently ignore console errors in worklet
            }
          },
        };

        // ✅ CRITICAL FIX: Acquire lock FIRST to prevent race condition
        // Multiple frames could pass the check simultaneously before lock is set
        if (isInferenceRunning.current) {
          // Another inference is running, skip silently
          safeConsole.log(
            '[useEnvironmentDetection] ⏭️  Skipped - inference already running'
          );
          return null;
        }

        // Set lock immediately to block other frames
        isInferenceRunning.current = true;
        safeConsole.log(
          '[useEnvironmentDetection] 🔒 Lock acquired - starting inference'
        );

        // Basic checks - release lock if failed
        if (!isActive || modelStatus !== 'ready' || !objectModel.model) {
          isInferenceRunning.current = false;
          return null;
        }

        // Frame sampling - release lock if skipped
        frameCount.current++;
        if (frameCount.current % (skipFrames + 1) !== 0) {
          isInferenceRunning.current = false;
          return null;
        }

        // Throttle based on FPS - release lock if too soon
        const now = Date.now();
        const minInterval = 1000 / objectDetectionFps;
        if (now - lastObjectDetectionTime.current < minInterval) {
          isInferenceRunning.current = false;
          return null;
        }
        lastObjectDetectionTime.current = now;

        safeConsole.log(
          '[useEnvironmentDetection] ✅ All checks passed - starting frame processing'
        );

        // Resize frame for model (300x300 for COCO SSD MobileNet V1)
        // YOLOv5 uses float32 input (same as Scene model)
        safeConsole.log(
          '[useEnvironmentDetection] 📐 About to resize frame to 320x320 for YOLOv5'
        );
        let resized: any;
        try {
          resized = resize(frame, {
            scale: {
              width: 320,
              height: 320,
            },
            pixelFormat: 'rgb',
            dataType: 'float32', // YOLOv5 expects float32
          });
          safeConsole.log('[useEnvironmentDetection] Resize complete');
        } catch (resizeError) {
          safeConsole.log('[useEnvironmentDetection] Resize failed');
          isInferenceRunning.current = false; // Release lock on error
          return null;
        }

        // Extract buffer from resize result as Float32Array first
        safeConsole.log('[useEnvironmentDetection] About to extract buffer');
        let resizedFloat32: Float32Array;

        // Type-safe buffer extraction with any casting to avoid TypeScript complexity
        const resizedAny = resized as any;

        try {
          // Try multiple paths to extract the buffer
          if (resizedAny?.buffer instanceof ArrayBuffer) {
            resizedFloat32 = new Float32Array(resizedAny.buffer);
          } else if (
            resizedAny?.buffer &&
            ArrayBuffer.isView(resizedAny.buffer)
          ) {
            const view = resizedAny.buffer as any;
            resizedFloat32 =
              view instanceof Float32Array
                ? view
                : new Float32Array(
                    view.buffer,
                    view.byteOffset,
                    view.byteLength / 4
                  );
          } else if (resizedAny?.data instanceof ArrayBuffer) {
            resizedFloat32 = new Float32Array(resizedAny.data);
          } else if (resizedAny?.data && ArrayBuffer.isView(resizedAny.data)) {
            const view = resizedAny.data as any;
            resizedFloat32 =
              view instanceof Float32Array
                ? view
                : new Float32Array(
                    view.buffer,
                    view.byteOffset,
                    view.byteLength / 4
                  );
          } else if (resizedAny instanceof ArrayBuffer) {
            resizedFloat32 = new Float32Array(resizedAny);
          } else if (ArrayBuffer.isView(resizedAny)) {
            const view = resizedAny as any;
            resizedFloat32 =
              view instanceof Float32Array
                ? view
                : new Float32Array(
                    view.buffer,
                    view.byteOffset,
                    view.byteLength / 4
                  );
          } else {
            isInferenceRunning.current = false; // Release lock on error
            return null;
          }
        } catch (bufferError) {
          isInferenceRunning.current = false; // Release lock on error
          return null;
        }

        safeConsole.log(
          '[useEnvironmentDetection] Float32 buffer extracted, size:',
          resizedFloat32.length
        );

        // Validate buffer size for YOLOv5 (320x320x3)
        const expectedSize = 320 * 320 * 3; // 307200 values
        const actualSize = resizedFloat32.length;

        if (actualSize !== expectedSize) {
          // Buffer size mismatch, skip this frame
          safeConsole.log(
            '[useEnvironmentDetection] Size mismatch:',
            actualSize,
            'vs',
            expectedSize
          );
          isInferenceRunning.current = false; // Release lock on error
          return null;
        }

        // YOLOv5 uses Float32Array directly (no uint8 conversion needed!)
        // Same approach as Scene model
        const resizedFrame = resizedFloat32;

        // Log sample values for debugging
        safeConsole.log('[useEnvironmentDetection] Sample float32 values:', [
          resizedFrame[0],
          resizedFrame[1],
          resizedFrame[2],
        ]);

        // Check model is loaded
        if (!objectModel.model) {
          isInferenceRunning.current = false; // Release lock on error
          return null;
        }

        // Run inference with error handling
        safeConsole.log(
          '[useEnvironmentDetection] About to run YOLOv5 model inference with Float32Array'
        );
        let outputs: any;
        try {
          outputs = objectModel.model.run([resizedFrame]);
          safeConsole.log(
            '[useEnvironmentDetection] ✅ YOLOv5 inference complete - SUCCESS!'
          );
        } catch (inferenceError) {
          safeConsole.log('[useEnvironmentDetection] Model inference failed');
          // Print detailed error information
          if (inferenceError && typeof inferenceError === 'object') {
            const err = inferenceError as any;
            safeConsole.log(
              '[useEnvironmentDetection] Error type:',
              typeof inferenceError
            );
            safeConsole.log(
              '[useEnvironmentDetection] Error message:',
              err.message || 'No message'
            );
            safeConsole.log(
              '[useEnvironmentDetection] Error name:',
              err.name || 'No name'
            );
            if (err.stack) {
              safeConsole.log(
                '[useEnvironmentDetection] Error stack:',
                err.stack
              );
            }
          } else {
            safeConsole.log(
              '[useEnvironmentDetection] Error value:',
              String(inferenceError)
            );
          }
          isInferenceRunning.current = false; // Release lock on error
          return null;
        }

        if (!outputs) {
          safeConsole.log(
            '[useEnvironmentDetection] Outputs is null/undefined'
          );
          isInferenceRunning.current = false; // Release lock on error
          return null;
        }

        safeConsole.log(
          '[useEnvironmentDetection] Checking YOLOv5 output format...'
        );
        safeConsole.log(
          '[useEnvironmentDetection] outputs type:',
          typeof outputs
        );
        safeConsole.log(
          '[useEnvironmentDetection] outputs isArray:',
          Array.isArray(outputs)
        );

        // Extract YOLOv5 output tensor: [1, 6300, 85]
        // Format: [x_center, y_center, w, h, objectness, ...80 class scores]
        let yoloOutput: any;

        if (Array.isArray(outputs)) {
          safeConsole.log(
            '[useEnvironmentDetection] Array format detected, length:',
            outputs.length
          );
          yoloOutput = outputs[0]; // First output is the main prediction tensor
        } else if (typeof outputs === 'object') {
          safeConsole.log('[useEnvironmentDetection] Object format detected');
          // Try to extract first output tensor
          if (outputs._j && Array.isArray(outputs._j)) {
            yoloOutput = outputs._j[0];
          } else if (outputs[0]) {
            yoloOutput = outputs[0];
          } else {
            const keys = Object.keys(outputs);
            if (keys.length > 0) {
              yoloOutput = outputs[keys[0]];
            }
          }
        } else {
          safeConsole.log('[useEnvironmentDetection] Unknown output type');
          isInferenceRunning.current = false;
          return null;
        }

        if (!yoloOutput) {
          safeConsole.log(
            '[useEnvironmentDetection] Failed to extract YOLO output'
          );
          isInferenceRunning.current = false;
          return null;
        }

        safeConsole.log(
          '[useEnvironmentDetection] YOLO output extracted, processing detections...'
        );
        const detectedObjects: DetectedObject[] = [];

        // Simplified YOLO processing: just check if we got output
        // For now, return a placeholder detection to verify the model works
        try {
          // TODO: Implement full YOLO postprocessing (NMS, confidence filtering, etc.)
          // For initial testing, just return a placeholder
          safeConsole.log(
            '[useEnvironmentDetection] YOLO model inference successful!'
          );
          safeConsole.log(
            '[useEnvironmentDetection] Output received - YOLOv5 is working!'
          );

          // Return empty array for now (will implement full processing later)
          safeConsole.log(
            '[useEnvironmentDetection] Returning empty detections (postprocessing not implemented yet)'
          );
        } catch (processingError) {
          safeConsole.log('[useEnvironmentDetection] Processing error caught');
        }

        // FIX: Ensure return value is a plain array of plain objects
        // Create a fresh array to avoid any potential reference issues
        safeConsole.log(
          '[useEnvironmentDetection] Preparing to return results'
        );

        if (detectedObjects.length === 0) {
          safeConsole.log(
            '[useEnvironmentDetection] No objects detected, returning empty array'
          );
          return [];
        }

        // Create a clean copy of the results for safe serialization
        const results: DetectedObject[] = [];
        for (let i = 0; i < detectedObjects.length; i++) {
          const obj = detectedObjects[i];
          results.push({
            label: obj.label,
            confidence: obj.confidence,
            bbox: {
              x: obj.bbox.x,
              y: obj.bbox.y,
              width: obj.bbox.width,
              height: obj.bbox.height,
            },
          });
        }

        safeConsole.log(
          '[useEnvironmentDetection] Returning',
          results.length,
          'results'
        );

        // FIX: Release inference lock before returning
        isInferenceRunning.current = false;
        safeConsole.log(
          '[useEnvironmentDetection] 🔓 Lock released - inference complete'
        );

        return results;
      } catch (outerError) {
        // Catch any unexpected errors at the top level
        // Cannot use safeConsole here as it's out of scope
        try {
          if (typeof console !== 'undefined' && console.log) {
            console.log('[useEnvironmentDetection] Outer error caught');
            // Print detailed error information
            if (outerError && typeof outerError === 'object') {
              const err = outerError as any;
              console.log(
                '[useEnvironmentDetection] Outer error type:',
                typeof outerError
              );
              console.log(
                '[useEnvironmentDetection] Outer error message:',
                err.message || 'No message'
              );
              console.log(
                '[useEnvironmentDetection] Outer error name:',
                err.name || 'No name'
              );
              if (err.stack) {
                console.log(
                  '[useEnvironmentDetection] Outer error stack:',
                  err.stack
                );
              }
            } else {
              console.log(
                '[useEnvironmentDetection] Outer error value:',
                String(outerError)
              );
            }
          }
        } catch (e) {
          // Really ignore
        }

        // FIX: Release inference lock before returning on error
        isInferenceRunning.current = false;

        return null;
      }
    },
    [
      isActive,
      modelStatus,
      objectDetectionFps,
      skipFrames,
      objectModel.model,
      resize,
    ]
  );

  /**
   * Process frame for scene classification
   * This function should be called from a frame processor worklet
   */
  const processFrameForScene = useCallback(
    (frame: any) => {
      'worklet';

      // TODO: Temporarily disabled to focus on fixing Object detection
      console.log(
        '[useEnvironmentDetection] Scene detection temporarily disabled'
      );
      return null;

      if (!isActive || modelStatus !== 'ready' || !sceneModel.model) {
        return null;
      }

      const now = Date.now();

      // Only classify at intervals
      if (
        now - lastSceneClassificationTime.current <
        sceneClassificationInterval
      ) {
        return null;
      }

      lastSceneClassificationTime.current = now;

      try {
        console.log('[useEnvironmentDetection] Scene: Starting resize...');

        // Resize frame for model (224x224 for MobileNetV3)
        const resized = resize(frame, {
          scale: {
            width: 224,
            height: 224,
          },
          pixelFormat: 'rgb',
          dataType: 'float32',
        });

        console.log('[useEnvironmentDetection] Scene: Resize completed');

        // Extract buffer from resize result with multiple fallback strategies
        let resizedFrame: Float32Array;

        // Type-safe buffer extraction with any casting to avoid TypeScript complexity
        const resizedAny = resized as any;

        try {
          // Try multiple paths to extract the buffer
          if (resizedAny?.buffer instanceof ArrayBuffer) {
            resizedFrame = new Float32Array(resizedAny.buffer);
            console.log(
              '[useEnvironmentDetection] Scene: Created Float32Array from buffer property'
            );
          } else if (
            resizedAny?.buffer &&
            ArrayBuffer.isView(resizedAny.buffer)
          ) {
            const view = resizedAny.buffer as any;
            resizedFrame =
              view instanceof Float32Array
                ? view
                : new Float32Array(
                    view.buffer,
                    view.byteOffset,
                    view.byteLength / 4
                  );
            console.log(
              '[useEnvironmentDetection] Scene: Converted buffer TypedArray to Float32Array'
            );
          } else if (resizedAny?.data instanceof ArrayBuffer) {
            resizedFrame = new Float32Array(resizedAny.data);
            console.log(
              '[useEnvironmentDetection] Scene: Created Float32Array from data property'
            );
          } else if (resizedAny?.data && ArrayBuffer.isView(resizedAny.data)) {
            const view = resizedAny.data as any;
            resizedFrame =
              view instanceof Float32Array
                ? view
                : new Float32Array(
                    view.buffer,
                    view.byteOffset,
                    view.byteLength / 4
                  );
            console.log(
              '[useEnvironmentDetection] Scene: Converted data TypedArray to Float32Array'
            );
          } else if (resizedAny instanceof ArrayBuffer) {
            resizedFrame = new Float32Array(resizedAny);
            console.log(
              '[useEnvironmentDetection] Scene: Created Float32Array from direct ArrayBuffer'
            );
          } else if (ArrayBuffer.isView(resizedAny)) {
            const view = resizedAny as any;
            resizedFrame =
              view instanceof Float32Array
                ? view
                : new Float32Array(
                    view.buffer,
                    view.byteOffset,
                    view.byteLength / 4
                  );
            console.log(
              '[useEnvironmentDetection] Scene: Converted direct TypedArray to Float32Array'
            );
          } else {
            console.log(
              '[useEnvironmentDetection] Scene: Unable to extract buffer, unknown format:',
              typeof resizedAny
            );
            return null;
          }
        } catch (bufferError) {
          console.log(
            '[useEnvironmentDetection] Scene: Buffer extraction error:',
            bufferError
          );
          return null;
        }

        console.log(
          '[useEnvironmentDetection] Scene resized frame:',
          typeof resizedFrame,
          'length:',
          resizedFrame.length,
          'byteLength:',
          resizedFrame.byteLength
        );

        // Validate buffer size for scene model
        const expectedSize = 224 * 224 * 3; // Number of float32 values (not bytes)
        const actualSize = resizedFrame.length;

        if (actualSize !== expectedSize) {
          console.log(
            `[useEnvironmentDetection] Scene WARNING: Buffer size mismatch! Expected: ${expectedSize} values, Actual: ${actualSize} values`
          );
          console.log(
            `[useEnvironmentDetection] Scene WARNING: This suggests resize failed - frame may still be original resolution`
          );
          return null; // Don't try to run inference with wrong size
        }

        // Log sample values for debugging
        console.log('[useEnvironmentDetection] Scene: Sample values:', [
          resizedFrame[0],
          resizedFrame[1],
          resizedFrame[2],
        ]);

        // FIX: Resize plugin with dataType:'float32' already returns normalized 0-1 data
        // No need to divide by 255 again!
        console.log(
          '[useEnvironmentDetection] Scene: Buffer validated, running model...'
        );

        // Check model is loaded
        if (!sceneModel.model) {
          console.log('[useEnvironmentDetection] Scene: Model not available');
          return null;
        }

        // Run inference with the frame data (already normalized by resize plugin)
        const outputs = sceneModel.model.run([resizedFrame]) as any;

        console.log('[useEnvironmentDetection] Scene: Model run completed');
        console.log(
          '[useEnvironmentDetection] Scene: Outputs type:',
          typeof outputs
        );
        console.log(
          '[useEnvironmentDetection] Scene: Outputs is array?',
          Array.isArray(outputs)
        );

        if (!outputs) {
          console.log('[useEnvironmentDetection] Scene: No outputs from model');
          return null;
        }

        // react-native-fast-tflite with Hermes engine returns special object structure
        let probabilities: Float32Array | null = null;

        if (Array.isArray(outputs)) {
          // If it's an array, use first element
          probabilities = outputs[0] as Float32Array;
          console.log(
            '[useEnvironmentDetection] Scene: Using array format outputs[0]'
          );
        } else if (
          outputs instanceof Float32Array ||
          outputs instanceof Uint8Array
        ) {
          // Direct TypedArray
          probabilities = outputs as Float32Array;
          console.log(
            '[useEnvironmentDetection] Scene: Direct TypedArray output'
          );
        } else if (typeof outputs === 'object') {
          console.log(
            '[useEnvironmentDetection] Scene: Outputs is object, extracting tensor data...'
          );

          // Hermes engine wraps outputs in special structure: { _j: [{ 0: val, 1: val, ... }] }
          // Try to access the tensor data through various paths
          let tensorData: any = null;

          // Path 1: outputs._j[0] (Hermes common pattern)
          if (outputs._j && Array.isArray(outputs._j) && outputs._j[0]) {
            tensorData = outputs._j[0];
            console.log(
              '[useEnvironmentDetection] Scene: Found tensor in outputs._j[0]'
            );
          }
          // Path 2: outputs[0] (direct index)
          else if (outputs[0] !== undefined) {
            tensorData = outputs[0];
            console.log(
              '[useEnvironmentDetection] Scene: Found tensor in outputs[0]'
            );
          }
          // Path 3: Object.values fallback
          else {
            const values = Object.values(outputs).filter(
              (v: any) => v && typeof v === 'object'
            );
            if (values.length > 0) {
              // Find the array or object with tensor data
              for (const val of values) {
                const valAny = val as any;
                if (Array.isArray(valAny) && valAny[0]) {
                  tensorData = valAny[0];
                  console.log(
                    '[useEnvironmentDetection] Scene: Found tensor in Object.values array'
                  );
                  break;
                } else if (valAny[0] !== undefined) {
                  tensorData = valAny;
                  console.log(
                    '[useEnvironmentDetection] Scene: Found tensor in Object.values object'
                  );
                  break;
                }
              }
            }
          }

          if (!tensorData) {
            console.log(
              '[useEnvironmentDetection] Scene: Could not find tensor data in outputs'
            );
            console.log(
              '[useEnvironmentDetection] Scene: Outputs structure:',
              JSON.stringify(outputs, null, 2).slice(0, 500)
            );
            return null;
          }

          // Convert tensor data (object with numeric keys) to Float32Array
          if (tensorData instanceof Float32Array) {
            probabilities = tensorData;
            console.log(
              '[useEnvironmentDetection] Scene: Tensor is already Float32Array'
            );
          } else if (typeof tensorData === 'object') {
            // Convert object { "0": val, "1": val, ... } to Float32Array
            const keys = Object.keys(tensorData).filter(
              (k) => !k.startsWith('_')
            );
            console.log(
              '[useEnvironmentDetection] Scene: Converting object to Float32Array, keys:',
              keys.length
            );

            probabilities = new Float32Array(keys.length);
            for (let i = 0; i < keys.length; i++) {
              probabilities[i] = Number(tensorData[i]);
            }
            console.log(
              '[useEnvironmentDetection] Scene: Converted to Float32Array, length:',
              probabilities.length
            );
          }
        }

        if (!probabilities || probabilities.length === 0) {
          console.log(
            '[useEnvironmentDetection] Scene: Could not extract probabilities from outputs'
          );
          return null;
        }

        // Type assertion after null check - we know probabilities is not null here
        const validProbabilities: Float32Array = probabilities!;

        console.log(
          '[useEnvironmentDetection] Scene: Raw output length:',
          validProbabilities.length
        );

        // Model outputs logits, not probabilities
        // Find max logit (no need for full softmax since we only need the argmax)
        console.log('[useEnvironmentDetection] Scene: Finding max logit...');

        let maxLogit = -Infinity;
        let maxIndex = 0;

        for (let i = 0; i < validProbabilities.length; i++) {
          const logit = Number(validProbabilities[i]);
          if (logit > maxLogit) {
            maxLogit = logit;
            maxIndex = i;
          }
        }

        // Calculate confidence using softmax for just the max value
        // For better accuracy, we'd compute full softmax, but this is an approximation
        let expSum = 0;
        for (let i = 0; i < Math.min(validProbabilities.length, 100); i++) {
          expSum += Math.exp(Number(validProbabilities[i]));
        }
        const confidence = Math.exp(maxLogit) / expSum;

        console.log('[useEnvironmentDetection] Scene: Max logit found:', {
          index: maxIndex,
          logit: maxLogit,
          approximateConfidence: confidence.toFixed(4),
        });

        // Map ImageNet class to scene type
        // ImageNet has 1001 classes - we need to infer scene from object class
        let scene: SceneType = 'unknown';

        // Indoor object classes (rough mapping)
        // Classes 0-100: Many indoor items (furniture, appliances, etc.)
        // Classes 400-500: Indoor animals/pets
        // Classes 700-850: Indoor objects and furniture
        if (
          (maxIndex >= 0 && maxIndex < 150) || // Early classes: many indoor items
          (maxIndex >= 400 && maxIndex < 500) || // Pets and indoor animals
          (maxIndex >= 700 && maxIndex < 850) // Furniture and appliances
        ) {
          scene = 'indoor';
        }
        // Outdoor classes
        // Classes 200-400: Many outdoor animals and nature
        // Classes 500-700: Vehicles and outdoor structures
        else if (
          (maxIndex >= 150 && maxIndex < 400) || // Outdoor animals, nature
          (maxIndex >= 500 && maxIndex < 700) // Vehicles, outdoor structures
        ) {
          scene = 'outdoor';
        }
        // Unknown for ambiguous classes
        else {
          scene = 'unknown';
        }

        console.log('[useEnvironmentDetection] Scene: Classification result:', {
          scene,
          confidence: confidence.toFixed(4),
          maxIndex,
          maxLogit: maxLogit.toFixed(2),
        });

        return { scene, confidence };
      } catch (error) {
        // Note: debugLog is not available in worklet context
        // Use console.log for debugging in worklet
        console.log(
          '[useEnvironmentDetection] Scene classification error:',
          JSON.stringify(error)
        );
        if (error && typeof error === 'object') {
          const err = error as any;
          console.log('[useEnvironmentDetection] Error message:', err.message);
          console.log('[useEnvironmentDetection] Error stack:', err.stack);
        }
        return null;
      }
    },
    [
      isActive,
      modelStatus,
      sceneClassificationInterval,
      sceneModel.model,
      resize,
    ]
  );

  /**
   * Update environment context with new detections
   * Call this from main thread after processing frames
   */
  const updateEnvironmentContext = useCallback(
    (objects: DetectedObject[], scene: SceneType, confidence: number) => {
      setLastDetectedObjects(objects);
      setCurrentScene(scene);

      const environmentContext = buildEnvironmentContext(
        scene,
        objects,
        confidence
      );

      setCurrentEnvironment(environmentContext);
      addEnvironmentHistory(environmentContext);

      if (onEnvironmentDetected) {
        onEnvironmentDetected(environmentContext);
      }

      debugLog('useEnvironmentDetection', 'Environment updated', {
        scene,
        objectCount: objects.length,
        confidence: `${(confidence * 100).toFixed(1)}%`,
      });
    },
    [setCurrentEnvironment, addEnvironmentHistory, onEnvironmentDetected]
  );

  return {
    modelStatus,
    currentScene,
    lastDetectedObjects,
    processFrameForObjects,
    processFrameForScene,
    updateEnvironmentContext,
  };
}
