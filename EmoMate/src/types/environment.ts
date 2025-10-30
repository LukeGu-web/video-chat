// Type definitions for object and environment detection

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type SceneType =
  | 'indoor'
  | 'outdoor'
  | 'office'
  | 'home'
  | 'restaurant'
  | 'transport'
  | 'nature'
  | 'unknown';

export type LightingCondition = 'bright' | 'normal' | 'dim' | 'dark';

export type ActivityType =
  | 'working'
  | 'relaxing'
  | 'eating'
  | 'exercising'
  | 'reading'
  | 'socializing'
  | 'traveling'
  | 'unknown';

export interface EnvironmentContext {
  scene: SceneType;
  objects: DetectedObject[];
  lighting: LightingCondition;
  activity: ActivityType;
  timestamp: number;
  confidence: number;
}

export interface ObjectDetectionResult {
  objects: DetectedObject[];
  timestamp: number;
  inferenceTime?: number;
}

export interface SceneClassificationResult {
  scene: SceneType;
  confidence: number;
  timestamp: number;
  inferenceTime?: number;
}

// Props for ObjectEnvironmentDetector component
export interface ObjectEnvironmentDetectorProps {
  onEnvironmentDetected?: (context: EnvironmentContext) => void;
  onObjectsDetected?: (result: ObjectDetectionResult) => void;
  isActive?: boolean;
  // Object detection frequency (fps)
  objectDetectionFps?: number;
  // Scene classification interval (milliseconds)
  sceneClassificationInterval?: number;
  // Skip frames for object detection (1 = every frame, 2 = every other frame)
  skipFrames?: number;
}

// COCO dataset labels (80 classes) for MobileNet SSD
export const COCO_LABELS = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

// Scene classification labels for ImageNet-based models
export const SCENE_LABELS: Record<number, SceneType> = {
  // Indoor scenes
  0: 'indoor',
  1: 'home',
  2: 'office',
  3: 'restaurant',
  // Outdoor scenes
  4: 'outdoor',
  5: 'nature',
  6: 'transport',
};
