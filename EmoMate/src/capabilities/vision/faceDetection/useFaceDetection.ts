/**
 * Face detection hook
 * Manages MLKit face detection and emotion recognition
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import type { FaceDetectionOptions } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { EmotionType } from '../../../types/emotion';
import { debugLog, isDebugMode } from '../../../utils/debug';
import {
  TIMEOUT_CONSTANTS,
  EMOTION_THRESHOLDS,
} from '../../../constants/vision';
import {
  calculateMouthAspectRatio,
  calculateAvgEyeOpen,
  MLKitLandmarks,
} from './faceFeatures';
import { detectEmotionFromFace } from './emotionAlgorithm';

/**
 * Face detection options
 */
export interface UseFaceDetectionOptions {
  /** Whether face detection is active */
  isActive: boolean;
  /** Minimum interval between detections (ms) */
  detectionInterval?: number;
  /** Callback when emotion is detected */
  onEmotionDetected: (emotion: EmotionType) => void;
  /** Optional custom face detection options */
  faceDetectionOptions?: FaceDetectionOptions;
}

/**
 * Face detection return value
 */
export interface UseFaceDetectionReturn {
  /** Frame processor for camera */
  frameProcessor: any; // FrameProcessor type from react-native-vision-camera
  /** Currently detected emotion */
  currentEmotion: EmotionType;
  /** Whether a face is currently detected */
  faceDetected: boolean;
  /** Whether face detection is ready */
  isReady: boolean;
}

/**
 * Hook for MLKit-based face detection and emotion recognition
 *
 * Features:
 * - Real-time face detection using MLKit
 * - Plutchik's 8 basic emotions detection
 * - Configurable detection interval
 * - Automatic face detection timeout
 *
 * @param options - Face detection configuration
 * @returns Face detection state and frame processor
 */
export function useFaceDetection(
  options: UseFaceDetectionOptions
): UseFaceDetectionReturn {
  const {
    isActive,
    detectionInterval = TIMEOUT_CONSTANTS.DEFAULT_DETECTION_INTERVAL,
    onEmotionDetected,
    faceDetectionOptions: customOptions,
  } = options;

  // State management
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const [faceDetected, setFaceDetected] = useState(false);

  // Refs for tracking detection timing
  const lastMLKitDetection = useRef(0);
  const faceDetectedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // MLKit face detection options - Full power mode with landmarks and contours
  const faceDetectionOptions = useMemo<FaceDetectionOptions>(
    () =>
      customOptions || {
        performanceMode: 'accurate', // Use accurate mode for better emotion detection
        classificationMode: 'all', // Enable smiling and eye open probabilities
        landmarkMode: 'all', // Enable facial landmarks detection
        contourMode: 'all', // Enable facial contours detection
        minFaceSize: 0.15, // Minimum face size ratio
        trackingEnabled: false, // Disabled because contourMode is enabled (conflict)
      },
    [customOptions]
  );

  // Use the MLKit hook to get detectFaces function
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  // Callback to update emotion on JS thread
  const updateEmotionCallback = useCallback(
    (emotion: EmotionType, confidence: number) => {
      setCurrentEmotion(emotion);
      setFaceDetected(true);
      onEmotionDetected(emotion);
      debugLog('useFaceDetection', `MLKit detected emotion: ${emotion}`, {
        confidence,
      });

      // Clear existing timeout to prevent memory leak
      if (faceDetectedTimeoutRef.current) {
        clearTimeout(faceDetectedTimeoutRef.current);
      }

      // Set new timeout with ref tracking
      faceDetectedTimeoutRef.current = setTimeout(() => {
        setFaceDetected(false);
        faceDetectedTimeoutRef.current = null;
      }, TIMEOUT_CONSTANTS.FACE_DETECTION_TIMEOUT);
    },
    [onEmotionDetected]
  );

  // Create worklet-compatible callback
  const updateEmotionWorklet = Worklets.createRunOnJS(updateEmotionCallback);

  // Frame processor for face detection with Plutchik's 8 emotions
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      // Performance optimization: Run at target FPS (10fps instead of 60fps)
      // This reduces CPU usage by ~80%
      //'runAtTargetFps(10)';

      try {
        const faces = detectFaces(frame);

        if (faces && faces.length > 0) {
          const face = faces[0];

          // Basic classification probabilities
          const smilingProbability = face.smilingProbability ?? 0;
          const leftEyeProb = face.leftEyeOpenProbability ?? 0.5;
          const rightEyeProb = face.rightEyeOpenProbability ?? 0.5;
          const avgEyeOpen = calculateAvgEyeOpen(leftEyeProb, rightEyeProb);

          // Landmarks-based features
          const landmarks = face.landmarks as MLKitLandmarks | undefined;
          const mouthAspectRatio = calculateMouthAspectRatio(landmarks);

          // Head pose angles
          const pitchAngle = face.pitchAngle ?? 0;
          const yawAngle = face.yawAngle ?? 0;

          // Detect emotion using algorithm
          const { emotion, confidence } = detectEmotionFromFace({
            smilingProbability,
            avgEyeOpen,
            mouthAspectRatio,
            pitchAngle,
            yawAngle,
          });

          const now = Date.now();
          const lastTime = lastMLKitDetection.current;

          // Only update if enough time has passed and confidence is high enough
          if (
            now - lastTime >= detectionInterval &&
            confidence > EMOTION_THRESHOLDS.MIN_CONFIDENCE
          ) {
            lastMLKitDetection.current = now;

            // Call JS function from worklet context
            updateEmotionWorklet(emotion, confidence);
          }
        }
      } catch (error) {
        // Log frame processing errors in debug mode
        if (isDebugMode()) {
          console.error('[useFaceDetection] Frame processing error:', error);
        }
      }
    },
    [detectFaces, detectionInterval, updateEmotionWorklet]
  );

  // Cleanup timeout on unmount
  const cleanup = useCallback(() => {
    if (faceDetectedTimeoutRef.current) {
      clearTimeout(faceDetectedTimeoutRef.current);
      faceDetectedTimeoutRef.current = null;
    }
  }, []);

  return {
    frameProcessor: isActive ? frameProcessor : undefined,
    currentEmotion,
    faceDetected,
    isReady: isActive,
  };
}
