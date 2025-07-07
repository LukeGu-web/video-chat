import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

export interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  allGranted: boolean;
}

export const requestCameraAndMicrophonePermissions = async (): Promise<PermissionStatus> => {
  try {
    const cameraPermission = await Camera.requestCameraPermissionsAsync();
    const microphonePermission = await Audio.requestPermissionsAsync();

    const cameraGranted = cameraPermission.status === 'granted';
    const microphoneGranted = microphonePermission.status === 'granted';

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      allGranted: cameraGranted && microphoneGranted,
    };
  } catch (error) {
    console.error('Error requesting permissions:', error);
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
    const microphonePermission = await Audio.getPermissionsAsync();

    const cameraGranted = cameraPermission.status === 'granted';
    const microphoneGranted = microphonePermission.status === 'granted';

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      allGranted: cameraGranted && microphoneGranted,
    };
  } catch (error) {
    console.error('Error checking permissions:', error);
    return {
      camera: false,
      microphone: false,
      allGranted: false,
    };
  }
};