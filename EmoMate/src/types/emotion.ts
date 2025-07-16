export type EmotionType = 'happy' | 'sad' | 'neutral' | 'angry' | 'surprised';

export interface EmotionDetectionResult {
  emotion: EmotionType;
  confidence: number;
  timestamp: number;
}

export interface FaceData {
  smilingProbability?: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  faceID?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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