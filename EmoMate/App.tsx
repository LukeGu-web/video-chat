import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WelcomeScreen, HomeScreen, ChatHistoryScreen, HiyoriScreen, EmotionTestScreen } from './src/screens';
import { isDebugMode } from './src/utils/debug';
import { transitionAudio } from './src/utils/transitionAudio'; // Phase 1: 过渡语音预加载
import './global.css';

export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
  Hiyori: undefined;
  EmotionTest: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  // Phase 1: 应用启动时预加载过渡语音
  useEffect(() => {
    transitionAudio.preloadAll().catch(error => {
      console.error('[App] 预加载过渡音频失败:', error);
    });
  }, []);

  return (
    <GestureHandlerRootView className="flex-1">
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Welcome"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="ChatHistory" component={ChatHistoryScreen} />
          <Stack.Screen name="Hiyori" component={HiyoriScreen} />
          {isDebugMode() && (
            <Stack.Screen name="EmotionTest" component={EmotionTestScreen} />
          )}
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
