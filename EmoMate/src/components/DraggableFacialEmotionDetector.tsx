import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useAnimatedGestureHandler,
  runOnJS,
} from 'react-native-reanimated';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { EmotionDetectorProps, EmotionType } from '../types/emotion';
import { isDebugMode, debugLog } from '../utils/debug';

const AnimatedView = Animated.createAnimatedComponent(View);

export const DraggableFacialEmotionDetector: React.FC<EmotionDetectorProps> = ({
  onEmotionDetected,
  isActive = true,
  detectionInterval = 1000
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const lastDetectionTime = useRef(0);

  // 拖拽相关状态
  const translateX = useSharedValue(20); // 初始位置：左上角
  const translateY = useSharedValue(80);
  const scale = useSharedValue(1);

  // 模拟情绪检测
  const handleEmotionSelection = useCallback((emotion: EmotionType) => {
    const now = Date.now();
    if (now - lastDetectionTime.current < detectionInterval) return;

    lastDetectionTime.current = now;
    setCurrentEmotion(emotion);
    
    debugLog('DraggableFacialEmotionDetector', `Emotion selected: ${emotion}`);
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

  // 拖拽手势处理
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startX = translateX.value;
      context.startY = translateY.value;
      scale.value = withSpring(0.95);
    },
    onActive: (event, context) => {
      translateX.value = (context.startX as number) + event.translationX;
      translateY.value = (context.startY as number) + event.translationY;
    },
    onEnd: () => {
      scale.value = withSpring(1);
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  useEffect(() => {
    debugLog('DraggableFacialEmotionDetector', `Detector ${isActive ? 'activated' : 'deactivated'}`);
  }, [isActive]);

  if (!permission) {
    return (
      <AnimatedView style={[styles.container, animatedStyle]}>
        <Text style={styles.statusText}>Loading camera...</Text>
      </AnimatedView>
    );
  }

  if (!permission.granted) {
    return (
      <AnimatedView style={[styles.container, animatedStyle]}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </AnimatedView>
    );
  }

  if (!isActive) {
    return (
      <AnimatedView style={[styles.container, animatedStyle]}>
        <View style={styles.inactiveIndicator}>
          <Text style={styles.inactiveText}>Camera Inactive</Text>
        </View>
      </AnimatedView>
    );
  }

  return (
    <PanGestureHandler onGestureEvent={gestureHandler} onHandlerStateChange={gestureHandler}>
      <AnimatedView style={[styles.container, animatedStyle]}>
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
            <Text style={styles.debugText}>X: {translateX.value.toFixed(0)}, Y: {translateY.value.toFixed(0)}</Text>
          </View>
        )}
      </AnimatedView>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 160,
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