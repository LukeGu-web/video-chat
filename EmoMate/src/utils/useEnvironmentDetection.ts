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
          width: 320,
          height: 320,
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });

        console.log('[useEnvironmentDetection] Resized object:', typeof resized);
        console.log('[useEnvironmentDetection] Resized keys:', Object.keys(resized || {}));

        // Extract buffer from resize result with multiple fallback strategies
        let resizedFrame: any;

        if (resized?.buffer) {
          // Strategy 1: buffer property (most likely)
          resizedFrame = resized.buffer;
          console.log('[useEnvironmentDetection] Using resized.buffer');
        } else if (resized?.data) {
          // Strategy 2: data property
          resizedFrame = resized.data;
          console.log('[useEnvironmentDetection] Using resized.data');
        } else if (resized?.array) {
          // Strategy 3: array property
          resizedFrame = resized.array;
          console.log('[useEnvironmentDetection] Using resized.array');
        } else if (ArrayBuffer.isView(resized)) {
          // Strategy 4: Direct TypedArray
          resizedFrame = resized;
          console.log('[useEnvironmentDetection] Resized is direct TypedArray');
        } else {
          // Strategy 5: Use as-is (original behavior)
          resizedFrame = resized;
          console.log('[useEnvironmentDetection] Using resized as-is');
        }

        console.log('[useEnvironmentDetection] Resized frame:', typeof resizedFrame, resizedFrame?.length || resizedFrame?.byteLength);

        // Validate buffer size before inference
        const expectedSize = 320 * 320 * 3; // 307200
        const actualSize = resizedFrame?.length || resizedFrame?.byteLength || 0;

        if (actualSize !== expectedSize) {
          console.log(`[useEnvironmentDetection] WARNING: Buffer size mismatch! Expected: ${expectedSize}, Actual: ${actualSize}`);
          // Continue anyway to get detailed error from TFLite
        }

        // Run inference
        const outputs = objectModel.model.run([resizedFrame]);

        console.log('[useEnvironmentDetection] Model output:', typeof outputs, outputs?.length);

        if (!outputs || outputs.length < 4) {
          console.log('[useEnvironmentDetection] Invalid output from model');
          return null;
        }

        // Parse results
        const boxes = outputs[0];
        const classes = outputs[1];
        const scores = outputs[2];
        const numDetections = Math.min(outputs[3][0], 10);

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
        console.log('[useEnvironmentDetection] Object detection error:', JSON.stringify(error));
        console.log('[useEnvironmentDetection] Error message:', error?.message);
        console.log('[useEnvironmentDetection] Error stack:', error?.stack);
        return null;
      }
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
        // Resize frame for model (224x224 for MobileNetV3)
        const resized = resize(frame, {
          width: 224,
          height: 224,
          pixelFormat: 'rgb',
          dataType: 'float32',
          normalize: true,
        });

        // Extract buffer from resize result with multiple fallback strategies
        let resizedFrame: any;

        if (resized?.buffer) {
          resizedFrame = resized.buffer;
          console.log('[useEnvironmentDetection] Scene: Using resized.buffer');
        } else if (resized?.data) {
          resizedFrame = resized.data;
          console.log('[useEnvironmentDetection] Scene: Using resized.data');
        } else if (resized?.array) {
          resizedFrame = resized.array;
          console.log('[useEnvironmentDetection] Scene: Using resized.array');
        } else if (ArrayBuffer.isView(resized)) {
          resizedFrame = resized;
          console.log('[useEnvironmentDetection] Scene: Resized is direct TypedArray');
        } else {
          resizedFrame = resized;
          console.log('[useEnvironmentDetection] Scene: Using resized as-is');
        }

        console.log('[useEnvironmentDetection] Scene resized frame:', typeof resizedFrame, resizedFrame?.length || resizedFrame?.byteLength);

        // Validate buffer size for scene model
        const expectedSize = 224 * 224 * 3 * 4; // float32 = 4 bytes per value
        const actualSize = resizedFrame?.length || resizedFrame?.byteLength || 0;

        if (actualSize !== expectedSize) {
          console.log(`[useEnvironmentDetection] Scene WARNING: Buffer size mismatch! Expected: ${expectedSize}, Actual: ${actualSize}`);
        }

        // Run inference
        const outputs = sceneModel.model.run([resizedFrame]);
        if (!outputs || outputs.length === 0) {
          return null;
        }

        // Get top prediction
        const probabilities = outputs[0];
        let maxProb = 0;
        let maxIndex = 0;

        for (let i = 0; i < probabilities.length; i++) {
          if (probabilities[i] > maxProb) {
            maxProb = probabilities[i];
            maxIndex = i;
          }
        }

        // Map to scene type (simplified - adjust based on model)
        let scene: SceneType = 'unknown';
        if (maxIndex < 100) {
          scene = 'indoor';
        } else if (maxIndex < 200) {
          scene = 'outdoor';
        } else {
          scene = 'unknown';
        }

        return { scene, confidence: maxProb };
      } catch (error) {
        // Note: debugLog is not available in worklet context
        // Use console.log for debugging in worklet
        console.log('[useEnvironmentDetection] Scene classification error:', JSON.stringify(error));
        console.log('[useEnvironmentDetection] Error message:', error?.message);
        console.log('[useEnvironmentDetection] Error stack:', error?.stack);
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
