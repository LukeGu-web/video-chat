import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, PanResponder, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
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

export const SimpleDraggableEmotionDetector: React.FC<EmotionDetectorProps> = ({
  onEmotionDetected,
  isActive = true,
  detectionInterval = 1000
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const lastDetectionTime = useRef(0);

  // 动画值
  const scale = useSharedValue(1);

  // 创建PanResponder处理拖拽
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      scale.value = withSpring(0.95);
    },
    onPanResponderMove: (evt, gestureState) => {
      // 限制拖拽范围在屏幕内
      const newX = Math.max(0, Math.min(SCREEN_WIDTH - CONTAINER_WIDTH, position.x + gestureState.dx));
      const newY = Math.max(0, Math.min(SCREEN_HEIGHT - CONTAINER_HEIGHT, position.y + gestureState.dy));
      
      setPosition({ x: newX, y: newY });
    },
    onPanResponderRelease: (evt, gestureState) => {
      scale.value = withSpring(1);
      
      // 最终位置限制
      const finalX = Math.max(0, Math.min(SCREEN_WIDTH - CONTAINER_WIDTH, position.x + gestureState.dx));
      const finalY = Math.max(0, Math.min(SCREEN_HEIGHT - CONTAINER_HEIGHT, position.y + gestureState.dy));
      
      setPosition({ x: finalX, y: finalY });
      
      debugLog('SimpleDraggableEmotionDetector', `Dragged to position: ${finalX}, ${finalY}`);
    }
  });

  // 模拟情绪检测
  const handleEmotionSelection = useCallback((emotion: EmotionType) => {
    const now = Date.now();
    if (now - lastDetectionTime.current < detectionInterval) return;

    lastDetectionTime.current = now;
    setCurrentEmotion(emotion);
    
    debugLog('SimpleDraggableEmotionDetector', `Emotion selected: ${emotion}`);
    onEmotionDetected(emotion);
  }, [detectionInterval, onEmotionDetected]);

  // 自动返回neutral状态
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      if (currentEmotion !== 'neutral') {
        setTimeout(() => {
          handleEmotionSelection('neutral');
        }, 5000);
      }
    }, detectionInterval);

    return () => clearInterval(interval);
  }, [isActive, detectionInterval, currentEmotion, handleEmotionSelection]);

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // 容器样式（包括位置）
  const containerStyle = [
    styles.container,
    {
      left: position.x,
      top: position.y,
    },
    animatedStyle,
  ];

  useEffect(() => {
    debugLog('SimpleDraggableEmotionDetector', `Detector ${isActive ? 'activated' : 'deactivated'}`);
  }, [isActive]);

  if (!permission) {
    return (
      <AnimatedView style={containerStyle}>
        <Text style={styles.statusText}>Loading camera...</Text>
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

      {/* 情绪控制按钮 */}
      <View style={styles.emotionControls}>
        <TouchableOpacity 
          style={[styles.emotionButton, currentEmotion === 'happy' && styles.activeButton]}
          onPress={() => handleEmotionSelection('happy')}
        >
          <Text style={styles.emotionText}>😊</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.emotionButton, currentEmotion === 'sad' && styles.activeButton]}
          onPress={() => handleEmotionSelection('sad')}
        >
          <Text style={styles.emotionText}>😢</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.emotionButton, currentEmotion === 'surprised' && styles.activeButton]}
          onPress={() => handleEmotionSelection('surprised')}
        >
          <Text style={styles.emotionText}>😲</Text>
        </TouchableOpacity>
      </View>

      {isDebugMode() && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>Emotion: {currentEmotion}</Text>
          <Text style={styles.debugText}>Draggable</Text>
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 1.5,
  },
  emotionControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  emotionButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  activeButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  emotionText: {
    fontSize: 14
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