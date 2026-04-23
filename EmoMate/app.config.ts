import { ExpoConfig, ConfigContext } from 'expo/config';
import * as dotenv from 'dotenv';
dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default ({ config }: ConfigContext): any => ({
  ...config,
  name: 'Yume',
  slug: 'EmoMate',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.lukeguexpo.emomate',
    infoPlist: {
      CFBundleDisplayName: 'Yume',
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        'Yume needs access to your camera to enable video conversations with your AI companion and analyze your emotional expressions for a personalized experience.',
      NSMicrophoneUsageDescription:
        'Yume needs access to your microphone to record your voice for speech recognition and enable audio conversations with your AI companion.',
      NSSpeechRecognitionUsageDescription:
        'Yume uses speech recognition to convert your spoken words into text for better communication with your AI companion.',
      NSPhotoLibraryUsageDescription:
        'Yume may need access to your photo library to save or share conversation memories with your AI companion.',
      NSLocationWhenInUseUsageDescription:
        'Yume may use your location to provide contextual and personalized experiences with your AI companion.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-audio',
    [
      'react-native-vision-camera',
      {
        cameraPermissionText: '$(PRODUCT_NAME) needs access to your Camera.',

        // optionally, if you want to record audio:
        enableMicrophonePermission: true,
        microphonePermissionText:
          '$(PRODUCT_NAME) needs access to your Microphone.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.5',
        },
      },
    ],
    'expo-asset',
    'expo-sqlite',
  ],
  extra: {
    eas: {
      projectId: 'd96cc4b9-d302-44a3-83f0-362985174c0e',
    },
    claudeApiKey: process.env.CLAUDE_API_KEY,
    fishAudioApiKey: process.env.FISH_AUDIO_API_KEY,
    characterViewUrl: process.env.HIYORI_VIEW_URL,
    showTestComponents: process.env.SHOW_TEST_COMPONENTS === 'true',
  },
});
