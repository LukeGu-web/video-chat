/**
 * Navigation Type Definitions
 *
 * Centralized navigation types for the EmoMate application.
 * This file defines all navigation route parameters for type-safe navigation.
 */

import { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Root Stack Navigator Parameter List
 *
 * Defines all routes and their parameters in the app's navigation stack.
 */
export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
  SceneHistory: undefined;
};

/**
 * Navigation prop types for each screen
 */
export type WelcomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Welcome'
>;

export type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

export type ChatHistoryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ChatHistory'
>;

export type SceneHistoryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SceneHistory'
>;
