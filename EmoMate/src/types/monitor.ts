/**
 * Function Monitor Types
 * Defines all monitoring data structures for the FunctionMonitor component
 */

import { EmotionType } from './emotion';
import { AvatarMotion } from '../store';

// ============================================
// Avatar System Monitoring
// ============================================

/**
 * WebView connection and communication status
 */
export interface WebViewStatus {
  isWebViewReady: boolean;
  isModelReady: boolean;
  isLoading: boolean;
  error: string | null;
  pendingMessagesCount: number;
}

/**
 * Avatar model playback status
 */
export interface AvatarStatus {
  currentMotion: AvatarMotion;
  isModelReady: boolean;
  isPlaying: boolean;
  shouldLoop: boolean;
}

// ============================================
// Emotion System Monitoring
// ============================================

/**
 * Emotion detection and mapping status
 */
export interface EmotionStatus {
  facialEmotion: EmotionType | null;
  textEmotion: EmotionType | null;
  combinedEmotion: EmotionType;
  aiStatus: AvatarMotion | null;
  selectedMotion: AvatarMotion;
  motionPriority: number;
  motionReason: string;
  mappingEnabled: boolean;
}

// ============================================
// Scene Understanding Monitoring
// ============================================

/**
 * Background scene context information
 */
export interface BackgroundSceneInfo {
  sceneId: string;
  dayType: string;
  timePeriod: string;
  location: string;
  weather: string;
  storyPreview: string; // First 60 characters
}

/**
 * Scene understanding system status
 */
export interface SceneUnderstandingStatus {
  isAnalyzing: boolean;
  totalAPICalls: number;
  currentLocation: string | null;
  timerEnabled: boolean;
  nextCaptureInSeconds: number;
}

// ============================================
// Combined Monitor Data
// ============================================

/**
 * Complete monitoring data for FunctionMonitor
 */
export interface MonitorData {
  // Avatar System
  webView: WebViewStatus;
  avatar: AvatarStatus;

  // Emotion System
  emotion: EmotionStatus;

  // Scene Understanding
  backgroundScene: BackgroundSceneInfo | null;
  sceneUnderstanding: SceneUnderstandingStatus;
}

/**
 * Section visibility state for collapsible panels
 */
export interface SectionState {
  avatarSystem: boolean;
  emotionSystem: boolean;
  sceneUnderstanding: boolean;
}
