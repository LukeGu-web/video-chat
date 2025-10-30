/**
 * ObjectEnvironmentDetector Component
 *
 * Uses react-native-fast-tflite to detect objects and classify scenes
 * Works alongside BasicEmotionDetector to provide comprehensive environment awareness
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useFrameProcessor } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import {
  ObjectEnvironmentDetectorProps,
  DetectedObject,
  SceneType,
  ObjectDetectionResult,
  SceneClassificationResult,
  COCO_LABELS,
} from '../types/environment';
import {
  buildEnvironmentContext,
  filterObjectsByConfidence,
  hasEnvironmentChanged,
} from '../utils/environmentAnalysis';
import { useUserStore } from '../store/userStore';
import { debugLog, isDebugMode } from '../utils/debug';

// Performance optimization config
const DEFAULT_OBJECT_DETECTION_FPS = 15; // Detect objects 15 times per second
const DEFAULT_SCENE_INTERVAL = 3000; // Classify scene every 3 seconds
const DEFAULT_SKIP_FRAMES = 1; // Process every other frame
const MIN_CONFIDENCE = 0.3; // Minimum confidence threshold for detections

export const ObjectEnvironmentDetector: React.FC<ObjectEnvironmentDetectorProps> = ({
  onEnvironmentDetected,
  onObjectsDetected,
  isActive = true,
  objectDetectionFps = DEFAULT_OBJECT_DETECTION_FPS,
  sceneClassificationInterval = DEFAULT_SCENE_INTERVAL,
  skipFrames = DEFAULT_SKIP_FRAMES,
}) => {
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

  // Resize plugin for model input preprocessing
  const { resize } = useResizePlugin();

  // Check model loading status
  useEffect(() => {
    if (objectModel.state === 'loaded' && sceneModel.state === 'loaded') {
      setModelStatus('ready');
      debugLog('ObjectEnvironmentDetector', 'Both models loaded successfully');
    } else if (objectModel.state === 'error' || sceneModel.state === 'error') {
      setModelStatus('error');
      debugLog('ObjectEnvironmentDetector', 'Error loading models', {
        objectModel: objectModel.state,
        sceneModel: sceneModel.state,
      });
    }
  }, [objectModel.state, sceneModel.state]);

  /**
   * Worklet function to detect objects using TFLite model
   * Runs on the JS worklet thread for performance
   */
  const detectObjects = Worklets.createRunInJsFn((frame: any) => {
    'worklet';

    if (!isActive || modelStatus !== 'ready') {
      return;
    }

    // Frame sampling - only process every Nth frame
    frameCount.current++;
    if (frameCount.current % (skipFrames + 1) !== 0) {
      return;
    }

    // Throttle based on FPS setting
    const now = Date.now();
    const minInterval = 1000 / objectDetectionFps;
    if (now - lastObjectDetectionTime.current < minInterval) {
      return;
    }
    lastObjectDetectionTime.current = now;

    try {
      // Resize frame to model input size (320x320 for EfficientDet Lite0)
      const resizedFrame = resize(frame, {
        width: 320,
        height: 320,
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      // Run object detection inference
      const startTime = Date.now();
      const outputs = objectModel.model?.run([resizedFrame]);
      const inferenceTime = Date.now() - startTime;

      if (!outputs || outputs.length === 0) {
        return;
      }

      // Parse detection results
      // EfficientDet outputs: [boxes, classes, scores, num_detections]
      const boxes = outputs[0]; // [N, 4] - bounding boxes
      const classes = outputs[1]; // [N] - class indices
      const scores = outputs[2]; // [N] - confidence scores
      const numDetections = outputs[3][0]; // number of valid detections

      const detectedObjects: DetectedObject[] = [];

      for (let i = 0; i < numDetections && i < 10; i++) {
        const confidence = scores[i];
        if (confidence < MIN_CONFIDENCE) continue;

        const classIndex = Math.round(classes[i]);
        const label = COCO_LABELS[classIndex] || 'unknown';

        // Bounding box coordinates (normalized 0-1)
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

      // Filter and update detected objects
      const filteredObjects = filterObjectsByConfidence(detectedObjects, MIN_CONFIDENCE);

      // Update state on main thread
      Worklets.defaultContext.runAsync(() => {
        setLastDetectedObjects(filteredObjects);

        if (onObjectsDetected) {
          onObjectsDetected({
            objects: filteredObjects,
            timestamp: now,
            inferenceTime,
          });
        }

        debugLog('ObjectEnvironmentDetector', `Detected ${filteredObjects.length} objects`, {
          inferenceTime: `${inferenceTime}ms`,
          objects: filteredObjects.map(o => `${o.label} (${(o.confidence * 100).toFixed(0)}%)`),
        });
      });

    } catch (error) {
      debugLog('ObjectEnvironmentDetector', 'Object detection error', error);
    }
  });

  /**
   * Worklet function to classify scene using TFLite model
   * Runs less frequently than object detection
   */
  const classifyScene = Worklets.createRunInJsFn((frame: any) => {
    'worklet';

    if (!isActive || modelStatus !== 'ready') {
      return;
    }

    const now = Date.now();

    // Only classify scene at specified intervals
    if (now - lastSceneClassificationTime.current < sceneClassificationInterval) {
      return;
    }

    // Check if environment has changed significantly before reclassifying
    if (currentEnvironment && !hasEnvironmentChanged(currentEnvironment, lastDetectedObjects)) {
      return;
    }

    lastSceneClassificationTime.current = now;

    try {
      // Resize frame to model input size (224x224 for MobileNetV3)
      const resizedFrame = resize(frame, {
        width: 224,
        height: 224,
        pixelFormat: 'rgb',
        dataType: 'float32',
        normalize: true, // Normalize to [0, 1]
      });

      // Run scene classification inference
      const startTime = Date.now();
      const outputs = sceneModel.model?.run([resizedFrame]);
      const inferenceTime = Date.now() - startTime;

      if (!outputs || outputs.length === 0) {
        return;
      }

      // Get top prediction
      const probabilities = outputs[0]; // [N] - class probabilities
      let maxProb = 0;
      let maxIndex = 0;

      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          maxIndex = i;
        }
      }

      // Map to scene type (simplified mapping - adjust based on your model)
      let scene: SceneType = 'unknown';
      if (maxIndex < 100) {
        scene = 'indoor';
      } else if (maxIndex < 200) {
        scene = 'outdoor';
      } else {
        scene = 'unknown';
      }

      // Update state and build environment context
      Worklets.defaultContext.runAsync(() => {
        setCurrentScene(scene);

        const environmentContext = buildEnvironmentContext(
          scene,
          lastDetectedObjects,
          maxProb
        );

        setCurrentEnvironment(environmentContext);
        addEnvironmentHistory(environmentContext);

        if (onEnvironmentDetected) {
          onEnvironmentDetected(environmentContext);
        }

        debugLog('ObjectEnvironmentDetector', `Scene classified: ${scene}`, {
          confidence: `${(maxProb * 100).toFixed(1)}%`,
          inferenceTime: `${inferenceTime}ms`,
        });
      });

    } catch (error) {
      debugLog('ObjectEnvironmentDetector', 'Scene classification error', error);
    }
  });

  /**
   * Main frame processor - processes camera frames
   */
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    if (!isActive) {
      return;
    }

    // Run object detection
    detectObjects(frame);

    // Run scene classification (less frequently)
    classifyScene(frame);
  }, [isActive, modelStatus, lastDetectedObjects, currentEnvironment]);

  // This component doesn't render anything - it's a processing component
  // The camera is rendered by the parent component (BasicEmotionDetector)
  if (!isDebugMode()) {
    return null;
  }

  // Debug UI
  return (
    <View style={styles.debugContainer}>
      <View style={styles.debugPanel}>
        <Text style={styles.debugTitle}>Environment Detection</Text>
        <Text style={styles.debugText}>
          Status: {modelStatus === 'ready' ? '✅ Ready' : modelStatus === 'loading' ? '⏳ Loading' : '❌ Error'}
        </Text>
        <Text style={styles.debugText}>
          Scene: {currentScene}
        </Text>
        <Text style={styles.debugText}>
          Objects: {lastDetectedObjects.length}
        </Text>
        {lastDetectedObjects.slice(0, 3).map((obj, idx) => (
          <Text key={idx} style={styles.debugText}>
            • {obj.label} ({(obj.confidence * 100).toFixed(0)}%)
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  debugContainer: {
    position: 'absolute',
    bottom: 180,
    right: 10,
    zIndex: 1000,
  },
  debugPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 12,
    borderRadius: 8,
    minWidth: 180,
  },
  debugTitle: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 6,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginBottom: 2,
  },
});
