/**
 * TFLite Detection Configuration
 *
 * Performance optimization settings for object and environment detection
 */

export const TFLITE_DETECTION_CONFIG = {
  // Object detection settings
  objectDetection: {
    fps: 15, // Detect objects 15 times per second
    skipFrames: 1, // Process every other frame (1 = skip 1 frame)
    minConfidence: 0.3, // Minimum confidence threshold
    maxDetections: 10, // Maximum number of objects to detect
    modelInputSize: { width: 320, height: 320 }, // EfficientDet Lite0 input size
  },

  // Scene classification settings
  sceneClassification: {
    interval: 3000, // Classify scene every 3 seconds
    minConfidence: 0.5, // Minimum confidence threshold
    changeThreshold: 0.5, // Jaccard similarity threshold for scene change
    modelInputSize: { width: 224, height: 224 }, // MobileNetV3 input size
  },

  // Performance tuning
  performance: {
    enableGPU: true, // Enable GPU acceleration (if available)
    enableMultiThreading: true, // Enable multi-threading
    numThreads: 4, // Number of threads for CPU inference
  },

  // Debug settings
  debug: {
    logInferenceTime: true, // Log inference time for each detection
    logDetections: true, // Log detected objects
  },
};

/**
 * Adaptive FPS based on device performance
 * Can be dynamically adjusted based on frame processing time
 */
export function getAdaptiveFPS(avgInferenceTime: number): number {
  // If inference is fast, increase FPS
  if (avgInferenceTime < 30) {
    return 30;
  } else if (avgInferenceTime < 50) {
    return 20;
  } else if (avgInferenceTime < 100) {
    return 15;
  } else {
    return 10;
  }
}

/**
 * Calculate optimal skip frames based on target FPS
 */
export function calculateSkipFrames(targetFPS: number, cameraFPS: number = 60): number {
  const frameInterval = cameraFPS / targetFPS;
  return Math.max(1, Math.floor(frameInterval) - 1);
}
