/**
 * Emotion Store - Zustand
 * Manages emotion state with automatic combination and history tracking
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { EmotionType, EmotionState } from '../types/emotion';
import { combineEmotions } from '../capabilities/emotion/emotionAnalysis';
import { debugLog } from '../utils/debug';

// ============================================
// Store Interface
// ============================================

interface EmotionStoreState {
  facialEmotion: EmotionType | null;
  textEmotion: EmotionType | null;
  combinedEmotion: EmotionType;
  lastUpdated: number;
  emotionHistory: EmotionState[];
}

interface EmotionStoreActions {
  setFacialEmotion: (emotion: EmotionType | null) => void;
  setTextEmotion: (emotion: EmotionType | null) => void;
  clearEmotions: () => void;
  getEmotionHistory: () => EmotionState[];
  reset: () => void;
}

type EmotionStore = EmotionStoreState & EmotionStoreActions;

// ============================================
// Initial State
// ============================================

const initialState: EmotionStoreState = {
  facialEmotion: null,
  textEmotion: null,
  combinedEmotion: 'neutral',
  lastUpdated: Date.now(),
  emotionHistory: [],
};

// ============================================
// Store Definition
// ============================================

export const useEmotionStore = create<EmotionStore>()(
  immer((set, get) => ({
    ...initialState,

    setFacialEmotion: (emotion: EmotionType | null) => {
      const currentFacialEmotion = get().facialEmotion;
      if (emotion !== currentFacialEmotion) {
        debugLog(
          'EmotionStore',
          `Facial emotion changed: ${currentFacialEmotion} -> ${emotion}`
        );

        set((state) => {
          state.facialEmotion = emotion;
          state.lastUpdated = Date.now();

          // Recalculate combined emotion
          const newCombinedEmotion = combineEmotions(emotion, state.textEmotion);
          const oldCombinedEmotion = state.combinedEmotion;
          state.combinedEmotion = newCombinedEmotion;

          // Update history if combined emotion changed
          if (newCombinedEmotion !== oldCombinedEmotion) {
            debugLog(
              'EmotionStore',
              `Combined emotion changed: ${oldCombinedEmotion} -> ${newCombinedEmotion}`,
              {
                facialEmotion: emotion,
                textEmotion: state.textEmotion,
                combinedEmotion: newCombinedEmotion,
                lastUpdated: state.lastUpdated,
              }
            );

            const newHistoryEntry: EmotionState = {
              facialEmotion: emotion,
              textEmotion: state.textEmotion,
              combinedEmotion: newCombinedEmotion,
              lastUpdated: state.lastUpdated,
            };

            // Keep only last 10 states
            state.emotionHistory = [...state.emotionHistory.slice(-9), newHistoryEntry];
          }
        });
      }
    },

    setTextEmotion: (emotion: EmotionType | null) => {
      const currentTextEmotion = get().textEmotion;
      if (emotion !== currentTextEmotion) {
        debugLog(
          'EmotionStore',
          `Text emotion changed: ${currentTextEmotion} -> ${emotion}`
        );

        set((state) => {
          state.textEmotion = emotion;
          state.lastUpdated = Date.now();

          // Recalculate combined emotion
          const newCombinedEmotion = combineEmotions(state.facialEmotion, emotion);
          const oldCombinedEmotion = state.combinedEmotion;
          state.combinedEmotion = newCombinedEmotion;

          // Update history if combined emotion changed
          if (newCombinedEmotion !== oldCombinedEmotion) {
            debugLog(
              'EmotionStore',
              `Combined emotion changed: ${oldCombinedEmotion} -> ${newCombinedEmotion}`,
              {
                facialEmotion: state.facialEmotion,
                textEmotion: emotion,
                combinedEmotion: newCombinedEmotion,
                lastUpdated: state.lastUpdated,
              }
            );

            const newHistoryEntry: EmotionState = {
              facialEmotion: state.facialEmotion,
              textEmotion: emotion,
              combinedEmotion: newCombinedEmotion,
              lastUpdated: state.lastUpdated,
            };

            // Keep only last 10 states
            state.emotionHistory = [...state.emotionHistory.slice(-9), newHistoryEntry];
          }
        });
      }
    },

    clearEmotions: () => {
      debugLog('EmotionStore', 'Clearing all emotions');
      set((state) => {
        state.facialEmotion = null;
        state.textEmotion = null;
        state.combinedEmotion = 'neutral';
        state.lastUpdated = Date.now();
      });
    },

    getEmotionHistory: () => {
      return get().emotionHistory.slice(-10); // Return last 10 emotion states
    },

    reset: () => {
      set((state) => {
        state.facialEmotion = initialState.facialEmotion;
        state.textEmotion = initialState.textEmotion;
        state.combinedEmotion = initialState.combinedEmotion;
        state.lastUpdated = initialState.lastUpdated;
        state.emotionHistory = initialState.emotionHistory;
      });
    },
  }))
);
