import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import HiyoriWebView, { type HiyoriBridge } from '../components/HiyoriWebView';

const HiyoriScreen: React.FC = () => {
  const hiyoriRef = useRef<any>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [lastMotion, setLastMotion] = useState<string>('');

  // Available motions for quick access
  const quickMotions = [
    { name: 'Wave', label: '👋 Wave', color: '#3B82F6' },
    { name: 'Happy', label: '😊 Happy', color: '#10B981' },
    { name: 'Speaking', label: '🗣️ Speaking', color: '#8B5CF6' },
    { name: 'Surprised', label: '😮 Surprised', color: '#F59E0B' },
    { name: 'Shy', label: '😳 Shy', color: '#EF4444' },
    { name: 'Dance', label: '💃 Dance', color: '#EC4899' },
  ];

  const emotionMotions = [
    { name: 'Laugh', label: '😄 Laugh', color: '#10B981' },
    { name: 'Thinking', label: '🤔 Thinking', color: '#6B7280' },
    { name: 'Excited', label: '🤩 Excited', color: '#F59E0B' },
    { name: 'Sleepy', label: '😴 Sleepy', color: '#8B5CF6' },
  ];

  const handleModelReady = () => {
    setIsModelReady(true);
    Alert.alert('Hiyori Ready!', 'The Live2D model is loaded and ready for interaction.');
    
    // Play welcome animation
    setTimeout(() => {
      playMotion('Wave');
    }, 500);
  };

  const handleMotionResult = (motion: string, success: boolean, error?: string) => {
    if (success) {
      setLastMotion(motion);
    } else {
      Alert.alert('Motion Error', `Failed to play ${motion}: ${error}`);
    }
  };

  const playMotion = (motionName: string) => {
    if (!isModelReady) {
      Alert.alert('Not Ready', 'Hiyori model is still loading. Please wait...');
      return;
    }

    hiyoriRef.current?.hiyoriBridge?.playMotion(motionName);
  };

  const playRandomMotion = () => {
    const allMotions = [...quickMotions, ...emotionMotions];
    const randomMotion = allMotions[Math.floor(Math.random() * allMotions.length)];
    playMotion(randomMotion.name);
  };

  const resetToIdle = () => {
    playMotion('Idle');
  };

  const checkAvailableMotions = () => {
    hiyoriRef.current?.hiyoriBridge?.getAvailableMotions();
  };

  const renderMotionButton = (motion: { name: string; label: string; color: string }) => (
    <TouchableOpacity
      key={motion.name}
      style={[styles.motionButton, { backgroundColor: motion.color }]}
      onPress={() => playMotion(motion.name)}
      disabled={!isModelReady}
    >
      <Text style={styles.motionButtonText}>{motion.label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Hiyori Live2D</Text>
        <Text style={styles.subtitle}>
          {isModelReady ? 'Ready for interaction' : 'Loading model...'}
        </Text>
      </View>

      {/* WebView Container */}
      <View style={styles.webviewContainer}>
        <HiyoriWebView
          ref={hiyoriRef}
          style={styles.webview}
          onModelReady={handleModelReady}
          onMotionResult={handleMotionResult}
        />
      </View>

      {/* Control Panel */}
      <ScrollView style={styles.controlPanel} showsVerticalScrollIndicator={false}>
        {/* Status */}
        {lastMotion ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>Last Motion: {lastMotion}</Text>
          </View>
        ) : null}

        {/* Quick Motions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.motionGrid}>
            {quickMotions.map(renderMotionButton)}
          </View>
        </View>

        {/* Emotion Motions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emotions</Text>
          <View style={styles.motionGrid}>
            {emotionMotions.map(renderMotionButton)}
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Controls</Text>
          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.controlButton, styles.primaryButton]}
              onPress={playRandomMotion}
              disabled={!isModelReady}
            >
              <Text style={styles.controlButtonText}>🎲 Random Motion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.secondaryButton]}
              onPress={resetToIdle}
              disabled={!isModelReady}
            >
              <Text style={styles.controlButtonText}>🔄 Reset to Idle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.infoButton]}
              onPress={checkAvailableMotions}
              disabled={!isModelReady}
            >
              <Text style={styles.controlButtonText}>📋 List Motions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  webviewContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  webview: {
    flex: 1,
  },
  controlPanel: {
    maxHeight: 280,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statusCard: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  statusText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  motionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  motionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  motionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  controlButtons: {
    gap: 8,
  },
  controlButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
  },
  secondaryButton: {
    backgroundColor: '#6B7280',
  },
  infoButton: {
    backgroundColor: '#10B981',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HiyoriScreen;