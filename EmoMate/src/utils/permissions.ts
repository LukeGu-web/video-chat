import { Camera } from 'react-native-vision-camera';
import { AudioModule } from 'expo-audio';

export interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  allGranted: boolean;
}

/**
 * Request camera and microphone permissions
 * Uses react-native-vision-camera for camera permissions
 */
export const requestCameraAndMicrophonePermissions = async (): Promise<PermissionStatus> => {
  try {
    // Request camera permission using react-native-vision-camera
    const cameraResult = await Camera.requestCameraPermission();

    // Request microphone permission
    const microphonePermission = await AudioModule.requestRecordingPermissionsAsync();

    const cameraGranted = cameraResult === 'granted';
    const microphoneGranted = microphonePermission.granted;

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      allGranted: cameraGranted && microphoneGranted,
    };
  } catch (error) {
    console.error('[Permissions] Error requesting permissions:', error);
    return {
      camera: false,
      microphone: false,
      allGranted: false,
    };
  }
};

/**
 * Check current camera and microphone permissions status
 * Uses react-native-vision-camera for camera permissions
 */
export const checkCameraAndMicrophonePermissions = async (): Promise<PermissionStatus> => {
  try {
    // Check camera permission using react-native-vision-camera
    const cameraStatus = Camera.getCameraPermissionStatus();

    // Check microphone permission
    const microphonePermission = await AudioModule.getRecordingPermissionsAsync();

    const cameraGranted = cameraStatus === 'granted';
    const microphoneGranted = microphonePermission.granted;

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      allGranted: cameraGranted && microphoneGranted,
    };
  } catch (error) {
    console.error('[Permissions] Error checking permissions:', error);
    return {
      camera: false,
      microphone: false,
      allGranted: false,
    };
  }
};