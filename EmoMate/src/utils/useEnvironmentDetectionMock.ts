/**
 * Mock version of useEnvironmentDetection for testing
 * Use this to verify the UI and AI integration works before debugging TFLite
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DetectedObject,
  SceneType,
  EnvironmentContext,
} from '../types/environment';
import { buildEnvironmentContext } from '../utils/environmentAnalysis';
import { useUserStore } from '../store/userStore';
import { debugLog } from './debug';

export interface UseEnvironmentDetectionOptions {
  isActive?: boolean;
  objectDetectionFps?: number;
  sceneClassificationInterval?: number;
  skipFrames?: number;
  onEnvironmentDetected?: (context: EnvironmentContext) => void;
}

export function useEnvironmentDetectionMock(options: UseEnvironmentDetectionOptions = {}) {
  const {
    isActive = true,
    onEnvironmentDetected,
  } = options;

  const { setCurrentEnvironment, addEnvironmentHistory } = useUserStore();
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [lastDetectedObjects, setLastDetectedObjects] = useState<DetectedObject[]>([]);
  const [currentScene, setCurrentScene] = useState<SceneType>('unknown');

  // Simulate model loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setModelStatus('ready');
      debugLog('useEnvironmentDetectionMock', 'Mock models ready');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Simulate object detection
  useEffect(() => {
    if (!isActive || modelStatus !== 'ready') {
      return;
    }

    const interval = setInterval(() => {
      // Mock detected objects (simulating a cup, laptop, and mouse)
      const mockObjects: DetectedObject[] = [
        {
          label: 'cup',
          confidence: 0.85,
          bbox: { x: 0.3, y: 0.4, width: 0.2, height: 0.3 },
        },
        {
          label: 'laptop',
          confidence: 0.78,
          bbox: { x: 0.1, y: 0.5, width: 0.4, height: 0.4 },
        },
        {
          label: 'mouse',
          confidence: 0.72,
          bbox: { x: 0.6, y: 0.6, width: 0.1, height: 0.1 },
        },
      ];

      setLastDetectedObjects(mockObjects);

      // Mock scene classification
      const mockScene: SceneType = 'office';
      const mockConfidence = 0.82;

      setCurrentScene(mockScene);

      // Build environment context
      const environmentContext = buildEnvironmentContext(
        mockScene,
        mockObjects,
        mockConfidence
      );

      setCurrentEnvironment(environmentContext);
      addEnvironmentHistory(environmentContext);

      if (onEnvironmentDetected) {
        onEnvironmentDetected(environmentContext);
      }

      debugLog('useEnvironmentDetectionMock', 'Mock environment detected', {
        scene: mockScene,
        objectCount: mockObjects.length,
      });
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, [isActive, modelStatus, onEnvironmentDetected, setCurrentEnvironment, addEnvironmentHistory]);

  // Mock frame processors (no-op for testing)
  const processFrameForObjects = useCallback((frame: any) => {
    'worklet';
    return null; // Mock doesn't process real frames
  }, []);

  const processFrameForScene = useCallback((frame: any) => {
    'worklet';
    return null; // Mock doesn't process real frames
  }, []);

  const updateEnvironmentContext = useCallback(
    (objects: DetectedObject[], scene: SceneType, confidence: number) => {
      // This would be called in real version
      debugLog('useEnvironmentDetectionMock', 'Update environment (mock)', {
        scene,
        objectCount: objects.length,
      });
    },
    []
  );

  return {
    modelStatus,
    currentScene,
    lastDetectedObjects,
    processFrameForObjects,
    processFrameForScene,
    updateEnvironmentContext,
  };
}
