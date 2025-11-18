/**
 * Vision Camera Component
 * Pure UI component for displaying camera feed
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Camera, type CameraDevice } from 'react-native-vision-camera';

/**
 * Vision camera props
 */
export interface VisionCameraProps {
  /** Camera device to use */
  device: CameraDevice | undefined;
  /** Whether camera is active */
  isActive: boolean;
  /** Optional frame processor for face detection */
  frameProcessor?: any;
  /** Whether to show face detection indicator */
  showFaceIndicator?: boolean;
  /** Whether a face is currently detected */
  faceDetected?: boolean;
  /** Callback when camera is ready */
  onCameraReady?: () => void;
  /** Callback when camera switch is pressed */
  onSwitchCamera?: () => void;
  /** Optional camera ref for taking snapshots */
  cameraRef?: React.RefObject<Camera | null>;
  /** Enable photo mode for snapshots */
  enablePhoto?: boolean;
}

/**
 * Vision Camera Component
 * Displays camera feed with optional face detection and controls
 *
 * Features:
 * - Camera feed display
 * - Face detection indicator
 * - Camera switch button
 * - Drag indicator
 *
 * @param props - Component props
 */
export const VisionCamera: React.FC<VisionCameraProps> = ({
  device,
  isActive,
  frameProcessor,
  showFaceIndicator = false,
  faceDetected = false,
  onSwitchCamera,
  cameraRef,
  enablePhoto = true,
}) => {
  if (!device) {
    return (
      <View className="justify-center items-center w-full h-full bg-[#f5f5f5]">
        <Text className="text-[10px] text-[#666] text-center">No Camera Device</Text>
      </View>
    );
  }

  return (
    <>
      {/* Camera Feed */}
      <Camera
        ref={cameraRef}
        style={{ width: '100%', height: '100%' }}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
        photo={enablePhoto}
      />

      {/* Drag Indicator */}
      <View className="absolute top-1 left-0 right-0 items-center">
        <View className="w-[30px] h-[3px] bg-white/70 rounded-full" />
      </View>

      {/* Face Detection Indicator */}
      {showFaceIndicator && faceDetected && (
        <View className="absolute bottom-2 left-3">
          <Text className="text-[#22c55e] text-xs font-bold">●</Text>
        </View>
      )}

      {/* Camera Switch Button */}
      {onSwitchCamera && (
        <Pressable className="absolute bottom-0 right-2" onPress={onSwitchCamera}>
          <Text className="text-2xl font-extrabold text-white">↺</Text>
        </Pressable>
      )}
    </>
  );
};
