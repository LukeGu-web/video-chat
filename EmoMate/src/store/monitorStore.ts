/**
 * Monitor Store - Zustand
 * Manages monitoring data for debug panels
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  MonitorData,
  WebViewStatus,
  AvatarStatus,
  EmotionStatus,
  BackgroundSceneInfo,
  SceneUnderstandingStatus,
} from '../types/monitor';

// ============================================
// Store Interface
// ============================================

interface MonitorState {
  data: MonitorData;
}

interface MonitorActions {
  updateWebViewStatus: (status: Partial<WebViewStatus>) => void;
  updateAvatarStatus: (status: Partial<AvatarStatus>) => void;
  updateEmotionStatus: (status: Partial<EmotionStatus>) => void;
  updateBackgroundScene: (scene: BackgroundSceneInfo | null) => void;
  updateSceneUnderstanding: (status: Partial<SceneUnderstandingStatus>) => void;
  reset: () => void;
}

type MonitorStore = MonitorState & MonitorActions;

// ============================================
// Initial State
// ============================================

const initialState: MonitorState = {
  data: {
    webView: {
      isWebViewReady: false,
      isModelReady: false,
      isLoading: false,
      error: null,
      pendingMessagesCount: 0,
    },
    avatar: {
      currentMotion: 'Idle',
      isModelReady: false,
      isPlaying: false,
      shouldLoop: false,
    },
    emotion: {
      facialEmotion: null,
      textEmotion: null,
      combinedEmotion: 'neutral',
      aiStatus: null,
      selectedMotion: 'Idle',
      motionPriority: 0,
      motionReason: '',
      mappingEnabled: true,
    },
    backgroundScene: null,
    sceneUnderstanding: {
      isAnalyzing: false,
      totalAPICalls: 0,
      currentLocation: null,
      timerEnabled: false,
      nextCaptureInSeconds: 0,
    },
  },
};

// ============================================
// Store Definition
// ============================================

export const useMonitorStore = create<MonitorStore>()(
  immer((set) => ({
    ...initialState,

    updateWebViewStatus: (status: Partial<WebViewStatus>) => {
      set((state) => {
        Object.assign(state.data.webView, status);
      });
    },

    updateAvatarStatus: (status: Partial<AvatarStatus>) => {
      set((state) => {
        Object.assign(state.data.avatar, status);
      });
    },

    updateEmotionStatus: (status: Partial<EmotionStatus>) => {
      set((state) => {
        Object.assign(state.data.emotion, status);
      });
    },

    updateBackgroundScene: (scene: BackgroundSceneInfo | null) => {
      set((state) => {
        state.data.backgroundScene = scene;
      });
    },

    updateSceneUnderstanding: (status: Partial<SceneUnderstandingStatus>) => {
      set((state) => {
        Object.assign(state.data.sceneUnderstanding, status);
      });
    },

    reset: () => {
      set((state) => {
        state.data = initialState.data;
      });
    },
  }))
);
