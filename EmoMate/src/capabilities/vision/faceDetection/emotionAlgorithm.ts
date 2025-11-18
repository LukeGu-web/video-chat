/**
 * Emotion detection algorithm based on Plutchik's 8 basic emotions
 * Analyzes facial features to determine emotional state
 */

import { EmotionType } from '../../../types/emotion';
import { EMOTION_THRESHOLDS } from '../../../utils/vision/constants';

/**
 * Emotion detection result
 */
export interface EmotionDetectionResult {
  /** Detected emotion type */
  emotion: EmotionType;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Facial features for emotion detection
 */
export interface FacialFeatures {
  /** Smiling probability (0-1) */
  smilingProbability: number;
  /** Average eye open probability (0-1) */
  avgEyeOpen: number;
  /** Mouth aspect ratio (width/height) */
  mouthAspectRatio: number;
  /** Head pitch angle (degrees) */
  pitchAngle: number;
  /** Head yaw angle (degrees) */
  yawAngle: number;
}

/**
 * Detect emotion from facial features using Plutchik's 8 basic emotions
 * Worklet function - can be called in frame processor
 *
 * Algorithm based on:
 * - Smiling probability
 * - Eye open probability
 * - Mouth aspect ratio (wide = smiling, narrow = open)
 * - Head pose (pitch and yaw angles)
 *
 * @param features - Facial features extracted from MLKit
 * @returns Emotion detection result with confidence
 */
export const detectEmotionFromFace = (features: FacialFeatures): EmotionDetectionResult => {
  'worklet';

  const { smilingProbability, avgEyeOpen, mouthAspectRatio, pitchAngle, yawAngle } = features;

  // Use threshold constants
  const {
    HIGH_SMILE,
    LOW_SMILE,
    VERY_LOW_SMILE,
    HIGH_EYE_OPEN,
    VERY_HIGH_EYE_OPEN,
    LOW_EYE_OPEN,
    TIGHT_MOUTH_RATIO,
    OPEN_MOUTH_RATIO,
    NARROW_MOUTH_RATIO,
    DIRECT_GAZE_ANGLE,
  } = EMOTION_THRESHOLDS;

  // Plutchik's 8 basic emotions detection

  // 1. Joy (喜悦) - High smile + moderate eye open + wide mouth
  if (smilingProbability > HIGH_SMILE && avgEyeOpen > 0.5) {
    return {
      emotion: 'joy',
      confidence: Math.min((smilingProbability + avgEyeOpen) / 2, 0.95),
    };
  }

  // 2. Sadness (悲伤) - Low smile + eyes partially closed + head down
  if (avgEyeOpen < LOW_EYE_OPEN && smilingProbability < LOW_SMILE) {
    return {
      emotion: 'sadness',
      confidence: Math.min(1.0 - avgEyeOpen, 0.85),
    };
  }

  // 3. Anger (愤怒) - No smile + eyes wide + tight mouth
  if (smilingProbability < VERY_LOW_SMILE && avgEyeOpen > 0.6 && mouthAspectRatio > TIGHT_MOUTH_RATIO) {
    return {
      emotion: 'anger',
      confidence: Math.min((1.0 - smilingProbability + avgEyeOpen) / 2, 0.8),
    };
  }

  // 4. Fear (恐惧) - Eyes very wide + mouth open + no smile
  if (avgEyeOpen > VERY_HIGH_EYE_OPEN && smilingProbability < 0.3 && mouthAspectRatio < OPEN_MOUTH_RATIO) {
    return {
      emotion: 'fear',
      confidence: Math.min(avgEyeOpen, 0.8),
    };
  }

  // 5. Surprise (惊讶) - Eyes very wide + mouth very open
  if (avgEyeOpen > HIGH_EYE_OPEN && mouthAspectRatio < NARROW_MOUTH_RATIO) {
    return {
      emotion: 'surprise',
      confidence: Math.min(avgEyeOpen, 0.85),
    };
  }

  // 6. Disgust (厌恶) - Eyes partially closed + nose wrinkle + slight frown
  if (avgEyeOpen < 0.5 && smilingProbability < LOW_SMILE) {
    return {
      emotion: 'disgust',
      confidence: 0.7,
    };
  }

  // 7. Trust (信任) - Moderate smile + relaxed eyes + direct gaze
  if (
    smilingProbability > 0.4 &&
    smilingProbability < HIGH_SMILE &&
    avgEyeOpen > 0.5 &&
    Math.abs(yawAngle) < DIRECT_GAZE_ANGLE
  ) {
    return {
      emotion: 'trust',
      confidence: 0.75,
    };
  }

  // 8. Anticipation (期待) - Eyes wide + slight smile + head slightly forward
  if (avgEyeOpen > 0.7 && smilingProbability > 0.3 && smilingProbability < 0.6) {
    return {
      emotion: 'anticipation',
      confidence: 0.7,
    };
  }

  // Default to neutral for unclear expressions
  return {
    emotion: 'neutral',
    confidence: 0.5,
  };
};
