import { Camera } from 'expo-camera';
import { AudioModule } from 'expo-audio';

export interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  allGranted: boolean;
}

export const requestCameraAndMicrophonePermissions = async (): Promise<PermissionStatus> => {
  try {
    const cameraPermission = await Camera.requestCameraPermissionsAsync();
    const microphonePermission = await AudioModule.requestRecordingPermissionsAsync();

    const cameraGranted = cameraPermission.status === 'granted';
    const microphoneGranted = microphonePermission.granted;

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      allGranted: cameraGranted && microphoneGranted,
    };
  } catch (error) {
    // Permission request error handled below
    return {
      camera: false,
      microphone: false,
      allGranted: false,
    };
  }
};

export const checkCameraAndMicrophonePermissions = async (): Promise<PermissionStatus> => {
  try {
    const cameraPermission = await Camera.getCameraPermissionsAsync();
    const microphonePermission = await AudioModule.getRecordingPermissionsAsync();

    const cameraGranted = cameraPermission.status === 'granted';
    const microphoneGranted = microphonePermission.granted;

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      allGranted: cameraGranted && microphoneGranted,
    };
  } catch (error) {
    // Permission check error handled below
    return {
      camera: false,
      microphone: false,
      allGranted: false,
    };
  }
};