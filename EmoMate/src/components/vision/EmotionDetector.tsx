/**
 * Emotion Detector Component
 * Refactored component that integrates all emotion detection capabilities
 *
 * Replaces: BasicEmotionDetector.tsx (688 lines → ~150 lines)
 *
 * Architecture:
 * - Uses capability hooks for business logic
 * - Uses UI hooks for interaction
 * - Pure component composition
 * - No redundant code
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { EmotionDetectorProps } from '../../types/emotion';
import { useFaceDetection } from '../../capabilities/vision/faceDetection';
import {
  useCamera,
  useCameraPermissions,
} from '../../capabilities/vision/camera';
import { CAMERA_CONSTANTS } from '../../constants/vision';
import { VisionCamera } from './VisionCamera';
import { DraggableCameraView } from './DraggableCameraView';

/**
 * Emotion Detector Component
 *
 * Features:
 * - MLKit face detection with Plutchik's 8 emotions
 * - Draggable floating camera view
 * - Camera permission management
 * - Front/back camera switching
 * - Integration with useSceneUnderstanding for scene capture
 *
 * @param props - Component props
 */
export const EmotionDetector: React.FC<EmotionDetectorProps> = (props) => {
  const {
    onEmotionDetected,
    isActive = true,
    detectionInterval = 1000,
    onFrameCaptured, // For scene understanding integration
    frameCaptureInterval = 30000,
  } = props;

  // Camera ref for scene capture integration
  const cameraRef = useRef<Camera | null>(null);

  // Use capability hooks
  const { hasPermission, requestPermission } = useCameraPermissions();
  const { device, switchCamera } = useCamera('front');
  const { frameProcessor, faceDetected } = useFaceDetection({
    isActive: isActive && hasPermission,
    detectionInterval,
    onEmotionDetected,
  });

  // Scene understanding integration - Photo capture timer
  useEffect(() => {
    if (!onFrameCaptured || !isActive || !hasPermission) {
      return;
    }

    console.log(
      '[EmotionDetector] Starting photo capture timer with interval:',
      frameCaptureInterval
    );

    // Periodic photo capture for scene understanding
    const capturePhoto = async () => {
      if (!cameraRef.current || !isActive) {
        console.log(
          '[EmotionDetector] Camera not ready or inactive, skipping capture'
        );
        return;
      }

      try {
        console.log('[EmotionDetector] Attempting to capture photo...');
        const photo = await cameraRef.current.takePhoto({
          flash: 'off',
        });

        console.log(
          '[EmotionDetector] Photo captured successfully:',
          photo.path
        );

        // Convert photo to base64
        const base64 = await fetch(`file://${photo.path}`)
          .then((res) => res.blob())
          .then(
            (blob) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64String = reader.result as string;
                  // Remove the data:image/jpeg;base64, prefix
                  const base64Data = base64String.split(',')[1];
                  resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              })
          );

        console.log(
          '[EmotionDetector] Photo converted to base64, size:',
          Math.round((base64.length * 0.75) / 1024),
          'KB'
        );

        // Call the callback with base64 and timestamp
        onFrameCaptured(base64, Date.now());
      } catch (error) {
        console.error('[EmotionDetector] Failed to capture photo:', error);
      }
    };

    // Initial capture after a short delay
    const initialTimeout = setTimeout(() => {
      capturePhoto();
    }, 2000); // 2 seconds delay to ensure camera is fully ready

    // Set up interval for periodic captures
    const interval = setInterval(() => {
      capturePhoto();
    }, frameCaptureInterval);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [onFrameCaptured, isActive, hasPermission, frameCaptureInterval]);

  // Render permission request UI
  if (!hasPermission) {
    return (
      <DraggableCameraView
        containerWidth={CAMERA_CONSTANTS.CONTAINER_WIDTH}
        containerHeight={CAMERA_CONSTANTS.CONTAINER_HEIGHT}
      >
        <View className='justify-center items-center w-full h-full bg-[#f8f9fa]'>
          <Text className='text-[9px] text-[#e74c3c] text-center px-1.5 pt-3.5'>
            Camera permission required
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className='bg-[#3498db] px-2 py-1 rounded mx-auto mt-2'
          >
            <Text className='text-white text-[9px] font-bold'>
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      </DraggableCameraView>
    );
  }

  // Render inactive state
  if (!isActive) {
    return (
      <DraggableCameraView
        containerWidth={CAMERA_CONSTANTS.CONTAINER_WIDTH}
        containerHeight={CAMERA_CONSTANTS.CONTAINER_HEIGHT}
      >
        <View className='justify-center items-center w-full h-full bg-[#f5f5f5]'>
          <Text className='text-[10px] text-[#666] text-center'>
            Camera Inactive
          </Text>
        </View>
      </DraggableCameraView>
    );
  }

  // Render main camera view
  return (
    <DraggableCameraView
      containerWidth={CAMERA_CONSTANTS.CONTAINER_WIDTH}
      containerHeight={CAMERA_CONSTANTS.CONTAINER_HEIGHT}
    >
      <VisionCamera
        device={device}
        isActive={isActive && hasPermission}
        frameProcessor={frameProcessor}
        showFaceIndicator={true}
        faceDetected={faceDetected}
        onSwitchCamera={switchCamera}
        cameraRef={cameraRef}
        enablePhoto={!!onFrameCaptured} // Enable photo mode if scene capture is needed
      />
    </DraggableCameraView>
  );
};

// Export camera ref type for parent components that need scene capture
export type EmotionDetectorRef = React.RefObject<Camera>;
