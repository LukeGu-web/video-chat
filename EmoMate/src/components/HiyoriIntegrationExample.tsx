import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import HiyoriWebView, { type HiyoriBridge } from './HiyoriWebView';

interface HiyoriIntegrationExampleProps {
  // Props for integrating with chat or other features
  currentEmotion?: string;
  isSpeaking?: boolean;
  autoReact?: boolean;
}

const HiyoriIntegrationExample: React.FC<HiyoriIntegrationExampleProps> = ({
  currentEmotion = 'neutral',
  isSpeaking = false,
  autoReact = true,
}) => {
  const hiyoriRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentMotion, setCurrentMotion] = useState<string>('Idle');

  // Emotion to motion mapping
  const emotionToMotion: Record<string, string> = {
    happy: 'Happy',
    sad: 'Sleepy',
    excited: 'Excited',
    surprised: 'Surprised',
    thinking: 'Thinking',
    speaking: 'Speaking',
    neutral: 'Idle',
  };

  // Auto-react to emotion changes
  useEffect(() => {
    if (autoReact && isReady && currentEmotion) {
      const motion = emotionToMotion[currentEmotion] || 'Idle';
      playMotion(motion);
    }
  }, [currentEmotion, autoReact, isReady]);

  // Auto-react to speaking state
  useEffect(() => {
    if (autoReact && isReady) {
      if (isSpeaking) {
        playMotion('Speaking');
      } else {
        // Return to emotion-based motion when done speaking
        const motion = emotionToMotion[currentEmotion] || 'Idle';
        setTimeout(() => playMotion(motion), 1000);
      }
    }
  }, [isSpeaking, autoReact, isReady, currentEmotion]);

  const handleModelReady = () => {
    setIsReady(true);
    console.log('Hiyori is ready for integration!');
    
    // Play initial motion
    setTimeout(() => {
      playMotion('Wave');
    }, 500);
  };

  const handleMotionResult = (motion: string, success: boolean, error?: string) => {
    if (success) {
      setCurrentMotion(motion);
    } else {
      console.warn(`Failed to play motion ${motion}:`, error);
    }
  };

  const playMotion = (motionName: string) => {
    hiyoriRef.current?.hiyoriBridge?.playMotion(motionName);
  };

  // Public API for other components to control Hiyori
  const hiyoriAPI = {
    playMotion,
    setEmotion: (emotion: string) => {
      const motion = emotionToMotion[emotion] || 'Idle';
      playMotion(motion);
    },
    startSpeaking: () => playMotion('Speaking'),
    stopSpeaking: () => {
      const motion = emotionToMotion[currentEmotion] || 'Idle';
      playMotion(motion);
    },
    wave: () => playMotion('Wave'),
    celebrate: () => playMotion('Dance'),
    isReady: () => isReady,
  };

  // Expose API via ref (if needed by parent components)
  React.useImperativeHandle(
    hiyoriRef,
    () => ({
      ...hiyoriRef.current,
      hiyoriAPI,
    }),
    [hiyoriAPI]
  );

  return (
    <View style={styles.container}>
      {/* Hiyori WebView */}
      <HiyoriWebView
        ref={hiyoriRef}
        style={styles.webview}
        onModelReady={handleModelReady}
        onMotionResult={handleMotionResult}
      />

      {/* Debug Info */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>Status: {isReady ? 'Ready' : 'Loading'}</Text>
          <Text style={styles.debugText}>Motion: {currentMotion}</Text>
          <Text style={styles.debugText}>Emotion: {currentEmotion}</Text>
          <Text style={styles.debugText}>Speaking: {isSpeaking ? 'Yes' : 'No'}</Text>
        </View>
      )}

      {/* Quick Test Controls (for development) */}
      {__DEV__ && isReady && (
        <View style={styles.testControls}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => hiyoriAPI.setEmotion('happy')}
          >
            <Text style={styles.testButtonText}>😊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => hiyoriAPI.startSpeaking()}
          >
            <Text style={styles.testButtonText}>🗣️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => hiyoriAPI.wave()}
          >
            <Text style={styles.testButtonText}>👋</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => hiyoriAPI.celebrate()}
          >
            <Text style={styles.testButtonText}>🎉</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  debugInfo: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  testControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    gap: 10,
  },
  testButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 18,
  },
});

export default HiyoriIntegrationExample;

// Export the API interface for TypeScript
export interface HiyoriAPI {
  playMotion: (motionName: string) => void;
  setEmotion: (emotion: string) => void;
  startSpeaking: () => void;
  stopSpeaking: () => void;
  wave: () => void;
  celebrate: () => void;
  isReady: () => boolean;
}