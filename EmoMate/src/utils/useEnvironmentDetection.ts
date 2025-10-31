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
  filterObjectsByConfidence,
  hasEnvironmentChanged,
} from '../utils/environmentAnalysis';
import { useUserStore } from '../store/userStore';
import { debugLog } from './debug';

// Performance optimization config
const DEFAULT_OBJECT_DETECTION_FPS = 15;
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

export function useEnvironmentDetection(options: UseEnvironmentDetectionOptions = {}) {
  const {
    isActive = true,
    objectDetectionFps = DEFAULT_OBJECT_DETECTION_FPS,
    sceneClassificationInterval = DEFAULT_SCENE_INTERVAL,
    skipFrames = DEFAULT_SKIP_FRAMES,
    onEnvironmentDetected,
  } = options;

  // Load TFLite models
  const objectModel = useTensorflowModel(
    require('../../assets/tflite/efficientdet-tflite-lite0-detection-default-v1.tflite')
  );

  const sceneModel = useTensorflowModel(
    require('../../assets/tflite/mobilenet-v3-tflite-large-075-224-classification-v1.tflite')
  );

  // State management
  const { setCurrentEnvironment, addEnvironmentHistory, currentEnvironment } = useUserStore();
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [lastDetectedObjects, setLastDetectedObjects] = useState<DetectedObject[]>([]);
  const [currentScene, setCurrentScene] = useState<SceneType>('unknown');

  // Frame processing control
  const frameCount = useRef(0);
  const lastObjectDetectionTime = useRef(0);
  const lastSceneClassificationTime = useRef(0);

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
   */
  const processFrameForObjects = useCallback(
    (frame: any) => {
      'worklet';

      // TODO: Temporarily disabled due to crashes - investigate TFLite model compatibility
      console.log('[useEnvironmentDetection] Object detection temporarily disabled');
      return null;

      /*
      if (!isActive || modelStatus !== 'ready' || !objectModel.model) {
        return null;
      }

      // Frame sampling
      frameCount.current++;
      if (frameCount.current % (skipFrames + 1) !== 0) {
        return null;
      }

      // Throttle based on FPS
      const now = Date.now();
      const minInterval = 1000 / objectDetectionFps;
      if (now - lastObjectDetectionTime.current < minInterval) {
        return null;
      }
      lastObjectDetectionTime.current = now;

      try {
        // Check if model is available
        if (!objectModel.model) {
          console.log('[useEnvironmentDetection] Model not loaded yet');
          return null;
        }

        // Resize frame for model (320x320 for EfficientDet)
        const resized = resize(frame, {
          scale: {
            width: 320,
            height: 320,
          },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });

        console.log('[useEnvironmentDetection] Resized object:', typeof resized);

        // Extract buffer from resize result and convert to Uint8Array
        let resizedFrame: Uint8Array | null = null;

        // Type-safe buffer extraction
        const resizedAny = resized as any;

        if (resizedAny?.buffer) {
          // Check if buffer is ArrayBuffer and convert to Uint8Array
          if (resizedAny.buffer instanceof ArrayBuffer) {
            resizedFrame = new Uint8Array(resizedAny.buffer);
            console.log('[useEnvironmentDetection] Created Uint8Array from ArrayBuffer');
          } else if (ArrayBuffer.isView(resizedAny.buffer)) {
            // Already a TypedArray, ensure it's Uint8Array
            const bufferView = resizedAny.buffer as ArrayBufferView;
            resizedFrame = bufferView instanceof Uint8Array
              ? bufferView
              : new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
            console.log('[useEnvironmentDetection] Converted TypedArray to Uint8Array');
          } else {
            console.log('[useEnvironmentDetection] Unknown buffer type:', typeof resizedAny.buffer);
            return null;
          }
        } else if (resizedAny?.data) {
          // Check if data is ArrayBuffer
          if (resizedAny.data instanceof ArrayBuffer) {
            resizedFrame = new Uint8Array(resizedAny.data);
            console.log('[useEnvironmentDetection] Created Uint8Array from data ArrayBuffer');
          } else if (ArrayBuffer.isView(resizedAny.data)) {
            const dataView = resizedAny.data as ArrayBufferView;
            resizedFrame = dataView instanceof Uint8Array
              ? dataView
              : new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
            console.log('[useEnvironmentDetection] Converted data to Uint8Array');
          }
        } else if (ArrayBuffer.isView(resized)) {
          // Direct TypedArray
          const typedArray = resized as ArrayBufferView;
          resizedFrame = typedArray instanceof Uint8Array
            ? typedArray
            : new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
          console.log('[useEnvironmentDetection] Resized is direct TypedArray');
        } else if (resized instanceof ArrayBuffer) {
          // Direct ArrayBuffer
          resizedFrame = new Uint8Array(resized);
          console.log('[useEnvironmentDetection] Created Uint8Array from direct ArrayBuffer');
        } else {
          console.log('[useEnvironmentDetection] Unable to extract buffer from resized object');
          return null;
        }

        if (!resizedFrame) {
          console.log('[useEnvironmentDetection] Failed to create Uint8Array');
          return null;
        }

        console.log('[useEnvironmentDetection] Resized frame:', typeof resizedFrame, 'length:', resizedFrame.length, 'byteLength:', resizedFrame.byteLength);

        // Validate buffer size before inference
        const expectedSize = 320 * 320 * 3; // 307200 bytes for uint8
        const actualSize = resizedFrame.length;

        if (actualSize !== expectedSize) {
          console.log(`[useEnvironmentDetection] WARNING: Buffer size mismatch! Expected: ${expectedSize} bytes, Actual: ${actualSize} bytes`);
          console.log(`[useEnvironmentDetection] WARNING: This suggests resize failed - frame may still be original resolution`);
          // Continue anyway to get detailed error from TFLite
        }

        // Run inference
        const outputs = objectModel.model.run([resizedFrame]);

        console.log('[useEnvironmentDetection] Model output:', typeof outputs);
        console.log('[useEnvironmentDetection] Model output is array?', Array.isArray(outputs));

        if (!outputs) {
          console.log('[useEnvironmentDetection] No outputs from model');
          return null;
        }

        // Extract outputs - handle both array and object formats
        let boxes: any, classes: any, scores: any, numDetections: number;

        if (Array.isArray(outputs)) {
          // Array format (expected for EfficientDet)
          if (outputs.length < 4) {
            console.log('[useEnvironmentDetection] Invalid output from model - expected 4 outputs');
            return null;
          }
          boxes = outputs[0];
          classes = outputs[1];
          scores = outputs[2];
          numDetections = Math.min(outputs[3][0], 10);
        } else if (typeof outputs === 'object') {
          // Object format - try to extract by common keys
          const outputKeys = Object.keys(outputs);
          console.log('[useEnvironmentDetection] Output keys:', outputKeys);

          if (outputKeys.length < 4) {
            console.log('[useEnvironmentDetection] Invalid output - expected at least 4 output tensors');
            return null;
          }

          // Try to map keys to outputs (order matters for EfficientDet)
          boxes = outputs[outputKeys[0]];
          classes = outputs[outputKeys[1]];
          scores = outputs[outputKeys[2]];
          const numDetectionsArray = outputs[outputKeys[3]];
          numDetections = Math.min(numDetectionsArray[0], 10);
        } else {
          console.log('[useEnvironmentDetection] Unknown output format');
          return null;
        }

        const detectedObjects: DetectedObject[] = [];

        for (let i = 0; i < numDetections; i++) {
          const confidence = scores[i];
          if (confidence < MIN_CONFIDENCE) continue;

          const classIndex = Math.round(classes[i]);
          const label = COCO_LABELS[classIndex] || 'unknown';

          const ymin = boxes[i * 4];
          const xmin = boxes[i * 4 + 1];
          const ymax = boxes[i * 4 + 2];
          const xmax = boxes[i * 4 + 3];

          detectedObjects.push({
            label,
            confidence,
            bbox: {
              x: xmin,
              y: ymin,
              width: xmax - xmin,
              height: ymax - ymin,
            },
          });
        }

        return filterObjectsByConfidence(detectedObjects, MIN_CONFIDENCE);
      } catch (error) {
        // Note: debugLog is not available in worklet context
        // Use console.log for debugging in worklet
        const err = error as Error;
        console.log('[useEnvironmentDetection] Object detection error:', JSON.stringify(error));
        console.log('[useEnvironmentDetection] Error message:', err?.message);
        console.log('[useEnvironmentDetection] Error stack:', err?.stack);
        return null;
      }
      */
    },
    [isActive, modelStatus, objectDetectionFps, skipFrames, objectModel.model, resize]
  );

  /**
   * Process frame for scene classification
   * This function should be called from a frame processor worklet
   */
  const processFrameForScene = useCallback(
    (frame: any) => {
      'worklet';

      if (!isActive || modelStatus !== 'ready' || !sceneModel.model) {
        return null;
      }

      const now = Date.now();

      // Only classify at intervals
      if (now - lastSceneClassificationTime.current < sceneClassificationInterval) {
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
        let resizedFrame: Float32Array | null = null;

        // Type-safe buffer extraction
        const resizedAny = resized as any;

        if (resizedAny?.buffer) {
          // Check if buffer is ArrayBuffer and convert to Float32Array
          if (resizedAny.buffer instanceof ArrayBuffer) {
            resizedFrame = new Float32Array(resizedAny.buffer);
            console.log('[useEnvironmentDetection] Scene: Created Float32Array from ArrayBuffer');
          } else if (ArrayBuffer.isView(resizedAny.buffer)) {
            // Already a TypedArray, ensure it's Float32Array
            const bufferView = resizedAny.buffer as ArrayBufferView;
            resizedFrame = bufferView instanceof Float32Array
              ? bufferView
              : new Float32Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength / 4);
            console.log('[useEnvironmentDetection] Scene: Converted TypedArray to Float32Array');
          } else {
            console.log('[useEnvironmentDetection] Scene: Unknown buffer type:', typeof resizedAny.buffer);
            return null;
          }
        } else if (resizedAny?.data) {
          // Check if data is ArrayBuffer
          if (resizedAny.data instanceof ArrayBuffer) {
            resizedFrame = new Float32Array(resizedAny.data);
            console.log('[useEnvironmentDetection] Scene: Created Float32Array from data ArrayBuffer');
          } else if (ArrayBuffer.isView(resizedAny.data)) {
            const dataView = resizedAny.data as ArrayBufferView;
            resizedFrame = dataView instanceof Float32Array
              ? dataView
              : new Float32Array(dataView.buffer, dataView.byteOffset, dataView.byteLength / 4);
            console.log('[useEnvironmentDetection] Scene: Converted data to Float32Array');
          }
        } else if (ArrayBuffer.isView(resized)) {
          // Direct TypedArray
          const typedArray = resized as ArrayBufferView;
          resizedFrame = typedArray instanceof Float32Array
            ? typedArray
            : new Float32Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 4);
          console.log('[useEnvironmentDetection] Scene: Resized is direct TypedArray');
        } else if (resized instanceof ArrayBuffer) {
          // Direct ArrayBuffer
          resizedFrame = new Float32Array(resized);
          console.log('[useEnvironmentDetection] Scene: Created Float32Array from direct ArrayBuffer');
        } else {
          console.log('[useEnvironmentDetection] Scene: Unable to extract buffer from resized object');
          return null;
        }

        if (!resizedFrame) {
          console.log('[useEnvironmentDetection] Scene: Failed to create Float32Array');
          return null;
        }

        console.log('[useEnvironmentDetection] Scene resized frame:', typeof resizedFrame, 'length:', resizedFrame.length, 'byteLength:', resizedFrame.byteLength);

        // Validate buffer size for scene model
        const expectedSize = 224 * 224 * 3; // Number of float32 values (not bytes)
        const actualSize = resizedFrame.length;

        if (actualSize !== expectedSize) {
          console.log(`[useEnvironmentDetection] Scene WARNING: Buffer size mismatch! Expected: ${expectedSize} values, Actual: ${actualSize} values`);
          console.log(`[useEnvironmentDetection] Scene WARNING: This suggests resize failed - frame may still be original resolution`);
          return null; // Don't try to run inference with wrong size
        }

        // Log sample values for debugging
        console.log('[useEnvironmentDetection] Scene: Sample values:', [
          resizedFrame[0],
          resizedFrame[1],
          resizedFrame[2]
        ]);

        // FIX: Resize plugin with dataType:'float32' already returns normalized 0-1 data
        // No need to divide by 255 again!
        console.log('[useEnvironmentDetection] Scene: Buffer validated, running model...');

        // Run inference with the frame data (already normalized by resize plugin)
        const outputs = sceneModel.model.run([resizedFrame]) as any;

        console.log('[useEnvironmentDetection] Scene: Model run completed');
        console.log('[useEnvironmentDetection] Scene: Outputs type:', typeof outputs);
        console.log('[useEnvironmentDetection] Scene: Outputs is array?', Array.isArray(outputs));

        if (!outputs) {
          console.log('[useEnvironmentDetection] Scene: No outputs from model');
          return null;
        }

        // react-native-fast-tflite with Hermes engine returns special object structure
        let probabilities: Float32Array | null = null;

        if (Array.isArray(outputs)) {
          // If it's an array, use first element
          probabilities = outputs[0] as Float32Array;
          console.log('[useEnvironmentDetection] Scene: Using array format outputs[0]');
        } else if (outputs instanceof Float32Array || outputs instanceof Uint8Array) {
          // Direct TypedArray
          probabilities = outputs as Float32Array;
          console.log('[useEnvironmentDetection] Scene: Direct TypedArray output');
        } else if (typeof outputs === 'object') {
          console.log('[useEnvironmentDetection] Scene: Outputs is object, extracting tensor data...');

          // Hermes engine wraps outputs in special structure: { _j: [{ 0: val, 1: val, ... }] }
          // Try to access the tensor data through various paths
          let tensorData: any = null;

          // Path 1: outputs._j[0] (Hermes common pattern)
          if (outputs._j && Array.isArray(outputs._j) && outputs._j[0]) {
            tensorData = outputs._j[0];
            console.log('[useEnvironmentDetection] Scene: Found tensor in outputs._j[0]');
          }
          // Path 2: outputs[0] (direct index)
          else if (outputs[0] !== undefined) {
            tensorData = outputs[0];
            console.log('[useEnvironmentDetection] Scene: Found tensor in outputs[0]');
          }
          // Path 3: Object.values fallback
          else {
            const values = Object.values(outputs).filter((v: any) => v && typeof v === 'object');
            if (values.length > 0) {
              // Find the array or object with tensor data
              for (const val of values) {
                const valAny = val as any;
                if (Array.isArray(valAny) && valAny[0]) {
                  tensorData = valAny[0];
                  console.log('[useEnvironmentDetection] Scene: Found tensor in Object.values array');
                  break;
                } else if (valAny[0] !== undefined) {
                  tensorData = valAny;
                  console.log('[useEnvironmentDetection] Scene: Found tensor in Object.values object');
                  break;
                }
              }
            }
          }

          if (!tensorData) {
            console.log('[useEnvironmentDetection] Scene: Could not find tensor data in outputs');
            console.log('[useEnvironmentDetection] Scene: Outputs structure:', JSON.stringify(outputs, null, 2).slice(0, 500));
            return null;
          }

          // Convert tensor data (object with numeric keys) to Float32Array
          if (tensorData instanceof Float32Array) {
            probabilities = tensorData;
            console.log('[useEnvironmentDetection] Scene: Tensor is already Float32Array');
          } else if (typeof tensorData === 'object') {
            // Convert object { "0": val, "1": val, ... } to Float32Array
            const keys = Object.keys(tensorData).filter(k => !k.startsWith('_'));
            console.log('[useEnvironmentDetection] Scene: Converting object to Float32Array, keys:', keys.length);

            probabilities = new Float32Array(keys.length);
            for (let i = 0; i < keys.length; i++) {
              probabilities[i] = Number(tensorData[i]);
            }
            console.log('[useEnvironmentDetection] Scene: Converted to Float32Array, length:', probabilities.length);
          }
        }

        if (!probabilities || probabilities.length === 0) {
          console.log('[useEnvironmentDetection] Scene: Could not extract probabilities from outputs');
          return null;
        }

        console.log('[useEnvironmentDetection] Scene: Raw output length:', probabilities.length);

        // Model outputs logits, not probabilities
        // Find max logit (no need for full softmax since we only need the argmax)
        console.log('[useEnvironmentDetection] Scene: Finding max logit...');

        let maxLogit = -Infinity;
        let maxIndex = 0;

        for (let i = 0; i < probabilities.length; i++) {
          const logit = Number(probabilities[i]);
          if (logit > maxLogit) {
            maxLogit = logit;
            maxIndex = i;
          }
        }

        // Calculate confidence using softmax for just the max value
        // For better accuracy, we'd compute full softmax, but this is an approximation
        let expSum = 0;
        for (let i = 0; i < Math.min(probabilities.length, 100); i++) {
          expSum += Math.exp(Number(probabilities[i]));
        }
        const confidence = Math.exp(maxLogit) / expSum;

        console.log('[useEnvironmentDetection] Scene: Max logit found:', {
          index: maxIndex,
          logit: maxLogit,
          approximateConfidence: confidence.toFixed(4)
        });

        // Map ImageNet class to scene type
        // ImageNet has 1001 classes - we need to infer scene from object class
        let scene: SceneType = 'unknown';

        // Indoor object classes (rough mapping)
        // Classes 0-100: Many indoor items (furniture, appliances, etc.)
        // Classes 400-500: Indoor animals/pets
        // Classes 700-850: Indoor objects and furniture
        if (
          (maxIndex >= 0 && maxIndex < 150) ||      // Early classes: many indoor items
          (maxIndex >= 400 && maxIndex < 500) ||    // Pets and indoor animals
          (maxIndex >= 700 && maxIndex < 850)       // Furniture and appliances
        ) {
          scene = 'indoor';
        }
        // Outdoor classes
        // Classes 200-400: Many outdoor animals and nature
        // Classes 500-700: Vehicles and outdoor structures
        else if (
          (maxIndex >= 150 && maxIndex < 400) ||    // Outdoor animals, nature
          (maxIndex >= 500 && maxIndex < 700)       // Vehicles, outdoor structures
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
          maxLogit: maxLogit.toFixed(2)
        });

        return { scene, confidence };
      } catch (error) {
        // Note: debugLog is not available in worklet context
        // Use console.log for debugging in worklet
        console.log('[useEnvironmentDetection] Scene classification error:', JSON.stringify(error));
        if (error && typeof error === 'object') {
          const err = error as any;
          console.log('[useEnvironmentDetection] Error message:', err.message);
          console.log('[useEnvironmentDetection] Error stack:', err.stack);
        }
        return null;
      }
    },
    [isActive, modelStatus, sceneClassificationInterval, sceneModel.model, resize]
  );

  /**
   * Update environment context with new detections
   * Call this from main thread after processing frames
   */
  const updateEnvironmentContext = useCallback(
    (objects: DetectedObject[], scene: SceneType, confidence: number) => {
      setLastDetectedObjects(objects);
      setCurrentScene(scene);

      const environmentContext = buildEnvironmentContext(scene, objects, confidence);

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
