/**
 * Face feature calculation utilities
 * Extract facial features for emotion detection
 */

import { calculateDistance, calculateMidpoint, Point } from './worklets';

/**
 * MLKit landmarks interface
 * Based on react-native-vision-camera-face-detector types
 */
export interface MLKitLandmarks {
  MOUTH_LEFT?: Point;
  MOUTH_RIGHT?: Point;
  MOUTH_BOTTOM?: Point;
  leftMouth?: Point;
  rightMouth?: Point;
  bottomMouth?: Point;
  // Add other landmarks as needed
  [key: string]: Point | undefined;
}

/**
 * Calculate mouth aspect ratio from facial landmarks
 * Higher ratio = wider mouth (smiling), Lower ratio = open mouth
 * Worklet function - can be called in frame processor
 *
 * @param landmarks - MLKit facial landmarks
 * @returns Mouth aspect ratio (width / height)
 */
export const calculateMouthAspectRatio = (landmarks: MLKitLandmarks | null | undefined): number => {
  'worklet';

  if (!landmarks) return 1.0;

  // Try to access mouth landmarks (property names may vary by MLKit version)
  const leftMouth = landmarks.MOUTH_LEFT || landmarks.leftMouth;
  const rightMouth = landmarks.MOUTH_RIGHT || landmarks.rightMouth;
  const bottomMouth = landmarks.MOUTH_BOTTOM || landmarks.bottomMouth;

  if (!leftMouth || !rightMouth || !bottomMouth) {
    return 1.0; // Default ratio if landmarks not available
  }

  // Calculate mouth width (horizontal distance)
  const mouthWidth = calculateDistance(leftMouth, rightMouth);

  // Calculate mouth height (vertical distance from center to bottom)
  const mouthCenter = calculateMidpoint(leftMouth, rightMouth);
  const mouthHeight = calculateDistance(mouthCenter, bottomMouth);

  // Return aspect ratio (avoid division by zero)
  return mouthHeight > 0 ? mouthWidth / mouthHeight : 1.0;
};

/**
 * Calculate average eye open probability
 * Worklet function - can be called in frame processor
 *
 * @param leftEyeProb - Left eye open probability (0-1)
 * @param rightEyeProb - Right eye open probability (0-1)
 * @returns Average eye open probability (0-1)
 */
export const calculateAvgEyeOpen = (
  leftEyeProb: number | null | undefined,
  rightEyeProb: number | null | undefined
): number => {
  'worklet';

  const left = leftEyeProb ?? 0.5; // Default to half-open if not available
  const right = rightEyeProb ?? 0.5;

  return (left + right) / 2;
};
