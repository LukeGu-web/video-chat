import React, { createContext, useContext, ReactNode } from 'react';
import { useEmotionState, UseEmotionStateReturn } from '../utils/useEmotionState';
import { debugLog } from '../utils/debug';

interface EmotionProviderProps {
  children: ReactNode;
}

const EmotionContext = createContext<UseEmotionStateReturn | null>(null);

export const EmotionProvider: React.FC<EmotionProviderProps> = ({ children }) => {
  const emotionState = useEmotionState();

  React.useEffect(() => {
    debugLog('EmotionProvider', 'Emotion context initialized');
  }, []);

  return (
    <EmotionContext.Provider value={emotionState}>
      {children}
    </EmotionContext.Provider>
  );
};

export const useEmotionContext = (): UseEmotionStateReturn => {
  const context = useContext(EmotionContext);
  if (!context) {
    throw new Error('useEmotionContext must be used within an EmotionProvider');
  }
  return context;
};