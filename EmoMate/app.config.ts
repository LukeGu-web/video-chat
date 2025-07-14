import { ExpoConfig, ConfigContext } from 'expo/config';
import * as dotenv from 'dotenv';
dotenv.config();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "EmoMate",
  slug: "EmoMate",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.lukeguexpo.emomate",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "EmoMate needs access to your camera to enable video conversations with your AI companion and analyze your emotional expressions for a personalized experience.",
      NSMicrophoneUsageDescription: "EmoMate needs access to your microphone to record your voice for speech recognition and enable audio conversations with your AI companion.",
      NSSpeechRecognitionUsageDescription: "EmoMate uses speech recognition to convert your spoken words into text for better communication with your AI companion."
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    edgeToEdgeEnabled: true,
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS"
    ]
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  plugins: ["expo-audio"],
  extra: {
    eas: {
      projectId: "d96cc4b9-d302-44a3-83f0-362985174c0e"
    },
    claudeApiKey: process.env.CLAUDE_API_KEY,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    showTestComponents: process.env.SHOW_TEST_COMPONENTS === 'true'
  }
});