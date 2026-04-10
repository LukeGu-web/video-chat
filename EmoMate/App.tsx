import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setAudioModeAsync } from 'expo-audio'; // Import setAudioModeAsync for audio session configuration
import {
  WelcomeScreen,
  HomeScreen,
  ChatHistoryScreen,
  SceneHistoryScreen,
} from './src/screens';
import { AmplifiedAudioPlayer } from './src/components/AmplifiedAudioPlayer';
import { initializeTTSCache, TTSQueue } from './src/capabilities/speak'; // Phase 3: TTS 预热 + 缓存 - NEW ARCHITECTURE
import { RootStackParamList } from './src/types/navigation';
import { useMemoryStore } from './src/store';
import './global.css';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Configure audio session for optimal voice playback
 * Fixes: Low volume issue on iPhone by setting proper audio category and mode
 *
 * Critical: Start with allowsRecording: false to ensure speaker output
 * Reference: https://snack.expo.dev/@keith-kurak/ios---recording-sound-forces-future-playback-to-earpiece
 */
async function configureAudioSession(): Promise<void> {
  try {
    // Configure audio mode for voice-optimized playback
    // Start with allowsRecording: false to route audio through speaker by default
    await setAudioModeAsync({
      // iOS: Allow audio playback even when device is in silent mode
      playsInSilentMode: true,

      // iOS: Start with recording disabled for louder speaker output
      // Will be enabled when user starts speaking
      allowsRecording: false,

      // iOS/Android: Keep audio session active in background
      shouldPlayInBackground: true,

      // iOS: Duck other audio when playing (reduce others' volume)
      interruptionMode: 'duckOthers',

      // Android: Duck other audio when playing
      interruptionModeAndroid: 'duckOthers',

      // Android: Use speaker output by default (not earpiece)
      // This ensures louder volume for TTS playback
      shouldRouteThroughEarpiece: false,
    });

    console.log(
      '[App] ✅ Audio session configured for optimal voice playback (allowsRecording: false)'
    );
  } catch (error) {
    console.error('[App] ❌ Failed to configure audio session:', error);
    throw error;
  }
}

/**
 * Warmup TTS service with a test synthesis
 * Phase 3 Optimization: Pre-establish connection to ElevenLabs
 */
async function warmupTTS(): Promise<void> {
  try {
    const testQueue = new TTSQueue();

    // Send a very short test phrase to warm up the connection
    // This pre-establishes the HTTPS connection and validates API key
    await testQueue.enqueue('嗯');

    // Wait briefly for synthesis to start (don't wait for completion)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Cancel to avoid playing the test audio
    await testQueue.cancel();

    console.log('[App] ✅ TTS service warmed up');
  } catch (error) {
    // Warmup failure is not critical, just log it
    console.warn('[App] ⚠️ TTS warmup failed (non-critical):', error);
  }
}

export default function App() {
  // Memory system: hydrate user profile + preferences from MMKV on app launch
  const loadFromStorage = useMemoryStore((s) => s.loadFromStorage);
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Phase 1: 应用启动时预加载过渡语音
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] 开始初始化应用...');

        // 0. 配置音频会话 (Fix: iPhone音量过小问题)
        console.log('[App] 配置音频会话...');
        await configureAudioSession();

        // 2. 初始化 TTS 缓存目录 (Phase 3: 缓存系统)
        console.log('[App] 初始化 TTS 缓存系统...');
        await initializeTTSCache();

        // 3. 预热 TTS 服务 (Phase 3: 优化)
        console.log('[App] 预热 TTS 服务...');
        await warmupTTS();

        console.log('[App] ✅ 应用初始化完成');
      } catch (error) {
        console.error('[App] 初始化失败:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <GestureHandlerRootView className='flex-1'>
      <AmplifiedAudioPlayer />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName='Welcome'
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name='Welcome' component={WelcomeScreen} />
          <Stack.Screen name='Home' component={HomeScreen} />
          <Stack.Screen name='ChatHistory' component={ChatHistoryScreen} />
          <Stack.Screen name='SceneHistory' component={SceneHistoryScreen} />
        </Stack.Navigator>
        <StatusBar style='auto' />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
