import { useState, useCallback, useEffect } from 'react';
import { EmotionType, EmotionState } from '../types/emotion';
import { combineEmotions } from './emotionAnalysis';
import { debugLog } from './debug';

export interface UseEmotionStateReturn {
  facialEmotion: EmotionType | null;
  textEmotion: EmotionType | null;
  combinedEmotion: EmotionType;
  lastUpdated: number;
  setFacialEmotion: (emotion: EmotionType | null) => void;
  setTextEmotion: (emotion: EmotionType | null) => void;
  clearEmotions: () => void;
  getEmotionHistory: () => EmotionState[];
}

export const useEmotionState = (): UseEmotionStateReturn => {
  const [facialEmotion, setFacialEmotionState] = useState<EmotionType | null>(null);
  const [textEmotion, setTextEmotionState] = useState<EmotionType | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [emotionHistory, setEmotionHistory] = useState<EmotionState[]>([]);

  // Calculate combined emotion whenever facial or text emotion changes
  const combinedEmotion = combineEmotions(facialEmotion, textEmotion);

  const setFacialEmotion = useCallback((emotion: EmotionType | null) => {
    if (emotion !== facialEmotion) {
      debugLog('EmotionState', `Facial emotion changed: ${facialEmotion} -> ${emotion}`);
      setFacialEmotionState(emotion);
      setLastUpdated(Date.now());
    }
  }, [facialEmotion]);

  const setTextEmotion = useCallback((emotion: EmotionType | null) => {
    if (emotion !== textEmotion) {
      debugLog('EmotionState', `Text emotion changed: ${textEmotion} -> ${emotion}`);
      setTextEmotionState(emotion);
      setLastUpdated(Date.now());
    }
  }, [textEmotion]);

  const clearEmotions = useCallback(() => {
    debugLog('EmotionState', 'Clearing all emotions');
    setFacialEmotionState(null);
    setTextEmotionState(null);
    setLastUpdated(Date.now());
  }, []);

  const getEmotionHistory = useCallback(() => {
    return emotionHistory.slice(-10); // Return last 10 emotion states
  }, [emotionHistory]);

  // Update emotion history whenever combined emotion changes
  useEffect(() => {
    const newState: EmotionState = {
      facialEmotion,
      textEmotion,
      combinedEmotion,
      lastUpdated
    };

    setEmotionHistory(prev => {
      // Only add to history if combined emotion actually changed
      const lastState = prev[prev.length - 1];
      if (!lastState || lastState.combinedEmotion !== combinedEmotion) {
        debugLog('EmotionState', `Combined emotion changed: ${lastState?.combinedEmotion || 'none'} -> ${combinedEmotion}`, newState);
        return [...prev.slice(-9), newState]; // Keep last 10 states
      }
      return prev;
    });
  }, [facialEmotion, textEmotion, combinedEmotion, lastUpdated]);

  return {
    facialEmotion,
    textEmotion,
    combinedEmotion,
    lastUpdated,
    setFacialEmotion,
    setTextEmotion,
    clearEmotions,
    getEmotionHistory
  };
};