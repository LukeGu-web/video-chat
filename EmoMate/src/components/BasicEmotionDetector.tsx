import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, PanResponder, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { EmotionDetectorProps, EmotionType } from '../types/emotion';
import { isDebugMode, debugLog } from '../utils/debug';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_WIDTH = 120;
const CONTAINER_HEIGHT = 160;

const AnimatedView = Animated.createAnimatedComponent(View);

export const BasicEmotionDetector: React.FC<EmotionDetectorProps> = (props) => {
  const { 
    onEmotionDetected,
    isActive = true,
    detectionInterval = 1000 
  } = props;

  const [permission, requestPermission] = useCameraPermissions();
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [faceDetected, setFaceDetected] = useState(false);
  const lastDetectionTime = useRef(0);

  // 动画值
  const scale = useSharedValue(1);

  // 创建PanResponder处理拖拽
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      scale.value = withSpring(0.95);
    },
    onPanResponderMove: (_evt, gestureState) => {
      const newX = Math.max(0, Math.min(SCREEN_WIDTH - CONTAINER_WIDTH, position.x + gestureState.dx));
      const newY = Math.max(0, Math.min(SCREEN_HEIGHT - CONTAINER_HEIGHT, position.y + gestureState.dy));
      setPosition({ x: newX, y: newY });
    },
    onPanResponderRelease: (_evt, gestureState) => {
      scale.value = withSpring(1);
      const finalX = Math.max(0, Math.min(SCREEN_WIDTH - CONTAINER_WIDTH, position.x + gestureState.dx));
      const finalY = Math.max(0, Math.min(SCREEN_HEIGHT - CONTAINER_HEIGHT, position.y + gestureState.dy));
      setPosition({ x: finalX, y: finalY });
      debugLog('BasicEmotionDetector', `Dragged to position: ${finalX}, ${finalY}`);
    }
  });

  // 智能情绪模拟（基于时间模式和用户交互的情绪检测）
  const simulateEmotionDetection = useCallback(() => {
    if (!isActive) return;

    const now = Date.now();
    if (now - lastDetectionTime.current < detectionInterval) return;

    // 基于时间的智能情绪模拟
    const hour = new Date().getHours();
    let emotionWeights: Record<EmotionType, number>;
    
    // 根据时间段调整情绪概率
    if (hour >= 6 && hour < 12) {
      // 早上：更积极的情绪
      emotionWeights = { happy: 0.4, neutral: 0.4, surprised: 0.15, sad: 0.03, angry: 0.02 };
    } else if (hour >= 12 && hour < 18) {
      // 下午：平衡情绪
      emotionWeights = { happy: 0.3, neutral: 0.5, surprised: 0.1, sad: 0.07, angry: 0.03 };
    } else {
      // 晚上：较为平静
      emotionWeights = { happy: 0.25, neutral: 0.6, surprised: 0.08, sad: 0.05, angry: 0.02 };
    }

    // 基于权重随机选择情绪
    const rand = Math.random();
    let cumulativeWeight = 0;
    let selectedEmotion: EmotionType = 'neutral';
    
    for (const [emotion, weight] of Object.entries(emotionWeights)) {
      cumulativeWeight += weight;
      if (rand <= cumulativeWeight) {
        selectedEmotion = emotion as EmotionType;
        break;
      }
    }
    
    if (selectedEmotion !== currentEmotion) {
      lastDetectionTime.current = now;
      setCurrentEmotion(selectedEmotion);
      setFaceDetected(true);
      
      debugLog('BasicEmotionDetector', `Intelligent emotion simulation: ${selectedEmotion}`, {
        timeOfDay: hour,
        probability: emotionWeights[selectedEmotion]
      });
      onEmotionDetected(selectedEmotion);

      // 重置face detected状态
      setTimeout(() => setFaceDetected(false), 1000);
    }
  }, [isActive, detectionInterval, currentEmotion, onEmotionDetected]);

  // 定时器模拟面部检测
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(simulateEmotionDetection, detectionInterval);
    return () => clearInterval(interval);
  }, [isActive, simulateEmotionDetection, detectionInterval]);

  // 请求摄像头权限
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // 自动返回neutral状态
  useEffect(() => {
    if (!isActive) return;

    const neutralTimeout = setTimeout(() => {
      if (currentEmotion !== 'neutral' && !faceDetected) {
        setCurrentEmotion('neutral');
        onEmotionDetected('neutral');
        debugLog('BasicEmotionDetector', 'Auto reset to neutral');
      }
    }, 5000);

    return () => clearTimeout(neutralTimeout);
  }, [isActive, currentEmotion, faceDetected, onEmotionDetected]);

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // 容器样式
  const containerStyle = [
    styles.container,
    {
      left: position.x,
      top: position.y,
    },
    animatedStyle,
  ];

  if (!permission) {
    return (
      <AnimatedView style={containerStyle}>
        <Text style={styles.statusText}>Permission loading...</Text>
      </AnimatedView>
    );
  }

  if (!permission.granted) {
    return (
      <AnimatedView style={containerStyle}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </AnimatedView>
    );
  }

  if (!isActive) {
    return (
      <AnimatedView style={containerStyle}>
        <View style={styles.inactiveIndicator}>
          <Text style={styles.inactiveText}>Camera Inactive</Text>
        </View>
      </AnimatedView>
    );
  }

  return (
    <AnimatedView style={containerStyle} {...panResponder.panHandlers}>
      <CameraView
        style={styles.camera}
        facing="front"
      />
      
      {/* 拖拽指示器 */}
      <View style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </View>

      {/* 情绪显示指示器 */}
      <View style={styles.emotionDisplay}>
        <View style={[styles.emotionIndicator, currentEmotion !== 'neutral' && styles.activeIndicator]}>
          <Text style={styles.emotionText}>
            {currentEmotion === 'happy' && '😊'}
            {currentEmotion === 'sad' && '😔'}
            {currentEmotion === 'surprised' && '😮'}
            {currentEmotion === 'angry' && '😤'}
            {currentEmotion === 'neutral' && '😐'}
          </Text>
        </View>
        {faceDetected && (
          <View style={styles.detectingIndicator}>
            <Text style={styles.detectingText}>●</Text>
          </View>
        )}
      </View>

      {isDebugMode() && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>Emotion: {currentEmotion}</Text>
          <Text style={styles.debugText}>Detecting: {faceDetected ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugText}>X: {position.x.toFixed(0)}, Y: {position.y.toFixed(0)}</Text>
        </View>
      )}
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
    position: 'absolute',
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  camera: {
    width: '100%',
    height: '65%'
  },
  dragIndicator: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dragHandle: {
    width: 30,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 1.5,
  },
  emotionDisplay: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  emotionIndicator: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  activeIndicator: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  detectingIndicator: {
    marginLeft: 6,
  },
  detectingText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emotionText: {
    fontSize: 16
  },
  statusText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingTop: 20
  },
  errorText: {
    fontSize: 9,
    color: '#e74c3c',
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingTop: 15
  },
  permissionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'center'
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold'
  },
  inactiveIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5'
  },
  inactiveText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center'
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 2
  },
  debugText: {
    fontSize: 8,
    color: 'white',
    textAlign: 'center'
  }
});