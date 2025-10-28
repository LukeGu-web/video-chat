// Plutchik's 8 basic emotions
export type EmotionType =
  | 'joy'          // 喜悦（快乐）
  | 'sadness'      // 悲伤
  | 'anger'        // 愤怒
  | 'fear'         // 恐惧
  | 'surprise'     // 惊讶
  | 'disgust'      // 厌恶
  | 'trust'        // 信任
  | 'anticipation' // 期待
  | 'neutral';     // 中性（默认状态）

export interface EmotionDetectionResult {
  emotion: EmotionType;
  confidence: number;
  timestamp: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface FaceLandmarks {
  leftEye?: Point;
  rightEye?: Point;
  noseBase?: Point;
  leftEar?: Point;
  rightEar?: Point;
  leftMouth?: Point;
  rightMouth?: Point;
  leftCheek?: Point;
  rightCheek?: Point;
  bottomMouth?: Point;
}

export interface FaceContours {
  face?: Point[];
  leftEyebrow?: Point[];
  rightEyebrow?: Point[];
  leftEye?: Point[];
  rightEye?: Point[];
  upperLipTop?: Point[];
  upperLipBottom?: Point[];
  lowerLipTop?: Point[];
  lowerLipBottom?: Point[];
  noseBridge?: Point[];
  noseBottom?: Point[];
  leftCheek?: Point[];
  rightCheek?: Point[];
}

export interface FaceData {
  // Classification probabilities
  smilingProbability?: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;

  // Head pose
  rollAngle?: number;
  pitchAngle?: number;
  yawAngle?: number;

  // Tracking
  faceID?: string;
  trackingId?: number;

  // Bounds
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Landmarks and contours
  landmarks?: FaceLandmarks;
  contours?: FaceContours;
}

export interface EmotionDetectorProps {
  onEmotionDetected: (emotion: EmotionType) => void;
  isActive?: boolean;
  detectionInterval?: number; // milliseconds, default 1000
}

export interface EmotionState {
  facialEmotion: EmotionType | null;
  textEmotion: EmotionType | null;
  combinedEmotion: EmotionType;
  lastUpdated: number;
}