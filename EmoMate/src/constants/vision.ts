/**
 * Vision-related constants
 * Centralized configuration to eliminate magic numbers
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Camera container dimensions
 */
export const CAMERA_CONSTANTS = {
  /** Container width in pixels */
  CONTAINER_WIDTH: 120,
  /** Container height in pixels */
  CONTAINER_HEIGHT: 160,
  /** Screen width */
  SCREEN_WIDTH,
  /** Screen height */
  SCREEN_HEIGHT,
  /** Minimum face size ratio for detection (0-1) */
  MIN_FACE_SIZE: 0.15,
} as const;

/**
 * Animation-related constants
 */
export const ANIMATION_CONSTANTS = {
  /** Scale when pressed */
  PRESSED_SCALE: 0.95,
  /** Normal scale */
  NORMAL_SCALE: 1.0,
  /** Spring animation config */
  SPRING_CONFIG: {
    damping: 15,
    stiffness: 150,
  },
} as const;

/**
 * Timeout and interval constants
 */
export const TIMEOUT_CONSTANTS = {
  /** Timeout for face detection indicator (ms) */
  FACE_DETECTION_TIMEOUT: 1000,
  /** Timeout for auto-reset to neutral emotion (ms) */
  NEUTRAL_RESET_TIMEOUT: 5000,
  /** Default emotion detection interval (ms) */
  DEFAULT_DETECTION_INTERVAL: 1000,
} as const;

/**
 * Emotion detection thresholds
 */
export const EMOTION_THRESHOLDS = {
  /** Confidence threshold for emotion detection */
  MIN_CONFIDENCE: 0.6,
  /** High smile probability threshold */
  HIGH_SMILE: 0.7,
  /** Low smile probability threshold */
  LOW_SMILE: 0.2,
  /** Very low smile probability threshold */
  VERY_LOW_SMILE: 0.15,
  /** High eye open probability threshold */
  HIGH_EYE_OPEN: 0.8,
  /** Very high eye open probability threshold */
  VERY_HIGH_EYE_OPEN: 0.85,
  /** Low eye open probability threshold */
  LOW_EYE_OPEN: 0.4,
  /** Mouth aspect ratio threshold for tight mouth */
  TIGHT_MOUTH_RATIO: 2.5,
  /** Mouth aspect ratio threshold for open mouth */
  OPEN_MOUTH_RATIO: 2.0,
  /** Narrow mouth aspect ratio threshold */
  NARROW_MOUTH_RATIO: 1.5,
  /** Head yaw angle threshold for direct gaze (degrees) */
  DIRECT_GAZE_ANGLE: 15,
} as const;

/**
 * Type definitions for constants
 */
export type CameraConstants = typeof CAMERA_CONSTANTS;
export type AnimationConstants = typeof ANIMATION_CONSTANTS;
export type TimeoutConstants = typeof TIMEOUT_CONSTANTS;
export type EmotionThresholds = typeof EMOTION_THRESHOLDS;
