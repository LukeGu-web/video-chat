/**
 * ObjectEnvironmentDetector Component
 *
 * Uses react-native-fast-tflite to detect objects and classify scenes
 * Works alongside BasicEmotionDetector to provide comprehensive environment awareness
 *
 * Note: This component doesn't render a camera - it overlays on existing camera view
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useEnvironmentDetection } from '../utils/useEnvironmentDetection';
import { ObjectEnvironmentDetectorProps } from '../types/environment';
import { debugLog, isDebugMode } from '../utils/debug';

export const ObjectEnvironmentDetector: React.FC<ObjectEnvironmentDetectorProps> = ({
  onEnvironmentDetected,
  onObjectsDetected,
  isActive = true,
  objectDetectionFps = 15,
  sceneClassificationInterval = 3000,
  skipFrames = 1,
}) => {
  // Use the environment detection hook
  const {
    modelStatus,
    currentScene,
    lastDetectedObjects,
  } = useEnvironmentDetection({
    isActive,
    objectDetectionFps,
    sceneClassificationInterval,
    skipFrames,
    onEnvironmentDetected,
  });

  // Log status changes
  useEffect(() => {
    debugLog('ObjectEnvironmentDetector', 'Component mounted', {
      isActive,
      objectDetectionFps,
      sceneClassificationInterval,
    });
  }, []);

  // Log model status
  useEffect(() => {
    debugLog('ObjectEnvironmentDetector', `Model status: ${modelStatus}`);
  }, [modelStatus]);

  // Log detected objects
  useEffect(() => {
    if (lastDetectedObjects.length > 0 && onObjectsDetected) {
      onObjectsDetected({
        objects: lastDetectedObjects,
        timestamp: Date.now(),
      });

      debugLog('ObjectEnvironmentDetector', `Detected ${lastDetectedObjects.length} objects`, {
        objects: lastDetectedObjects.map(o => `${o.label} (${(o.confidence * 100).toFixed(0)}%)`),
      });
    }
  }, [lastDetectedObjects, onObjectsDetected]);

  // This component doesn't render anything in production - it's a processing component
  // The camera is rendered by the parent component
  if (!isDebugMode()) {
    return null;
  }

  // Debug UI
  return (
    <View style={styles.debugContainer}>
      <View style={styles.debugPanel}>
        <Text style={styles.debugTitle}>Environment Detection</Text>
        <Text style={styles.debugText}>
          Status: {modelStatus === 'ready' ? '✅ Ready' : modelStatus === 'loading' ? '⏳ Loading' : '❌ Error'}
        </Text>
        <Text style={styles.debugText}>
          Scene: {currentScene}
        </Text>
        <Text style={styles.debugText}>
          Objects: {lastDetectedObjects.length}
        </Text>
        {lastDetectedObjects.slice(0, 3).map((obj, idx) => (
          <Text key={idx} style={styles.debugText}>
            • {obj.label} ({(obj.confidence * 100).toFixed(0)}%)
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  debugContainer: {
    position: 'absolute',
    bottom: 180,
    right: 10,
    zIndex: 1000,
  },
  debugPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 12,
    borderRadius: 8,
    minWidth: 180,
  },
  debugTitle: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 6,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginBottom: 2,
  },
});
