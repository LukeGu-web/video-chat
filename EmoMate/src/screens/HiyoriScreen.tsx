import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HiyoriWebView from '../components/HiyoriWebView';
import { debugLog, debugWarn } from '../utils/debug';

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
    // Alert.alert(
    //   'Hiyori Ready!',
    //   'The Live2D model is loaded and ready for interaction.'
    // );

    // Play welcome animation
    setTimeout(() => {
      playMotion('Wave');
    }, 500);
  };

  const handleMotionResult = (motion: string, success: boolean) => {
    if (success) {
      setLastMotion(motion);
    }
  };

  const playMotion = (motionName: string) => {
    debugLog('HiyoriScreen', `playMotion called with: "${motionName}"`);
    debugLog('HiyoriScreen', `isModelReady: ${isModelReady}`);
    debugLog('HiyoriScreen', `hiyoriRef.current:`, hiyoriRef.current);
    debugLog('HiyoriScreen', `hiyoriBridge:`, hiyoriRef.current?.hiyoriBridge);

    if (!isModelReady) {
      debugWarn('HiyoriScreen', `Model not ready, showing alert`);
      // Alert.alert('Not Ready', 'Hiyori model is still loading. Please wait...');
      return;
    }

    debugLog(
      'HiyoriScreen',
      `Calling hiyoriRef.current.hiyoriBridge.playMotion("${motionName}")`
    );
    hiyoriRef.current?.hiyoriBridge?.playMotion(motionName);
  };

  const playRandomMotion = () => {
    const allMotions = [...quickMotions, ...emotionMotions];
    const randomMotion =
      allMotions[Math.floor(Math.random() * allMotions.length)];
    playMotion(randomMotion.name);
  };

  const resetToIdle = () => {
    playMotion('Idle');
  };

  const checkAvailableMotions = () => {
    hiyoriRef.current?.hiyoriBridge?.getAvailableMotions();
  };

  const renderMotionButton = (motion: {
    name: string;
    label: string;
    color: string;
  }) => (
    <TouchableOpacity
      key={motion.name}
      className='px-3 py-2 rounded-[20px] mr-2 mb-2'
      style={{ backgroundColor: motion.color }}
      onPress={() => {
        console.log(`🎮 [HiyoriScreen] Button pressed: ${motion.name}`);
        playMotion(motion.name);
      }}
      disabled={!isModelReady}
    >
      <Text className='text-xs font-semibold text-white'>{motion.label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className='flex-1 bg-gray-50'>
      {/* Header */}
      <View className='p-4 bg-white border-b border-gray-200'>
        <Text className='text-2xl font-bold text-center text-gray-900'>
          Hiyori Live2D
        </Text>
        <Text className='mt-1 text-sm text-center text-gray-500'>
          {isModelReady ? 'Ready for interaction' : 'Loading model...'}
        </Text>
      </View>

      {/* WebView Container */}
      <View
        className='flex-1 m-4 overflow-hidden bg-white rounded-xl'
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <HiyoriWebView
          ref={hiyoriRef}
          style={{ flex: 1 }}
          onModelReady={handleModelReady}
          onMotionResult={handleMotionResult}
        />
      </View>

      {/* Control Panel */}
      <ScrollView
        className='max-h-[280px] bg-white rounded-t-[20px] px-4 pt-4'
        showsVerticalScrollIndicator={false}
      >
        {/* Status */}
        {lastMotion ? (
          <View className='p-3 mb-4 border-l-4 border-blue-500 rounded-lg bg-blue-50'>
            <Text className='text-sm font-medium text-blue-800'>
              Last Motion: {lastMotion}
            </Text>
          </View>
        ) : null}

        {/* Quick Motions */}
        <View className='mb-5'>
          <Text className='mb-3 text-base font-semibold text-gray-700'>
            Quick Actions
          </Text>
          <View className='flex-row flex-wrap gap-2'>
            {quickMotions.map(renderMotionButton)}
          </View>
        </View>

        {/* Emotion Motions */}
        <View className='mb-5'>
          <Text className='mb-3 text-base font-semibold text-gray-700'>
            Emotions
          </Text>
          <View className='flex-row flex-wrap gap-2'>
            {emotionMotions.map(renderMotionButton)}
          </View>
        </View>

        {/* Control Buttons */}
        <View className='mb-5'>
          <Text className='mb-3 text-base font-semibold text-gray-700'>
            Controls
          </Text>
          <View className='gap-2'>
            <TouchableOpacity
              className='items-center px-4 py-3 bg-purple-500 rounded-lg'
              onPress={playRandomMotion}
              disabled={!isModelReady}
            >
              <Text className='text-sm font-semibold text-white'>
                🎲 Random Motion
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className='items-center px-4 py-3 bg-gray-500 rounded-lg'
              onPress={resetToIdle}
              disabled={!isModelReady}
            >
              <Text className='text-sm font-semibold text-white'>
                🔄 Reset to Idle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className='items-center px-4 py-3 bg-green-500 rounded-lg'
              onPress={checkAvailableMotions}
              disabled={!isModelReady}
            >
              <Text className='text-sm font-semibold text-white'>
                📋 List Motions
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HiyoriScreen;
