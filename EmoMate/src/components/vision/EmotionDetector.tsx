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
import { useCamera, useCameraPermissions } from '../../capabilities/vision/camera';
import { CAMERA_CONSTANTS } from '../../utils/vision/constants';
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
  const cameraRef = useRef<Camera>(null);

  // Use capability hooks
  const { hasPermission, requestPermission } = useCameraPermissions();
  const { device, switchCamera } = useCamera('front');
  const { frameProcessor, faceDetected } = useFaceDetection({
    isActive: isActive && hasPermission,
    detectionInterval,
    onEmotionDetected,
  });

  // Scene understanding integration
  // Note: Scene capture is handled by useSceneUnderstanding hook in parent component
  // This component only provides the camera ref for photo capture
  useEffect(() => {
    // If onFrameCaptured is provided, the parent component should use
    // useSceneUnderstanding hook and register the photo capture callback
    if (onFrameCaptured) {
      // Log that scene capture should be handled by parent
      console.log('[EmotionDetector] Scene capture callback provided. Parent should use useSceneUnderstanding hook.');
    }
  }, [onFrameCaptured]);

  // Render permission request UI
  if (!hasPermission) {
    return (
      <DraggableCameraView
        containerWidth={CAMERA_CONSTANTS.CONTAINER_WIDTH}
        containerHeight={CAMERA_CONSTANTS.CONTAINER_HEIGHT}
      >
        <View className="justify-center items-center w-full h-full bg-[#f8f9fa]">
          <Text className="text-[9px] text-[#e74c3c] text-center px-1.5 pt-3.5">
            Camera permission required
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-[#3498db] px-2 py-1 rounded mx-auto mt-2"
          >
            <Text className="text-white text-[9px] font-bold">Grant Permission</Text>
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
        <View className="justify-center items-center w-full h-full bg-[#f5f5f5]">
          <Text className="text-[10px] text-[#666] text-center">Camera Inactive</Text>
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
