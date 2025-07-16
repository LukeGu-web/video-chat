import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { EmotionDetectorProps, EmotionType } from '../types/emotion';
import { isDebugMode, debugLog } from '../utils/debug';

// Simplified emotion detection without MLKit
// This version provides a basic camera interface and manual emotion input for MVP
export const SimpleFacialEmotionDetector: React.FC<EmotionDetectorProps> = ({
  onEmotionDetected,
  isActive = true,
  detectionInterval = 1000
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const lastDetectionTime = useRef(0);

  // Simulate emotion detection with user interaction
  const handleEmotionSelection = useCallback((emotion: EmotionType) => {
    const now = Date.now();
    if (now - lastDetectionTime.current < detectionInterval) return;

    lastDetectionTime.current = now;
    setCurrentEmotion(emotion);
    
    debugLog('SimpleFacialEmotionDetector', `Manual emotion selected: ${emotion}`);
    onEmotionDetected(emotion);
  }, [detectionInterval, onEmotionDetected]);

  // Auto-detect neutral state periodically
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      // In a real implementation, this would analyze camera frames
      // For MVP, we'll provide manual controls and default to neutral
      if (currentEmotion !== 'neutral') {
        setTimeout(() => {
          handleEmotionSelection('neutral');
        }, 5000); // Return to neutral after 5 seconds
      }
    }, detectionInterval);

    return () => clearInterval(interval);
  }, [isActive, detectionInterval, currentEmotion, handleEmotionSelection]);

  useEffect(() => {
    debugLog('SimpleFacialEmotionDetector', `Emotion detector ${isActive ? 'activated' : 'deactivated'}`);
  }, [isActive]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isActive) {
    return (
      <View style={styles.container}>
        <View style={styles.inactiveIndicator}>
          <Text style={styles.inactiveText}>Camera Inactive</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="front"
      />
      
      {/* Manual emotion controls for MVP demonstration */}
      <View style={styles.emotionControls}>
        <TouchableOpacity 
          style={[styles.emotionButton, currentEmotion === 'happy' && styles.activeButton]}
          onPress={() => handleEmotionSelection('happy')}
        >
          <Text style={styles.emotionText}>😊</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.emotionButton, currentEmotion === 'sad' && styles.activeButton]}
          onPress={() => handleEmotionSelection('sad')}
        >
          <Text style={styles.emotionText}>😢</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.emotionButton, currentEmotion === 'surprised' && styles.activeButton]}
          onPress={() => handleEmotionSelection('surprised')}
        >
          <Text style={styles.emotionText}>😲</Text>
        </TouchableOpacity>
      </View>

      {isDebugMode() && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>Facial Emotion: {currentEmotion}</Text>
          <Text style={styles.debugText}>Detection: Manual</Text>
          <Text style={styles.debugText}>Interval: {detectionInterval}ms</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#ddd'
  },
  camera: {
    width: '100%',
    height: '70%'
  },
  emotionControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  emotionButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  activeButton: {
    backgroundColor: 'rgba(255,255,255,0.8)'
  },
  emotionText: {
    fontSize: 16
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 8
  },
  errorText: {
    fontSize: 11,
    color: '#e74c3c',
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 8
  },
  permissionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold'
  },
  inactiveIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#ddd'
  },
  inactiveText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center'
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 2
  },
  debugText: {
    fontSize: 8,
    color: 'white',
    textAlign: 'center'
  }
});