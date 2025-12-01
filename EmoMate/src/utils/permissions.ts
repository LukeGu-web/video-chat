import { Camera } from 'react-native-vision-camera';
import { AudioModule } from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  speechRecognition: boolean;
  allGranted: boolean;
}

/**
 * Request camera, microphone, and speech recognition permissions
 * Uses react-native-vision-camera for camera permissions
 * Uses expo-audio for microphone permissions
 * Uses expo-speech-recognition for speech recognition permissions
 */
export const requestCameraAndMicrophonePermissions = async (): Promise<PermissionStatus> => {
  try {
    // Request camera permission using react-native-vision-camera
    const cameraResult = await Camera.requestCameraPermission();

    // Request microphone permission
    const microphonePermission = await AudioModule.requestRecordingPermissionsAsync();

    // Request speech recognition permission
    const speechRecognitionPermission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

    const cameraGranted = cameraResult === 'granted';
    const microphoneGranted = microphonePermission.granted;
    const speechRecognitionGranted = speechRecognitionPermission.granted;

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      speechRecognition: speechRecognitionGranted,
      allGranted: cameraGranted && microphoneGranted && speechRecognitionGranted,
    };
  } catch (error) {
    console.error('[Permissions] Error requesting permissions:', error);
    return {
      camera: false,
      microphone: false,
      speechRecognition: false,
      allGranted: false,
    };
  }
};

/**
 * Check current camera, microphone, and speech recognition permissions status
 * Uses react-native-vision-camera for camera permissions
 * Uses expo-audio for microphone permissions
 * Uses expo-speech-recognition for speech recognition permissions
 */
export const checkCameraAndMicrophonePermissions = async (): Promise<PermissionStatus> => {
  try {
    // Check camera permission using react-native-vision-camera
    const cameraStatus = Camera.getCameraPermissionStatus();

    // Check microphone permission
    const microphonePermission = await AudioModule.getRecordingPermissionsAsync();

    // Check speech recognition permission
    const speechRecognitionPermission = await ExpoSpeechRecognitionModule.getPermissionsAsync();

    const cameraGranted = cameraStatus === 'granted';
    const microphoneGranted = microphonePermission.granted;
    const speechRecognitionGranted = speechRecognitionPermission.granted;

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      speechRecognition: speechRecognitionGranted,
      allGranted: cameraGranted && microphoneGranted && speechRecognitionGranted,
    };
  } catch (error) {
    console.error('[Permissions] Error checking permissions:', error);
    return {
      camera: false,
      microphone: false,
      speechRecognition: false,
      allGranted: false,
    };
  }
};