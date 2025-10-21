import { useMemo, useEffect, useRef } from 'react';
import { Frame } from 'react-native-vision-camera';
import { useFaceDetector, FaceDetectionOptions, Face } from 'react-native-vision-camera-face-detector';
import type { EmotionType, FaceData, EmotionDetectionResult } from '../types/emotion';

// Re-export Face type for backward compatibility
export type MLKitFace = Face;

// Re-export FaceDetectionOptions for backward compatibility
export type MLKitFaceDetectionOptions = FaceDetectionOptions;

// Face Detector Plugin Interface
type FaceDetectorPlugin = {
  detectFaces: (frame: Frame) => Face[];
  stopListeners: () => void;
};

/**
 * 使用react-native-vision-camera-face-detector 1.9.0 API
 * 替代旧的VisionCameraProxy方式
 */
export function useMLKitFaceDetector(
  options?: FaceDetectionOptions
): FaceDetectorPlugin | null {
  const detectionOptions = useMemo<FaceDetectionOptions>(() => ({
    performanceMode: 'fast',
    classificationMode: 'all', // Enable emotion classification
    landmarkMode: 'none',
    contourMode: 'none',
    minFaceSize: 0.15,
    trackingEnabled: false,
    ...options
  }), [options]);

  // Use the new useFaceDetector hook from 1.9.0
  const { detectFaces, stopListeners } = useFaceDetector(detectionOptions);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListeners();
    };
  }, [stopListeners]);

  return useMemo(() => {
    if (!detectFaces) return null;

    return {
      detectFaces: (frame: Frame): Face[] => {
        'worklet';
        try {
          const faces = detectFaces(frame);
          return Array.isArray(faces) ? faces : [];
        } catch (error) {
          console.warn('[FaceDetector] Detection failed:', error);
          return [];
        }
      },
      stopListeners
    };
  }, [detectFaces, stopListeners]);
}

/**
 * 基于MLKit面部特征分析情绪
 * 使用react-native-vision-camera-face-detector 1.9.0 Face接口
 */
export function analyzeEmotionFromMLKitFace(face: Face): EmotionDetectionResult {
  // Face interface from 1.9.0: { smilingProbability, leftEyeOpenProbability, rightEyeOpenProbability, bounds }
  const smilingProb = face.smilingProbability ?? 0;
  const leftEyeProb = face.leftEyeOpenProbability ?? 0.5;
  const rightEyeProb = face.rightEyeOpenProbability ?? 0.5;

  // Calculate average eye open probability
  const avgEyeOpen = (leftEyeProb + rightEyeProb) / 2;

  let emotion: EmotionType = 'neutral';
  let confidence = 0.5;

  // Emotion analysis algorithm based on facial probabilities
  if (smilingProb > 0.6) {
    // High smiling probability = happy
    emotion = 'happy';
    confidence = Math.min(smilingProb, 0.95);
  } else if (avgEyeOpen > 0.8 && smilingProb < 0.3) {
    // Wide eyes + low smile = surprised
    emotion = 'surprised';
    confidence = Math.min(avgEyeOpen, 0.85);
  } else if (avgEyeOpen < 0.4 && smilingProb < 0.2) {
    // Eyes closed + no smile = sad
    emotion = 'sad';
    confidence = Math.min(1.0 - avgEyeOpen, 0.8);
  } else if (smilingProb < 0.1 && avgEyeOpen > 0.5) {
    // No smile + normal eyes = angry
    emotion = 'angry';
    confidence = Math.min(1.0 - smilingProb, 0.75);
  }

  return {
    emotion,
    confidence,
    timestamp: Date.now()
  };
}

/**
 * Convert Face data to legacy FaceData format
 */
export function convertMLKitFaceToFaceData(face: Face): FaceData {
  return {
    smilingProbability: face.smilingProbability,
    leftEyeOpenProbability: face.leftEyeOpenProbability,
    rightEyeOpenProbability: face.rightEyeOpenProbability,
    bounds: face.bounds
  };
}

/**
 * Check if face detection is available
 * For 1.9.0, detection availability is determined by the useFaceDetector hook
 */
export function isMLKitAvailable(): boolean {
  // For version 1.9.0, face detection is available if the library is properly installed
  // The actual availability check happens within useFaceDetector hook
  try {
    // Check if the library exports are available
    return typeof useFaceDetector === 'function';
  } catch (error) {
    console.warn('[FaceDetector] Face detection not available:', error);
    return false;
  }
}