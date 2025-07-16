import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EmotionType } from '../types/emotion';
import { analyzeTextEmotion } from '../utils/emotionAnalysis';
import { isDebugMode, debugLog } from '../utils/debug';

interface ChatEmotionAnalyzerProps {
  text: string;
  onEmotion: (emotion: EmotionType) => void;
  enabled?: boolean;
  debounceMs?: number;
}

export const ChatEmotionAnalyzer: React.FC<ChatEmotionAnalyzerProps> = ({
  text,
  onEmotion,
  enabled = true,
  debounceMs = 500
}) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastAnalyzedText = useRef<string>('');

  useEffect(() => {
    if (!enabled || !text || text === lastAnalyzedText.current) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the analysis to avoid too frequent API calls
    timeoutRef.current = setTimeout(async () => {
      try {
        lastAnalyzedText.current = text;
        debugLog('ChatEmotionAnalyzer', 'Analyzing text emotion', { text });
        
        const emotion = await analyzeTextEmotion(text);
        
        debugLog('ChatEmotionAnalyzer', `Text emotion result: ${emotion}`, { text });
        onEmotion(emotion);
      } catch (error) {
        debugLog('ChatEmotionAnalyzer', 'Text emotion analysis error', error);
        // Fallback to neutral on error
        onEmotion('neutral');
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, enabled, debounceMs, onEmotion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isDebugMode()) {
    return null;
  }

  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Text Emotion Analysis</Text>
      <Text style={styles.debugText}>
        Status: {enabled ? 'Active' : 'Disabled'}
      </Text>
      <Text style={styles.debugText}>
        Last Text: {text.slice(0, 30)}{text.length > 30 ? '...' : ''}
      </Text>
      <Text style={styles.debugText}>
        Debounce: {debounceMs}ms
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  debugContainer: {
    position: 'absolute',
    bottom: 200,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 8,
    borderRadius: 4,
    minWidth: 200,
    zIndex: 1000
  },
  debugTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    marginBottom: 2
  }
});