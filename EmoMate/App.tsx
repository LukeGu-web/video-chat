import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  WelcomeScreen,
  HomeScreen,
  ChatHistoryScreen,
  HiyoriScreen,
  EmotionTestScreen,
} from './src/screens';
import { isDebugMode } from './src/utils/debug';
import { transitionAudio } from './src/utils/transitionAudio'; // Phase 1: 过渡语音预加载
import { TTSQueue, initializeTTSCache } from './src/utils/ttsQueue'; // Phase 3: TTS 预热 + 缓存
import './global.css';

export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
  Hiyori: undefined;
  EmotionTest: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
  // Phase 1: 应用启动时预加载过渡语音
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] 开始初始化应用...');

        // 1. 预加载过渡语音
        console.log('[App] 预加载过渡语音...');
        await transitionAudio.preloadAll();

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
          <Stack.Screen name='Hiyori' component={HiyoriScreen} />
          {isDebugMode() && (
            <Stack.Screen name='EmotionTest' component={EmotionTestScreen} />
          )}
        </Stack.Navigator>
        <StatusBar style='auto' />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
